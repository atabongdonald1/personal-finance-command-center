import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateEntry,
  useDeleteEntry,
  useEntries,
  useUpdateEntry,
} from "@/hooks/useQueries";
import {
  entryKindLabel,
  formatDate,
  formatMoney,
  fromDateInputValue,
  parseMoney,
  toDateInputValue,
} from "@/lib/format";
import { EntryKind } from "@/types";
import type {
  EntryFilters,
  EntryInput,
  FinancialEntry,
  RecordId,
} from "@/types";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

const ALL = "__all__";

interface DraftState {
  kind: EntryKind;
  amount: string;
  date: string;
  category: string;
  note: string;
}

function emptyDraft(): DraftState {
  return {
    kind: EntryKind.expense,
    amount: "",
    date: toDateInputValue(BigInt(Date.now()) * 1_000_000n),
    category: "",
    note: "",
  };
}

function draftFromEntry(entry: FinancialEntry): DraftState {
  return {
    kind: entry.kind,
    amount: (Number(entry.amount) / 100).toFixed(2),
    date: toDateInputValue(entry.date),
    category: entry.category,
    note: entry.note,
  };
}

function sortRecent(entries: FinancialEntry[]): FinancialEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date === b.date) return Number(b.createdAt - a.createdAt);
    return a.date < b.date ? 1 : -1;
  });
}

function KindBadge({ kind }: { kind: EntryKind }) {
  const income = kind === EntryKind.income;
  return (
    <Badge
      variant="outline"
      className={
        income
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      }
    >
      {income ? (
        <ArrowDownLeft aria-hidden="true" />
      ) : (
        <ArrowUpRight aria-hidden="true" />
      )}
      {entryKindLabel(kind)}
    </Badge>
  );
}

