import type { backendInterface } from "@/backend";
import type { Project, ProjectFunding } from "@/types";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithActor } from "./test-utils";

const OWNER = "aaaaa-aa" as unknown as Project["owner"];

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 1n,
    owner: OWNER,
    name: "Workshop expansion",
    target: 500_000n,
    description: "New tools",
    createdAt: 0n,
    updatedAt: 0n,
    ...overrides,
  };
}

function funding(overrides: Partial<ProjectFunding> = {}): ProjectFunding {
  return {
    projectId: 1n,
    target: 500_000n,
    contributed: 200_000n,
    spent: 50_000n,
    remaining: 300_000n,
    ...overrides,
  };
}

function makeActor(
  overrides: Partial<
    Pick<
      backendInterface,
      | "listProjects"
      | "createProject"
      | "updateProject"
      | "getProjectFunding"
      | "listContributions"
      | "listProjectExpenses"
    >
  > = {},
) {
  return {
    listProjects: vi.fn<backendInterface["listProjects"]>(async () => [
      project(),
    ]),
    createProject: vi.fn<backendInterface["createProject"]>(async () => ({
      __kind__: "ok" as const,
      ok: project({ id: 2n }),
    })),
    updateProject: vi.fn<backendInterface["updateProject"]>(async () => ({
      __kind__: "ok" as const,
      ok: project(),
    })),
    getProjectFunding: vi.fn<backendInterface["getProjectFunding"]>(
      async () => ({
        __kind__: "ok" as const,
        ok: funding(),
      }),
    ),
    listContributions: vi.fn<backendInterface["listContributions"]>(
      async () => [],
    ),
    listProjectExpenses: vi.fn<backendInterface["listProjectExpenses"]>(
      async () => [],
    ),
    ...overrides,
  } satisfies Pick<
    backendInterface,
    | "listProjects"
    | "createProject"
    | "updateProject"
    | "getProjectFunding"
    | "listContributions"
    | "listProjectExpenses"
  >;
}

describe("ProjectsPage", () => {
  it("lists projects and shows funding totals when one is selected", async () => {
    const user = userEvent.setup();
    const { default: ProjectsPage } = await import("@/pages/ProjectsPage");
    renderWithActor(<ProjectsPage />, makeActor());

    await user.click(await screen.findByTestId("project.item.1"));

    expect(await screen.findByText("Total funded")).toBeInTheDocument();
    expect(screen.getByText("$2,000.00")).toBeInTheDocument();
    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
    expect(screen.getByText("$5,000.00")).toBeInTheDocument();
  });

  it("creates a project through the actor", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: ProjectsPage } = await import("@/pages/ProjectsPage");
    renderWithActor(<ProjectsPage />, actor);

    await screen.findByTestId("project.item.1");
    await user.click(screen.getByTestId("project.open_modal_button"));
    await user.type(screen.getByTestId("project.name_input"), "New roof");
    await user.type(screen.getByTestId("project.target_input"), "8000");
    await user.click(screen.getByTestId("project.save_button"));

    await waitFor(() => expect(actor.createProject).toHaveBeenCalledTimes(1));
    expect(actor.createProject).toHaveBeenCalledWith("New roof", 800_000n, "");
  });

  it("reopens a project for editing with its saved values", async () => {
    const user = userEvent.setup();
    const actor = makeActor();
    const { default: ProjectsPage } = await import("@/pages/ProjectsPage");
    renderWithActor(<ProjectsPage />, actor);

    await user.click(await screen.findByTestId("project.item.1"));
    await user.click(await screen.findByTestId("project.edit_button"));

    expect(screen.getByTestId("project.name_input")).toHaveValue(
      "Workshop expansion",
    );
    expect(screen.getByTestId("project.target_input")).toHaveValue("5000.00");

    const name = screen.getByTestId("project.name_input");
    await user.clear(name);
    await user.type(name, "Workshop v2");
    await user.click(screen.getByTestId("project.save_button"));

    await waitFor(() => expect(actor.updateProject).toHaveBeenCalledTimes(1));
    expect(actor.updateProject).toHaveBeenCalledWith(
      1n,
      "Workshop v2",
      500_000n,
      "New tools",
    );
  });

  it("shows the project-expense empty state noting exclusion from reports", async () => {
    const user = userEvent.setup();
    const { default: ProjectsPage } = await import("@/pages/ProjectsPage");
    renderWithActor(<ProjectsPage />, makeActor());

    await user.click(await screen.findByTestId("project.item.1"));

    expect(
      await screen.findByText(
        "No project expenses yet. Project expenses stay out of personal and business reports.",
      ),
    ).toBeInTheDocument();
  });
});
