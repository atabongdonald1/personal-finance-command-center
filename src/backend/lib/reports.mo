import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Common "../types/common";

/// Reporting, spending alerts and backup/restore for the caller's own records.
///
/// Every operation is scoped to the calling principal: reports and alerts are
/// computed strictly from the caller's recorded entries, and export/restore
/// only ever touch the caller's own collections. Personal reports aggregate
/// `entries` only, so project expenses and business records are never
/// double-counted here.
mixin (
  accessControlState : AccessControl.AccessControlState,
  entries : Map.Map<Principal, Map.Map<Common.RecordId, Common.FinancialEntry>>,
  budgetCategories : Map.Map<Principal, Map.Map<Common.RecordId, Common.BudgetCategory>>,
  budgetSettings : Map.Map<Principal, Common.BudgetSettings>,
  projects : Map.Map<Principal, Map.Map<Common.RecordId, Common.Project>>,
  contributions : Map.Map<Principal, Map.Map<Common.RecordId, Common.ProjectContribution>>,
  projectExpenses : Map.Map<Principal, Map.Map<Common.RecordId, Common.ProjectExpense>>,
  businessRecords : Map.Map<Principal, Map.Map<Common.RecordId, Common.BusinessRecord>>,
  debts : Map.Map<Principal, Map.Map<Common.RecordId, Common.Debt>>,
  debtPayments : Map.Map<Principal, Map.Map<Common.RecordId, Common.DebtPayment>>,
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
  /// Per-owner id counters, structurally identical to the record declared in
  /// `main.mo`. Kept here so restore can advance counters past restored ids.
  type ReportsNextIds = {
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

  func reportsRequireUser(caller : Principal) {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can access financial reports");
    };
  };

  /// Format a minor-unit money amount as a major-unit decimal string.
  func formatMoney(m : Common.Money) : Text {
    let negative = m < 0;
    let magnitude = if (negative) { -m } else { m };
    let whole = magnitude / 100;
    let cents = magnitude % 100;
    let centsText = if (cents < 10) { "0" # cents.toText() } else { cents.toText() };
    (if (negative) { "-" } else { "" }) # whole.toText() # "." # centsText;
  };

  /// Sum the caller's entries within [from, to], returning income, expenses and
  /// per-category expense totals. Figures come straight from the stored records
  /// so they reconcile exactly with the underlying entries.
  func aggregate(
    owner : Principal,
    from : Common.Timestamp,
    to : Common.Timestamp,
  ) : (Common.Money, Common.Money, Map.Map<Text, Common.Money>) {
    var income : Common.Money = 0;
    var expenses : Common.Money = 0;
    let byCategory = Map.empty<Text, Common.Money>();
    switch (entries.get(owner)) {
      case (?owned) {
        for (entry in owned.values()) {
          if (entry.date >= from and entry.date <= to) {
            switch (entry.kind) {
              case (#income) { income += entry.amount };
              case (#expense) {
                expenses += entry.amount;
                let previous = byCategory.get(entry.category) ?? 0;
                byCategory.add(entry.category, previous + entry.amount);
              };
            };
          };
        };
      };
      case null {};
    };
    (income, expenses, byCategory);
  };

  // --- Public API -----------------------------------------------------------

  /// A reconciled report for the caller over the requested window. `period` is
  /// the reporting label; `from`/`to` are inclusive nanosecond bounds.
  public query ({ caller }) func getFinancialReport(
    period : Common.BudgetPeriod,
    from : Common.Timestamp,
    to : Common.Timestamp,
  ) : async Common.FinancialReport {
    reportsRequireUser(caller);
    let (income, expenses, byCategory) = aggregate(caller, from, to);
    {
      period;
      from;
      to;
      income;
      expenses;
      net = income - expenses;
      byCategory = byCategory.entries().toArray();
    };
  };

  /// Spending alerts derived from the caller's actual recorded data: one alert
  /// per budget category whose spending approaches or exceeds its allocation,
  /// plus an alert when total spending approaches or exceeds expected income.
  public query ({ caller }) func getSpendingAlerts(
    from : Common.Timestamp,
    to : Common.Timestamp,
  ) : async [Common.SpendingAlert] {
    reportsRequireUser(caller);
    let (_, totalExpenses, byCategory) = aggregate(caller, from, to);
    let alerts = List.empty<Common.SpendingAlert>();

    switch (budgetCategories.get(caller)) {
      case (?owned) {
        for (category in owned.values()) {
          let allocated = category.allocated;
          if (allocated > 0) {
            let spent = byCategory.get(category.name) ?? 0;
            if (spent >= allocated) {
              alerts.add({
                category = category.name;
                spent;
                allocated;
                severity = #critical;
                message = category.name # ": spent " # formatMoney(spent) # " of " # formatMoney(allocated) # " allocated";
              });
            } else if (spent * 100 >= allocated * 80) {
              alerts.add({
                category = category.name;
                spent;
                allocated;
                severity = #warning;
                message = category.name # ": spent " # formatMoney(spent) # " of " # formatMoney(allocated) # " allocated";
              });
            } else if (spent * 100 >= allocated * 50) {
              alerts.add({
                category = category.name;
                spent;
                allocated;
                severity = #info;
                message = category.name # ": spent " # formatMoney(spent) # " of " # formatMoney(allocated) # " allocated";
              });
            };
          };
        };
      };
      case null {};
    };

    switch (budgetSettings.get(caller)) {
      case (?settings) {
        let expected = settings.expectedIncome;
        if (expected > 0) {
          if (totalExpenses >= expected) {
            alerts.add({
              category = "Total";
              spent = totalExpenses;
              allocated = expected;
              severity = #critical;
              message = "Total spending " # formatMoney(totalExpenses) # " exceeds expected income " # formatMoney(expected);
            });
          } else if (totalExpenses * 100 >= expected * 80) {
            alerts.add({
              category = "Total";
              spent = totalExpenses;
              allocated = expected;
              severity = #warning;
              message = "Total spending " # formatMoney(totalExpenses) # " is approaching expected income " # formatMoney(expected);
            });
          };
        };
      };
      case null {};
    };

    alerts.toArray();
  };

  /// Export the caller's records as a portable snapshot. The snapshot contains
  /// only the caller's own data.
  public query ({ caller }) func exportBackup() : async Common.BackupData {
    reportsRequireUser(caller);
    {
      entries = switch (entries.get(caller)) {
        case (?owned) owned.values().toArray();
        case null [];
      };
      budgetCategories = switch (budgetCategories.get(caller)) {
        case (?owned) owned.values().toArray();
        case null [];
      };
      budgetSettings = budgetSettings.get(caller);
      projects = switch (projects.get(caller)) {
        case (?owned) owned.values().toArray();
        case null [];
      };
      contributions = switch (contributions.get(caller)) {
        case (?owned) owned.values().toArray();
        case null [];
      };
      projectExpenses = switch (projectExpenses.get(caller)) {
        case (?owned) owned.values().toArray();
        case null [];
      };
      businessRecords = switch (businessRecords.get(caller)) {
        case (?owned) owned.values().toArray();
        case null [];
      };
      debts = switch (debts.get(caller)) {
        case (?owned) owned.values().toArray();
        case null [];
      };
      debtPayments = switch (debtPayments.get(caller)) {
        case (?owned) owned.values().toArray();
        case null [];
      };
      exportedAt = Time.now();
    };
  };

  /// Restore the caller's records from a snapshot, replacing the caller's
  /// existing collections. Every restored record is owned by the caller, and id
  /// counters advance past the restored ids so new records never collide.
  public shared ({ caller }) func restoreBackup(data : Common.BackupData) : async Common.LedgerlyResult<()> {
    reportsRequireUser(caller);

    let counters = switch (nextIds.get(caller)) {
      case (?existing) existing;
      case null {
        let created : ReportsNextIds = {
          var entry = 0;
          var budgetCategory = 0;
          var project = 0;
          var contribution = 0;
          var projectExpense = 0;
          var businessRecord = 0;
          var debt = 0;
          var debtPayment = 0;
        };
        nextIds.add(caller, created);
        created;
      };
    };

    let restoredEntries = Map.empty<Common.RecordId, Common.FinancialEntry>();
    for (entry in data.entries.values()) {
      let record = { entry with owner = caller };
      restoredEntries.add(record.id, record);
      if (record.id + 1 > counters.entry) { counters.entry := record.id + 1 };
    };
    entries.add(caller, restoredEntries);

    let restoredCategories = Map.empty<Common.RecordId, Common.BudgetCategory>();
    for (category in data.budgetCategories.values()) {
      let record = { category with owner = caller };
      restoredCategories.add(record.id, record);
      if (record.id + 1 > counters.budgetCategory) { counters.budgetCategory := record.id + 1 };
    };
    budgetCategories.add(caller, restoredCategories);

    switch (data.budgetSettings) {
      case (?settings) { budgetSettings.add(caller, { settings with owner = caller }) };
      case null { budgetSettings.remove(caller) };
    };

    let restoredProjects = Map.empty<Common.RecordId, Common.Project>();
    for (project in data.projects.values()) {
      let record = { project with owner = caller };
      restoredProjects.add(record.id, record);
      if (record.id + 1 > counters.project) { counters.project := record.id + 1 };
    };
    projects.add(caller, restoredProjects);

    let restoredContributions = Map.empty<Common.RecordId, Common.ProjectContribution>();
    for (contribution in data.contributions.values()) {
      let record = { contribution with owner = caller };
      restoredContributions.add(record.id, record);
      if (record.id + 1 > counters.contribution) { counters.contribution := record.id + 1 };
    };
    contributions.add(caller, restoredContributions);

    let restoredProjectExpenses = Map.empty<Common.RecordId, Common.ProjectExpense>();
    for (expense in data.projectExpenses.values()) {
      let record = { expense with owner = caller };
      restoredProjectExpenses.add(record.id, record);
      if (record.id + 1 > counters.projectExpense) { counters.projectExpense := record.id + 1 };
    };
    projectExpenses.add(caller, restoredProjectExpenses);

    let restoredBusiness = Map.empty<Common.RecordId, Common.BusinessRecord>();
    for (business in data.businessRecords.values()) {
      let record = { business with owner = caller };
      restoredBusiness.add(record.id, record);
      if (record.id + 1 > counters.businessRecord) { counters.businessRecord := record.id + 1 };
    };
    businessRecords.add(caller, restoredBusiness);

    let restoredDebts = Map.empty<Common.RecordId, Common.Debt>();
    for (debt in data.debts.values()) {
      let record = { debt with owner = caller };
      restoredDebts.add(record.id, record);
      if (record.id + 1 > counters.debt) { counters.debt := record.id + 1 };
    };
    debts.add(caller, restoredDebts);

    let restoredPayments = Map.empty<Common.RecordId, Common.DebtPayment>();
    for (payment in data.debtPayments.values()) {
      let record = { payment with owner = caller };
      restoredPayments.add(record.id, record);
      if (record.id + 1 > counters.debtPayment) { counters.debtPayment := record.id + 1 };
    };
    debtPayments.add(caller, restoredPayments);

    #ok(());
  };
};
