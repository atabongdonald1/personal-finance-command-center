import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReport } from "@/hooks/useQueries";
import {
  dateToTimestamp,
  formatDate,
  formatMoney,
  periodLabel,
  toDateInputValue,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { BudgetPeriod } from "@/types";
import type { FinancialReport, Money, Timestamp } from "@/types";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Scale,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

const PERIODS: BudgetPeriod[] = [
  BudgetPeriod.daily,
  BudgetPeriod.weekly,
  BudgetPeriod.monthly,
  BudgetPeriod.annual,
];

/** Start of the day containing `date`, in local time. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The inclusive [from, to] window for a period anchored on `anchor`. */
function periodWindow(
  period: BudgetPeriod,
  anchor: Date,
): { from: Date; to: Date } {
  const day = startOfDay(anchor);
  switch (period) {
    case BudgetPeriod.daily:
      return { from: day, to: day };
    case BudgetPeriod.weekly: {
      const weekday = (day.getDay() + 6) % 7; // Monday = 0
      const from = new Date(day);
      from.setDate(day.getDate() - weekday);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      return { from, to };
    }
    case BudgetPeriod.monthly: {
      const from = new Date(day.getFullYear(), day.getMonth(), 1);
      const to = new Date(day.getFullYear(), day.getMonth() + 1, 0);
      return { from, to };
    }
    case BudgetPeriod.annual: {
      const from = new Date(day.getFullYear(), 0, 1);
      const to = new Date(day.getFullYear(), 11, 31);
      return { from, to };
    }
    default:
      return { from: day, to: day };
  }
}

/** Shift the anchor date by one period in the given direction. */
function shiftAnchor(
  period: BudgetPeriod,
  anchor: Date,
  direction: -1 | 1,
): Date {
  const next = new Date(anchor);
  switch (period) {
    case BudgetPeriod.daily:
      next.setDate(next.getDate() + direction);
      break;
    case BudgetPeriod.weekly:
      next.setDate(next.getDate() + direction * 7);
      break;
    case BudgetPeriod.monthly:
      next.setMonth(next.getMonth() + direction);
      break;
    case BudgetPeriod.annual:
      next.setFullYear(next.getFullYear() + direction);
      break;
  }
  return next;
}

/** A human label for the window, e.g. "Mar 3 – Mar 9, 2026". */
function windowLabel(period: BudgetPeriod, from: Date, to: Date): string {
  if (period === BudgetPeriod.daily) {
    return formatDate(dateToTimestamp(from), {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  if (period === BudgetPeriod.annual) {
    return `${from.getFullYear()}`;
  }
  const sameYear = from.getFullYear() === to.getFullYear();
  const fromLabel = formatDate(dateToTimestamp(from), {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const toLabel = formatDate(dateToTimestamp(to), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `${fromLabel} – ${toLabel}`;
}

interface StatCardProps {
  label: string;
  value: Money;
  icon: typeof Wallet;
  tone: "income" | "expense" | "net";
  showSign?: boolean;
}

function StatCard({ label, value, icon: Icon, tone, showSign }: StatCardProps) {
  const toneClass =
    tone === "income"
      ? "text-success"
      : tone === "expense"
        ? "text-destructive"
        : value < 0n
          ? "text-destructive"
          : "text-foreground";
  return (
    <Card
      data-ocid={`reports.stat.${tone}`}
      className="gap-3 rounded-lg py-5 shadow-subtle"
    >
      <CardHeader className="px-5">
        <div className="flex items-center justify-between gap-2">
          <span className="label-caps">{label}</span>
          <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-5">
        <p
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums tracking-tight",
            toneClass,
          )}
        >
          {formatMoney(value, { showSign })}
        </p>
      </CardContent>
    </Card>
  );
}

function StatSkeleton() {
  return (
    <Card className="gap-3 rounded-lg py-5 shadow-subtle">
      <CardHeader className="px-5">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="px-5">
        <Skeleton className="h-7 w-32" />
      </CardContent>
    </Card>
  );
}

function CategoryBreakdown({ report }: { report: FinancialReport }) {
  const rows = useMemo(() => {
    const total = report.byCategory.reduce(
      (sum, [, amount]) => sum + (amount < 0n ? -amount : amount),
      0n,
    );
    return [...report.byCategory]
      .sort((a, b) => {
        const av = a[1] < 0n ? -a[1] : a[1];
        const bv = b[1] < 0n ? -b[1] : b[1];
        return bv > av ? 1 : bv < av ? -1 : 0;
      })
      .map(([category, amount]) => {
        const magnitude = amount < 0n ? -amount : amount;
        const share = total > 0n ? Number((magnitude * 1000n) / total) / 10 : 0;
        return { category, amount, share };
      });
  }, [report.byCategory]);

  if (rows.length === 0) {
    return (
      <div
        data-ocid="reports.category.empty_state"
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-12 text-center"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Scale className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-foreground">
          No categorised activity
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Entries recorded in this period will break down by category here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        data-ocid="reports.category.table"
        className="w-full min-w-[28rem] border-collapse text-sm"
      >
        <thead>
          <tr className="border-b border-border text-left">
            <th className="label-caps py-2 pr-4 font-semibold">Category</th>
            <th className="label-caps py-2 pr-4 font-semibold">Share</th>
            <th className="label-caps py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.category}
              data-ocid={`reports.category.row.${index + 1}`}
              className="border-b border-border/60 last:border-0"
            >
              <td className="py-3 pr-4">
                <span className="font-medium text-foreground">
                  {row.category}
                </span>
              </td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:w-32">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(row.share, 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {row.share.toFixed(1)}%
                  </span>
                </div>
              </td>
              <td
                className={cn(
                  "py-3 text-right font-mono tabular-nums",
                  row.amount < 0n ? "text-destructive" : "text-foreground",
                )}
              >
                {formatMoney(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<BudgetPeriod>(BudgetPeriod.monthly);
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const { from, to } = useMemo(
    () => periodWindow(period, anchor),
    [period, anchor],
  );
  const fromTs: Timestamp = dateToTimestamp(from);
  const toTs: Timestamp = dateToTimestamp(to);

  const reportQuery = useReport(period, fromTs, toTs);
  const report = reportQuery.data ?? null;

  const hasActivity =
    report !== null &&
    (report.income !== 0n ||
      report.expenses !== 0n ||
      report.byCategory.length > 0);

  return (
    <section data-ocid="reports.page" className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Reports
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Daily, weekly, monthly and annual totals for income, expenses and
            net — reconciled directly with your recorded entries.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={period}
            onValueChange={(value) => setPeriod(value as BudgetPeriod)}
          >
            <TabsList
              data-ocid="reports.period.tab"
              className="h-10 w-full justify-start overflow-x-auto sm:w-fit"
            >
              {PERIODS.map((option) => (
                <TabsTrigger
                  key={option}
                  value={option}
                  data-ocid={`reports.period.${option}`}
                  className="px-3"
                >
                  {periodLabel(option)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              data-ocid="reports.prev_button"
              aria-label={`Previous ${periodLabel(period).toLowerCase()} period`}
              onClick={() =>
                setAnchor((current) => shiftAnchor(period, current, -1))
              }
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <label className="relative flex items-center">
              <span className="sr-only">Jump to date</span>
              <CalendarDays
                className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="date"
                data-ocid="reports.date_input"
                value={toDateInputValue(dateToTimestamp(anchor))}
                onChange={(event) => {
                  const [year, month, day] = event.target.value
                    .split("-")
                    .map(Number);
                  if (!year || !month || !day) return;
                  setAnchor(new Date(year, month - 1, day));
                }}
                className="h-9 rounded-md border border-input bg-background pl-9 pr-3 font-mono text-sm tabular-nums text-foreground transition-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="icon"
              data-ocid="reports.next_button"
              aria-label={`Next ${periodLabel(period).toLowerCase()} period`}
              onClick={() =>
                setAnchor((current) => shiftAnchor(period, current, 1))
              }
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <p
          data-ocid="reports.window_label"
          className="font-mono text-sm tabular-nums text-muted-foreground"
        >
          {windowLabel(period, from, to)}
        </p>
      </header>

      {reportQuery.isError ? (
        <div
          data-ocid="reports.error_state"
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-12 text-center"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-foreground">
            We couldn't load this report
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            The ledger could not be reached. Check your connection and try
            again.
          </p>
          <Button
            type="button"
            variant="outline"
            data-ocid="reports.retry_button"
            onClick={() => void reportQuery.refetch()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {reportQuery.isLoading || !report ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  label="Income"
                  value={report.income}
                  icon={ArrowUpRight}
                  tone="income"
                />
                <StatCard
                  label="Expenses"
                  value={report.expenses}
                  icon={ArrowDownRight}
                  tone="expense"
                />
                <StatCard
                  label="Net"
                  value={report.net}
                  icon={Scale}
                  tone="net"
                  showSign
                />
              </>
            )}
          </div>

          <Card
            data-ocid="reports.category.card"
            className="gap-4 rounded-lg shadow-subtle"
          >
            <CardHeader className="px-5">
              <CardTitle className="font-display text-lg">
                Breakdown by category
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              {reportQuery.isLoading || !report ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }, (_, i) => `row-${i}`).map((id) => (
                    <Skeleton key={id} className="h-8 w-full" />
                  ))}
                </div>
              ) : hasActivity ? (
                <CategoryBreakdown report={report} />
              ) : (
                <div
                  data-ocid="reports.empty_state"
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-12 text-center"
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Wallet className="size-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    Nothing recorded in this period
                  </p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    There are no entries for {windowLabel(period, from, to)}.
                    Move to another period or record an entry to see totals.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
