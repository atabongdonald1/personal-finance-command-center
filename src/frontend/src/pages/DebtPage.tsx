import { createActor } from "@/backend";
import type {
  Debt,
  DebtPayment,
  DebtSummary,
  DebtWithBalance,
  LedgerlyError,
} from "@/backend";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { formatDate, formatMoney, parseMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  Banknote,
  CreditCard,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { type FormEvent, useState } from "react";

const DEBTS_KEY = ["debts"] as const;
const paymentsKey = (debtId: bigint) =>
  ["debtPayments", debtId.toString()] as const;

/** Human-readable message for a backend domain error. */
function errorMessage(error: LedgerlyError): string {
  switch (error.__kind__) {
    case "notAuthorized":
      return "You are not authorized to change this debt.";
    case "notFound":
      return "That debt no longer exists.";
    case "invalidAmount":
      return error.invalidAmount || "Enter a valid amount.";
    case "invalidInput":
      return error.invalidInput || "Check the values you entered.";
    case "invalidPercentage":
      return error.invalidPercentage || "Enter a valid percentage.";
    case "overAllocated":
      return "That change would over-allocate your budget.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/** Today as a `yyyy-mm-dd` value for a date input. */
function todayInputValue(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Convert a `yyyy-mm-dd` input value to a nanosecond timestamp. */
function dateInputToTimestamp(value: string): bigint | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return BigInt(date.getTime()) * 1_000_000n;
}

// --- Data hooks ------------------------------------------------------------

function useDebtSummary() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<DebtSummary>({
    queryKey: DEBTS_KEY,
    queryFn: async () => {
      if (!actor) return { debts: [], totalOutstanding: 0n };
      return actor.listDebts();
    },
    enabled: !!actor && !isFetching,
  });
}

function useAllDebtPayments() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<DebtPayment[]>({
    queryKey: ["debtPayments", "all"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listDebtPayments(null);
    },
    enabled: !!actor && !isFetching,
  });
}

function useCreateDebt() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      name: string;
      balance: bigint;
      interestRate: number | null;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.createDebt(
        args.name,
        args.balance,
        args.interestRate,
      );
      if (result.__kind__ === "err") throw new Error(errorMessage(result.err));
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["debts"] });
    },
  });
}

function useRecordPayment() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      debtId: bigint;
      amount: bigint;
      date: bigint;
      note: string;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.recordDebtPayment(
        args.debtId,
        args.amount,
        args.date,
        args.note,
      );
      if (result.__kind__ === "err") throw new Error(errorMessage(result.err));
      return result.ok;
    },
    onSuccess: (_data, args) => {
      void queryClient.invalidateQueries({ queryKey: ["debts"] });
      void queryClient.invalidateQueries({
        queryKey: paymentsKey(args.debtId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["debtPayments", "all"],
      });
    },
  });
}

// --- Presentational pieces -------------------------------------------------

function SummaryTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
  tone?: "default" | "accent";
}) {
  return (
    <div
      data-ocid="debt.summary_card"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-subtle sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps">{label}</span>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-md",
            tone === "accent"
              ? "bg-accent/15 text-accent"
              : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </div>
  );
}

