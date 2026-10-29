import type { backendInterface } from "@/backend";
import { EntryKind } from "@/types";
import type { FinancialEntry } from "@/types";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithActor } from "./test-utils";

const OWNER = "aaaaa-aa" as unknown as FinancialEntry["owner"];

function entry(overrides: Partial<FinancialEntry> = {}): FinancialEntry {
  return {
    id: 1n,
    owner: OWNER,
    kind: EntryKind.expense,
    amount: 2_500n,
    date: 1_700_000_000_000_000_000n,
    category: "Groceries",
    note: "Weekly shop",
    createdAt: 1_700_000_000_000_000_000n,
    updatedAt: 1_700_000_000_000_000_000n,
    ...overrides,
  };
}

function makeActor(
  overrides: Partial<
    Pick<
      backendInterface,
      "listEntries" | "createEntry" | "updateEntry" | "deleteEntry"
    >
  > = {},
) {
  return {
    listEntries: vi.fn<backendInterface["listEntries"]>(async () => [entry()]),
    createEntry: vi.fn<backendInterface["createEntry"]>(async () => ({
      __kind__: "ok" as const,
      ok: entry({ id: 2n }),
    })),
    updateEntry: vi.fn<backendInterface["updateEntry"]>(async () => ({
      __kind__: "ok" as const,
      ok: entry(),
    })),
    deleteEntry: vi.fn<backendInterface["deleteEntry"]>(async () => ({
      __kind__: "ok" as const,
      ok: null,
    })),
    ...overrides,
  } satisfies Pick<
    backendInterface,
    "listEntries" | "createEntry" | "updateEntry" | "deleteEntry"
  >;
}

describe("EntriesPage", () => {
  it("lists recorded entries with their category and amount", async () => {
    const { default: EntriesPage } = await import("@/pages/EntriesPage");
    renderWithActor(<EntriesPage />, makeActor());

    expect((await screen.findAllByText("Groceries")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/25\.00/).length).toBeGreaterThan(0);
  });

  it("records a new income entry through the actor", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: EntriesPage } = await import("@/pages/EntriesPage");
    renderWithActor(<EntriesPage />, actor);

    await screen.findAllByText("Groceries");
    await user.click(screen.getByTestId("entries.kind.income"));
    await user.type(screen.getByTestId("entries.amount_input"), "120.50");
    await user.type(screen.getByTestId("entries.category_input"), "Salary");
    await user.click(screen.getByTestId("entries.submit_button"));

    await waitFor(() => expect(actor.createEntry).toHaveBeenCalledTimes(1));
    expect(actor.createEntry).toHaveBeenCalledWith(
      EntryKind.income,
      12_050n,
      expect.any(BigInt),
      "Salary",
      "",
    );
  });

  it("rejects an entry without an amount", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: EntriesPage } = await import("@/pages/EntriesPage");
    renderWithActor(<EntriesPage />, actor);

    await screen.findAllByText("Groceries");
    await user.type(screen.getByTestId("entries.category_input"), "Salary");
    await user.click(screen.getByTestId("entries.submit_button"));

    expect(
      await screen.findByText("Enter an amount greater than zero."),
    ).toBeInTheDocument();
    expect(actor.createEntry).not.toHaveBeenCalled();
  });

  it("edits an existing entry and saves the change", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: EntriesPage } = await import("@/pages/EntriesPage");
    renderWithActor(<EntriesPage />, actor);

    await screen.findAllByText("Groceries");
    await user.click(screen.getAllByTestId("entries.edit_button.1")[0]);
    const amount = screen.getByTestId("entries.amount_input");
    await user.clear(amount);
    await user.type(amount, "30.00");
    await user.click(screen.getByTestId("entries.submit_button"));

    await waitFor(() => expect(actor.updateEntry).toHaveBeenCalledTimes(1));
    expect(actor.updateEntry).toHaveBeenCalledWith(
      1n,
      EntryKind.expense,
      3_000n,
      expect.any(BigInt),
      "Groceries",
      "Weekly shop",
    );
  });

  it("deletes an entry after confirming the dialog", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: EntriesPage } = await import("@/pages/EntriesPage");
    renderWithActor(<EntriesPage />, actor);

    await screen.findAllByText("Groceries");
    await user.click(screen.getAllByTestId("entries.delete_button.1")[0]);
    const dialog = await screen.findByTestId("entries.delete_dialog");
    await user.click(
      within(dialog).getByTestId("entries.delete_confirm_button"),
    );

    await waitFor(() => expect(actor.deleteEntry).toHaveBeenCalledWith(1n));
  });
});
