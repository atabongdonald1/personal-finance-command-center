import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setIdentityForTest } from "./setup";
import { renderWithActor } from "./test-utils";

/** A minimal non-anonymous identity stand-in for the sign-in gate. */
function fakeIdentity(principalText: string) {
  return {
    getPrincipal: () => ({
      isAnonymous: () => false,
      toText: () => principalText,
    }),
  } as never;
}

describe("AuthenticatedApp", () => {
  it("shows the sign-in panel instead of a blank screen when signed out", async () => {
    setIdentityForTest({ loginStatus: "idle" });
    const { AuthenticatedApp } = await import("@/components/InternetIdentity");
    renderWithActor(
      <AuthenticatedApp title="Sign in to Ledgerly">
        <p>Private workspace</p>
      </AuthenticatedApp>,
      {},
    );

    expect(screen.getByTestId("auth.panel")).toBeInTheDocument();
    expect(screen.getByText("Sign in to Ledgerly")).toBeInTheDocument();
    expect(screen.getByTestId("auth.button")).toBeInTheDocument();
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
  });

  it("shows a loading state while the session initializes", async () => {
    setIdentityForTest({ loginStatus: "initializing" });
    const { AuthenticatedApp } = await import("@/components/InternetIdentity");
    renderWithActor(
      <AuthenticatedApp>
        <p>Private workspace</p>
      </AuthenticatedApp>,
      {},
    );

    expect(screen.getByTestId("auth.loading_state")).toBeInTheDocument();
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
  });

  it("mounts the private workspace once a principal is signed in", async () => {
    setIdentityForTest({
      loginStatus: "success",
      identity: fakeIdentity("aaaaa-aa"),
    });
    const { AuthenticatedApp } = await import("@/components/InternetIdentity");
    renderWithActor(
      <AuthenticatedApp>
        <p>Private workspace</p>
      </AuthenticatedApp>,
      {},
    );

    expect(screen.getByText("Private workspace")).toBeInTheDocument();
    expect(screen.queryByTestId("auth.panel")).not.toBeInTheDocument();
  });
});
