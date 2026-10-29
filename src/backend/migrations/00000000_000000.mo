import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  // --- Inlined domain types (migrations must be self-contained) ---
  type RecordId = Nat;
  type Money = Int;
  type Timestamp = Int;

  type EntryKind = { #income; #expense };
  type BudgetPeriod = { #daily; #weekly; #monthly; #annual };
  type BusinessKind = { #revenue; #cost };

  type FinancialEntry = {
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

  type BudgetCategory = {
    id : RecordId;
    owner : Principal;
    name : Text;
    percentage : Nat;
    allocated : Money;
  };

  type BudgetSettings = {
    owner : Principal;
    expectedIncome : Money;
    period : BudgetPeriod;
    updatedAt : Timestamp;
  };

  type Project = {
    id : RecordId;
    owner : Principal;
    name : Text;
    target : Money;
    description : Text;
    createdAt : Timestamp;
    updatedAt : Timestamp;
  };

  type ProjectContribution = {
    id : RecordId;
    owner : Principal;
    projectId : RecordId;
    amount : Money;
    date : Timestamp;
    note : Text;
  };

  type ProjectExpense = {
    id : RecordId;
    owner : Principal;
    projectId : RecordId;
    amount : Money;
    date : Timestamp;
    category : Text;
    note : Text;
  };

  type BusinessRecord = {
    id : RecordId;
    owner : Principal;
    kind : BusinessKind;
    amount : Money;
    date : Timestamp;
    category : Text;
    note : Text;
  };

  type Debt = {
    id : RecordId;
    owner : Principal;
    name : Text;
    balance : Money;
    interestRate : ?Float;
    createdAt : Timestamp;
    updatedAt : Timestamp;
  };

  type DebtPayment = {
    id : RecordId;
    owner : Principal;
    debtId : RecordId;
    amount : Money;
    date : Timestamp;
    note : Text;
  };

  type NextIds = {
    var entry : RecordId;
    var budgetCategory : RecordId;
    var project : RecordId;
    var contribution : RecordId;
    var projectExpense : RecordId;
    var businessRecord : RecordId;
    var debt : RecordId;
    var debtPayment : RecordId;
  };

  public type OldActor = {};

  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    entries : Map.Map<Principal, Map.Map<RecordId, FinancialEntry>>;
    budgetCategories : Map.Map<Principal, Map.Map<RecordId, BudgetCategory>>;
    budgetSettings : Map.Map<Principal, BudgetSettings>;
    projects : Map.Map<Principal, Map.Map<RecordId, Project>>;
    contributions : Map.Map<Principal, Map.Map<RecordId, ProjectContribution>>;
    projectExpenses : Map.Map<Principal, Map.Map<RecordId, ProjectExpense>>;
    businessRecords : Map.Map<Principal, Map.Map<RecordId, BusinessRecord>>;
    debts : Map.Map<Principal, Map.Map<RecordId, Debt>>;
    debtPayments : Map.Map<Principal, Map.Map<RecordId, DebtPayment>>;
    nextIds : Map.Map<Principal, NextIds>;
  };

  public func migration(_ : OldActor) : NewActor {
    {
      accessControlState = AccessControl.initState();
      entries = Map.empty();
      budgetCategories = Map.empty();
      budgetSettings = Map.empty();
      projects = Map.empty();
      contributions = Map.empty();
      projectExpenses = Map.empty();
      businessRecords = Map.empty();
      debts = Map.empty();
      debtPayments = Map.empty();
      nextIds = Map.empty();
    };
  };
};