export default function EntriesPage() {
  const [filters, setFilters] = useState<EntryFilters>({
    from: null,
    to: null,
    kind: null,
    category: null,
  });
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [editingId, setEditingId] = useState<RecordId | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FinancialEntry | null>(
    null,
  );

  const entriesQuery = useEntries(filters);
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  const entries = useMemo(
    () => sortRecent(entriesQuery.data ?? []),
    [entriesQuery.data],
  );

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entriesQuery.data ?? []) {
      if (entry.category.trim()) set.add(entry.category);
    }
    if (filters.category) set.add(filters.category);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [entriesQuery.data, filters.category]);

  const isEditing = editingId !== null;
  const isSaving = createEntry.isPending || updateEntry.isPending;
  const hasActiveFilters =
    filters.from !== null ||
    filters.to !== null ||
    filters.kind !== null ||
    filters.category !== null;

  function resetDraft() {
    setDraft(emptyDraft());
    setEditingId(null);
    setFormError(null);
  }

  function startEdit(entry: FinancialEntry) {
    setDraft(draftFromEntry(entry));
    setEditingId(entry.id);
    setFormError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseMoney(draft.amount);
    const date = fromDateInputValue(draft.date);
    const category = draft.category.trim();

    if (amount === null || amount <= 0n) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    if (date === null) {
      setFormError("Choose a valid date.");
      return;
    }
    if (!category) {
      setFormError("Add a category so this entry can be grouped.");
      return;
    }

    const input: EntryInput = {
      kind: draft.kind,
      amount,
      date,
      category,
      note: draft.note.trim(),
    };
    setFormError(null);

    if (isEditing && editingId !== null) {
      const id = editingId;
      updateEntry.mutate(
        { id, input },
        {
          onSuccess: () => resetDraft(),
          onError: () => setFormError("Could not save changes. Try again."),
        },
      );
      return;
    }

    createEntry.mutate(input, {
      onSuccess: () => resetDraft(),
      onError: () => setFormError("Could not record this entry. Try again."),
    });
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    deleteEntry.mutate(id, {
      onSuccess: () => {
        if (editingId === id) resetDraft();
        setPendingDelete(null);
      },
      onError: () => setPendingDelete(null),
    });
  }

  return (
    <section data-ocid="entries.page" className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Entries
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Record every income and expense, then filter by date range, type and
          category. Most recent first.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        {/* Record / edit form */}
        <Card
          data-ocid="entries.form_card"
          className="rounded-lg shadow-subtle lg:sticky lg:top-20"
        >
          <CardHeader className="border-b border-border">
            <CardTitle className="font-display text-lg">
              {isEditing ? "Edit entry" : "Record an entry"}
            </CardTitle>
            <CardDescription>
              {isEditing
                ? "Update the details and save your changes."
                : "Log money in or out to keep the ledger current."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              data-ocid="entries.form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
            >
              <fieldset className="flex flex-col gap-2">
                <legend className="label-caps mb-1">Type</legend>
                <div className="grid grid-cols-2 gap-2">
                  {[EntryKind.income, EntryKind.expense].map((kind) => {
                    const active = draft.kind === kind;
                    return (
                      <button
                        key={kind}
                        type="button"
                        data-ocid={`entries.kind.${kind}`}
                        aria-pressed={active}
                        onClick={() =>
                          setDraft((current) => ({ ...current, kind }))
                        }
                        className={
                          active
                            ? "flex items-center justify-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-smooth"
                            : "flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-smooth hover:bg-accent hover:text-accent-foreground"
                        }
                      >
                        {kind === EntryKind.income ? (
                          <ArrowDownLeft
                            className="size-4"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowUpRight className="size-4" aria-hidden="true" />
                        )}
                        {entryKindLabel(kind)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex flex-col gap-2">
                <Label htmlFor="entry-amount">Amount</Label>
                <Input
                  id="entry-amount"
                  data-ocid="entries.amount_input"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={draft.amount}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  className="font-mono tabular-nums"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="entry-date">Date</Label>
                <Input
                  id="entry-date"
                  data-ocid="entries.date_input"
                  type="date"
                  value={draft.date}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="entry-category">Category</Label>
                <Input
                  id="entry-category"
                  data-ocid="entries.category_input"
                  placeholder="Groceries, Salary, Rent…"
                  value={draft.category}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  list="entry-category-options"
                />
                <datalist id="entry-category-options">
                  {categoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="entry-note">Note (optional)</Label>
                <Textarea
                  id="entry-note"
                  data-ocid="entries.note_input"
                  placeholder="Add context for later review"
                  value={draft.note}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  rows={2}
                />
              </div>

              {formError && (
                <p
                  data-ocid="entries.form.error_state"
                  className="flex items-center gap-2 text-sm text-destructive"
                >
                  <AlertCircle className="size-4" aria-hidden="true" />
                  {formError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  data-ocid="entries.submit_button"
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isEditing ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <Plus aria-hidden="true" />
                  )}
                  {isSaving
                    ? "Saving…"
                    : isEditing
                      ? "Save changes"
                      : "Record entry"}
                </Button>
                {isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    data-ocid="entries.cancel_button"
                    onClick={resetDraft}
                  >
                    <X aria-hidden="true" />
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Filters + list */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card
            data-ocid="entries.filters_card"
            className="rounded-lg shadow-subtle"
          >
            <CardHeader className="border-b border-border">
              <CardTitle className="font-display text-lg">Filters</CardTitle>
              <CardDescription>
                Narrow the ledger by date range, type or category.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="filter-from">From</Label>
                  <Input
                    id="filter-from"
                    data-ocid="entries.filter.from_input"
                    type="date"
                    value={filters.from ? toDateInputValue(filters.from) : ""}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        from: fromDateInputValue(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="filter-to">To</Label>
                  <Input
                    id="filter-to"
                    data-ocid="entries.filter.to_input"
                    type="date"
                    value={filters.to ? toDateInputValue(filters.to) : ""}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        to: fromDateInputValue(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="filter-kind">Type</Label>
                  <Select
                    value={filters.kind ?? ALL}
                    onValueChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        kind: value === ALL ? null : (value as EntryKind),
                      }))
                    }
                  >
                    <SelectTrigger
                      id="filter-kind"
                      data-ocid="entries.filter.kind_select"
                      className="w-full"
                    >
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All types</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="filter-category">Category</Label>
                  <Select
                    value={filters.category ?? ALL}
                    onValueChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        category: value === ALL ? null : value,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="filter-category"
                      data-ocid="entries.filter.category_select"
                      className="w-full"
                    >
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All categories</SelectItem>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-ocid="entries.filter.clear_button"
                    onClick={() =>
                      setFilters({
                        from: null,
                        to: null,
                        kind: null,
                        category: null,
                      })
                    }
                  >
                    <RotateCcw aria-hidden="true" />
                    Clear filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {entriesQuery.isLoading && (
            <Card
              data-ocid="entries.loading_state"
              className="rounded-lg shadow-subtle"
            >
              <CardContent className="flex flex-col gap-3 pt-6">
                {Array.from({ length: 5 }, (_, i) => `entry-skeleton-${i}`).map(
                  (id) => (
                    <div key={id} className="flex items-center gap-4">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 flex-1" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  ),
                )}
              </CardContent>
            </Card>
          )}

          {entriesQuery.isError && (
            <Alert
              variant="destructive"
              data-ocid="entries.error_state"
              className="shadow-subtle"
            >
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Could not load entries</AlertTitle>
              <AlertDescription>
                <p>
                  Something went wrong reaching your ledger. Your records are
                  safe — try again.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-ocid="entries.retry_button"
                  onClick={() => void entriesQuery.refetch()}
                >
                  <RotateCcw aria-hidden="true" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!entriesQuery.isLoading && !entriesQuery.isError && (
            <Card
              data-ocid="entries.list_card"
              className="overflow-hidden rounded-lg shadow-subtle"
            >
              {entries.length === 0 ? (
                <div
                  data-ocid="entries.empty_state"
                  className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <ArrowDownLeft className="size-6" aria-hidden="true" />
                  </span>
                  <p className="font-display text-lg font-semibold">
                    {hasActiveFilters
                      ? "No entries match these filters"
                      : "No entries yet"}
                  </p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {hasActiveFilters
                      ? "Try widening the date range or clearing a filter to see more of your ledger."
                      : "Record your first income or expense to start building the ledger."}
                  </p>
                  {hasActiveFilters && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-ocid="entries.empty_state.clear_button"
                      onClick={() =>
                        setFilters({
                          from: null,
                          to: null,
                          kind: null,
                          category: null,
                        })
                      }
                    >
                      <RotateCcw aria-hidden="true" />
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 bg-muted/60">
                        <tr className="border-b border-border text-left">
                          <th className="label-caps px-4 py-3 font-semibold">
                            Date
                          </th>
                          <th className="label-caps px-4 py-3 font-semibold">
                            Type
                          </th>
                          <th className="label-caps px-4 py-3 font-semibold">
                            Category
                          </th>
                          <th className="label-caps px-4 py-3 font-semibold">
                            Note
                          </th>
                          <th className="label-caps px-4 py-3 text-right font-semibold">
                            Amount
                          </th>
                          <th className="label-caps px-4 py-3 text-right font-semibold">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry, index) => (
                          <tr
                            key={entry.id.toString()}
                            data-ocid={`entries.item.${index + 1}`}
                            className="border-b border-border/70 transition-smooth last:border-0 hover:bg-muted/40"
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                              {formatDate(entry.date)}
                            </td>
                            <td className="px-4 py-3">
                              <KindBadge kind={entry.kind} />
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {entry.category}
                            </td>
                            <td className="max-w-[16rem] truncate px-4 py-3 text-muted-foreground">
                              {entry.note || "—"}
                            </td>
                            <td
                              className={
                                entry.kind === EntryKind.income
                                  ? "whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-primary"
                                  : "whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-destructive"
                              }
                            >
                              {entry.kind === EntryKind.income ? "+" : "−"}
                              {formatMoney(entry.amount)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  data-ocid={`entries.edit_button.${index + 1}`}
                                  aria-label={`Edit ${entry.category} entry`}
                                  onClick={() => startEdit(entry)}
                                >
                                  <Pencil aria-hidden="true" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  data-ocid={`entries.delete_button.${index + 1}`}
                                  aria-label={`Delete ${entry.category} entry`}
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setPendingDelete(entry)}
                                >
                                  <Trash2 aria-hidden="true" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile stacked list */}
                  <ul className="flex flex-col divide-y divide-border md:hidden">
                    {entries.map((entry, index) => (
                      <li
                        key={entry.id.toString()}
                        data-ocid={`entries.item.${index + 1}`}
                        className="flex flex-col gap-3 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="truncate font-medium">
                              {entry.category}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(entry.date)}
                            </span>
                          </div>
                          <span
                            className={
                              entry.kind === EntryKind.income
                                ? "shrink-0 font-mono tabular-nums text-primary"
                                : "shrink-0 font-mono tabular-nums text-destructive"
                            }
                          >
                            {entry.kind === EntryKind.income ? "+" : "−"}
                            {formatMoney(entry.amount)}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="text-sm text-muted-foreground">
                            {entry.note}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <KindBadge kind={entry.kind} />
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              data-ocid={`entries.edit_button.${index + 1}`}
                              onClick={() => startEdit(entry)}
                            >
                              <Pencil aria-hidden="true" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              data-ocid={`entries.delete_button.${index + 1}`}
                              className="text-destructive hover:text-destructive"
                              onClick={() => setPendingDelete(entry)}
                            >
                              <Trash2 aria-hidden="true" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}
        </div>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent data-ocid="entries.delete_dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `${entryKindLabel(pendingDelete.kind)} · ${pendingDelete.category} · ${formatMoney(pendingDelete.amount)} on ${formatDate(pendingDelete.date)}. This cannot be undone.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="entries.delete_cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="entries.delete_confirm_button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
