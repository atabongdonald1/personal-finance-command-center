import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PagePlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children?: ReactNode;
}

/**
 * Minimal, intentional placeholder used while the page bodies are implemented
 * by their dedicated page tasks. It keeps the shell navigable and compiles.
 */
export function PagePlaceholder({
  title,
  description,
  icon: Icon,
  children,
}: PagePlaceholderProps) {
  return (
    <section data-ocid="page.section" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </header>
      <div
        data-ocid="page.empty_state"
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center shadow-subtle"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-foreground">Coming together</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This view is being assembled. The navigation and data layer are ready.
        </p>
      </div>
      {children}
    </section>
  );
}
