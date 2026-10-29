import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Common "../types/common";

/// The projects domain: funding projects, their contributions and their
/// expenses. Every collection is keyed by owner principal, so a caller can
/// only ever read or write their own records.
///
/// Project expenses live in their own collection and are never written into
/// the personal entry collection or the business record collection, so they
/// cannot be double-counted in personal or business reports.
mixin (
  accessControlState : AccessControl.AccessControlState,
  projects : Map.Map<Principal, Map.Map<Common.RecordId, Common.Project>>,
  contributions : Map.Map<Principal, Map.Map<Common.RecordId, Common.ProjectContribution>>,
  projectExpenses : Map.Map<Principal, Map.Map<Common.RecordId, Common.ProjectExpense>>,
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
  // --- Internal helpers ---------------------------------------------------

  /// Reject anonymous callers and callers that never registered through the
  /// app's frontend. Traps with the authorization package's own message.
  func requireCaller(caller : Principal) {
    if (caller.isAnonymous()) {
      Runtime.trap("User is not registered");
    };
    ignore AccessControl.getUserRole(accessControlState, caller);
  };

  /// The per-owner id counters, created on first use.
  func countersFor(owner : Principal) : {
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
      case (?counters) { counters };
      case (null) {
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
        nextIds.add(owner, counters);
        counters;
      };
    };
  };

  /// The owner's project collection, created on first use.
  func projectsFor(owner : Principal) : Map.Map<Common.RecordId, Common.Project> {
    switch (projects.get(owner)) {
      case (?owned) { owned };
      case (null) {
        let owned = Map.empty<Common.RecordId, Common.Project>();
        projects.add(owner, owned);
        owned;
      };
    };
  };

  /// The owner's contribution collection, created on first use.
  func contributionsFor(owner : Principal) : Map.Map<Common.RecordId, Common.ProjectContribution> {
    switch (contributions.get(owner)) {
      case (?owned) { owned };
      case (null) {
        let owned = Map.empty<Common.RecordId, Common.ProjectContribution>();
        contributions.add(owner, owned);
        owned;
      };
    };
  };

  /// The owner's project-expense collection, created on first use.
  func projectExpensesFor(owner : Principal) : Map.Map<Common.RecordId, Common.ProjectExpense> {
    switch (projectExpenses.get(owner)) {
      case (?owned) { owned };
      case (null) {
        let owned = Map.empty<Common.RecordId, Common.ProjectExpense>();
        projectExpenses.add(owner, owned);
        owned;
      };
    };
  };

  /// Look up one of the caller's projects, or fail with `#notFound`.
  func requireProject(owner : Principal, projectId : Common.RecordId) : Common.Project {
    switch (projectsFor(owner).get(projectId)) {
      case (?project) { project };
      case (null) { Runtime.trap("Project not found") };
    };
  };

  /// Sum the amounts of the owner's contributions for one project.
  func contributedFor(owner : Principal, projectId : Common.RecordId) : Common.Money {
    contributionsFor(owner).values().foldLeft(
      0 : Common.Money,
      func(acc, contribution) {
        if (contribution.projectId == projectId) { acc + contribution.amount } else { acc };
      },
    );
  };

  /// Sum the amounts of the owner's expenses for one project.
  func spentFor(owner : Principal, projectId : Common.RecordId) : Common.Money {
    projectExpensesFor(owner).values().foldLeft(
      0 : Common.Money,
      func(acc, expense) {
        if (expense.projectId == projectId) { acc + expense.amount } else { acc };
      },
    );
  };

  /// Build the shared funding summary for one project.
  func fundingFor(owner : Principal, project : Common.Project) : Common.ProjectFunding {
    let contributed = contributedFor(owner, project.id);
    let spent = spentFor(owner, project.id);
    {
      projectId = project.id;
      target = project.target;
      contributed;
      spent;
      remaining = project.target - contributed;
    };
  };

  // --- Project CRUD -------------------------------------------------------

  /// Create a project owned by the caller.
  public shared ({ caller }) func createProject(
    name : Text,
    target : Common.Money,
    description : Text,
  ) : async Common.LedgerlyResult<Common.Project> {
    requireCaller(caller);
    if (name == "") {
      return #err(#invalidInput("Project name is required"));
    };
    if (target < 0) {
      return #err(#invalidAmount("Funding target cannot be negative"));
    };
    let counters = countersFor(caller);
    let id = counters.project;
    counters.project := id + 1;
    let now = Time.now();
    let project : Common.Project = {
      id;
      owner = caller;
      name;
      target;
      description;
      createdAt = now;
      updatedAt = now;
    };
    projectsFor(caller).add(id, project);
    #ok(project);
  };

  /// Update one of the caller's projects. Only the supplied fields change.
  public shared ({ caller }) func updateProject(
    projectId : Common.RecordId,
    name : Text,
    target : Common.Money,
    description : Text,
  ) : async Common.LedgerlyResult<Common.Project> {
    requireCaller(caller);
    if (name == "") {
      return #err(#invalidInput("Project name is required"));
    };
    if (target < 0) {
      return #err(#invalidAmount("Funding target cannot be negative"));
    };
    let owned = projectsFor(caller);
    switch (owned.get(projectId)) {
      case (null) { #err(#notFound(projectId)) };
      case (?existing) {
        let updated : Common.Project = {
          id = existing.id;
          owner = existing.owner;
          name;
          target;
          description;
          createdAt = existing.createdAt;
          updatedAt = Time.now();
        };
        owned.add(projectId, updated);
        #ok(updated);
      };
    };
  };

  /// Read one of the caller's projects.
  public query ({ caller }) func getProject(
    projectId : Common.RecordId,
  ) : async Common.LedgerlyResult<Common.Project> {
    requireCaller(caller);
    switch (projectsFor(caller).get(projectId)) {
      case (?project) { #ok(project) };
      case (null) { #err(#notFound(projectId)) };
    };
  };

  /// List every project owned by the caller.
  public query ({ caller }) func listProjects() : async [Common.Project] {
    requireCaller(caller);
    projectsFor(caller).values().toArray();
  };

  /// Delete one of the caller's projects together with its contributions and
  /// project expenses. Only the caller's own records are touched.
  public shared ({ caller }) func deleteProject(
    projectId : Common.RecordId,
  ) : async Common.LedgerlyResult<()> {
    requireCaller(caller);
    let owned = projectsFor(caller);
    switch (owned.get(projectId)) {
      case (null) { #err(#notFound(projectId)) };
      case (?_) {
        owned.remove(projectId);
        let ownedContributions = contributionsFor(caller);
        let contributionIds = ownedContributions.entries()
          .filter(func((_, contribution)) = contribution.projectId == projectId)
          .map(func((id, _)) = id)
          .toArray();
        for (id in contributionIds.values()) {
          ownedContributions.remove(id);
        };
        let ownedExpenses = projectExpensesFor(caller);
        let expenseIds = ownedExpenses.entries()
          .filter(func((_, expense)) = expense.projectId == projectId)
          .map(func((id, _)) = id)
          .toArray();
        for (id in expenseIds.values()) {
          ownedExpenses.remove(id);
        };
        #ok(());
      };
    };
  };

  // --- Contributions ------------------------------------------------------

  /// Record a contribution toward one of the caller's projects.
  public shared ({ caller }) func addContribution(
    projectId : Common.RecordId,
    amount : Common.Money,
    date : Common.Timestamp,
    note : Text,
  ) : async Common.LedgerlyResult<Common.ProjectContribution> {
    requireCaller(caller);
    if (amount <= 0) {
      return #err(#invalidAmount("Contribution amount must be positive"));
    };
    ignore requireProject(caller, projectId);
    let counters = countersFor(caller);
    let id = counters.contribution;
    counters.contribution := id + 1;
    let contribution : Common.ProjectContribution = {
      id;
      owner = caller;
      projectId;
      amount;
      date;
      note;
    };
    contributionsFor(caller).add(id, contribution);
    #ok(contribution);
  };

  /// List the caller's contributions, optionally filtered to one project.
  public query ({ caller }) func listContributions(
    projectId : ?Common.RecordId,
  ) : async [Common.ProjectContribution] {
    requireCaller(caller);
    let all = contributionsFor(caller).values().toArray();
    switch (projectId) {
      case (null) { all };
      case (?pid) { all.filter(func(contribution) = contribution.projectId == pid) };
    };
  };

  // --- Project expenses ---------------------------------------------------

  /// Record an expense charged against one of the caller's projects. The
  /// expense is stored only in the project-expense collection, never in the
  /// personal entry or business record collections.
  public shared ({ caller }) func addProjectExpense(
    projectId : Common.RecordId,
    amount : Common.Money,
    date : Common.Timestamp,
    category : Text,
    note : Text,
  ) : async Common.LedgerlyResult<Common.ProjectExpense> {
    requireCaller(caller);
    if (amount <= 0) {
      return #err(#invalidAmount("Expense amount must be positive"));
    };
    ignore requireProject(caller, projectId);
    let counters = countersFor(caller);
    let id = counters.projectExpense;
    counters.projectExpense := id + 1;
    let expense : Common.ProjectExpense = {
      id;
      owner = caller;
      projectId;
      amount;
      date;
      category;
      note;
    };
    projectExpensesFor(caller).add(id, expense);
    #ok(expense);
  };

  /// List the caller's project expenses, optionally filtered to one project.
  public query ({ caller }) func listProjectExpenses(
    projectId : ?Common.RecordId,
  ) : async [Common.ProjectExpense] {
    requireCaller(caller);
    let all = projectExpensesFor(caller).values().toArray();
    switch (projectId) {
      case (null) { all };
      case (?pid) { all.filter(func(expense) = expense.projectId == pid) };
    };
  };

  // --- Funding summary ----------------------------------------------------

  /// Compute the funding summary for one of the caller's projects.
  public query ({ caller }) func getProjectFunding(
    projectId : Common.RecordId,
  ) : async Common.LedgerlyResult<Common.ProjectFunding> {
    requireCaller(caller);
    switch (projectsFor(caller).get(projectId)) {
      case (?project) { #ok(fundingFor(caller, project)) };
      case (null) { #err(#notFound(projectId)) };
    };
  };
};
