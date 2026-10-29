import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAlerts,
  useBudgetCategories,
  useBudgetSettings,
  useReport,
} from "@/hooks/useQueries";
import { formatMoney, formatPercent, periodLabel } from "@/lib/format";
import { AlertSeverity, BudgetPeriod } from "@/types";
import type { Money, Timestamp } from "@/types";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  Info,
  PiggyBank,
  Scale,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

const PERIODS: BudgetPeriod[] = [
  BudgetPeriod.daily,
  BudgetPeriod.weekly,
  BudgetPeriod.monthly,
  BudgetPeriod.annual,
];

/** Compute the inclusive [from, to] nanosecond window for a period. */
function periodWindow(period: BudgetPeriod): {
  from: Timestamp;
  to: Timestamp;
} {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (period) {
    case BudgetPeriod.daily:
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case BudgetPeriod.weekly: {
      const day = start.getDay();
      const diff = (day + 6) % 7; // Monday as the first day
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case BudgetPeriod.annual:
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return {
    from: BigInt(start.getTime()) * 1_000_000n,
    to: BigInt(end.getTime()) * 1_000_000n,
  };
}

const SEVERITY_META: Record<
  AlertSeverity,
  { label: string; icon: typeof Info; badge: string; ring: string }
> = {
  [AlertSeverity.info]: {
    label: "Info",
    icon: Info,
    badge: "border-transparent bg-secondary text-secondary-foreground",
    ring: "bg-secondary text-secondary-foreground",
  },
  [AlertSeverity.warning]: {
    label: "Warning",
    icon: AlertTriangle,
    badge: "border-transparent bg-warning text-warning-foreground",
    ring: "bg-warning text-warning-foreground",
  },
  [AlertSeverity.critical]: {
    label: "Critical",
    icon: ShieldAlert,
    badge: "border-transparent bg-destructive text-destructive-foreground",
    ring: "bg-destructive text-destructive-foreground",
  },
};

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
  tone: "neutral" | "positive" | "negative";
  ocid: string;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  ocid,
}: StatCardProps) {
  const toneClass =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-destructive"
        : "text-foreground";
  return (
    <Card
      data-ocid={ocid}
      className="gap-4 rounded-lg border-border py-5 shadow-subtle"
    >
      <CardContent className="flex flex-col gap-3 px-5">
        <div className="flex items-center justify-between gap-2">
          <span className="label-caps">{label}</span>
          <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <p
          className={`font-mono text-2xl font-semibold tabular-nums ${toneClass}`}
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function StatSkeleton() {
  return (
    <Card className="gap-4 rounded-lg border-border py-5 shadow-subtle">
      <CardContent className="flex flex-col gap-3 px-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="size-8 rounded-md" />
        </div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card
      data-ocid="dashboard.error_state"
      className="rounded-lg border-destructive/40 bg-card shadow-subtle"
    >
      <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-foreground">
          We couldn&apos;t load your dashboard
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
        <Button
          type="button"
          variant="outline"
          data-ocid="dashboard.retry_button"
          onClick={onRetry}
          className="rounded-md"
        >
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<BudgetPeriod>(BudgetPeriod.monthly);
  const window = useMemo(() => periodWindow(period), [period]);

  const reportQuery = useReport(period, window.from, window.to);
  const settingsQuery = useBudgetSettings();
  const categoriesQuery = useBudgetCategories();
  const alertsQuery = useAlerts();

  const report = reportQuery.data ?? null;
  const settings = settingsQuery.data ?? null;
  const categories = categoriesQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];

  const isLoading =
    reportQuery.isLoading ||
    settingsQuery.isLoading ||
    categoriesQuery.isLoading ||
    alertsQuery.isLoading;

  const isError =
    reportQuery.isError ||
    settingsQuery.isError ||
    categoriesQuery.isError ||
    alertsQuery.isError;

  const errorMessage =
    (reportQuery.error as Error | null)?.message ??
    (settingsQuery.error as Error | null)?.message ??
    (categoriesQuery.error as Error | null)?.message ??
    (alertsQuery.error as Error | null)?.message ??
    "Something went wrong while fetching your ledger.";

  const retry = () => {
    void reportQuery.refetch();
    void settingsQuery.refetch();
    void categoriesQuery.refetch();
    void alertsQuery.refetch();
  };

  const income: Money = report?.income ?? 0n;
  const expenses: Money = report?.expenses ?? 0n;
  const net: Money = report?.net ?? 0n;
  const balance: Money = income - expenses;

  const expectedIncome: Money = settings?.expectedIncome ?? 0n;
  const allocatedTotal = categories.reduce(
    (sum, category) => sum + category.allocated,
    0n,
  );
  const allocationPercent =
    expectedIncome > 0n
      ? Math.min(100, Number((allocatedTotal * 100n) / expectedIncome))
      : 0;
  const remainingToAllocate =
    expectedIncome > allocatedTotal ? expectedIncome - allocatedTotal : 0n;
  const overAllocated = allocatedTotal > expectedIncome;

  const hasActivity = income !== 0n || expenses !== 0n;
  const hasBudget = expectedIncome > 0n || categories.length > 0;

  return (
    <section data-ocid="dashboard.page" className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Dashboard
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Your balance, cash flow and budget allocation for the selected
            period.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="dashboard-period"
            className="text-sm font-medium text-muted-foreground"
          >
            Period
          </label>
          <Select
            value={period}
            onValueChange={(value) => setPeriod(value as BudgetPeriod)}
          >
            <SelectTrigger
              id="dashboard-period"
              data-ocid="dashboard.period.select"
              className="w-36 rounded-md"
              aria-label="Select reporting period"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  data-ocid={`dashboard.period.${option}`}
                >
                  {periodLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {isError ? (
        <ErrorState message={errorMessage} onRetry={retry} />
      ) : (
        <>
          {/* Summary stats */}
          <div
            data-ocid="dashboard.stats"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {isLoading ? (
              Array.from({ length: 4 }, (_, i) => `stat-skeleton-${i}`).map(
                (id) => <StatSkeleton key={id} />,
              )
            ) : (
              <>
                <StatCard
                  ocid="dashboard.balance.card"
                  label="Current balance"
                  value={formatMoney(balance)}
                  hint={`Net position for ${periodLabel(period).toLowerCase()}`}
                  icon={Wallet}
                  tone={balance < 0n ? "negative" : "neutral"}
                />
                <StatCard
                  ocid="dashboard.income.card"
                  label="Total income"
                  value={formatMoney(income)}
                  hint="Money recorded in this period"
                  icon={ArrowUpRight}
                  tone="positive"
                />
                <StatCard
                  ocid="dashboard.expenses.card"
                  label="Total expenses"
                  value={formatMoney(expenses)}
                  hint="Money spent in this period"
                  icon={ArrowDownRight}
                  tone="negative"
                />
                <StatCard
                  ocid="dashboard.net.card"
                  label="Net"
                  value={formatMoney(net, { showSign: true })}
                  hint={
                    net >= 0n
                      ? "You are cash-flow positive"
                      : "Spending exceeds income"
                  }
                  icon={Scale}
                  tone={net >= 0n ? "positive" : "negative"}
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Budget allocation */}
            <Card
              data-ocid="dashboard.budget.card"
              className="gap-5 rounded-lg border-border shadow-subtle lg:col-span-3"
            >
              <CardHeader className="gap-1">
                <div className="flex items-center gap-2">
                  <PiggyBank
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  <CardTitle className="font-display text-lg">
                    Budget allocation
                  </CardTitle>
                </div>
                <CardDescription>
                  How your expected income is assigned across categories.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {isLoading ? (
                  <div className="flex flex-col gap-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : !hasBudget ? (
                  <div
                    data-ocid="dashboard.budget.empty_state"
                    className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center"
                  >
                    <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <PiggyBank className="size-6" aria-hidden="true" />
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      No budget set yet
                    </p>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      Set your expected income and allocate it across categories
                      to see progress here.
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      className="rounded-md"
                      data-ocid="dashboard.budget.link"
                    >
                      <Link to="/budgets">Set up your budget</Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm text-muted-foreground">
                          Allocated{" "}
                          <span className="font-mono font-medium text-foreground">
                            {formatMoney(allocatedTotal)}
                          </span>{" "}
                          of{" "}
                          <span className="font-mono font-medium text-foreground">
                            {formatMoney(expectedIncome)}
                          </span>
                        </span>
                        <span
                          className={`font-mono text-sm font-semibold ${
                            overAllocated ? "text-destructive" : "text-primary"
                          }`}
                        >
                          {expectedIncome > 0n
                            ? formatPercent(allocationPercent)
                            : "—"}
                        </span>
                      </div>
                      <Progress
                        value={allocationPercent}
                        data-ocid="dashboard.budget.progress"
                        aria-label="Budget allocation progress"
                        className={overAllocated ? "bg-destructive/20" : ""}
                      />
                      <p className="text-xs text-muted-foreground">
                        {overAllocated
                          ? `Over-allocated by ${formatMoney(allocatedTotal - expectedIncome)}`
                          : `${formatMoney(remainingToAllocate)} still unallocated`}
                      </p>
                    </div>

                    {categories.length > 0 && (
                      <ul
                        data-ocid="dashboard.budget.list"
                        className="flex flex-col divide-y divide-border"
                      >
                        {categories.map((category, index) => {
                          const share =
                            expectedIncome > 0n
                              ? Math.min(
                                  100,
                                  Number(
                                    (category.allocated * 100n) /
                                      expectedIncome,
                                  ),
                                )
                              : 0;
                          return (
                            <li
                              key={category.id.toString()}
                              data-ocid={`dashboard.budget.item.${index + 1}`}
                              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                                  {category.name}
                                </span>
                                <span className="shrink-0 font-mono text-sm text-muted-foreground">
                                  {formatMoney(category.allocated)}
                                  <span className="ml-2 text-xs">
                                    {formatPercent(category.percentage)}
                                  </span>
                                </span>
                              </div>
                              <Progress
                                value={share}
                                aria-label={`${category.name} allocation`}
                                className="h-1.5"
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card
              data-ocid="dashboard.alerts.card"
              className="gap-5 rounded-lg border-border shadow-subtle lg:col-span-2"
            >
              <CardHeader className="gap-1">
                <div className="flex items-center gap-2">
                  <BellRing className="size-4 text-accent" aria-hidden="true" />
                  <CardTitle className="font-display text-lg">
                    Spending alerts
                  </CardTitle>
                </div>
                <CardDescription>
                  Categories that need your attention.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : alerts.length === 0 ? (
                  <div
                    data-ocid="dashboard.alerts.empty_state"
                    className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center"
                  >
                    <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
                      <TrendingUp className="size-6" aria-hidden="true" />
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      All clear
                    </p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      No spending alerts right now. Your categories are within
                      their allocations.
                    </p>
                  </div>
                ) : (
                  <ul
                    data-ocid="dashboard.alerts.list"
                    className="flex flex-col gap-3"
                  >
                    {alerts.map((alert, index) => {
                      const meta = SEVERITY_META[alert.severity];
                      const Icon = meta.icon;
                      return (
                        <li
                          key={`${alert.category}-${alert.severity}`}
                          data-ocid={`dashboard.alerts.item.${index + 1}`}
                          className="flex gap-3 rounded-lg border border-border bg-muted/30 p-3"
                        >
                          <span
                            className={`flex size-8 shrink-0 items-center justify-center rounded-md ${meta.ring}`}
                          >
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {alert.category}
                              </span>
                              <Badge className={meta.badge}>{meta.label}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {alert.message}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {formatMoney(alert.spent)} of{" "}
                              {formatMoney(alert.allocated)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Empty activity hint */}
          {!isLoading && !hasActivity && (
            <Card
              data-ocid="dashboard.activity.empty_state"
              className="rounded-lg border-dashed border-border bg-card shadow-subtle"
            >
              <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Wallet className="size-6" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  No activity for {periodLabel(period).toLowerCase()}
                </p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Record an income or expense entry to see your balance and cash
                  flow come to life.
                </p>
                <Button
                  asChild
                  className="rounded-md"
                  data-ocid="dashboard.activity.link"
                >
                  <Link to="/entries">Record an entry</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </section>
  );
}
