import type { backendInterface } from "@/backend";
import { BudgetPeriod } from "@/types";
import type { BudgetCategory, BudgetSettings } from "@/types";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithActor } from "./test-utils";

const OWNER = "aaaaa-aa" as unknown as BudgetCategory["owner"];

function settings(overrides: Partial<BudgetSettings> = {}): BudgetSettings {
  return {
    owner: OWNER,
    expectedIncome: 100_000n,
    period: BudgetPeriod.monthly,
    updatedAt: 0n,
    ...overrides,
  };
}

function category(overrides: Partial<BudgetCategory> = {}): BudgetCategory {
  return {
    id: 1n,
    owner: OWNER,
    name: "Housing",
    percentage: 30n,
    allocated: 30_000n,
    ...overrides,
  };
}

function makeActor(
  overrides: Partial<
    Pick<
      backendInterface,
      | "getBudgetSettings"
      | "listBudgetCategories"
      | "setBudgetSettings"
      | "createBudgetCategory"
      | "updateBudgetCategory"
      | "deleteBudgetCategory"
    >
  > = {},
) {
  return {
    getBudgetSettings: vi.fn<backendInterface["getBudgetSettings"]>(async () =>
      settings(),
    ),
    listBudgetCategories: vi.fn<backendInterface["listBudgetCategories"]>(
      async () => [category()],
    ),
    setBudgetSettings: vi.fn<backendInterface["setBudgetSettings"]>(
      async () => ({ __kind__: "ok" as const, ok: settings() }),
    ),
    createBudgetCategory: vi.fn<backendInterface["createBudgetCategory"]>(
      async () => ({ __kind__: "ok" as const, ok: category({ id: 2n }) }),
    ),
    updateBudgetCategory: vi.fn<backendInterface["updateBudgetCategory"]>(
      async () => ({ __kind__: "ok" as const, ok: category() }),
    ),
    deleteBudgetCategory: vi.fn<backendInterface["deleteBudgetCategory"]>(
      async () => ({ __kind__: "ok" as const, ok: null }),
    ),
    ...overrides,
  } satisfies Pick<
    backendInterface,
    | "getBudgetSettings"
    | "listBudgetCategories"
    | "setBudgetSettings"
    | "createBudgetCategory"
    | "updateBudgetCategory"
    | "deleteBudgetCategory"
  >;
}

describe("BudgetsPage", () => {
  it("shows the allocated amount for a category", async () => {
    const { default: BudgetsPage } = await import("@/pages/BudgetsPage");
    renderWithActor(<BudgetsPage />, makeActor());

    expect(await screen.findByText("Housing")).toBeInTheDocument();
    expect(screen.getAllByText("$300.00").length).toBeGreaterThan(0);
    expect(screen.getByText("30% of expected income")).toBeInTheDocument();
  });

  it("updates a category percentage through the actor", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: BudgetsPage } = await import("@/pages/BudgetsPage");
    renderWithActor(<BudgetsPage />, actor);

    await screen.findByText("Housing");
    await user.click(screen.getByTestId("budget.edit_button.1"));
    const pct = screen.getByTestId("budget.category_pct_input.1");
    await user.clear(pct);
    await user.type(pct, "45");
    await user.click(screen.getByTestId("budget.save_category_button.1"));

    await waitFor(() =>
      expect(actor.updateBudgetCategory).toHaveBeenCalledWith(
        1n,
        "Housing",
        45n,
      ),
    );
  });

  it("flags over-allocation when categories exceed expected income", async () => {
    const { default: BudgetsPage } = await import("@/pages/BudgetsPage");
    renderWithActor(
      <BudgetsPage />,
      makeActor({
        listBudgetCategories: vi.fn<backendInterface["listBudgetCategories"]>(
          async () => [
            category({
              id: 1n,
              name: "Housing",
              percentage: 70n,
              allocated: 70_000n,
            }),
            category({
              id: 2n,
              name: "Savings",
              percentage: 50n,
              allocated: 50_000n,
            }),
          ],
        ),
      }),
    );

    expect(await screen.findByText("Over-allocated")).toBeInTheDocument();
    expect(
      screen.getByTestId("budget.over_allocated_state"),
    ).toBeInTheDocument();
  });

  it("shows a balanced state when allocations are within income", async () => {
    const { default: BudgetsPage } = await import("@/pages/BudgetsPage");
    renderWithActor(<BudgetsPage />, makeActor());

    expect(await screen.findByText("Within budget")).toBeInTheDocument();
    expect(screen.getByTestId("budget.balanced_state")).toBeInTheDocument();
  });

  it("saves expected income settings through the actor", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: BudgetsPage } = await import("@/pages/BudgetsPage");
    renderWithActor(<BudgetsPage />, actor);

    await screen.findByText("Housing");
    const income = screen.getByTestId("budget.income_input");
    await user.clear(income);
    await user.type(income, "2000");
    await user.click(screen.getByTestId("budget.save_settings_button"));

    await waitFor(() =>
      expect(actor.setBudgetSettings).toHaveBeenCalledWith(
        200_000n,
        BudgetPeriod.monthly,
      ),
    );
  });
});
