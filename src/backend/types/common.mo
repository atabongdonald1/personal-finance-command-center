module {
  /// A per-user record identifier. Ids are allocated from a per-owner counter.
  public type RecordId = Nat;

  /// A money amount in minor units (cents), kept exact as a signed integer so
  /// balances, cash flow and remaining-funding figures can go negative.
  public type Money = Int;

  /// A point in time as signed nanoseconds since the Unix epoch (`Time.now()`).
  public type Timestamp = Int;

  /// Whether a financial entry adds to or subtracts from the owner's money.
  public type EntryKind = {
    #income;
    #expense;
  };

  /// The reporting period a budget is configured for.
  public type BudgetPeriod = {
    #daily;
    #weekly;
    #monthly;
    #annual;
  };

  /// A single income or expense record owned by one principal.
  public type FinancialEntry = {
    id : RecordId;
    owner : Principal;
    kind : EntryKind;
    amount : Money;
    date : Timestamp;
    category : Text;
    note : Text;
    createdAt : Timestamp;
    updatedAt : Timestamp;
  };

  /// A budget line: a named category with a percentage of expected income.
  public type BudgetCategory = {
    id : RecordId;
    owner : Principal;
    name : Text;
    percentage : Nat;
    allocated : Money;
  };

  /// The owner's budget settings for a reporting period.
  public type BudgetSettings = {
    owner : Principal;
    expectedIncome : Money;
    period : BudgetPeriod;
    updatedAt : Timestamp;
  };

  /// A funding project owned by one principal.
  public type Project = {
    id : RecordId;
    owner : Principal;
    name : Text;
    target : Money;
    description : Text;
    createdAt : Timestamp;
    updatedAt : Timestamp;
  };

  /// A contribution of money toward a project.
  public type ProjectContribution = {
    id : RecordId;
    owner : Principal;
    projectId : RecordId;
    amount : Money;
    date : Timestamp;
    note : Text;
  };

  /// An expense charged against a project.
  public type ProjectExpense = {
    id : RecordId;
    owner : Principal;
    projectId : RecordId;
    amount : Money;
    date : Timestamp;
    category : Text;
    note : Text;
  };

  /// Whether a business record is revenue or a cost.
  public type BusinessKind = {
    #revenue;
    #cost;
  };

  /// A business revenue or cost record owned by one principal.
  public type BusinessRecord = {
    id : RecordId;
    owner : Principal;
    kind : BusinessKind;
    amount : Money;
    date : Timestamp;
    category : Text;
    note : Text;
  };

  /// A debt the owner is paying down.
  public type Debt = {
    id : RecordId;
    owner : Principal;
    name : Text;
    balance : Money;
    interestRate : ?Float;
    createdAt : Timestamp;
    updatedAt : Timestamp;
  };

  /// A payment made against a debt.
  public type DebtPayment = {
    id : RecordId;
    owner : Principal;
    debtId : RecordId;
    amount : Money;
    date : Timestamp;
    note : Text;
  };

  /// A computed spending alert for the owner.
  public type SpendingAlert = {
    category : Text;
    spent : Money;
    allocated : Money;
    severity : AlertSeverity;
    message : Text;
  };

  /// How urgent a spending alert is.
  public type AlertSeverity = {
    #info;
    #warning;
    #critical;
  };

  /// A reconciled report over a period.
  public type FinancialReport = {
    period : BudgetPeriod;
    from : Timestamp;
    to : Timestamp;
    income : Money;
    expenses : Money;
    net : Money;
    byCategory : [(Text, Money)];
  };

  /// A project funding summary.
  public type ProjectFunding = {
    projectId : RecordId;
    target : Money;
    contributed : Money;
    spent : Money;
    remaining : Money;
  };

  /// A business performance summary.
  public type BusinessSummary = {
    revenue : Money;
    costs : Money;
    profit : Money;
    cashFlow : Money;
  };

  /// A portable snapshot of one owner's records for backup and restore.
  public type BackupData = {
    entries : [FinancialEntry];
    budgetCategories : [BudgetCategory];
    budgetSettings : ?BudgetSettings;
    projects : [Project];
    contributions : [ProjectContribution];
    projectExpenses : [ProjectExpense];
    businessRecords : [BusinessRecord];
    debts : [Debt];
    debtPayments : [DebtPayment];
    exportedAt : Timestamp;
  };

  /// A validation or authorization failure a caller can act on.
  public type LedgerlyError = {
    #notAuthorized;
    #notFound : RecordId;
    #invalidAmount : Text;
    #overAllocated : { allocated : Money; expectedIncome : Money };
    #invalidPercentage : Text;
    #invalidInput : Text;
  };

  /// A shared result type for fallible operations.
  public type LedgerlyResult<T> = {
    #ok : T;
    #err : LedgerlyError;
  };
};
