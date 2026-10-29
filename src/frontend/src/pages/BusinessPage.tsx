import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  useBusinessRecords,
  useBusinessSummary,
  useCreateBusinessRecord,
  useDeleteBusinessRecord,
  useUpdateBusinessRecord,
} from "@/hooks/useQueries";
import {
  businessKindLabel,
  formatDate,
  formatMoney,
  fromDateInputValue,
  parseMoney,
  toDateInputValue,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { BusinessKind } from "@/types";
import type { BusinessRecord, BusinessRecordInput } from "@/types";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

interface DraftState {
  kind: BusinessKind;
  amount: string;
  date: string;
  category: string;
  note: string;
}

function emptyDraft(): DraftState {
  return {
    kind: BusinessKind.revenue,
    amount: "",
    date: toDateInputValue(BigInt(Date.now()) * 1_000_000n),
    category: "",
    note: "",
  };
}

function draftFromRecord(record: BusinessRecord): DraftState {
  return {
    kind: record.kind,
    amount: (Number(record.amount) / 100).toFixed(2),
    date: toDateInputValue(record.date),
    category: record.category,
    note: record.note,
  };
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  index,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  tone: "revenue" | "cost" | "profit" | "flow";
  index: number;
}) {
  const toneClass =
    tone === "revenue"
      ? "text-success"
      : tone === "cost"
        ? "text-destructive"
        : tone === "profit"
          ? "text-primary"
          : "text-accent";
  return (
    <div
      data-ocid={`business.summary_card.${index}`}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-subtle transition-smooth hover:shadow-elevated sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps">{label}</span>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-md bg-muted",
            toneClass,
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <span
        className={cn("font-mono text-xl font-semibold sm:text-2xl", toneClass)}
      >
        {value}
      </span>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => `summary-skeleton-${i}`).map(
        (id) => (
          <div
            key={id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-subtle"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
        ),
      )}
    </div>
  );
}

