import { createActor } from "@/backend";
import type { LedgerlyError } from "@/types";
import type {
  BudgetCategoryInput,
  BudgetPeriod,
  BusinessRecordInput,
  DebtInput,
  EntryFilters,
  EntryInput,
  ProjectInput,
  RecordId,
  Timestamp,
} from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** The generated actor, or null while the backend connection is resolving. */
export function useLedgerlyActor() {
  return useActor(createActor);
}

/** Human-readable text for a backend `LedgerlyError` variant. */
export function ledgerlyErrorMessage(error: LedgerlyError): string {
  switch (error.__kind__) {
    case "notAuthorized":
      return "You are not authorized to perform this action.";
    case "invalidPercentage":
      return error.invalidPercentage;
    case "invalidInput":
      return error.invalidInput;
    case "notFound":
      return "That record could not be found.";
    case "invalidAmount":
      return error.invalidAmount;
    case "overAllocated":
      return "Those allocations exceed your expected income.";
    default:
      return "The ledger rejected that request.";
  }
}

/** Unwrap a `LedgerlyResult` union, throwing on the error variant. */
function unwrap<T>(
  result: { __kind__: "ok"; ok: T } | { __kind__: "err"; err: LedgerlyError },
): T {
  if (result.__kind__ === "err")
    throw new Error(ledgerlyErrorMessage(result.err));
  return result.ok;
}

/** A window wide enough to cover every record when no bounds are supplied. */
const UNBOUNDED_FROM = 0n;
const UNBOUNDED_TO = 9_000_000_000_000_000_000n;

export const queryKeys = {
  entries: (filters: EntryFilters) => ["entries", filters] as const,
  budgetSettings: ["budgetSettings"] as const,
  budgetCategories: ["budgetCategories"] as const,
  report: (period: BudgetPeriod, from: Timestamp, to: Timestamp) =>
    ["report", period, from.toString(), to.toString()] as const,
  alerts: (from: Timestamp, to: Timestamp) =>
    ["alerts", from.toString(), to.toString()] as const,
  projects: ["projects"] as const,
  contributions: (projectId: RecordId) =>
    ["contributions", projectId.toString()] as const,
  projectExpenses: (projectId: RecordId) =>
    ["projectExpenses", projectId.toString()] as const,
  projectFunding: (projectId: RecordId) =>
    ["projectFunding", projectId.toString()] as const,
  businessRecords: ["businessRecords"] as const,
  businessSummary: (from: Timestamp, to: Timestamp) =>
    ["businessSummary", from.toString(), to.toString()] as const,
  debts: ["debts"] as const,
  debtPayments: (debtId: RecordId) =>
    ["debtPayments", debtId.toString()] as const,
};

// --- Entries ---------------------------------------------------------------

export function useEntries(filters: EntryFilters) {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.entries(filters),
    queryFn: async () => {
      if (!actor) return [];
      return actor.listEntries({
        from: filters.from ?? undefined,
        to: filters.to ?? undefined,
        kind: filters.kind ?? undefined,
        category: filters.category ?? undefined,
      });
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateEntry() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EntryInput) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.createEntry(
          input.kind,
          input.amount,
          input.date,
          input.category,
          input.note,
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["entries"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

export function useUpdateEntry() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: RecordId; input: EntryInput }) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.updateEntry(
          id,
          input.kind,
          input.amount,
          input.date,
          input.category,
          input.note,
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["entries"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

export function useDeleteEntry() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: RecordId) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(await actor.deleteEntry(id));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["entries"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

// --- Budgets ---------------------------------------------------------------

export function useBudgetSettings() {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.budgetSettings,
    queryFn: async () => {
      if (!actor) return null;
      return actor.getBudgetSettings();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSetBudgetSettings() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      expectedIncome,
      period,
    }: { expectedIncome: bigint; period: BudgetPeriod }) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(await actor.setBudgetSettings(expectedIncome, period));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["budgetSettings"] });
      void queryClient.invalidateQueries({ queryKey: ["budgetCategories"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useBudgetCategories() {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.budgetCategories,
    queryFn: async () => {
      if (!actor) return [];
      return actor.listBudgetCategories();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateBudgetCategory() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BudgetCategoryInput) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.createBudgetCategory(input.name, input.percentage),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["budgetCategories"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useUpdateBudgetCategory() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: { id: RecordId; input: BudgetCategoryInput }) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.updateBudgetCategory(id, input.name, input.percentage),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["budgetCategories"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useDeleteBudgetCategory() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: RecordId) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(await actor.deleteBudgetCategory(id));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["budgetCategories"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

// --- Reports and alerts ----------------------------------------------------

export function useReport(
  period: BudgetPeriod,
  from: Timestamp,
  to: Timestamp,
) {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.report(period, from, to),
    queryFn: async () => {
      if (!actor) return null;
      return actor.getFinancialReport(period, from, to);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAlerts(
  from: Timestamp = UNBOUNDED_FROM,
  to: Timestamp = UNBOUNDED_TO,
) {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.alerts(from, to),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSpendingAlerts(from, to);
    },
    enabled: !!actor && !isFetching,
  });
}

// --- Projects --------------------------------------------------------------

export function useProjects() {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => {
      if (!actor) return [];
      return actor.listProjects();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateProject() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProjectInput) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.createProject(input.name, input.target, input.description),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: { id: RecordId; input: ProjectInput }) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.updateProject(
          id,
          input.name,
          input.target,
          input.description,
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: RecordId) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(await actor.deleteProject(id));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useProjectFunding(projectId: RecordId) {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.projectFunding(projectId),
    queryFn: async () => {
      if (!actor) return null;
      return unwrap(await actor.getProjectFunding(projectId));
    },
    enabled: !!actor && !isFetching,
  });
}

export function useContributions(projectId: RecordId) {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.contributions(projectId),
    queryFn: async () => {
      if (!actor) return [];
      return actor.listContributions(projectId);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddContribution() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      projectId: RecordId;
      amount: bigint;
      date: Timestamp;
      note: string;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.addContribution(
          args.projectId,
          args.amount,
          args.date,
          args.note,
        ),
      );
    },
    onSuccess: (_data, args) => {
      void queryClient.invalidateQueries({
        queryKey: ["contributions", args.projectId.toString()],
      });
      void queryClient.invalidateQueries({
        queryKey: ["projectFunding", args.projectId.toString()],
      });
    },
  });
}

