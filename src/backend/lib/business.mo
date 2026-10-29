import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";

/// Business finances domain logic.
///
/// Business revenue and costs are stored separately from personal entries and
/// are never merged with personal income or expenses. Every operation is scoped
/// to the calling principal: a caller only ever reads or writes their own
/// records, and record ids are allocated from a per-owner counter.
mixin (
  accessControlState : AccessControl.AccessControlState,
  businessRecords : Map.Map<Principal, Map.Map<Common.RecordId, Common.BusinessRecord>>,
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
  /// Require a signed-in, registered caller. Anonymous principals are guests
  /// and are rejected.
  func businessRequireUser(caller : Principal) {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
  };

  /// The caller's own business record collection, created on first use.
  /// Only call this from update functions: a write inside a query is discarded.
  func callerRecords(caller : Principal) : Map.Map<Common.RecordId, Common.BusinessRecord> {
    switch (businessRecords.get(caller)) {
      case (?records) { records };
      case null {
        let records = Map.empty<Common.RecordId, Common.BusinessRecord>();
        businessRecords.add(caller, records);
        records;
      };
    };
  };

  /// Read-only view of the caller's business records. Never mutates state, so
  /// it is safe to call from query functions.
  func callerRecordsReadOnly(caller : Principal) : Map.Map<Common.RecordId, Common.BusinessRecord> {
    switch (businessRecords.get(caller)) {
      case (?records) { records };
      case null { Map.empty() };
    };
  };

  /// The caller's id counters, created on first use.
  func callerCounters(caller : Principal) : {
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

  /// Record a business revenue or cost for the caller.
  public shared ({ caller }) func addBusinessRecord(
    kind : Common.BusinessKind,
    amount : Common.Money,
    date : Common.Timestamp,
    category : Text,
    note : Text,
  ) : async Common.LedgerlyResult<Common.BusinessRecord> {
    businessRequireUser(caller);
    if (amount <= 0) {
      return #err(#invalidAmount("Amount must be greater than zero"));
    };
    let counters = callerCounters(caller);
    let id = counters.businessRecord;
    counters.businessRecord := id + 1;
    let record : Common.BusinessRecord = {
      id;
      owner = caller;
      kind;
      amount;
      date;
      category;
      note;
    };
    callerRecords(caller).add(id, record);
    #ok(record);
  };

  /// Update one of the caller's business records. The record must belong to the
  /// caller; another owner's id is reported as not found.
  public shared ({ caller }) func updateBusinessRecord(
    id : Common.RecordId,
    kind : Common.BusinessKind,
    amount : Common.Money,
    date : Common.Timestamp,
    category : Text,
    note : Text,
  ) : async Common.LedgerlyResult<Common.BusinessRecord> {
    businessRequireUser(caller);
    if (amount <= 0) {
      return #err(#invalidAmount("Amount must be greater than zero"));
    };
    let records = callerRecords(caller);
    switch (records.get(id)) {
      case null { #err(#notFound(id)) };
      case (?_) {
        let updated : Common.BusinessRecord = {
          id;
          owner = caller;
          kind;
          amount;
          date;
          category;
          note;
        };
        records.add(id, updated);
        #ok(updated);
      };
    };
  };

  /// Delete one of the caller's business records.
  public shared ({ caller }) func deleteBusinessRecord(
    id : Common.RecordId,
  ) : async Common.LedgerlyResult<()> {
    businessRequireUser(caller);
    let records = callerRecords(caller);
    switch (records.get(id)) {
      case null { #err(#notFound(id)) };
      case (?_) {
        records.remove(id);
        #ok(());
      };
    };
  };

  /// List the caller's business records, optionally filtered to an inclusive
  /// date range. A `null` bound leaves that side unbounded.
  public query ({ caller }) func listBusinessRecords(
    from : ?Common.Timestamp,
    to : ?Common.Timestamp,
  ) : async [Common.BusinessRecord] {
    businessRequireUser(caller);
    let records = callerRecordsReadOnly(caller);
    let all = records.values().toArray();
    all.filter(
      func(record) {
        let afterFrom = switch (from) {
          case (?f) { record.date >= f };
          case null { true };
        };
        let beforeTo = switch (to) {
          case (?t) { record.date <= t };
          case null { true };
        };
        afterFrom and beforeTo;
      }
    );
  };

  /// Compute the caller's business summary from business records only.
  ///
  /// `revenue` is the sum of revenue records, `costs` the sum of cost records,
  /// `profit` is revenue minus costs, and `cashFlow` is the same net movement
  /// of business money. Personal income and expenses are never included.
  public query ({ caller }) func getBusinessSummary(
    from : ?Common.Timestamp,
    to : ?Common.Timestamp,
  ) : async Common.BusinessSummary {
    businessRequireUser(caller);
    let records = callerRecordsReadOnly(caller);
    var revenue : Common.Money = 0;
    var costs : Common.Money = 0;
    for (record in records.values()) {
      let inRange = switch (from, to) {
        case (?f, ?t) { record.date >= f and record.date <= t };
        case (?f, null) { record.date >= f };
        case (null, ?t) { record.date <= t };
        case (null, null) { true };
      };
      if (inRange) {
        switch (record.kind) {
          case (#revenue) { revenue += record.amount };
          case (#cost) { costs += record.amount };
        };
      };
    };
    let profit = revenue - costs;
    {
      revenue;
      costs;
      profit;
      cashFlow = profit;
    };
  };
};