function DebtCardSkeleton({ id }: { id: string }) {
  return (
    <div
      key={id}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-subtle"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-2 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

function DebtCard({
  entry,
  paid,
  onRecordPayment,
}: {
  entry: DebtWithBalance;
  paid: bigint;
  onRecordPayment: (debt: Debt) => void;
}) {
  const { debt, remaining } = entry;
  const original = debt.balance;
  const progress =
    original > 0n
      ? Math.min(100, Math.max(0, Number((paid * 100n) / original)))
      : 0;
  const settled = remaining <= 0n;

  return (
    <article
      data-ocid="debt.card"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-subtle transition-smooth hover:shadow-elevated"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate font-display text-lg font-semibold tracking-tight text-foreground">
            {debt.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {debt.interestRate !== undefined && debt.interestRate !== null
              ? `${debt.interestRate}% interest · `
              : "No interest · "}
            Opened {formatDate(debt.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="label-caps">Remaining</span>
          <span
            className={cn(
              "font-mono text-xl font-semibold tracking-tight",
              settled ? "text-success" : "text-foreground",
            )}
          >
            {formatMoney(remaining)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Progress
          value={progress}
          aria-label={`${debt.name} repayment progress`}
          className={cn(
            "bg-muted",
            settled && "[&>[data-slot=progress-indicator]]:bg-success",
          )}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Paid{" "}
            <span className="font-mono text-foreground">
              {formatMoney(paid)}
            </span>{" "}
            of{" "}
            <span className="font-mono text-foreground">
              {formatMoney(original)}
            </span>
          </span>
          <span className="font-mono">{progress}%</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={settled ? "outline" : "default"}
          disabled={settled}
          onClick={() => onRecordPayment(debt)}
          data-ocid="debt.record_payment_button"
        >
          <ArrowDownRight className="size-4" aria-hidden="true" />
          Record payment
        </Button>
        {settled && (
          <span className="text-xs font-medium text-success">Paid in full</span>
        )}
      </div>
    </article>
  );
}

// --- Page ------------------------------------------------------------------

export default function DebtPage() {
  const summary = useDebtSummary();
  const payments = useAllDebtPayments();
  const createDebt = useCreateDebt();
  const recordPayment = useRecordPayment();

  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [rate, setRate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayInputValue());
  const [payNote, setPayNote] = useState("");
  const [payError, setPayError] = useState<string | null>(null);

  const debts = summary.data?.debts ?? [];
  const totalOutstanding = summary.data?.totalOutstanding ?? 0n;
  const allPayments = payments.data ?? [];
  const totalPaid = allPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0n,
  );
  const paidByDebt = new Map<string, bigint>();
  for (const payment of allPayments) {
    const key = payment.debtId.toString();
    paidByDebt.set(key, (paidByDebt.get(key) ?? 0n) + payment.amount);
  }
  const activeCount = debts.filter((entry) => entry.remaining > 0n).length;

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const trimmedName = name.trim();
    const parsedBalance = parseMoney(balance);
    if (!trimmedName) {
      setFormError("Give the debt a name.");
      return;
    }
    if (parsedBalance === null || parsedBalance <= 0n) {
      setFormError("Enter an outstanding balance greater than zero.");
      return;
    }
    let interestRate: number | null = null;
    if (rate.trim() !== "") {
      const parsedRate = Number(rate);
      if (!Number.isFinite(parsedRate) || parsedRate < 0) {
        setFormError("Interest rate must be zero or greater.");
        return;
      }
      interestRate = parsedRate;
    }

    const payload = {
      name: trimmedName,
      balance: parsedBalance,
      interestRate,
    };
    setName("");
    setBalance("");
    setRate("");
    createDebt.mutate(payload, {
      onError: (error) => {
        setFormError(
          error instanceof Error ? error.message : "Could not save the debt.",
        );
      },
    });
  }

  function openPayment(debt: Debt) {
    setPayingDebt(debt);
    setPayAmount("");
    setPayDate(todayInputValue());
    setPayNote("");
    setPayError(null);
  }

  function handleRecordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payingDebt) return;
    setPayError(null);
    const parsedAmount = parseMoney(payAmount);
    if (parsedAmount === null || parsedAmount <= 0n) {
      setPayError("Enter a payment amount greater than zero.");
      return;
    }
    const timestamp = dateInputToTimestamp(payDate);
    if (timestamp === null) {
      setPayError("Choose a valid payment date.");
      return;
    }
    const debtId = payingDebt.id;
    const payload = {
      debtId,
      amount: parsedAmount,
      date: timestamp,
      note: payNote.trim(),
    };
    setPayingDebt(null);
    recordPayment.mutate(payload, {
      onError: (error) => {
        setPayingDebt(payingDebt);
        setPayError(
          error instanceof Error
            ? error.message
            : "Could not record the payment.",
        );
      },
    });
  }

  const isLoading = summary.isLoading || payments.isLoading;
  const isError = summary.isError || payments.isError;

  return (
    <section data-ocid="debt.page" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Debt
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Track what you owe, record payments as you make them, and watch each
          balance fall toward zero.
        </p>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile
          label="Total outstanding"
          value={formatMoney(totalOutstanding)}
          hint="Across all active debts"
          icon={CreditCard}
        />
        <SummaryTile
          label="Paid to date"
          value={formatMoney(totalPaid)}
          hint="Cash applied to debt"
          icon={Banknote}
          tone="accent"
        />
        <SummaryTile
          label="Active debts"
          value={`${activeCount}`}
          hint={
            debts.length === activeCount
              ? "All balances open"
              : `${debts.length - activeCount} paid in full`
          }
          icon={Wallet}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Debt list */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Your debts
            </h2>
            {!isLoading && !isError && debts.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {debts.length} {debts.length === 1 ? "debt" : "debts"}
              </span>
            )}
          </div>

          {isLoading && (
            <div
              data-ocid="debt.loading_state"
              className="flex flex-col gap-4"
              aria-busy="true"
              aria-live="polite"
            >
              {Array.from({ length: 3 }, (_, i) => `debt-skeleton-${i}`).map(
                (id) => (
                  <DebtCardSkeleton key={id} id={id} />
                ),
              )}
            </div>
          )}

          {isError && !isLoading && (
            <Alert
              variant="destructive"
              data-ocid="debt.error_state"
              className="items-start"
            >
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertTitle>Could not load your debts</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <span>
                  The ledger did not respond. Check your connection and try
                  again.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void summary.refetch();
                    void payments.refetch();
                  }}
                  data-ocid="debt.retry_button"
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && !isError && debts.length === 0 && (
            <div
              data-ocid="debt.empty_state"
              className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center shadow-subtle"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <CreditCard className="size-6" aria-hidden="true" />
              </span>
              <p className="font-display text-base font-semibold text-foreground">
                No debts recorded yet
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add your first debt to start tracking its balance and the
                payments you make against it.
              </p>
            </div>
          )}

          {!isLoading && !isError && debts.length > 0 && (
            <div data-ocid="debt.list" className="flex flex-col gap-4">
              {debts.map((entry) => (
                <DebtCard
                  key={entry.debt.id.toString()}
                  entry={entry}
                  paid={paidByDebt.get(entry.debt.id.toString()) ?? 0n}
                  onRecordPayment={openPayment}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add debt form */}
        <Card
          data-ocid="debt.add_panel"
          className="h-fit rounded-lg border-border shadow-subtle lg:sticky lg:top-24"
        >
          <CardHeader>
            <CardTitle className="font-display text-lg">Add a debt</CardTitle>
            <CardDescription>
              Record an outstanding balance and, if it applies, its interest
              rate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreate}
              className="flex flex-col gap-4"
              noValidate
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="debt-name">Name</Label>
                <Input
                  id="debt-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Car loan"
                  autoComplete="off"
                  data-ocid="debt.name_input"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="debt-balance">Outstanding balance</Label>
                <Input
                  id="debt-balance"
                  value={balance}
                  onChange={(event) => setBalance(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  data-ocid="debt.balance_input"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="debt-rate">
                  Interest rate{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="debt-rate"
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 5.5"
                  data-ocid="debt.rate_input"
                />
              </div>

              {formError && (
                <p
                  role="alert"
                  data-ocid="debt.form_error"
                  className="text-sm font-medium text-destructive"
                >
                  {formError}
                </p>
              )}

              <Button
                type="submit"
                disabled={createDebt.isPending}
                data-ocid="debt.submit_button"
                className="w-full"
              >
                <Plus className="size-4" aria-hidden="true" />
                {createDebt.isPending ? "Saving…" : "Add debt"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Record payment dialog */}
      <Dialog
        open={payingDebt !== null}
        onOpenChange={(open) => {
          if (!open) setPayingDebt(null);
        }}
      >
        <DialogContent data-ocid="debt.payment_dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Record a payment</DialogTitle>
            <DialogDescription>
              {payingDebt
                ? `Reduce the balance of ${payingDebt.name} by the amount you paid.`
                : "Reduce a debt balance by the amount you paid."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleRecordPayment}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-amount">Amount</Label>
              <Input
                id="payment-amount"
                value={payAmount}
                onChange={(event) => setPayAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                data-ocid="debt.payment_amount_input"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-date">Date</Label>
              <Input
                id="payment-date"
                type="date"
                value={payDate}
                onChange={(event) => setPayDate(event.target.value)}
                data-ocid="debt.payment_date_input"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-note">
                Note{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="payment-note"
                value={payNote}
                onChange={(event) => setPayNote(event.target.value)}
                placeholder="e.g. Monthly instalment"
                rows={2}
                data-ocid="debt.payment_note_input"
              />
            </div>

            {payError && (
              <p
                role="alert"
                data-ocid="debt.payment_error"
                className="text-sm font-medium text-destructive"
              >
                {payError}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayingDebt(null)}
                data-ocid="debt.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={recordPayment.isPending}
                data-ocid="debt.confirm_button"
              >
                {recordPayment.isPending ? "Recording…" : "Record payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
