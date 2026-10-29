import { AuthenticatedApp } from "@/components/InternetIdentity";
import { Layout } from "@/components/Layout";
import BackupPage from "@/pages/BackupPage";
import BudgetsPage from "@/pages/BudgetsPage";
import BusinessPage from "@/pages/BusinessPage";
import DashboardPage from "@/pages/DashboardPage";
import DebtPage from "@/pages/DebtPage";
import EntriesPage from "@/pages/EntriesPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ReportsPage from "@/pages/ReportsPage";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const entriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/entries",
  component: EntriesPage,
});

const budgetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/budgets",
  component: BudgetsPage,
});

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports",
  component: ReportsPage,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects",
  component: ProjectsPage,
});

const businessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/business",
  component: BusinessPage,
});

const debtRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/debt",
  component: DebtPage,
});

const backupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/backup",
  component: BackupPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  entriesRoute,
  budgetsRoute,
  reportsRoute,
  projectsRoute,
  businessRoute,
  debtRoute,
  backupRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <AuthenticatedApp
      title="Sign in to Ledgerly"
      description="Your financial records are private to your Internet Identity. Sign in to plan, allocate and grow."
    >
      <RouterProvider router={router} />
    </AuthenticatedApp>
  );
}