export function useProjectExpenses(projectId: RecordId) {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.projectExpenses(projectId),
    queryFn: async () => {
      if (!actor) return [];
      return actor.listProjectExpenses(projectId);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddProjectExpense() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      projectId: RecordId;
      amount: bigint;
      date: Timestamp;
      category: string;
      note: string;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.addProjectExpense(
          args.projectId,
          args.amount,
          args.date,
          args.category,
          args.note,
        ),
      );
    },
    onSuccess: (_data, args) => {
      void queryClient.invalidateQueries({
        queryKey: ["projectExpenses", args.projectId.toString()],
      });
      void queryClient.invalidateQueries({
        queryKey: ["projectFunding", args.projectId.toString()],
      });
    },
  });
}

// --- Business --------------------------------------------------------------

export function useBusinessRecords() {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.businessRecords,
    queryFn: async () => {
      if (!actor) return [];
      return actor.listBusinessRecords(null, null);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateBusinessRecord() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BusinessRecordInput) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.addBusinessRecord(
          input.kind,
          input.amount,
          input.date,
          input.category,
          input.note,
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["businessRecords"] });
      void queryClient.invalidateQueries({ queryKey: ["businessSummary"] });
    },
  });
}

export function useUpdateBusinessRecord() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: { id: RecordId; input: BusinessRecordInput }) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.updateBusinessRecord(
          id,
          input.kind,
          input.amount,
          input.date,
          input.category,
          input.note,
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["businessRecords"] });
      void queryClient.invalidateQueries({ queryKey: ["businessSummary"] });
    },
  });
}

export function useDeleteBusinessRecord() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: RecordId) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(await actor.deleteBusinessRecord(id));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["businessRecords"] });
      void queryClient.invalidateQueries({ queryKey: ["businessSummary"] });
    },
  });
}

export function useBusinessSummary(
  from: Timestamp | null = null,
  to: Timestamp | null = null,
) {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.businessSummary(
      from ?? UNBOUNDED_FROM,
      to ?? UNBOUNDED_TO,
    ),
    queryFn: async () => {
      if (!actor) return null;
      return actor.getBusinessSummary(from, to);
    },
    enabled: !!actor && !isFetching,
  });
}

// --- Debt ------------------------------------------------------------------

export function useDebts() {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.debts,
    queryFn: async () => {
      if (!actor) return { debts: [], totalOutstanding: 0n };
      return actor.listDebts();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateDebt() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DebtInput) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.createDebt(input.name, input.balance, input.interestRate),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["debts"] });
    },
  });
}

export function useUpdateDebt() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: RecordId; input: DebtInput }) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.updateDebt(
          id,
          input.name,
          input.balance,
          input.interestRate,
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["debts"] });
    },
  });
}

export function useDeleteDebt() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: RecordId) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(await actor.deleteDebt(id));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["debts"] });
    },
  });
}

export function useDebtPayments(debtId: RecordId) {
  const { actor, isFetching } = useLedgerlyActor();
  return useQuery({
    queryKey: queryKeys.debtPayments(debtId),
    queryFn: async () => {
      if (!actor) return [];
      return actor.listDebtPayments(debtId);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddDebtPayment() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      debtId: RecordId;
      amount: bigint;
      date: Timestamp;
      note: string;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return unwrap(
        await actor.recordDebtPayment(
          args.debtId,
          args.amount,
          args.date,
          args.note,
        ),
      );
    },
    onSuccess: (_data, args) => {
      void queryClient.invalidateQueries({
        queryKey: ["debtPayments", args.debtId.toString()],
      });
      void queryClient.invalidateQueries({ queryKey: ["debts"] });
    },
  });
}

// --- Backup ----------------------------------------------------------------

export function useExportBackup() {
  const { actor } = useLedgerlyActor();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.exportBackup();
    },
  });
}

export function useImportBackup() {
  const { actor } = useLedgerlyActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Parameters<NonNullable<typeof actor>["restoreBackup"]>[0],
    ) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.restoreBackup(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
