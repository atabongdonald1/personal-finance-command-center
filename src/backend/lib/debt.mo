import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Common "../types/common";

/// The debt tracking domain: debts the owner is paying down and the payments
/// made against them.
///
/// Exposed as a mixin over the actor's stable state so the composition root can
/// `include DebtApi(accessControlState, debts, debtPayments, nextIds)`. Every
/// operation is scoped to the calling principal: a caller can only ever read or
/// modify its own debts and payments.
///
/// A payment reduces the debt's outstanding balance by the payment amount and
/// is recorded in its own collection, so available cash can reflect the debt
/// payments the owner has made.
mixin (
  accessControlState : AccessControl.AccessControlState,
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
  /// A debt together with its remaining balance, for listing.
  public type DebtWithBalance = {
    debt : Common.Debt;
    remaining : Common.Money;
  };

  /// The caller's debts with their remaining balances and the total owed.
  public type DebtSummary = {
    debts : [DebtWithBalance];
    totalOutstanding : Common.Money;
  };

  // --- Internal helpers ---------------------------------------------------

  /// Require a signed-in, registered caller. Anonymous principals are guests
  /// and are rejected.
  func debtRequireUser(caller : Principal) {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
  };

  /// The caller's own debt collection, created on first use.
  /// Only call this from update functions: a write inside a query is discarded.
  func callerDebts(caller : Principal) : Map.Map<Common.RecordId, Common.Debt> {
    switch (debts.get(caller)) {
      case (?owned) { owned };
      case null {
        let owned = Map.empty<Common.RecordId, Common.Debt>();
        debts.add(caller, owned);
        owned;
      };
    };
  };

  /// Read-only view of the caller's debts. Never mutates state, so it is safe
  /// to call from query functions.
  func callerDebtsReadOnly(caller : Principal) : Map.Map<Common.RecordId, Common.Debt> {
    switch (debts.get(caller)) {
      case (?owned) { owned };
      case null { Map.empty() };
    };
  };

  /// The caller's own payment collection, created on first use.
  func callerPayments(caller : Principal) : Map.Map<Common.RecordId, Common.DebtPayment> {
    switch (debtPayments.get(caller)) {
      case (?owned) { owned };
      case null {
        let owned = Map.empty<Common.RecordId, Common.DebtPayment>();
        debtPayments.add(caller, owned);
        owned;
      };
    };
  };

  /// Read-only view of the caller's payments.
  func callerPaymentsReadOnly(caller : Principal) : Map.Map<Common.RecordId, Common.DebtPayment> {
    switch (debtPayments.get(caller)) {
      case (?owned) { owned };
      case null { Map.empty() };
    };
  };

  /// The caller's id counters, created on first use.
  func debtCounters(caller : Principal) : {
    var entry : Common.RecordId;
    var budgetCategory : Common.RecordId;
    var project : Common.RecordId;
    var contribution : Common.RecordId;
    var projectExpense : Common.RecordId;
    var businessRecord : Common.RecordId;
    var debt : Common.RecordId;
    var debtPayment : Common.RecordId;
  } {
    switch (nextIds.get(caller)) {
      case (?counters) { counters };
      case null {
        let counters = {
          var entry = 0;
          var budgetCategory = 0;
          var project = 0;
          var contribution = 0;
          var projectExpense = 0;
          var businessRecord = 0;
          var debt = 0;
          var debtPayment = 0;
        };
        nextIds.add(caller, counters);
        counters;
      };
    };
  };

  /// Look up one of the caller's debts, or fail with `#notFound`.
  func requireDebt(caller : Principal, debtId : Common.RecordId) : Common.Debt {
    switch (callerDebtsReadOnly(caller).get(debtId)) {
      case (?debt) { debt };
      case null { Runtime.trap("Debt not found") };
    };
  };

  // --- Debt CRUD ----------------------------------------------------------

  /// Create a debt owned by the caller.
  public shared ({ caller }) func createDebt(
    name : Text,
    balance : Common.Money,
    interestRate : ?Float,
  ) : async Common.LedgerlyResult<Common.Debt> {
    debtRequireUser(caller);
    if (name == "") {
      return #err(#invalidInput("Debt name is required"));
    };
    if (balance < 0) {
      return #err(#invalidAmount("Outstanding balance cannot be negative"));
    };
    let counters = debtCounters(caller);
    let id = counters.debt;
    counters.debt := id + 1;
    let now = Time.now();
    let debt : Common.Debt = {
      id;
      owner = caller;
      name;
      balance;
      interestRate;
      createdAt = now;
      updatedAt = now;
    };
    callerDebts(caller).add(id, debt);
    #ok(debt);
  };

  /// Update one of the caller's debts. Another owner's id is reported as not
  /// found.
  public shared ({ caller }) func updateDebt(
    debtId : Common.RecordId,
    name : Text,
    balance : Common.Money,
    interestRate : ?Float,
  ) : async Common.LedgerlyResult<Common.Debt> {
    debtRequireUser(caller);
    if (name == "") {
      return #err(#invalidInput("Debt name is required"));
    };
    if (balance < 0) {
      return #err(#invalidAmount("Outstanding balance cannot be negative"));
    };
    let owned = callerDebts(caller);
    switch (owned.get(debtId)) {
      case null { #err(#notFound(debtId)) };
      case (?existing) {
        let updated : Common.Debt = {
          id = existing.id;
          owner = existing.owner;
          name;
          balance;
          interestRate;
          createdAt = existing.createdAt;
          updatedAt = Time.now();
        };
        owned.add(debtId, updated);
        #ok(updated);
      };
    };
  };

  /// Delete one of the caller's debts. Its recorded payments are removed with
  /// it. Another owner's id is reported as not found.
  public shared ({ caller }) func deleteDebt(
    debtId : Common.RecordId,
  ) : async Common.LedgerlyResult<()> {
    debtRequireUser(caller);
    let owned = callerDebts(caller);
    switch (owned.get(debtId)) {
      case null { #err(#notFound(debtId)) };
      case (?_) {
        owned.remove(debtId);
        let payments = callerPayments(caller);
        let snapshot = payments.entries().toArray();
        for ((paymentId, payment) in snapshot.values()) {
          if (payment.debtId == debtId) {
            payments.remove(paymentId);
          };
        };
        #ok(());
      };
    };
  };

  /// List the caller's debts with their remaining balances and the total
  /// outstanding debt.
  ///
  /// `debt.balance` is already the outstanding balance: `recordDebtPayment`
  /// reduces it by the payment amount when the payment is recorded. The
  /// remaining balance is therefore reported directly, without subtracting the
  /// recorded payments a second time.
  public query ({ caller }) func listDebts() : async DebtSummary {
    debtRequireUser(caller);
    let owned = callerDebtsReadOnly(caller);
    var total : Common.Money = 0;
    let rows = owned.values().map(
      func(debt) {
        let remaining = debt.balance;
        total += remaining;
        { debt; remaining };
      }
    ).toArray();
    {
      debts = rows;
      totalOutstanding = total;
    };
  };

  // --- Payments -----------------------------------------------------------

  /// Record a payment against one of the caller's debts. The debt's balance is
  /// reduced by the payment amount, and the payment is recorded so available
  /// cash reflects debt payments made. A payment larger than the outstanding
  /// balance is rejected with the shared invalid-amount error.
  public shared ({ caller }) func recordDebtPayment(
    debtId : Common.RecordId,
    amount : Common.Money,
    date : Common.Timestamp,
    note : Text,
  ) : async Common.LedgerlyResult<Common.DebtPayment> {
    debtRequireUser(caller);
    if (amount <= 0) {
      return #err(#invalidAmount("Payment amount must be positive"));
    };
    let owned = callerDebts(caller);
    switch (owned.get(debtId)) {
      case null { #err(#notFound(debtId)) };
      case (?debt) {
        if (amount > debt.balance) {
          return #err(#invalidAmount("Payment exceeds the outstanding balance"));
        };
        let counters = debtCounters(caller);
        let id = counters.debtPayment;
        counters.debtPayment := id + 1;
        let payment : Common.DebtPayment = {
          id;
          owner = caller;
          debtId;
          amount;
          date;
          note;
        };
        callerPayments(caller).add(id, payment);
        let updated : Common.Debt = {
          id = debt.id;
          owner = debt.owner;
          name = debt.name;
          balance = debt.balance - amount;
          interestRate = debt.interestRate;
          createdAt = debt.createdAt;
          updatedAt = Time.now();
        };
        owned.add(debtId, updated);
        #ok(payment);
      };
    };
  };

  /// List the caller's debt payments, optionally filtered to one debt.
  public query ({ caller }) func listDebtPayments(
    debtId : ?Common.RecordId,
  ) : async [Common.DebtPayment] {
    debtRequireUser(caller);
    let all = callerPaymentsReadOnly(caller).values().toArray();
    switch (debtId) {
      case (null) { all };
      case (?id) { all.filter(func(payment) = payment.debtId == id) };
    };
  };
};
