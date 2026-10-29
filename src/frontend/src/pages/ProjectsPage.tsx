import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddContribution,
  useAddProjectExpense,
  useContributions,
  useCreateProject,
  useDeleteProject,
  useProjectExpenses,
  useProjectFunding,
  useProjects,
  useUpdateProject,
} from "@/hooks/useQueries";
import {
  formatDate,
  formatMoney,
  fromDateInputValue,
  parseMoney,
  toDateInputValue,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Project, ProjectInput, RecordId } from "@/types";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  FolderKanban,
  Pencil,
  Plus,
  Target,
  Trash2,
  Wallet,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

const CURRENCY = "USD";

function todayInputValue(): string {
  return toDateInputValue(BigInt(Date.now()) * 1_000_000n);
}

function progressPercent(contributed: bigint, target: bigint): number {
  if (target <= 0n) return 0;
  const ratio = Number((contributed * 10_000n) / target) / 100;
  return Math.max(0, Math.min(100, ratio));
}

// --- Project create / edit dialog ------------------------------------------

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
}

function ProjectDialog({ open, onOpenChange, project }: ProjectDialogProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const isEditing = project !== null;

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Re-seed the draft whenever the dialog opens for a different record.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = open ? (project ? project.id.toString() : "new") : null;
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    if (seedKey !== null) {
      setName(project?.name ?? "");
      setTarget(project ? (Number(project.target) / 100).toFixed(2) : "");
      setDescription(project?.description ?? "");
      setError(null);
    }
  }

  const pending = createProject.isPending || updateProject.isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const parsedTarget = parseMoney(target);
    if (trimmedName === "") {
      setError("Give the project a name.");
      return;
    }
    if (parsedTarget === null || parsedTarget <= 0n) {
      setError("Enter a funding target greater than zero.");
      return;
    }
    setError(null);
    const input: ProjectInput = {
      name: trimmedName,
      target: parsedTarget,
      description: description.trim(),
    };
    const onError = () => setError("Could not save the project. Try again.");
    if (isEditing && project) {
      updateProject.mutate(
        { id: project.id, input },
        { onSuccess: () => onOpenChange(false), onError },
      );
    } else {
      createProject.mutate(input, {
        onSuccess: () => onOpenChange(false),
        onError,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ocid="project.modal">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEditing ? "Edit project" : "New project"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the name, target or description. Contributions and expenses are kept."
              : "Name the project and set the amount you want to fund."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              data-ocid="project.name_input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Workshop expansion"
              autoComplete="off"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-target">Funding target</Label>
            <Input
              id="project-target"
              data-ocid="project.target_input"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-description">
              Description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="project-description"
              data-ocid="project.description_input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this project for?"
              rows={3}
            />
          </div>
          {error && (
            <p
              data-ocid="project.error_state"
              className="flex items-center gap-2 text-sm text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                data-ocid="project.cancel_button"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              data-ocid="project.save_button"
              disabled={pending}
            >
              {pending
                ? "Saving…"
                : isEditing
                  ? "Save changes"
                  : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Contribution form ------------------------------------------------------

function ContributionForm({ projectId }: { projectId: RecordId }) {
  const addContribution = useAddContribution();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInputValue);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseMoney(amount);
    const timestamp = fromDateInputValue(date);
    if (parsed === null || parsed <= 0n) {
      setError("Enter a contribution amount greater than zero.");
      return;
    }
    if (timestamp === null) {
      setError("Choose a valid date.");
      return;
    }
    setError(null);
    const captured = { amount, note };
    setAmount("");
    setNote("");
    addContribution.mutate(
      {
        projectId,
        amount: parsed,
        date: timestamp,
        note: captured.note.trim(),
      },
      {
        onError: () => {
          setError("Could not record the contribution. Try again.");
          setAmount((current) => (current === "" ? captured.amount : current));
          setNote((current) => (current === "" ? captured.note : current));
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4"
    >
      <p className="label-caps">Record a contribution</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contribution-amount">Amount</Label>
          <Input
            id="contribution-amount"
            data-ocid="contribution.amount_input"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contribution-date">Date</Label>
          <Input
            id="contribution-date"
            data-ocid="contribution.date_input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contribution-note">
          Note{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="contribution-note"
          data-ocid="contribution.note_input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Source or memo"
        />
      </div>
      {error && (
        <p
          data-ocid="contribution.error_state"
          className="flex items-center gap-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          data-ocid="contribution.submit_button"
          disabled={addContribution.isPending}
        >
          <Plus className="size-4" aria-hidden="true" />
          {addContribution.isPending ? "Adding…" : "Add contribution"}
        </Button>
      </div>
    </form>
  );
}

// --- Expense form -----------------------------------------------------------

function ExpenseForm({ projectId }: { projectId: RecordId }) {
  const addExpense = useAddProjectExpense();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInputValue);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseMoney(amount);
    const timestamp = fromDateInputValue(date);
    if (parsed === null || parsed <= 0n) {
      setError("Enter an expense amount greater than zero.");
      return;
    }
    if (timestamp === null) {
      setError("Choose a valid date.");
      return;
    }
    setError(null);
    const captured = { amount, category, note };
    setAmount("");
    setCategory("");
    setNote("");
    addExpense.mutate(
      {
        projectId,
        amount: parsed,
        date: timestamp,
        category: captured.category.trim() || "General",
        note: captured.note.trim(),
      },
      {
        onError: () => {
          setError("Could not record the expense. Try again.");
          setAmount((current) => (current === "" ? captured.amount : current));
          setCategory((current) =>
            current === "" ? captured.category : current,
          );
          setNote((current) => (current === "" ? captured.note : current));
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4"
    >
      <p className="label-caps">Record a project expense</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-amount">Amount</Label>
          <Input
            id="expense-amount"
            data-ocid="expense.amount_input"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-date">Date</Label>
          <Input
            id="expense-date"
            data-ocid="expense.date_input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-category">Category</Label>
          <Input
            id="expense-category"
            data-ocid="expense.category_input"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Materials"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-note">
            Note{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="expense-note"
            data-ocid="expense.note_input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Vendor or memo"
          />
        </div>
      </div>
      {error && (
        <p
          data-ocid="expense.error_state"
          className="flex items-center gap-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          data-ocid="expense.submit_button"
          disabled={addExpense.isPending}
        >
          <Plus className="size-4" aria-hidden="true" />
          {addExpense.isPending ? "Adding…" : "Add expense"}
        </Button>
      </div>
    </form>
  );
}

// --- Funding summary --------------------------------------------------------

function FundingSummary({ projectId }: { projectId: RecordId }) {
  const funding = useProjectFunding(projectId);

  if (funding.isLoading) {
    return (
      <div
        data-ocid="funding.loading_state"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {Array.from({ length: 4 }, (_, i) => `funding-skeleton-${i}`).map(
          (id) => (
            <Skeleton key={id} className="h-20 rounded-lg" />
          ),
        )}
      </div>
    );
  }

  if (funding.isError || !funding.data) {
    return (
      <p
        data-ocid="funding.error_state"
        className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        Funding totals could not be loaded.
      </p>
    );
  }

  const { target, contributed, spent, remaining } = funding.data;
  const percent = progressPercent(contributed, target);
  const funded = target > 0n && contributed >= target;

  const stats = [
    {
      label: "Total funded",
      value: formatMoney(contributed, { currency: CURRENCY }),
      icon: ArrowUpRight,
      tone: "text-success",
    },
    {
      label: "Total spent",
      value: formatMoney(spent, { currency: CURRENCY }),
      icon: ArrowDownRight,
      tone: "text-accent",
    },
    {
      label: "Remaining to fund",
      value: formatMoney(remaining, { currency: CURRENCY }),
      icon: Wallet,
      tone: remaining < 0n ? "text-destructive" : "text-foreground",
    },
    {
      label: "Target",
      value: formatMoney(target, { currency: CURRENCY }),
      icon: Target,
      tone: "text-foreground",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-subtle"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Icon className="size-3.5" aria-hidden="true" />
                {stat.label}
              </span>
              <span
                className={cn(
                  "font-mono text-lg font-semibold tabular-nums",
                  stat.tone,
                )}
              >
                {stat.value}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {percent.toFixed(0)}% of target funded
          </span>
          {funded && (
            <Badge
              variant="secondary"
              className="bg-success/15 text-success"
              data-ocid="funding.success_state"
            >
              Fully funded
            </Badge>
          )}
        </div>
        <Progress
          value={percent}
          data-ocid="funding.progress"
          aria-label={`${percent.toFixed(0)} percent of target funded`}
        />
      </div>
    </div>
  );
}

// --- Contribution and expense lists ----------------------------------------

function ContributionList({ projectId }: { projectId: RecordId }) {
  const contributions = useContributions(projectId);

  if (contributions.isLoading) {
    return (
      <div
        data-ocid="contribution.loading_state"
        className="flex flex-col gap-2"
      >
        {Array.from({ length: 3 }, (_, i) => `contribution-skeleton-${i}`).map(
          (id) => (
            <Skeleton key={id} className="h-12 rounded-md" />
          ),
        )}
      </div>
    );
  }

  if (contributions.isError) {
    return (
      <p
        data-ocid="contribution.error_state"
        className="text-sm text-destructive"
      >
        Contributions could not be loaded.
      </p>
    );
  }

  const rows = contributions.data ?? [];
  if (rows.length === 0) {
    return (
      <p
        data-ocid="contribution.empty_state"
        className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
      >
        No contributions yet. Record the first one above.
      </p>
    );
  }

  return (
    <ul data-ocid="contribution.list" className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <li
          key={row.id.toString()}
          data-ocid={`contribution.item.${index + 1}`}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5"
        >
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">
              {row.note || "Contribution"}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(row.date)}
            </span>
          </div>
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-success">
            {formatMoney(row.amount, { currency: CURRENCY, showSign: true })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ExpenseList({ projectId }: { projectId: RecordId }) {
  const expenses = useProjectExpenses(projectId);

  if (expenses.isLoading) {
    return (
      <div data-ocid="expense.loading_state" className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, i) => `expense-skeleton-${i}`).map(
          (id) => (
            <Skeleton key={id} className="h-12 rounded-md" />
          ),
        )}
      </div>
    );
  }

  if (expenses.isError) {
    return (
      <p data-ocid="expense.error_state" className="text-sm text-destructive">
        Project expenses could not be loaded.
      </p>
    );
  }

  const rows = expenses.data ?? [];
  if (rows.length === 0) {
    return (
      <p
        data-ocid="expense.empty_state"
        className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
      >
        No project expenses yet. Project expenses stay out of personal and
        business reports.
      </p>
    );
  }

  return (
    <ul data-ocid="expense.list" className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <li
          key={row.id.toString()}
          data-ocid={`expense.item.${index + 1}`}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5"
        >
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">
              {row.note || row.category || "Expense"}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.category ? `${row.category} · ` : ""}
              {formatDate(row.date)}
            </span>
          </div>
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-accent">
            {formatMoney(row.amount, { currency: CURRENCY })}
          </span>
        </li>
      ))}
    </ul>
  );
}

// --- Project detail ---------------------------------------------------------

function ProjectDetail({
  project,
  onEdit,
  onDelete,
  deleting,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div data-ocid="project.detail" className="flex flex-col gap-6">
      <Card className="rounded-lg shadow-subtle">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="font-display text-xl">
                {project.name}
              </CardTitle>
              <CardDescription>
                {project.description || "No description provided."}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEdit}
                data-ocid="project.edit_button"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={deleting}
                data-ocid="project.delete_button"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <FundingSummary projectId={project.id} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-lg shadow-subtle">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Contributions
            </CardTitle>
            <CardDescription>
              Money set aside toward this project&apos;s target.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ContributionForm projectId={project.id} />
            <ContributionList projectId={project.id} />
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-subtle">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Project expenses
            </CardTitle>
            <CardDescription>
              Spending drawn from the project. Excluded from personal and
              business reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ExpenseForm projectId={project.id} />
            <ExpenseList projectId={project.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Page -------------------------------------------------------------------

export default function ProjectsPage() {
  const projects = useProjects();
  const deleteProject = useDeleteProject();
  const [selectedId, setSelectedId] = useState<RecordId | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const rows = useMemo(() => projects.data ?? [], [projects.data]);
  const selected = useMemo(
    () => rows.find((project) => project.id === selectedId) ?? null,
    [rows, selectedId],
  );

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(project: Project) {
    setEditing(project);
    setDialogOpen(true);
  }

  function handleDelete(project: Project) {
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        if (selectedId === project.id) setSelectedId(null);
      },
    });
  }

  return (
    <section data-ocid="projects.page" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Projects
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Fund the things that matter. Set a target, record contributions and
            track spending against progress.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          data-ocid="project.open_modal_button"
        >
          <Plus className="size-4" aria-hidden="true" />
          New project
        </Button>
      </header>

      {projects.isLoading && (
        <div
          data-ocid="projects.loading_state"
          className="grid gap-4 md:grid-cols-[20rem_1fr]"
        >
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => `project-skeleton-${i}`).map(
              (id) => (
                <Skeleton key={id} className="h-24 rounded-lg" />
              ),
            )}
          </div>
          <Skeleton className="h-72 rounded-lg" />
        </div>
      )}

      {projects.isError && (
        <div
          data-ocid="projects.error_state"
          className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-12 text-center"
        >
          <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            Projects could not be loaded.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void projects.refetch()}
            data-ocid="projects.retry_button"
          >
            Try again
          </Button>
        </div>
      )}

      {!projects.isLoading && !projects.isError && rows.length === 0 && (
        <div
          data-ocid="projects.empty_state"
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center shadow-subtle"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FolderKanban className="size-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-foreground">No projects yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create your first project to set a funding target and track
            contributions and spending.
          </p>
          <Button
            type="button"
            onClick={openCreate}
            data-ocid="projects.primary_button"
          >
            <Plus className="size-4" aria-hidden="true" />
            Create a project
          </Button>
        </div>
      )}

      {!projects.isLoading && !projects.isError && rows.length > 0 && (
        <div className="grid gap-6 md:grid-cols-[20rem_1fr]">
          <div
            data-ocid="project.list"
            className="flex flex-col gap-3 md:max-h-[calc(100dvh-12rem)] md:overflow-y-auto md:pr-1"
          >
            {rows.map((project, index) => {
              const active = project.id === selectedId;
              return (
                <button
                  key={project.id.toString()}
                  type="button"
                  onClick={() => setSelectedId(project.id)}
                  data-ocid={`project.item.${index + 1}`}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-4 text-left transition-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active
                      ? "border-primary bg-primary/5 shadow-subtle"
                      : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
                  )}
                >
                  <span className="truncate font-medium text-foreground">
                    {project.name}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    Target {formatMoney(project.target, { currency: CURRENCY })}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="min-w-0">
            {selected ? (
              <ProjectDetail
                project={selected}
                onEdit={() => openEdit(selected)}
                onDelete={() => handleDelete(selected)}
                deleting={deleteProject.isPending}
              />
            ) : (
              <div
                data-ocid="project.select_prompt"
                className="flex h-full min-h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center"
              >
                <FolderKanban
                  className="size-6 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-foreground">
                  Select a project
                </p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Choose a project from the list to see its funding progress,
                  contributions and expenses.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={editing}
      />
    </section>
  );
}
