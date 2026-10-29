import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBudgetCategories,
  useBudgetSettings,
  useCreateBudgetCategory,
  useDeleteBudgetCategory,
  useSetBudgetSettings,
  useUpdateBudgetCategory,
} from "@/hooks/useQueries";
import {
  formatMoney,
  formatPercent,
  parseMoney,
  periodLabel,
} from "@/lib/format";
import { BudgetPeriod } from "@/types";
import type { BudgetCategory } from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

const PERIODS: BudgetPeriod[] = [
  BudgetPeriod.daily,
  BudgetPeriod.weekly,
  BudgetPeriod.monthly,
  BudgetPeriod.annual,
];

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

// --- Income settings -------------------------------------------------------

function IncomeSettingsCard({
  expectedIncome,
  period,
  isSaving,
  onSave,
}: {
  expectedIncome: bigint;
  period: BudgetPeriod;
  isSaving: boolean;
  onSave: (expectedIncome: bigint, period: BudgetPeriod) => void;
}) {
  const [incomeDraft, setIncomeDraft] = useState(() =>
    expectedIncome > 0n ? (Number(expectedIncome) / 100).toFixed(2) : "",
  );
  const [periodDraft, setPeriodDraft] = useState<BudgetPeriod>(period);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseMoney(incomeDraft);
    if (parsed === null || parsed < 0n) {
      setError("Enter a valid expected income amount.");
      return;
    }
    setError(null);
    onSave(parsed, periodDraft);
  }

  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Wallet className="size-4 text-primary" aria-hidden="true" />
          Expected income
        </CardTitle>
        <CardDescription>
          Set the income you expect for the period. Category allocations are
          calculated as a percentage of this amount.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-income">Expected income</Label>
            <Input
              id="budget-income"
              data-ocid="budget.income_input"
              inputMode="decimal"
              placeholder="0.00"
              value={incomeDraft}
              onChange={(event) => setIncomeDraft(event.target.value)}
              aria-invalid={error ? true : undefined}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-period">Period</Label>
            <Select
              value={periodDraft}
              onValueChange={(value) => setPeriodDraft(value as BudgetPeriod)}
            >
              <SelectTrigger
                id="budget-period"
                data-ocid="budget.period_select"
                className="w-full"
              >
                <SelectValue placeholder="Select a period" />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {periodLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            data-ocid="budget.save_settings_button"
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving ? "Saving…" : "Save income"}
          </Button>
        </form>
        {error && (
          <p
            data-ocid="budget.income_error"
            className="mt-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Allocation summary ----------------------------------------------------

function AllocationSummary({
  expectedIncome,
  totalPercentage,
  totalAllocated,
  remaining,
  overAllocated,
}: {
  expectedIncome: bigint;
  totalPercentage: bigint;
  totalAllocated: bigint;
  remaining: bigint;
  overAllocated: boolean;
}) {
  const allocatedPct = Math.min(Number(totalPercentage), 100);
  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <PiggyBank className="size-4 text-primary" aria-hidden="true" />
          Allocation
        </CardTitle>
        <CardDescription>
          How your expected income is distributed across categories.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="label-caps">Expected income</span>
            <span className="font-mono text-lg font-semibold tabular-nums">
              {formatMoney(expectedIncome)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="label-caps">Allocated</span>
            <span className="font-mono text-lg font-semibold tabular-nums">
              {formatMoney(totalAllocated)}
            </span>
          </div>
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <span className="label-caps">Unallocated</span>
            <span
              data-ocid="budget.remaining_value"
              className={
                overAllocated
                  ? "font-mono text-lg font-semibold tabular-nums text-destructive"
                  : "font-mono text-lg font-semibold tabular-nums text-success"
              }
            >
              {formatMoney(remaining)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total allocated</span>
            <span className="font-mono font-medium tabular-nums">
              {formatPercent(totalPercentage)}
            </span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={allocatedPct}
            aria-label="Percentage of income allocated"
          >
            <div
              className={
                overAllocated
                  ? "h-full rounded-full bg-destructive transition-smooth"
                  : "h-full rounded-full bg-primary transition-smooth"
              }
              style={{ width: `${allocatedPct}%` }}
            />
          </div>
        </div>

        {overAllocated ? (
          <Alert
            variant="destructive"
            data-ocid="budget.over_allocated_state"
            className="rounded-lg"
          >
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Over-allocated</AlertTitle>
            <AlertDescription>
              Your categories total {formatPercent(totalPercentage)}, which
              exceeds your expected income by{" "}
              {formatMoney(totalAllocated - expectedIncome)}. Reduce a
              percentage to bring the plan back into balance.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert
            data-ocid="budget.balanced_state"
            className="rounded-lg border-success/40 bg-success/5"
          >
            <CheckCircle2 className="text-success" aria-hidden="true" />
            <AlertTitle>Within budget</AlertTitle>
            <AlertDescription>
              {remaining > 0n
                ? `${formatMoney(remaining)} of your expected income is still unallocated.`
                : "Every dollar of your expected income is allocated."}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// --- Category row ----------------------------------------------------------

function CategoryRow({
  category,
  index,
  isBusy,
  onUpdate,
  onDelete,
}: {
  category: BudgetCategory;
  index: number;
  isBusy: boolean;
  onUpdate: (id: bigint, name: string, percentage: bigint) => void;
  onDelete: (id: bigint) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(category.name);
  const [pctDraft, setPctDraft] = useState(String(category.percentage));
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setNameDraft(category.name);
    setPctDraft(String(category.percentage));
    setError(null);
    setEditing(true);
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = nameDraft.trim();
    if (!name) {
      setError("Give the category a name.");
      return;
    }
    const pct = Number(pctDraft);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError("Percentage must be between 0 and 100.");
      return;
    }
    setError(null);
    onUpdate(category.id, name, BigInt(Math.round(pct)));
    setEditing(false);
  }

  if (editing) {
    return (
      <li
        data-ocid={`budget.category.${index + 1}`}
        className="rounded-lg border border-ring/40 bg-muted/40 p-4"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`category-name-${index}`}>Name</Label>
              <Input
                id={`category-name-${index}`}
                data-ocid={`budget.category_name_input.${index + 1}`}
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`category-pct-${index}`}>Percentage</Label>
              <Input
                id={`category-pct-${index}`}
                data-ocid={`budget.category_pct_input.${index + 1}`}
                inputMode="numeric"
                value={pctDraft}
                onChange={(event) => setPctDraft(event.target.value)}
              />
            </div>
          </div>
          {error && (
            <p
              data-ocid={`budget.category_error.${index + 1}`}
              className="text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              data-ocid={`budget.save_category_button.${index + 1}`}
              disabled={isBusy}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              data-ocid={`budget.cancel_category_button.${index + 1}`}
              onClick={() => setEditing(false)}
            >
              <X className="size-4" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      data-ocid={`budget.category.${index + 1}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-smooth hover:border-ring/40 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-medium text-foreground">
          {category.name}
        </span>
        <span className="text-sm text-muted-foreground">
          {formatPercent(category.percentage)} of expected income
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <span className="font-mono text-base font-semibold tabular-nums">
          {formatMoney(category.allocated)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            data-ocid={`budget.edit_button.${index + 1}`}
            aria-label={`Edit ${category.name}`}
            onClick={startEdit}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            data-ocid={`budget.delete_button.${index + 1}`}
            aria-label={`Delete ${category.name}`}
            disabled={isBusy}
            onClick={() => onDelete(category.id)}
          >
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  );
}

// --- Add category form -----------------------------------------------------

function AddCategoryForm({
  isSaving,
  onAdd,
}: {
  isSaving: boolean;
  onAdd: (name: string, percentage: bigint) => void;
}) {
  const [name, setName] = useState("");
  const [pct, setPct] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the category a name.");
      return;
    }
    const value = Number(pct);
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      setError("Percentage must be between 1 and 100.");
      return;
    }
    setError(null);
    onAdd(trimmed, BigInt(Math.round(value)));
    setName("");
    setPct("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-category-name">Category name</Label>
        <Input
          id="new-category-name"
          data-ocid="budget.new_category_name_input"
          placeholder="e.g. Housing, Savings, Debt"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-category-pct">Percentage</Label>
        <Input
          id="new-category-pct"
          data-ocid="budget.new_category_pct_input"
          inputMode="numeric"
          placeholder="0"
          value={pct}
          onChange={(event) => setPct(event.target.value)}
        />
      </div>
      <Button
        type="submit"
        data-ocid="budget.add_category_button"
        disabled={isSaving}
        className="w-full sm:w-auto"
      >
        <Plus className="size-4" aria-hidden="true" />
        {isSaving ? "Adding…" : "Add category"}
      </Button>
      {error && (
        <p
          data-ocid="budget.new_category_error"
          className="text-sm text-destructive sm:col-span-3"
        >
          {error}
        </p>
      )}
    </form>
  );
}

// --- Loading skeleton ------------------------------------------------------

function BudgetsSkeleton() {
  const rows = Array.from({ length: 4 }, (_, i) => `budget-skeleton-${i}`);
  return (
    <div data-ocid="budget.loading_state" className="flex flex-col gap-6">
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
      <div className="flex flex-col gap-3">
        {rows.map((id) => (
          <Skeleton key={id} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// --- Page ------------------------------------------------------------------

export default function BudgetsPage() {
  const settingsQuery = useBudgetSettings();
  const categoriesQuery = useBudgetCategories();
  const setSettings = useSetBudgetSettings();
  const createCategory = useCreateBudgetCategory();
  const updateCategory = useUpdateBudgetCategory();
  const deleteCategory = useDeleteBudgetCategory();

  const [actionError, setActionError] = useState<string | null>(null);

  const settings = settingsQuery.data ?? null;
  const categories = categoriesQuery.data ?? [];

  const expectedIncome = settings?.expectedIncome ?? 0n;
  const period = settings?.period ?? BudgetPeriod.monthly;

  const { totalPercentage, totalAllocated, remaining, overAllocated } =
    useMemo(() => {
      const pct = categories.reduce((sum, c) => sum + c.percentage, 0n);
      const allocated = categories.reduce((sum, c) => sum + c.allocated, 0n);
      return {
        totalPercentage: pct,
        totalAllocated: allocated,
        remaining: expectedIncome - allocated,
        overAllocated: allocated > expectedIncome,
      };
    }, [categories, expectedIncome]);

  const isLoading = settingsQuery.isLoading || categoriesQuery.isLoading;
  const isError = settingsQuery.isError || categoriesQuery.isError;
  const isBusy =
    createCategory.isPending ||
    updateCategory.isPending ||
    deleteCategory.isPending;

  function handleSaveSettings(income: bigint, nextPeriod: BudgetPeriod) {
    setActionError(null);
    setSettings.mutate(
      { expectedIncome: income, period: nextPeriod },
      {
        onError: (error) => setActionError(errorMessage(error)),
      },
    );
  }

  function handleAdd(name: string, percentage: bigint) {
    setActionError(null);
    createCategory.mutate(
      { name, percentage },
      { onError: (error) => setActionError(errorMessage(error)) },
    );
  }

  function handleUpdate(id: bigint, name: string, percentage: bigint) {
    setActionError(null);
    updateCategory.mutate(
      { id, input: { name, percentage } },
      { onError: (error) => setActionError(errorMessage(error)) },
    );
  }

  function handleDelete(id: bigint) {
    setActionError(null);
    deleteCategory.mutate(id, {
      onError: (error) => setActionError(errorMessage(error)),
    });
  }

  return (
    <section data-ocid="budget.page" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Budgets
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Set your expected income, then allocate it across named categories by
          percentage. Ledgerly recalculates each amount and flags any
          over-allocation.
        </p>
      </header>

      {isLoading ? (
        <BudgetsSkeleton />
      ) : isError ? (
        <Alert
          variant="destructive"
          data-ocid="budget.error_state"
          className="rounded-lg"
        >
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Could not load your budget</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>
              We couldn&apos;t reach your ledger. Check your connection and try
              again.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-ocid="budget.retry_button"
              onClick={() => {
                void settingsQuery.refetch();
                void categoriesQuery.refetch();
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {actionError && (
            <Alert
              variant="destructive"
              data-ocid="budget.action_error_state"
              className="rounded-lg"
            >
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>That change didn&apos;t save</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <IncomeSettingsCard
              expectedIncome={expectedIncome}
              period={period}
              isSaving={setSettings.isPending}
              onSave={handleSaveSettings}
            />
            <AllocationSummary
              expectedIncome={expectedIncome}
              totalPercentage={totalPercentage}
              totalAllocated={totalAllocated}
              remaining={remaining}
              overAllocated={overAllocated}
            />
          </div>

          <Card className="rounded-lg shadow-none">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <PiggyBank className="size-4 text-primary" aria-hidden="true" />
                Categories
                {categories.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {categories.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Each category receives its percentage of your expected income.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <AddCategoryForm
                isSaving={createCategory.isPending}
                onAdd={handleAdd}
              />

              {categories.length === 0 ? (
                <div
                  data-ocid="budget.empty_state"
                  className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center"
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <PiggyBank className="size-6" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    No categories yet
                  </p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Add your first category above — try Housing at 30% or
                    Savings at 20% — to start allocating your income.
                  </p>
                </div>
              ) : (
                <ul
                  data-ocid="budget.category_list"
                  className="flex flex-col gap-3"
                >
                  {categories.map((category, index) => (
                    <CategoryRow
                      key={category.id.toString()}
                      category={category}
                      index={index}
                      isBusy={isBusy}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
