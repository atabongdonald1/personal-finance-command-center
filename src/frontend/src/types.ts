/**
 * Ledgerly domain types.
 *
 * The record shapes, enums and error/result variants are owned by the backend
 * and generated into `@/backend`. This module re-exports them so the rest of the
 * frontend has a single import surface, and adds only the UI-local input and
 * filter shapes that the backend does not define.
 *
 * Money is stored in minor units (cents) as a signed integer so balances, cash
 * flow and remaining-funding figures can go negative. Timestamps are signed
 * nanoseconds since the Unix epoch (`Time.now()`).
 */

export type {
  BackupData,
  BudgetCategory,
  BudgetSettings,
  BusinessRecord,
  BusinessSummary,
  Debt,
  DebtPayment,
  FinancialEntry,
  FinancialReport,
  LedgerlyError,
  Money,
  Project,
  ProjectContribution,
  ProjectExpense,
  ProjectFunding,
  RecordId,
  SpendingAlert,
  Timestamp,
} from "@/backend";

// Enums are both a type and a runtime value, so a single value re-export
// carries both. Importing them from `@/backend` keeps one source of truth.
export {
  AlertSeverity,
  BudgetPeriod,
  BusinessKind,
  EntryKind,
} from "@/backend";

import type {
  BudgetPeriod,
  BusinessKind,
  EntryKind,
  LedgerlyError,
  Money,
  RecordId,
  Timestamp,
} from "@/backend";

/** A shared result type for fallible operations. */
export type LedgerlyOutcome<T> =
  | { __kind__: "ok"; ok: T }
  | { __kind__: "err"; err: LedgerlyError };

/** Input for creating or updating a financial entry. */
export interface EntryInput {
  kind: EntryKind;
  amount: Money;
  date: Timestamp;
  category: string;
  note: string;
}

/** Input for creating or updating a budget category. */
export interface BudgetCategoryInput {
  name: string;
  percentage: bigint;
}

/** Input for creating or updating a project. */
export interface ProjectInput {
  name: string;
  target: Money;
  description: string;
}

/** Input for creating or updating a business record. */
export interface BusinessRecordInput {
  kind: BusinessKind;
  amount: Money;
  date: Timestamp;
  category: string;
  note: string;
}

/** Input for creating or updating a debt. */
export interface DebtInput {
  name: string;
  balance: Money;
  interestRate: number | null;
}

/** Filters applied to the entry list. */
export interface EntryFilters {
  from: Timestamp | null;
  to: Timestamp | null;
  kind: EntryKind | null;
  category: string | null;
}

/** A reporting window label paired with its inclusive nanosecond bounds. */
export interface ReportWindow {
  period: BudgetPeriod;
  from: Timestamp;
  to: Timestamp;
}

/** A project identifier used by project-scoped queries. */
export type ProjectId = RecordId;
