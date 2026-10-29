import type { backendInterface } from "@/backend";
import { BudgetPeriod } from "@/types";
import type { FinancialReport } from "@/types";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithActor } from "./test-utils";

function report(overrides: Partial<FinancialReport> = {}): FinancialReport {
  return {
    period: BudgetPeriod.monthly,
    from: 0n,
    to: 0n,
    income: 500_000n,
    expenses: 200_000n,
    net: 300_000n,
    byCategory: [
      ["Groceries", -150_000n],
      ["Salary", 500_000n],
    ],
    ...overrides,
  };
}

function makeActor(
  overrides: Partial<Pick<backendInterface, "getFinancialReport">> = {},
) {
  return {
    getFinancialReport: vi.fn<backendInterface["getFinancialReport"]>(
      async () => report(),
    ),
    ...overrides,
  } satisfies Pick<backendInterface, "getFinancialReport">;
}

describe("ReportsPage", () => {
  it("shows income, expenses and net that reconcile with the report", async () => {
    const { default: ReportsPage } = await import("@/pages/ReportsPage");
    renderWithActor(<ReportsPage />, makeActor());

    expect(await screen.findByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Net")).toBeInTheDocument();
    expect(screen.getAllByText("$5,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$2,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+$3,000.00").length).toBeGreaterThan(0);
  });

  it("breaks activity down by category", async () => {
    const { default: ReportsPage } = await import("@/pages/ReportsPage");
    renderWithActor(<ReportsPage />, makeActor());

    expect(await screen.findByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByTestId("reports.category.table")).toBeInTheDocument();
  });

  it("requests the report for the selected period", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: ReportsPage } = await import("@/pages/ReportsPage");
    renderWithActor(<ReportsPage />, actor);

    await screen.findByText("Income");
    await user.click(screen.getByTestId("reports.period.daily"));

    await waitFor(() =>
      expect(actor.getFinancialReport).toHaveBeenCalledWith(
        BudgetPeriod.daily,
        expect.any(BigInt),
        expect.any(BigInt),
      ),
    );
  });

  it("shows the empty state when the period has no activity", async () => {
    const { default: ReportsPage } = await import("@/pages/ReportsPage");
    renderWithActor(
      <ReportsPage />,
      makeActor({
        getFinancialReport: vi.fn<backendInterface["getFinancialReport"]>(
          async () =>
            report({
              income: 0n,
              expenses: 0n,
              net: 0n,
              byCategory: [],
            }),
        ),
      }),
    );

    expect(
      await screen.findByText("Nothing recorded in this period"),
    ).toBeInTheDocument();
  });
});
