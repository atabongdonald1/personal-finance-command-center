import type { backendInterface } from "@/backend";
import { BusinessKind } from "@/types";
import type { BusinessRecord, BusinessSummary } from "@/types";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithActor } from "./test-utils";

const OWNER = "aaaaa-aa" as unknown as BusinessRecord["owner"];

function record(overrides: Partial<BusinessRecord> = {}): BusinessRecord {
  return {
    id: 1n,
    owner: OWNER,
    kind: BusinessKind.revenue,
    amount: 300_000n,
    date: 1_700_000_000_000_000_000n,
    category: "Client invoice",
    note: "",
    ...overrides,
  };
}

function summary(overrides: Partial<BusinessSummary> = {}): BusinessSummary {
  return {
    revenue: 300_000n,
    costs: 100_000n,
    profit: 200_000n,
    cashFlow: 200_000n,
    ...overrides,
  };
}

function makeActor(
  overrides: Partial<
    Pick<
      backendInterface,
      | "listBusinessRecords"
      | "getBusinessSummary"
      | "addBusinessRecord"
      | "updateBusinessRecord"
      | "deleteBusinessRecord"
    >
  > = {},
) {
  return {
    listBusinessRecords: vi.fn<backendInterface["listBusinessRecords"]>(
      async () => [record()],
    ),
    getBusinessSummary: vi.fn<backendInterface["getBusinessSummary"]>(
      async () => summary(),
    ),
    addBusinessRecord: vi.fn<backendInterface["addBusinessRecord"]>(
      async () => ({ __kind__: "ok" as const, ok: record({ id: 2n }) }),
    ),
    updateBusinessRecord: vi.fn<backendInterface["updateBusinessRecord"]>(
      async () => ({ __kind__: "ok" as const, ok: record() }),
    ),
    deleteBusinessRecord: vi.fn<backendInterface["deleteBusinessRecord"]>(
      async () => ({ __kind__: "ok" as const, ok: null }),
    ),
    ...overrides,
  } satisfies Pick<
    backendInterface,
    | "listBusinessRecords"
    | "getBusinessSummary"
    | "addBusinessRecord"
    | "updateBusinessRecord"
    | "deleteBusinessRecord"
  >;
}

describe("BusinessPage", () => {
  it("shows revenue, costs, profit and cash flow from the business summary", async () => {
    const { default: BusinessPage } = await import("@/pages/BusinessPage");
    renderWithActor(<BusinessPage />, makeActor());

    expect((await screen.findAllByText("Revenue")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Costs").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Profit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cash flow").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$3,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$1,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$2,000.00").length).toBeGreaterThan(0);
  });

  it("adds a business record through the actor", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: BusinessPage } = await import("@/pages/BusinessPage");
    renderWithActor(<BusinessPage />, actor);

    await screen.findAllByText("Revenue");
    await user.click(screen.getByTestId("business.open_modal_button"));
    await user.type(screen.getByTestId("business.input"), "450");
    await user.type(
      screen.getByTestId("business.category_input"),
      "Consulting",
    );
    await user.click(screen.getByTestId("business.submit_button"));

    await waitFor(() =>
      expect(actor.addBusinessRecord).toHaveBeenCalledTimes(1),
    );
    expect(actor.addBusinessRecord).toHaveBeenCalledWith(
      BusinessKind.revenue,
      45_000n,
      expect.any(BigInt),
      "Consulting",
      "",
    );
  });

  it("shows the empty state when there are no business records", async () => {
    const { default: BusinessPage } = await import("@/pages/BusinessPage");
    renderWithActor(
      <BusinessPage />,
      makeActor({
        listBusinessRecords: vi.fn<backendInterface["listBusinessRecords"]>(
          async () => [],
        ),
        getBusinessSummary: vi.fn<backendInterface["getBusinessSummary"]>(
          async () =>
            summary({ revenue: 0n, costs: 0n, profit: 0n, cashFlow: 0n }),
        ),
      }),
    );

    expect(
      await screen.findByText("No business records yet"),
    ).toBeInTheDocument();
  });
});
