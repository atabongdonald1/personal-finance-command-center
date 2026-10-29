import type { backendInterface } from "@/backend";
import { BudgetPeriod } from "@/types";
import type { BackupData } from "@/types";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithActor } from "./test-utils";

const OWNER = "aaaaa-aa" as unknown as BackupData["entries"][number]["owner"];

function backup(overrides: Partial<BackupData> = {}): BackupData {
  return {
    exportedAt: 1_700_000_000_000_000_000n,
    entries: [
      {
        id: 1n,
        owner: OWNER,
        kind: "income" as never,
        amount: 100_000n,
        date: 1_700_000_000_000_000_000n,
        category: "Salary",
        note: "",
        createdAt: 0n,
        updatedAt: 0n,
      },
    ],
    budgetCategories: [],
    budgetSettings: {
      owner: OWNER,
      period: BudgetPeriod.monthly,
      expectedIncome: 500_000n,
      updatedAt: 0n,
    },
    projects: [],
    contributions: [],
    projectExpenses: [],
    businessRecords: [],
    debts: [],
    debtPayments: [],
    ...overrides,
  };
}

function makeActor(
  overrides: Partial<
    Pick<backendInterface, "exportBackup" | "restoreBackup">
  > = {},
) {
  return {
    exportBackup: vi.fn<backendInterface["exportBackup"]>(async () => backup()),
    restoreBackup: vi.fn<backendInterface["restoreBackup"]>(async () => ({
      __kind__: "ok" as const,
      ok: null,
    })),
    ...overrides,
  } satisfies Pick<backendInterface, "exportBackup" | "restoreBackup">;
}

describe("BackupPage", () => {
  it("surfaces an export error when the backup cannot be serialized", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: BackupPage } = await import("@/pages/BackupPage");
    renderWithActor(<BackupPage />, actor);

    await user.click(screen.getByTestId("backup.export_button"));

    await waitFor(() => expect(actor.exportBackup).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByTestId("backup.export_error_state"),
    ).toBeInTheDocument();
  });

  it("restores a valid backup file through the actor", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: BackupPage } = await import("@/pages/BackupPage");
    renderWithActor(<BackupPage />, actor);

    const serialized = {
      ...backup(),
      exportedAt: "1700000000000000000",
      entries: [
        {
          id: "1",
          owner: OWNER,
          kind: "income",
          amount: "100000",
          date: "1700000000000000000",
          category: "Salary",
          note: "",
          createdAt: "0",
          updatedAt: "0",
        },
      ],
      budgetSettings: {
        owner: OWNER,
        period: BudgetPeriod.monthly,
        expectedIncome: "500000",
        updatedAt: "0",
      },
    };
    const file = new File(
      [JSON.stringify(serialized)],
      "ledgerly-backup.json",
      {
        type: "application/json",
      },
    );
    Object.defineProperty(file, "text", {
      value: async () => JSON.stringify(serialized),
    });
    await user.upload(screen.getByTestId("backup.file_input"), file);

    await waitFor(() => expect(actor.restoreBackup).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByTestId("backup.restore_success_state"),
    ).toBeInTheDocument();
    expect(screen.getByText("Backup restored")).toBeInTheDocument();
  });

  it("reports an error for a file that is not a valid backup", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: BackupPage } = await import("@/pages/BackupPage");
    renderWithActor(<BackupPage />, actor);

    const file = new File(["not json"], "broken.json", {
      type: "application/json",
    });
    await user.upload(screen.getByTestId("backup.file_input"), file);

    expect(
      await screen.findByTestId("backup.restore_error_state"),
    ).toBeInTheDocument();
    expect(actor.restoreBackup).not.toHaveBeenCalled();
  });
});