function RecordRow({
  record,
  index,
  onEdit,
  onDelete,
  deleting,
}: {
  record: BusinessRecord;
  index: number;
  onEdit: (record: BusinessRecord) => void;
  onDelete: (record: BusinessRecord) => void;
  deleting: boolean;
}) {
  const isRevenue = record.kind === "revenue";
  return (
    <li
      data-ocid={`business.item.${index}`}
      className="flex flex-col gap-3 border-b border-border px-4 py-4 transition-smooth last:border-b-0 hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
            isRevenue
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {isRevenue ? (
            <ArrowUpRight className="size-4" aria-hidden="true" />
          ) : (
            <ArrowDownRight className="size-4" aria-hidden="true" />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {record.category || businessKindLabel(record.kind)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider",
                isRevenue
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {businessKindLabel(record.kind)}
            </span>
          </div>
          <span className="truncate text-xs text-muted-foreground">
            {formatDate(record.date)}
            {record.note ? ` · ${record.note}` : ""}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span
          className={cn(
            "font-mono text-sm font-semibold tabular-nums sm:text-base",
            isRevenue ? "text-success" : "text-destructive",
          )}
        >
          {isRevenue ? "+" : "−"}
          {formatMoney(record.amount)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-ocid={`business.edit_button.${index}`}
            aria-label={`Edit ${businessKindLabel(record.kind)} record`}
            onClick={() => onEdit(record)}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-ocid={`business.delete_button.${index}`}
            aria-label={`Delete ${businessKindLabel(record.kind)} record`}
            disabled={deleting}
            onClick={() => onDelete(record)}
          >
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  );
}

export default function BusinessPage() {
  const recordsQuery = useBusinessRecords();
  const summaryQuery = useBusinessSummary();
  const createRecord = useCreateBusinessRecord();
  const updateRecord = useUpdateBusinessRecord();
  const deleteRecord = useDeleteBusinessRecord();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessRecord | null>(null);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);

  const records = recordsQuery.data ?? [];
  const summary = summaryQuery.data ?? null;

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => Number(b.date - a.date)),
    [records],
  );

  const isLoading = recordsQuery.isLoading || summaryQuery.isLoading;
  const isError = recordsQuery.isError || summaryQuery.isError;

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft());
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(record: BusinessRecord) {
    setEditing(record);
    setDraft(draftFromRecord(record));
    setFormError(null);
    setDialogOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseMoney(draft.amount);
    if (amount === null || amount <= 0n) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    const date = fromDateInputValue(draft.date);
    if (date === null) {
      setFormError("Choose a valid date.");
      return;
    }
    const input: BusinessRecordInput = {
      kind: draft.kind,
      amount,
      date,
      category: draft.category.trim(),
      note: draft.note.trim(),
    };
    setFormError(null);
    if (editing) {
      updateRecord.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => setDialogOpen(false),
          onError: () => setFormError("Could not save changes. Try again."),
        },
      );
    } else {
      createRecord.mutate(input, {
        onSuccess: () => setDialogOpen(false),
        onError: () => setFormError("Could not save the record. Try again."),
      });
    }
  }

  function handleDelete(record: BusinessRecord) {
    deleteRecord.mutate(record.id);
  }

  const isSaving = createRecord.isPending || updateRecord.isPending;

  return (
    <section data-ocid="business.page" className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="label-caps">Business ledger</span>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Business
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Track business revenue and costs on their own ledger. Profit and
            cash flow are reported here, kept entirely separate from your
            personal figures.
          </p>
        </div>
        <Button
          type="button"
          data-ocid="business.open_modal_button"
          onClick={openCreate}
          className="w-full rounded-lg sm:w-auto"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add record
        </Button>
      </header>

      {isLoading ? (
        <div data-ocid="business.loading_state" className="flex flex-col gap-6">
          <SummarySkeleton />
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-subtle">
            {Array.from({ length: 4 }, (_, i) => `row-skeleton-${i}`).map(
              (id) => (
                <Skeleton key={id} className="h-12 w-full" />
              ),
            )}
          </div>
        </div>
      ) : isError ? (
        <div
          data-ocid="business.error_state"
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-14 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-foreground">
            We couldn't load your business ledger
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Something went wrong reaching the backend. Your records are safe —
            try again.
          </p>
          <Button
            type="button"
            variant="outline"
            data-ocid="business.retry_button"
            onClick={() => {
              void recordsQuery.refetch();
              void summaryQuery.refetch();
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              index={1}
              label="Revenue"
              value={formatMoney(summary?.revenue ?? 0n)}
              icon={TrendingUp}
              tone="revenue"
            />
            <SummaryCard
              index={2}
              label="Costs"
              value={formatMoney(summary?.costs ?? 0n)}
              icon={ArrowDownRight}
              tone="cost"
            />
            <SummaryCard
              index={3}
              label="Profit"
              value={formatMoney(summary?.profit ?? 0n)}
              icon={Wallet}
              tone="profit"
            />
            <SummaryCard
              index={4}
              label="Cash flow"
              value={formatMoney(summary?.cashFlow ?? 0n)}
              icon={Briefcase}
              tone="flow"
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Records
              </h2>
              {sortedRecords.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {sortedRecords.length}{" "}
                  {sortedRecords.length === 1 ? "record" : "records"}
                </span>
              )}
            </div>

            {sortedRecords.length === 0 ? (
              <div
                data-ocid="business.empty_state"
                className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center shadow-subtle"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Briefcase className="size-6" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  No business records yet
                </p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Add your first revenue or cost to start tracking business
                  profit and cash flow separately from your personal ledger.
                </p>
                <Button
                  type="button"
                  data-ocid="business.primary_button"
                  onClick={openCreate}
                  className="rounded-lg"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add record
                </Button>
              </div>
            ) : (
              <ul
                data-ocid="business.list"
                className="overflow-hidden rounded-lg border border-border bg-card shadow-subtle"
              >
                {sortedRecords.map((record, index) => (
                  <RecordRow
                    key={record.id.toString()}
                    record={record}
                    index={index + 1}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    deleting={deleteRecord.isPending}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-ocid="business.modal" className="rounded-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit business record" : "Add business record"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details of this business record."
                : "Record business revenue or a cost. These stay separate from your personal entries."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="business-kind">Type</Label>
              <Select
                value={draft.kind}
                onValueChange={(value) =>
                  setDraft((prev) => ({ ...prev, kind: value as BusinessKind }))
                }
              >
                <SelectTrigger
                  id="business-kind"
                  data-ocid="business.select"
                  className="w-full"
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="cost">Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="business-amount">Amount</Label>
                <Input
                  id="business-amount"
                  data-ocid="business.input"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={draft.amount}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      amount: event.target.value,
                    }))
                  }
                  className="font-mono"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="business-date">Date</Label>
                <Input
                  id="business-date"
                  data-ocid="business.date_input"
                  type="date"
                  value={draft.date}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, date: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="business-category">Category</Label>
              <Input
                id="business-category"
                data-ocid="business.category_input"
                placeholder="e.g. Client invoice, Supplies"
                value={draft.category}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    category: event.target.value,
                  }))
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="business-note">Note</Label>
              <Input
                id="business-note"
                data-ocid="business.note_input"
                placeholder="Optional detail"
                value={draft.note}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, note: event.target.value }))
                }
              />
            </div>

            {formError && (
              <p
                data-ocid="business.error_state"
                role="alert"
                className="text-sm text-destructive"
              >
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                data-ocid="business.cancel_button"
                onClick={() => setDialogOpen(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                data-ocid="business.submit_button"
                disabled={isSaving}
                className="rounded-lg"
              >
                {isSaving ? "Saving…" : editing ? "Save changes" : "Add record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
