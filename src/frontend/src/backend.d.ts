import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface BackupData {
    contributions: Array<ProjectContribution>;
    projects: Array<Project>;
    projectExpenses: Array<ProjectExpense>;
    exportedAt: Timestamp;
    entries: Array<FinancialEntry>;
    budgetCategories: Array<BudgetCategory>;
    debtPayments: Array<DebtPayment>;
    budgetSettings?: BudgetSettings;
    debts: Array<Debt>;
    businessRecords: Array<BusinessRecord>;
}
export interface BudgetCategory {
    id: RecordId;
    owner: Principal;
    allocated: Money;
    name: string;
    percentage: bigint;
}
export interface BudgetSettings {
    owner: Principal;
    period: BudgetPeriod;
    updatedAt: Timestamp;
    expectedIncome: Money;
}
export interface BusinessRecord {
    id: RecordId;
    owner: Principal;
    date: Timestamp;
    kind: BusinessKind;
    note: string;
    category: string;
    amount: Money;
}
export interface BusinessSummary {
    revenue: Money;
    costs: Money;
    profit: Money;
    cashFlow: Money;
}
export interface Cell {
    value: Value;
    name: string;
}
export interface Debt {
    id: RecordId;
    balance: Money;
    owner: Principal;
    name: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    interestRate?: number;
}
export interface DebtPayment {
    id: RecordId;
    owner: Principal;
    date: Timestamp;
    note: string;
    debtId: RecordId;
    amount: Money;
}
export interface DebtSummary {
    totalOutstanding: Money;
    debts: Array<DebtWithBalance>;
}
export interface DebtWithBalance {
    debt: Debt;
    remaining: Money;
}
export interface EntryFilter {
    to?: Timestamp;
    from?: Timestamp;
    kind?: EntryKind;
    category?: string;
}
export type Error_ = {
    __kind__: "FrontendOriginsNotConfigured";
    FrontendOriginsNotConfigured: null;
} | {
    __kind__: "MixedSsoSources";
    MixedSsoSources: {
        otherKeys: Array<string>;
        ssoKeys: Array<string>;
    };
} | {
    __kind__: "Stale";
    Stale: {
        ageNs: bigint;
    };
} | {
    __kind__: "MalformedCandid";
    MalformedCandid: null;
} | {
    __kind__: "AmbiguousAttribute";
    AmbiguousAttribute: {
        field: string;
        sources: Array<string>;
    };
} | {
    __kind__: "NoAttributes";
    NoAttributes: null;
} | {
    __kind__: "UnknownNonce";
    UnknownNonce: null;
} | {
    __kind__: "UntrustedSsoSource";
    UntrustedSsoSource: {
        domain: string;
    };
} | {
    __kind__: "MissingField";
    MissingField: string;
} | {
    __kind__: "FrontendOriginMismatch";
    FrontendOriginMismatch: {
        got: string;
        expected: Array<string>;
    };
};
export interface FinancialEntry {
    id: RecordId;
    owner: Principal;
    date: Timestamp;
    kind: EntryKind;
    note: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    category: string;
    amount: Money;
}
export interface FinancialReport {
    to: Timestamp;
    net: Money;
    period: BudgetPeriod;
    from: Timestamp;
    expenses: Money;
    income: Money;
    byCategory: Array<[string, Money]>;
}
export type LedgerlyError = {
    __kind__: "notAuthorized";
    notAuthorized: null;
} | {
    __kind__: "invalidPercentage";
    invalidPercentage: string;
} | {
    __kind__: "invalidInput";
    invalidInput: string;
} | {
    __kind__: "notFound";
    notFound: RecordId;
} | {
    __kind__: "invalidAmount";
    invalidAmount: string;
} | {
    __kind__: "overAllocated";
    overAllocated: {
        allocated: Money;
        expectedIncome: Money;
    };
};
export type LedgerlyResult = {
    __kind__: "ok";
    ok: Project;
} | {
    __kind__: "err";
    err: LedgerlyError;
};
export type LedgerlyResult_1 = {
    __kind__: "ok";
    ok: FinancialEntry;
} | {
    __kind__: "err";
    err: LedgerlyError;
};
export type LedgerlyResult_10 = {
    __kind__: "ok";
    ok: ProjectContribution;
} | {
    __kind__: "err";
    err: LedgerlyError;
};
export type LedgerlyResult_2 = {
    __kind__: "ok";
    ok: Debt;
} | {
    __kind__: "err";
    err: LedgerlyError;
};
export type LedgerlyResult_3 = {
    __kind__: "ok";
    ok: BusinessRecord;
} | {
    __kind__: "err";
    err: LedgerlyError;
};
export type LedgerlyResult_4 = {
    __kind__: "ok";
    ok: BudgetCategory;
} | {
    __kind__: "err";
    err: LedgerlyError;
};
export type LedgerlyResult_5 = {
    __kind__: "ok";
    ok: BudgetSettings;
} | {
    __kind__: "err";
    err: LedgerlyError;
};
export type LedgerlyResult_6 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: LedgerlyError;
};
export type LedgerlyResult_7 = {
    __kind__: "ok";
    ok: DebtPayment;
} | {
    __kind__: "err";
    err: LedgerlyError;
};
export type LedgerlyResult_8 = {
    __kind__: "ok";
    ok: ProjectFunding;
} | {
    __kind__: "err";
    err: LedgerlyError;
};
export type LedgerlyResult_9 = {
    __kind__: "ok";
    ok: ProjectExpense;
} | {
    __kind__: "err";
    err: LedgerlyError;
};
export type Money = bigint;
export interface Project {
    id: RecordId;
    owner: Principal;
    name: string;
    createdAt: Timestamp;
    description: string;
    updatedAt: Timestamp;
    target: Money;
}
export interface ProjectContribution {
    id: RecordId;
    owner: Principal;
    date: Timestamp;
    note: string;
    projectId: RecordId;
    amount: Money;
}
export interface ProjectExpense {
    id: RecordId;
    owner: Principal;
    date: Timestamp;
    note: string;
    projectId: RecordId;
    category: string;
    amount: Money;
}
export interface ProjectFunding {
    spent: Money;
    target: Money;
    projectId: RecordId;
    remaining: Money;
    contributed: Money;
}
export type RecordId = bigint;
export interface Result {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export type Result__1 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: Error_;
};
export interface SpendingAlert {
    allocated: Money;
    spent: Money;
    message: string;
    category: string;
    severity: AlertSeverity;
}
export type Timestamp = bigint;
export type Value = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export enum AlertSeverity {
    warning = "warning",
    info = "info",
    critical = "critical"
}
export enum BudgetPeriod {
    annual = "annual",
    monthly = "monthly",
    daily = "daily",
    weekly = "weekly"
}
export enum BusinessKind {
    revenue = "revenue",
    cost = "cost"
}
export enum EntryKind {
    expense = "expense",
    income = "income"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    /**
     * / Record a business revenue or cost for the caller.
     */
    addBusinessRecord(kind: BusinessKind, amount: Money, date: Timestamp, category: string, note: string): Promise<LedgerlyResult_3>;
    /**
     * / Record a contribution toward one of the caller's projects.
     */
    addContribution(projectId: RecordId, amount: Money, date: Timestamp, note: string): Promise<LedgerlyResult_10>;
    /**
     * / Record an expense charged against one of the caller's projects. The
     * / expense is stored only in the project-expense collection, never in the
     * / personal entry or business record collections.
     */
    addProjectExpense(projectId: RecordId, amount: Money, date: Timestamp, category: string, note: string): Promise<LedgerlyResult_9>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    /**
     * / Create a named budget category taking `percentage` of expected income.
     */
    createBudgetCategory(name: string, percentage: bigint): Promise<LedgerlyResult_4>;
    /**
     * / Create a debt owned by the caller.
     */
    createDebt(name: string, balance: Money, interestRate: number | null): Promise<LedgerlyResult_2>;
    /**
     * / Create an income or expense entry for the caller.
     */
    createEntry(kind: EntryKind, amount: Money, date: Timestamp, category: string, note: string): Promise<LedgerlyResult_1>;
    /**
     * / Create a project owned by the caller.
     */
    createProject(name: string, target: Money, description: string): Promise<LedgerlyResult>;
    /**
     * / Delete one of the caller's budget categories.
     */
    deleteBudgetCategory(id: RecordId): Promise<LedgerlyResult_6>;
    /**
     * / Delete one of the caller's business records.
     */
    deleteBusinessRecord(id: RecordId): Promise<LedgerlyResult_6>;
    /**
     * / Delete one of the caller's debts. Its recorded payments are removed with
     * / it. Another owner's id is reported as not found.
     */
    deleteDebt(debtId: RecordId): Promise<LedgerlyResult_6>;
    /**
     * / Delete one of the caller's entries. Fails with `#notFound` when the id is
     * / not owned by the caller.
     */
    deleteEntry(id: RecordId): Promise<LedgerlyResult_6>;
    /**
     * / Delete one of the caller's projects together with its contributions and
     * / project expenses. Only the caller's own records are touched.
     */
    deleteProject(projectId: RecordId): Promise<LedgerlyResult_6>;
    execute(qJson: string): Promise<Result>;
    /**
     * / Export the caller's records as a portable snapshot. The snapshot contains
     * / only the caller's own data.
     */
    exportBackup(): Promise<BackupData>;
    getApiDoc(): Promise<string>;
    /**
     * / The caller's budget settings, or null when none are configured.
     */
    getBudgetSettings(): Promise<BudgetSettings | null>;
    /**
     * / Compute the caller's business summary from business records only.
     * /
     * / `revenue` is the sum of revenue records, `costs` the sum of cost records,
     * / `profit` is revenue minus costs, and `cashFlow` is the same net movement
     * / of business money. Personal income and expenses are never included.
     */
    getBusinessSummary(from: Timestamp | null, to: Timestamp | null): Promise<BusinessSummary>;
    getCallerUserRole(): Promise<UserRole>;
    /**
     * / A reconciled report for the caller over the requested window. `period` is
     * / the reporting label; `from`/`to` are inclusive nanosecond bounds.
     */
    getFinancialReport(period: BudgetPeriod, from: Timestamp, to: Timestamp): Promise<FinancialReport>;
    /**
     * / Read one of the caller's projects.
     */
    getProject(projectId: RecordId): Promise<LedgerlyResult>;
    /**
     * / Compute the funding summary for one of the caller's projects.
     */
    getProjectFunding(projectId: RecordId): Promise<LedgerlyResult_8>;
    /**
     * / Spending alerts derived from the caller's actual recorded data: one alert
     * / per budget category whose spending approaches or exceeds its allocation,
     * / plus an alert when total spending approaches or exceeds expected income.
     */
    getSpendingAlerts(from: Timestamp, to: Timestamp): Promise<Array<SpendingAlert>>;
    isCallerAdmin(): Promise<boolean>;
    /**
     * / The caller's categories with allocated amounts derived from current
     * / expected income.
     */
    listBudgetCategories(): Promise<Array<BudgetCategory>>;
    /**
     * / List the caller's business records, optionally filtered to an inclusive
     * / date range. A `null` bound leaves that side unbounded.
     */
    listBusinessRecords(from: Timestamp | null, to: Timestamp | null): Promise<Array<BusinessRecord>>;
    /**
     * / List the caller's contributions, optionally filtered to one project.
     */
    listContributions(projectId: RecordId | null): Promise<Array<ProjectContribution>>;
    /**
     * / List the caller's debt payments, optionally filtered to one debt.
     */
    listDebtPayments(debtId: RecordId | null): Promise<Array<DebtPayment>>;
    /**
     * / List the caller's debts with their remaining balances and the total
     * / outstanding debt.
     * /
     * / `debt.balance` is already the outstanding balance: `recordDebtPayment`
     * / reduces it by the payment amount when the payment is recorded. The
     * / remaining balance is therefore reported directly, without subtracting the
     * / recorded payments a second time.
     */
    listDebts(): Promise<DebtSummary>;
    /**
     * / List the caller's entries, most recent first, with optional filters.
     */
    listEntries(filter: EntryFilter): Promise<Array<FinancialEntry>>;
    /**
     * / List the caller's project expenses, optionally filtered to one project.
     */
    listProjectExpenses(projectId: RecordId | null): Promise<Array<ProjectExpense>>;
    /**
     * / List every project owned by the caller.
     */
    listProjects(): Promise<Array<Project>>;
    /**
     * / Record a payment against one of the caller's debts. The debt's balance is
     * / reduced by the payment amount, and the payment is recorded so available
     * / cash reflects debt payments made. A payment larger than the outstanding
     * / balance is rejected with the shared invalid-amount error.
     */
    recordDebtPayment(debtId: RecordId, amount: Money, date: Timestamp, note: string): Promise<LedgerlyResult_7>;
    /**
     * / Restore the caller's records from a snapshot, replacing the caller's
     * / existing collections. Every restored record is owned by the caller, and id
     * / counters advance past the restored ids so new records never collide.
     */
    restoreBackup(data: BackupData): Promise<LedgerlyResult_6>;
    schema(): Promise<string>;
    /**
     * / Set the caller's expected income budget and reporting period. Recalculates
     * / every category allocation from the new expected income. Rejected when the
     * / existing categories would over-allocate the new income.
     */
    setBudgetSettings(expectedIncome: Money, period: BudgetPeriod): Promise<LedgerlyResult_5>;
    /**
     * / Update a category's name and percentage. Changing the percentage
     * / recalculates that category's allocated amount from current expected income.
     */
    updateBudgetCategory(id: RecordId, name: string, percentage: bigint): Promise<LedgerlyResult_4>;
    /**
     * / Update one of the caller's business records. The record must belong to the
     * / caller; another owner's id is reported as not found.
     */
    updateBusinessRecord(id: RecordId, kind: BusinessKind, amount: Money, date: Timestamp, category: string, note: string): Promise<LedgerlyResult_3>;
    /**
     * / Update one of the caller's debts. Another owner's id is reported as not
     * / found.
     */
    updateDebt(debtId: RecordId, name: string, balance: Money, interestRate: number | null): Promise<LedgerlyResult_2>;
    /**
     * / Update one of the caller's entries. Fails with `#notFound` when the id is
     * / not owned by the caller.
     */
    updateEntry(id: RecordId, kind: EntryKind, amount: Money, date: Timestamp, category: string, note: string): Promise<LedgerlyResult_1>;
    /**
     * / Update one of the caller's projects. Only the supplied fields change.
     */
    updateProject(projectId: RecordId, name: string, target: Money, description: string): Promise<LedgerlyResult>;
}
