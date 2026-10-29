import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Common "../types/common";

/// Income and expense domain.
///
/// Exposed as a mixin over the actor's stable state so the composition root can
/// `include EntriesApi(entries, nextIds)`. Every operation is scoped to the
/// calling principal: a caller can only ever read or modify its own entries.
mixin (
  entries : Map.Map<Principal, Map.Map<Common.RecordId, Common.FinancialEntry>>,
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
  /// Optional filters for listing the caller's entries.
  public type EntryFilter = {
    from : ?Common.Timestamp;
    to : ?Common.Timestamp;
    kind : ?Common.EntryKind;
    category : ?Text;
  };

  // --- Per-owner state accessors ---

  func ownerEntries(owner : Principal) : Map.Map<Common.RecordId, Common.FinancialEntry> {
    switch (entries.get(owner)) {
      case (?owned) { owned };
      case null {
        let owned = Map.empty<Common.RecordId, Common.FinancialEntry>();
        entries.add(owner, owned);
        owned;
      };
    };
  };

  func ownerIds(owner : Principal) : {
    var entry : Common.RecordId;
    var budgetCategory : Common.RecordId;
    var project : Common.RecordId;
    var contribution : Common.RecordId;
    var projectExpense : Common.RecordId;
    var businessRecord : Common.RecordId;
    var debt : Common.RecordId;
    var debtPayment : Common.RecordId;
  } {
    switch (nextIds.get(owner)) {
      case (?ids) { ids };
      case null {
        let ids = {
          var entry = 0;
          var budgetCategory = 0;
          var project = 0;
          var contribution = 0;
          var projectExpense = 0;
          var businessRecord = 0;
          var debt = 0;
          var debtPayment = 0;
        };
        nextIds.add(owner, ids);
        ids;
      };
    };
  };

  // --- Validation ---

  func validate(amount : Common.Money, category : Text) : ?Common.LedgerlyError {
    if (amount <= 0) {
      return ?#invalidAmount("amount must be positive");
    };
    if (category.size() == 0) {
      return ?#invalidInput("category is required");
    };
    null;
  };

  // --- API ---

  /// Create an income or expense entry for the caller.
  public shared ({ caller }) func createEntry(
    kind : Common.EntryKind,
    amount : Common.Money,
    date : Common.Timestamp,
    category : Text,
    note : Text,
  ) : async Common.LedgerlyResult<Common.FinancialEntry> {
    switch (validate(amount, category)) {
      case (?err) { return #err(err) };
      case null {};
    };
    let owned = ownerEntries(caller);
    let ids = ownerIds(caller);
    let id = ids.entry;
    ids.entry := id + 1;
    let now = Time.now();
    let entry : Common.FinancialEntry = {
      id;
      owner = caller;
      kind;
      amount;
      date;
      category;
      note;
      createdAt = now;
      updatedAt = now;
    };
    owned.add(id, entry);
    #ok(entry);
  };

  /// Update one of the caller's entries. Fails with `#notFound` when the id is
  /// not owned by the caller.
  public shared ({ caller }) func updateEntry(
    id : Common.RecordId,
    kind : Common.EntryKind,
    amount : Common.Money,
    date : Common.Timestamp,
    category : Text,
    note : Text,
  ) : async Common.LedgerlyResult<Common.FinancialEntry> {
    switch (validate(amount, category)) {
      case (?err) { return #err(err) };
      case null {};
    };
    let owned = ownerEntries(caller);
    switch (owned.get(id)) {
      case null { #err(#notFound(id)) };
      case (?existing) {
        let updated : Common.FinancialEntry = {
          existing with
          kind;
          amount;
          date;
          category;
          note;
          updatedAt = Time.now();
        };
        owned.add(id, updated);
        #ok(updated);
      };
    };
  };

  /// Delete one of the caller's entries. Fails with `#notFound` when the id is
  /// not owned by the caller.
  public shared ({ caller }) func deleteEntry(id : Common.RecordId) : async Common.LedgerlyResult<()> {
    let owned = ownerEntries(caller);
    switch (owned.get(id)) {
      case null { #err(#notFound(id)) };
      case (?_) {
        owned.remove(id);
        #ok(());
      };
    };
  };

  /// List the caller's entries, most recent first, with optional filters.
  public query ({ caller }) func listEntries(filter : EntryFilter) : async [Common.FinancialEntry] {
    let owned = ownerEntries(caller);
    let matched = owned.values().filter(func(entry) {
      let afterFrom = switch (filter.from) {
        case (?from) { entry.date >= from };
        case null { true };
      };
      let beforeTo = switch (filter.to) {
        case (?to) { entry.date <= to };
        case null { true };
      };
      let kindOk = switch (filter.kind) {
        case (?kind) { entry.kind == kind };
        case null { true };
      };
      let categoryOk = switch (filter.category) {
        case (?category) { entry.category == category };
        case null { true };
      };
      afterFrom and beforeTo and kindOk and categoryOk;
    }).toArray();
    matched.sort(func(a, b) {
      if (a.date > b.date) { #less } else if (a.date < b.date) {
        #greater;
      } else if (a.id > b.id) { #less } else if (a.id < b.id) {
        #greater;
      } else { #equal };
    });
  };
};
