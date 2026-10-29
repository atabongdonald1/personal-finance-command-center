import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";

let pic: PocketIc | undefined;
let actor: Actor<_SERVICE>;
let canisterId: CanisterFixture<_SERVICE>["canisterId"];

const alice = createIdentity("alice");
const bob = createIdentity("bob");

beforeAll(async () => {
  pic = await PocketIc.create(PIC_URL);
  const installed = await pic.setupCanister<_SERVICE>({
    idlFactory,
    wasm: BACKEND_WASM,
  });
  actor = installed.actor;
  canisterId = installed.canisterId;
  await registerCaller(actor, alice);
});

afterAll(async () => {
  await pic?.tearDown();
});

describe("Ledgerly backend", () => {
  it("answers empty-state reads instead of trapping", async () => {
    actor.setIdentity(alice);
    await expect(
      actor.listEntries({ from: [], to: [], kind: [], category: [] }),
    ).resolves.toEqual([]);
    await expect(actor.listProjects()).resolves.toEqual([]);
    await expect(actor.listBudgetCategories()).resolves.toEqual([]);
    await expect(actor.listDebts()).resolves.toEqual({
      debts: [],
      totalOutstanding: 0n,
    });
  });

  it("round-trips an entry and reconciles it in the report", async () => {
    actor.setIdentity(alice);
    const created = await actor.createEntry(
      { income: null },
      100_000n,
      1_000n,
      "Salary",
      "",
    );
    expect(created).toHaveProperty("ok");

    const entries = await actor.listEntries({
      from: [],
      to: [],
      kind: [],
      category: [],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ amount: 100_000n, category: "Salary" });

    const report = await actor.getFinancialReport(
      { monthly: null },
      0n,
      2_000n,
    );
    expect(report.income).toBe(100_000n);
    expect(report.expenses).toBe(0n);
    expect(report.net).toBe(100_000n);
  });

  it("rejects an entry with a non-positive amount", async () => {
    actor.setIdentity(alice);
    const result = await actor.createEntry(
      { expense: null },
      0n,
      1_000n,
      "Misc",
      "",
    );
    expect(result).toHaveProperty("err");
  });

  it("allocates a budget category from expected income", async () => {
    actor.setIdentity(alice);
    await actor.setBudgetSettings(500_000n, { monthly: null });
    const created = await actor.createBudgetCategory("Housing", 30n);
    expect(created).toHaveProperty("ok");

    const categories = await actor.listBudgetCategories();
    const housing = categories.find((c) => c.name === "Housing");
    expect(housing?.allocated).toBe(150_000n);
  });

  it("computes project funding and remaining against the target", async () => {
    actor.setIdentity(alice);
    const created = await actor.createProject("Workshop", 500_000n, "");
    expect(created).toHaveProperty("ok");
    const projectId = (created as { ok: { id: bigint } }).ok.id;

    await actor.addContribution(projectId, 200_000n, 1_000n, "");
    const funding = await actor.getProjectFunding(projectId);
    expect(funding).toHaveProperty("ok");
    const summary = (funding as { ok: { contributed: bigint; remaining: bigint } })
      .ok;
    expect(summary.contributed).toBe(200_000n);
    expect(summary.remaining).toBe(300_000n);
  });

  it("keeps project expenses out of the personal report", async () => {
    actor.setIdentity(alice);
    const created = await actor.createProject("Roof", 100_000n, "");
    const projectId = (created as { ok: { id: bigint } }).ok.id;
    await actor.addProjectExpense(projectId, 50_000n, 1_000n, "Materials", "");

    const report = await actor.getFinancialReport({ monthly: null }, 0n, 2_000n);
    expect(report.expenses).toBe(0n);
    const projectExpenses = await actor.listProjectExpenses([projectId]);
    expect(projectExpenses).toHaveLength(1);
  });

  it("computes business revenue, costs and profit separately", async () => {
    actor.setIdentity(alice);
    await actor.addBusinessRecord({ revenue: null }, 300_000n, 1_000n, "Invoice", "");
    await actor.addBusinessRecord({ cost: null }, 100_000n, 1_000n, "Supplies", "");

    const summary = await actor.getBusinessSummary([], []);
    expect(summary.revenue).toBe(300_000n);
    expect(summary.costs).toBe(100_000n);
    expect(summary.profit).toBe(200_000n);
  });

  it("reduces a debt balance when a payment is recorded", async () => {
    actor.setIdentity(alice);
    const created = await actor.createDebt("Car loan", 1_000_000n, []);
    const debtId = (created as { ok: { id: bigint } }).ok.id;

    const paid = await actor.recordDebtPayment(debtId, 200_000n, 1_000n, "");
    expect(paid).toHaveProperty("ok");

    const summary = await actor.listDebts();
    const debt = summary.debts.find((d) => d.debt.id === debtId);
    expect(debt?.remaining).toBe(800_000n);
  });

  it("rejects a payment larger than the outstanding balance", async () => {
    actor.setIdentity(alice);
    const created = await actor.createDebt("Overpay", 100_000n, []);
    const debtId = (created as { ok: { id: bigint } }).ok.id;

    const rejected = await actor.recordDebtPayment(
      debtId,
      150_000n,
      1_000n,
      "",
    );
    expect(rejected).toHaveProperty("err");

    const summary = await actor.listDebts();
    const debt = summary.debts.find((d) => d.debt.id === debtId);
    expect(debt?.remaining).toBe(100_000n);
  });

  it("keeps one caller's records private from another", async () => {
    const bobActor = await registerCaller(
      pic!.createActor<_SERVICE>(idlFactory, canisterId),
      bob,
    );
    bobActor.setIdentity(bob);
    await bobActor.createEntry({ income: null }, 42_000n, 1_000n, "Bob", "");

    const bobEntries = await bobActor.listEntries({
      from: [],
      to: [],
      kind: [],
      category: [],
    });
    expect(bobEntries).toHaveLength(1);

    actor.setIdentity(alice);
    const aliceEntries = await actor.listEntries({
      from: [],
      to: [],
      kind: [],
      category: [],
    });
    expect(aliceEntries.every((e) => e.category !== "Bob")).toBe(true);
  });
});
