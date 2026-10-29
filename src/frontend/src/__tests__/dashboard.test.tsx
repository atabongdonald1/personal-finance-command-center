import type { backendInterface } from "@/backend";
import { AlertSeverity, BudgetPeriod } from "@/types";
import type {
  BudgetCategory,
  BudgetSettings,
  FinancialReport,
  SpendingAlert,
} from "@/types";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithActor } from "./test-utils";

const OWNER = "aaaaa-aa" as unknown as BudgetCategory["owner"];

function report(overrides: Partial<FinancialReport> = {}): FinancialReport {
  return {
    period: BudgetPeriod.monthly,
    from: 0n,
    to: 9_000_000_000_000_000_000n,
    income: 500_000n,
    expenses: 200_000n,
    net: 300_000n,
    byCategory: [["Groceries", 200_000n]],
    ...overrides,
  };
}

function category(overrides: Partial<BudgetCategory> = {}): BudgetCategory {
  return {
    id: 1n,
    owner: OWNER,
    name: "Housing",
    percentage: 30n,
    allocated: 150_000n,
    ...overrides,
  };
}

function alert(overrides: Partial<SpendingAlert> = {}): SpendingAlert {
  return {
    category: "Groceries",
    severity: AlertSeverity.warning,
    message: "Groceries is nearing its allocation.",
    spent: 190_000n,
    allocated: 200_000n,
    ...overrides,
  };
}

function makeActor(
  overrides: Partial<
    Pick<
      backendInterface,
      | "getFinancialReport"
      | "getBudgetSettings"
      | "listBudgetCategories"
      | "getSpendingAlerts"
    >
  > = {},
) {
  return {
    getFinancialReport: vi.fn<backendInterface["getFinancialReport"]>(
      async () => report(),
    ),
    getBudgetSettings: vi.fn<backendInterface["getBudgetSettings"]>(
      async () =>
        ({
          owner: OWNER,
          expectedIncome: 500_000n,
          period: BudgetPeriod.monthly,
          updatedAt: 0n,
        }) satisfies BudgetSettings,
    ),
    listBudgetCategories: vi.fn<backendInterface["listBudgetCategories"]>(
      async () => [category()],
    ),
    getSpendingAlerts: vi.fn<backendInterface["getSpendingAlerts"]>(
      async () => [],
    ),
    ...overrides,
  } satisfies Pick<
    backendInterface,
    | "getFinancialReport"
    | "getBudgetSettings"
    | "listBudgetCategories"
    | "getSpendingAlerts"
  >;
}

/** Render a page that uses router `Link`s inside a minimal memory router. */
function renderWithRouter(
  ui: ReactElement,
  actor: ReturnType<typeof makeActor>,
) {
  const rootRoute = createRootRoute({ component: () => ui });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => ui,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return renderWithActor(<RouterProvider router={router} />, actor);
}

describe("DashboardPage", () => {
  it("renders the dashboard shell and totals from the report", async () => {
    const { default: DashboardPage } = await import("@/pages/DashboardPage");
    renderWithActor(<DashboardPage />, makeActor());

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByText("$5,000.00").length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText("$2,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$3,000.00").length).toBeGreaterThan(0);
  });

  it("shows the allocated amount for a budget category", async () => {
    const { default: DashboardPage } = await import("@/pages/DashboardPage");
    renderWithActor(<DashboardPage />, makeActor());

    expect(await screen.findByText("Housing")).toBeInTheDocument();
    expect(screen.getAllByText("$1,500.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("30%").length).toBeGreaterThan(0);
  });

  it("raises a spending alert from recorded data", async () => {
    const { default: DashboardPage } = await import("@/pages/DashboardPage");
    renderWithActor(
      <DashboardPage />,
      makeActor({
        getSpendingAlerts: vi.fn<backendInterface["getSpendingAlerts"]>(
          async () => [alert()],
        ),
      }),
    );

    expect(
      await screen.findByText("Groceries is nearing its allocation."),
    ).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("shows the empty state when there is no activity", async () => {
    const { default: DashboardPage } = await import("@/pages/DashboardPage");
    renderWithRouter(
      <DashboardPage />,
      makeActor({
        getFinancialReport: vi.fn<backendInterface["getFinancialReport"]>(
          async () =>
            report({ income: 0n, expenses: 0n, net: 0n, byCategory: [] }),
        ),
        getBudgetSettings: vi.fn<backendInterface["getBudgetSettings"]>(
          async () => null,
        ),
        listBudgetCategories: vi.fn<backendInterface["listBudgetCategories"]>(
          async () => [],
        ),
      }),
    );

    expect(
      await screen.findByText("No activity for monthly"),
    ).toBeInTheDocument();
    expect(screen.getByText("No budget set yet")).toBeInTheDocument();
  });
});
