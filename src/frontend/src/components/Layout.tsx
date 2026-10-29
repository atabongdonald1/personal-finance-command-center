import { SignInButton } from "@/components/InternetIdentity";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Briefcase,
  ChartPie,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Save,
} from "lucide-react";
import { type ReactNode, useState } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/entries", label: "Entries", icon: ArrowLeftRight },
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
  { to: "/reports", label: "Reports", icon: ChartPie },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/business", label: "Business", icon: Briefcase },
  { to: "/debt", label: "Debt", icon: CreditCard },
  { to: "/backup", label: "Backup", icon: Save },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            data-ocid={`nav.link.${item.label.toLowerCase()}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link
      to="/"
      data-ocid="nav.brand_link"
      className="flex items-center gap-2.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex size-9 items-center justify-center rounded-md bg-gradient-primary text-primary-foreground">
        <PiggyBank className="size-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-tight text-foreground">
          Ledgerly
        </span>
        <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
          Plan · Allocate · Grow
        </span>
      </span>
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside
          data-ocid="nav.sidebar"
          className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex"
        >
          <div className="flex h-16 items-center border-b border-sidebar-border px-5">
            <Brand />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavLinks />
          </div>
          <div className="border-t border-sidebar-border px-3 py-3">
            <SignInButton className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-smooth hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60" />
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-4 shadow-subtle sm:px-6">
          {isMobile && (
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  data-ocid="nav.open_modal_button"
                  aria-label="Open navigation menu"
                >
                  <Menu className="size-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0">
                <SheetHeader className="border-b border-sidebar-border">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <Brand />
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-3 py-4">
                  <NavLinks onNavigate={() => setMenuOpen(false)} />
                </div>
                <div className="border-t border-sidebar-border px-3 py-3">
                  <SignInButton className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-smooth hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60" />
                </div>
              </SheetContent>
            </Sheet>
          )}
          {isMobile && <Brand />}
          <div className="ml-auto flex items-center gap-3">
            {!isMobile && (
              <span className="hidden text-sm text-muted-foreground lg:inline">
                Your private ledger
              </span>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 bg-background px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-card px-4 py-4 sm:px-6">
          <p className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
                typeof window !== "undefined" ? window.location.hostname : "",
              )}`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              caffeine.ai
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
