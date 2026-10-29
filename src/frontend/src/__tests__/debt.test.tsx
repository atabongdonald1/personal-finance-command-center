import type { DebtSummary, backendInterface } from "@/backend";
import type { Debt, DebtPayment } from "@/types";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithActor } from "./test-utils";

const OWNER = "aaaaa-aa" as unknown as Debt["owner"];

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 1n,
    owner: OWNER,
    name: "Car loan",
    balance: 1_000_000n,
    interestRate: 5.5,
    createdAt: 0n,
    updatedAt: 0n,
    ...overrides,
  };
}

function summary(overrides: Partial<DebtSummary> = {}): DebtSummary {
  return {
    debts: [{ debt: debt(), remaining: 1_000_000n }],
    totalOutstanding: 1_000_000n,
    ...overrides,
  };
}

function payment(overrides: Partial<DebtPayment> = {}): DebtPayment {
  return {
    id: 1n,
    owner: OWNER,
    debtId: 1n,
    amount: 200_000n,
    date: 0n,
    note: "Instalment",
    ...overrides,
  };
}

function makeActor(
  overrides: Partial<
    Pick<
      backendInterface,
      "listDebts" | "listDebtPayments" | "createDebt" | "recordDebtPayment"
    >
  > = {},
) {
  return {
    listDebts: vi.fn<backendInterface["listDebts"]>(async () => summary()),
    listDebtPayments: vi.fn<backendInterface["listDebtPayments"]>(async () => [
      payment(),
    ]),
    createDebt: vi.fn<backendInterface["createDebt"]>(async () => ({
      __kind__: "ok" as const,
      ok: debt({ id: 2n }),
    })),
    recordDebtPayment: vi.fn<backendInterface["recordDebtPayment"]>(
      async () => ({
        __kind__: "ok" as const,
        ok: payment(),
      }),
    ),
    ...overrides,
  } satisfies Pick<
    backendInterface,
    "listDebts" | "listDebtPayments" | "createDebt" | "recordDebtPayment"
  >;
}

describe("DebtPage", () => {
  it("shows the outstanding balance and paid-to-date totals", async () => {
    const { default: DebtPage } = await import("@/pages/DebtPage");
    renderWithActor(<DebtPage />, makeActor());

    expect(await screen.findByText("Car loan")).toBeInTheDocument();
    expect(screen.getAllByText("$10,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$2,000.00").length).toBeGreaterThan(0);
  });

  it("records a debt payment through the actor", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: DebtPage } = await import("@/pages/DebtPage");
    renderWithActor(<DebtPage />, actor);

    await screen.findByText("Car loan");
    await user.click(screen.getByTestId("debt.record_payment_button"));
    await user.type(screen.getByTestId("debt.payment_amount_input"), "150");
    await user.click(screen.getByTestId("debt.confirm_button"));

    await waitFor(() =>
      expect(actor.recordDebtPayment).toHaveBeenCalledTimes(1),
    );
    expect(actor.recordDebtPayment).toHaveBeenCalledWith(
      1n,
      15_000n,
      expect.any(BigInt),
      "",
    );
  });

  it("rejects a payment without an amount", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: DebtPage } = await import("@/pages/DebtPage");
    renderWithActor(<DebtPage />, actor);

    await screen.findByText("Car loan");
    await user.click(screen.getByTestId("debt.record_payment_button"));
    await user.click(screen.getByTestId("debt.confirm_button"));

    expect(
      await screen.findByText("Enter a payment amount greater than zero."),
    ).toBeInTheDocument();
    expect(actor.recordDebtPayment).not.toHaveBeenCalled();
  });

  it("creates a debt through the actor", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: DebtPage } = await import("@/pages/DebtPage");
    renderWithActor(<DebtPage />, actor);

    await screen.findByText("Car loan");
    await user.type(screen.getByTestId("debt.name_input"), "Student loan");
    await user.type(screen.getByTestId("debt.balance_input"), "5000");
    await user.click(screen.getByTestId("debt.submit_button"));

    await waitFor(() => expect(actor.createDebt).toHaveBeenCalledTimes(1));
    expect(actor.createDebt).toHaveBeenCalledWith(
      "Student loan",
      500_000n,
      null,
    );
  });

  it("shows the empty state when no debts are recorded", async () => {
    const actor = makeActor({
      listDebts: vi.fn<backendInterface["listDebts"]>(async () => ({
        debts: [],
        totalOutstanding: 0n,
      })),
      listDebtPayments: vi.fn<backendInterface["listDebtPayments"]>(
        async () => [],
      ),
    });
    const { default: DebtPage } = await import("@/pages/DebtPage");
    renderWithActor(<DebtPage />, actor);

    expect(await screen.findByTestId("debt.empty_state")).toBeInTheDocument();
    expect(screen.getByText("No debts recorded yet")).toBeInTheDocument();
  });

  it("shows the error state when the ledger read fails", async () => {
    const actor = makeActor({
      listDebts: vi.fn<backendInterface["listDebts"]>(async () => {
        throw new Error("network down");
      }),
    });
    const { default: DebtPage } = await import("@/pages/DebtPage");
    renderWithActor(<DebtPage />, actor);

    expect(await screen.findByTestId("debt.error_state")).toBeInTheDocument();
    expect(screen.getByText("Could not load your debts")).toBeInTheDocument();
  });

  it("surfaces a backend rejection when a payment exceeds the balance", async () => {
    const user = userEvent.setup();
    const actor = makeActor({
      recordDebtPayment: vi.fn<backendInterface["recordDebtPayment"]>(
        async () => ({
          __kind__: "err" as const,
          err: {
            __kind__: "invalidAmount" as const,
            invalidAmount: "Payment exceeds the outstanding balance",
          },
        }),
      ),
    });
    const { default: DebtPage } = await import("@/pages/DebtPage");
    renderWithActor(<DebtPage />, actor);

    await screen.findByText("Car loan");
    await user.click(screen.getByTestId("debt.record_payment_button"));
    await user.type(screen.getByTestId("debt.payment_amount_input"), "99999");
    await user.click(screen.getByTestId("debt.confirm_button"));

    expect(
      await screen.findByText("Payment exceeds the outstanding balance"),
    ).toBeInTheDocument();
    expect(actor.recordDebtPayment).toHaveBeenCalledTimes(1);
  });
});
