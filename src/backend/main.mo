import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import Expose "mo:caffeineai-oql/Expose";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "types/common";

// --- Domain mixins (each owns one area of the Ledgerly surface) ---
import EntriesApi "lib/entries";
import BudgetsMixin "lib/budgets";
import ProjectsMixin "lib/projects";
import BusinessMixin "lib/business";
import DebtApi "lib/debt";
import ReportsMixin "lib/reports";
import ApiDocMixin "mixins/api-doc";

// --- OQL resolver modules (must be imported top-level in this file) ---
import OQL "mo:caffeineai-oql";
import Entity "mo:caffeineai-oql/Entity";
import RecordValue "mo:caffeineai-oql/RecordValue";
import OqlRows "lib/oql";
import NatValue "mo:caffeineai-oql/NatValue";
import IntValue "mo:caffeineai-oql/IntValue";
import FloatValue "mo:caffeineai-oql/FloatValue";
import TextValue "mo:caffeineai-oql/TextValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
// Custom value instances for the domain's variant field types.
import EntryKindValue "EntryKindValue";
import BudgetPeriodValue "BudgetPeriodValue";
import BusinessKindValue "BusinessKindValue";

actor {
  // --- Authorization state (owned by the authorization mixin) ---
  let accessControlState : AccessControl.AccessControlState;

  // --- Ledgerly domain state ---
  // Every collection is keyed by owner principal so per-user isolation is
  // enforced in the domain mixins. Record ids are allocated per owner.
  let entries : Map.Map<Principal, Map.Map<Common.RecordId, Common.FinancialEntry>>;
  let budgetCategories : Map.Map<Principal, Map.Map<Common.RecordId, Common.BudgetCategory>>;
  let budgetSettings : Map.Map<Principal, Common.BudgetSettings>;
  let projects : Map.Map<Principal, Map.Map<Common.RecordId, Common.Project>>;
  let contributions : Map.Map<Principal, Map.Map<Common.RecordId, Common.ProjectContribution>>;
  let projectExpenses : Map.Map<Principal, Map.Map<Common.RecordId, Common.ProjectExpense>>;
  let businessRecords : Map.Map<Principal, Map.Map<Common.RecordId, Common.BusinessRecord>>;
  let debts : Map.Map<Principal, Map.Map<Common.RecordId, Common.Debt>>;
  let debtPayments : Map.Map<Principal, Map.Map<Common.RecordId, Common.DebtPayment>>;

  // Per-owner id counters for each record kind.
  let nextIds : Map.Map<Principal, {
    var entry : Common.RecordId;
    var budgetCategory : Common.RecordId;
    var project : Common.RecordId;
    var contribution : Common.RecordId;
    var projectExpense : Common.RecordId;
    var businessRecord : Common.RecordId;
    var debt : Common.RecordId;
    var debtPayment : Common.RecordId;
  }>;

  // --- Authorization ---
  include MixinAuthorization(accessControlState, null);

  // --- Domain API ---
  include EntriesApi(entries, nextIds);
  include BudgetsMixin(accessControlState, budgetCategories, budgetSettings, nextIds);
  include ProjectsMixin(accessControlState, projects, contributions, projectExpenses, nextIds);
  include BusinessMixin(accessControlState, businessRecords, nextIds);
  include DebtApi(accessControlState, debts, debtPayments, nextIds);
  include ReportsMixin(
    accessControlState,
    entries,
    budgetCategories,
    budgetSettings,
    projects,
    contributions,
    projectExpenses,
    businessRecords,
    debts,
    debtPayments,
    nextIds,
  );

  // --- Behavioral API documentation ---
  include ApiDocMixin();

  // --- OQL: expose every persisted, queryable collection ---
  // Each entity is scoped to its owner principal, so a signed-in caller reads
  // only its own rows and the platform controller reads all rows. Collections
  // are nested owner maps, so each entity iterates the flattened records.
  include Expose({
    entities = [
      OQL.Entity.new<Common.FinancialEntry>(
        "entry",
        func() = OqlRows.flatten(entries),
        "FinancialEntry",
        "id",
      )
        .sample({
          id = 0;
          owner = Principal.fromText("aaaaa-aa");
          kind = #income;
          amount = 0;
          date = 0;
          category = "";
          note = "";
          createdAt = 0;
          updatedAt = 0;
        })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
      OQL.Entity.new<Common.BudgetCategory>(
        "budgetCategory",
        func() = OqlRows.flatten(budgetCategories),
        "BudgetCategory",
        "id",
      )
        .sample({
          id = 0;
          owner = Principal.fromText("aaaaa-aa");
          name = "";
          percentage = 0;
          allocated = 0;
        })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
      OQL.Entity.new<Common.BudgetSettings>(
        "budgetSettings",
        func() = budgetSettings.values(),
        "BudgetSettings",
        "owner",
      )
        .sample({
          owner = Principal.fromText("aaaaa-aa");
          expectedIncome = 0;
          period = #monthly;
          updatedAt = 0;
        })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
      OQL.Entity.new<Common.Project>(
        "project",
        func() = OqlRows.flatten(projects),
        "Project",
        "id",
      )
        .sample({
          id = 0;
          owner = Principal.fromText("aaaaa-aa");
          name = "";
          target = 0;
          description = "";
          createdAt = 0;
          updatedAt = 0;
        })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
      OQL.Entity.new<Common.ProjectContribution>(
        "contribution",
        func() = OqlRows.flatten(contributions),
        "ProjectContribution",
        "id",
      )
        .sample({
          id = 0;
          owner = Principal.fromText("aaaaa-aa");
          projectId = 0;
          amount = 0;
          date = 0;
          note = "";
        })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
      OQL.Entity.new<Common.ProjectExpense>(
        "projectExpense",
        func() = OqlRows.flatten(projectExpenses),
        "ProjectExpense",
        "id",
      )
        .sample({
          id = 0;
          owner = Principal.fromText("aaaaa-aa");
          projectId = 0;
          amount = 0;
          date = 0;
          category = "";
          note = "";
        })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
      OQL.Entity.new<Common.BusinessRecord>(
        "businessRecord",
        func() = OqlRows.flatten(businessRecords),
        "BusinessRecord",
        "id",
      )
        .sample({
          id = 0;
          owner = Principal.fromText("aaaaa-aa");
          kind = #revenue;
          amount = 0;
          date = 0;
          category = "";
          note = "";
        })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
      OQL.Entity.new<Common.Debt>(
        "debt",
        func() = OqlRows.flatten(debts),
        "Debt",
        "id",
      )
        .sample({
          id = 0;
          owner = Principal.fromText("aaaaa-aa");
          name = "";
          balance = 0;
          interestRate = ?0.0;
          createdAt = 0;
          updatedAt = 0;
        })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
      OQL.Entity.new<Common.DebtPayment>(
        "debtPayment",
        func() = OqlRows.flatten(debtPayments),
        "DebtPayment",
        "id",
      )
        .sample({
          id = 0;
          owner = Principal.fromText("aaaaa-aa");
          debtId = 0;
          amount = 0;
          date = 0;
          note = "";
        })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
    ];
  });
};
