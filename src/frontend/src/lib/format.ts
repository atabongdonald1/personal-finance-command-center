import type { Money, Timestamp } from "@/types";

/**
 * Format a minor-unit money amount (cents) as a currency string.
 * Negative values render with a leading minus sign.
 */
export function formatMoney(
  amount: Money,
  options: { currency?: string; locale?: string; showSign?: boolean } = {},
): string {
  const { currency = "USD", locale = "en-US", showSign = false } = options;
  const value = Number(amount) / 100;
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  if (value < 0) return `-${formatted}`;
  if (showSign && value > 0) return `+${formatted}`;
  return formatted;
}

/** Parse a user-entered decimal amount into minor units (cents). */
export function parseMoney(input: string): Money | null {
  const cleaned = input.replace(/[^0-9.-]/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return BigInt(Math.round(value * 100));
}

/** Convert a backend nanosecond timestamp to a JavaScript Date, or null. */
export function timestampToDate(timestamp: Timestamp): Date | null {
  const date = new Date(Number(timestamp / 1_000_000n));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Convert a JavaScript Date to a backend nanosecond timestamp. */
export function dateToTimestamp(date: Date): Timestamp {
  return BigInt(date.getTime()) * 1_000_000n;
}

/** Format a backend timestamp as a readable date, with a fallback. */
export function formatDate(
  timestamp: Timestamp,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
): string {
  const date = timestampToDate(timestamp);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

/** Format a backend timestamp as a readable date and time. */
export function formatDateTime(timestamp: Timestamp): string {
  return formatDate(timestamp, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Format an ISO date string (`yyyy-mm-dd`) for a date input value. */
export function toDateInputValue(timestamp: Timestamp): string {
  const date = timestampToDate(timestamp);
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse a date input value (`yyyy-mm-dd`) into a backend timestamp. */
export function fromDateInputValue(value: string): Timestamp | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return dateToTimestamp(date);
}

/** Format a percentage held as a whole number. */
export function formatPercent(value: bigint | number): string {
  return `${Number(value)}%`;
}

/** Human label for a budget period. */
export function periodLabel(period: string): string {
  switch (period) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "annual":
      return "Annual";
    default:
      return period;
  }
}

/** Human label for an entry kind. */
export function entryKindLabel(kind: string): string {
  return kind === "income" ? "Income" : "Expense";
}

/** Human label for a business record kind. */
export function businessKindLabel(kind: string): string {
  return kind === "revenue" ? "Revenue" : "Cost";
}
