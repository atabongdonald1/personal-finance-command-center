import AccessControl "mo:caffeineai-authorization/access-control";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Common "../types/common";

/// Budget allocation engine.
///
/// Owns the caller's expected income budget, its reporting period, and the named
/// budget categories that each take a percentage of that expected income. Every
/// operation is scoped to the calling principal: a caller only ever reads or
/// writes its own settings and categories.
///
/// Allocations are derived from the current expected income, so changing a
/// category percentage (or the expected income itself) recalculates the affected
/// allocated amounts. A change that would push the total allocation past 100
/// percent of expected income is rejected with the shared over-allocation error.
mixin (
  accessControlState : AccessControl.AccessControlState,
  budgetCategories : Map.Map<Principal, Map.Map<Common.RecordId, Common.BudgetCategory>>,
  budgetSettings : Map.Map<Principal, Common.BudgetSettings>,
  nextIds : Map.Map<Principal, {
    var entry : Common.RecordId;
    var budgetCategory : Common.RecordId;
    var project : Common.RecordId;
    var contribution : Common.RecordId;
    var projectExpense : Common.RecordId;
    var businessRecord : Common.RecordId;
    var debt : Common.RecordId;
    var debtPayment : Common.RecordId;
  }>,
) {
  /// Per-owner id counters, mirroring the inline record in the parameter list.
  type NextIds = {
    var entry : Common.RecordId;
    var budgetCategory : Common.RecordId;
    var project : Common.RecordId;
    var contribution : Common.RecordId;
    var projectExpense : Common.RecordId;
    var businessRecord : Common.RecordId;
    var debt : Common.RecordId;
    var debtPayment : Common.RecordId;
  };

  // --- Internal helpers -----------------------------------------------------

  func guardUser(caller : Principal) {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
  };

  /// The caller's category map, created on first use.
  func callerCategories(owner : Principal) : Map.Map<Common.RecordId, Common.BudgetCategory> {
    switch (budgetCategories.get(owner)) {
      case (?m) { m };
      case null {
        let m = Map.empty<Common.RecordId, Common.BudgetCategory>();
        budgetCategories.add(owner, m);
        m;
      };
    };
  };

  /// The caller's id counters, created on first use.
  func budgetCounters(owner : Principal) : NextIds {
    switch (nextIds.get(owner)) {
      case (?n) { n };
      case null {
        let n : NextIds = {
          var entry = 0;
          var budgetCategory = 0;
          var project = 0;
          var contribution = 0;
          var projectExpense = 0;
          var businessRecord = 0;
          var debt = 0;
          var debtPayment = 0;
        };
        nextIds.add(owner, n);
        n;
      };
    };
  };

  /// The caller's configured expected income, or 0 when no budget is set.
  func expectedIncomeOf(owner : Principal) : Common.Money {
    switch (budgetSettings.get(owner)) {
      case (?s) { s.expectedIncome };
      case null { 0 };
    };
  };

  /// Allocated amount for a percentage of expected income, in minor units.
  func allocate(expectedIncome : Common.Money, percentage : Nat) : Common.Money {
    expectedIncome * percentage.toInt() / 100;
  };

  /// Sum of percentages and allocated amounts across a category map.
  func totals(
    cats : Map.Map<Common.RecordId, Common.BudgetCategory>,
    expectedIncome : Common.Money,
  ) : (Nat, Common.Money) {
    var pct = 0;
    var alloc : Common.Money = 0;
    for ((_, c) in cats.entries()) {
      pct += c.percentage;
      alloc += allocate(expectedIncome, c.percentage);
    };
    (pct, alloc);
  };

  /// Sum of percentages and allocated amounts, optionally excluding one category.
  func totalsExcluding(
    cats : Map.Map<Common.RecordId, Common.BudgetCategory>,
    expectedIncome : Common.Money,
    excludeId : ?Common.RecordId,
  ) : (Nat, Common.Money) {
    var pct = 0;
    var alloc : Common.Money = 0;
    for ((id, c) in cats.entries()) {
      let skip = switch (excludeId) {
        case (?e) { id == e };
        case null { false };
      };
      if (not skip) {
        pct += c.percentage;
        alloc += allocate(expectedIncome, c.percentage);
      };
    };
    (pct, alloc);
  };

  /// Rebuild a category map with allocations recomputed from expected income.
  func recalc(
    cats : Map.Map<Common.RecordId, Common.BudgetCategory>,
    expectedIncome : Common.Money,
  ) : Map.Map<Common.RecordId, Common.BudgetCategory> {
    let out = Map.empty<Common.RecordId, Common.BudgetCategory>();
    for ((id, c) in cats.entries()) {
      out.add(id, { c with allocated = allocate(expectedIncome, c.percentage) });
    };
    out;
  };

  // --- Public API -----------------------------------------------------------

  /// Set the caller's expected income budget and reporting period. Recalculates
  /// every category allocation from the new expected income. Rejected when the
  /// existing categories would over-allocate the new income.
  public shared ({ caller }) func setBudgetSettings(
    expectedIncome : Common.Money,
    period : Common.BudgetPeriod,
  ) : async Common.LedgerlyResult<Common.BudgetSettings> {
    guardUser(caller);
    if (expectedIncome < 0) {
      return #err(#invalidAmount("Expected income cannot be negative"));
    };
    let cats = callerCategories(caller);
    let (pct, alloc) = totals(cats, expectedIncome);
    if (pct > 100 or alloc > expectedIncome) {
      return #err(#overAllocated({ allocated = alloc; expectedIncome }));
    };
    let settings : Common.BudgetSettings = {
      owner = caller;
      expectedIncome;
      period;
      updatedAt = Time.now();
    };
    budgetSettings.add(caller, settings);
    budgetCategories.add(caller, recalc(cats, expectedIncome));
    #ok(settings);
  };

  /// The caller's budget settings, or null when none are configured.
  public query ({ caller }) func getBudgetSettings() : async ?Common.BudgetSettings {
    guardUser(caller);
    budgetSettings.get(caller);
  };

  /// Create a named budget category taking `percentage` of expected income.
  public shared ({ caller }) func createBudgetCategory(
    name : Text,
    percentage : Nat,
  ) : async Common.LedgerlyResult<Common.BudgetCategory> {
    guardUser(caller);
    if (percentage > 100) {
      return #err(#invalidPercentage("Percentage must be between 0 and 100"));
    };
    let income = expectedIncomeOf(caller);
    let cats = callerCategories(caller);
    let (basePct, baseAlloc) = totalsExcluding(cats, income, null);
    let totalPct = basePct + percentage;
    let totalAlloc = baseAlloc + allocate(income, percentage);
    if (totalPct > 100 or totalAlloc > income) {
      return #err(#overAllocated({ allocated = totalAlloc; expectedIncome = income }));
    };
    let counters = budgetCounters(caller);
    let id = counters.budgetCategory;
    counters.budgetCategory := id + 1;
    let cat : Common.BudgetCategory = {
      id;
      owner = caller;
      name;
      percentage;
      allocated = allocate(income, percentage);
    };
    cats.add(id, cat);
    #ok(cat);
  };

  /// Update a category's name and percentage. Changing the percentage
  /// recalculates that category's allocated amount from current expected income.
  public shared ({ caller }) func updateBudgetCategory(
    id : Common.RecordId,
    name : Text,
    percentage : Nat,
  ) : async Common.LedgerlyResult<Common.BudgetCategory> {
    guardUser(caller);
    if (percentage > 100) {
      return #err(#invalidPercentage("Percentage must be between 0 and 100"));
    };
    let cats = callerCategories(caller);
    let existing = switch (cats.get(id)) {
      case (?c) { c };
      case null { return #err(#notFound(id)) };
    };
    let income = expectedIncomeOf(caller);
    let (basePct, baseAlloc) = totalsExcluding(cats, income, ?id);
    let totalPct = basePct + percentage;
    let totalAlloc = baseAlloc + allocate(income, percentage);
    if (totalPct > 100 or totalAlloc > income) {
      return #err(#overAllocated({ allocated = totalAlloc; expectedIncome = income }));
    };
    let updated : Common.BudgetCategory = {
      existing with
      name;
      percentage;
      allocated = allocate(income, percentage);
    };
    cats.add(id, updated);
    #ok(updated);
  };

  /// Delete one of the caller's budget categories.
  public shared ({ caller }) func deleteBudgetCategory(
    id : Common.RecordId,
  ) : async Common.LedgerlyResult<()> {
    guardUser(caller);
    let cats = callerCategories(caller);
    if (not cats.containsKey(id)) {
      return #err(#notFound(id));
    };
    cats.remove(id);
    #ok(());
  };

  /// The caller's categories with allocated amounts derived from current
  /// expected income.
  public query ({ caller }) func listBudgetCategories() : async [Common.BudgetCategory] {
    guardUser(caller);
    let income = expectedIncomeOf(caller);
    let out = List.empty<Common.BudgetCategory>();
    switch (budgetCategories.get(caller)) {
      case (?cats) {
        for ((_, c) in cats.entries()) {
          out.add({ c with allocated = allocate(income, c.percentage) });
        };
      };
      case null {};
    };
    out.toArray();
  };
};
