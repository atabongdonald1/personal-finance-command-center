import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useExportBackup, useImportBackup } from "@/hooks/useQueries";
import { formatDateTime } from "@/lib/format";
import type { BackupData, LedgerlyOutcome } from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";

/** The record collections a backup carries, in display order. */
const BACKUP_SECTIONS: Array<{ key: keyof BackupData; label: string }> = [
  { key: "entries", label: "Entries" },
  { key: "budgetCategories", label: "Budget categories" },
  { key: "projects", label: "Projects" },
  { key: "contributions", label: "Project contributions" },
  { key: "projectExpenses", label: "Project expenses" },
  { key: "businessRecords", label: "Business records" },
  { key: "debts", label: "Debts" },
  { key: "debtPayments", label: "Debt payments" },
];

interface BackupSummary {
  exportedAt: string;
  counts: Array<{ label: string; count: number }>;
  total: number;
}

function summarize(data: BackupData): BackupSummary {
  const counts = BACKUP_SECTIONS.map(({ key, label }) => {
    const value = data[key];
    return { label, count: Array.isArray(value) ? value.length : 0 };
  });
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  return {
    exportedAt: formatDateTime(data.exportedAt),
    counts,
    total,
  };
}

/** Revive bigint fields that JSON serialization turned into strings. */
function reviveBackup(raw: unknown): BackupData {
  const data = raw as Record<string, unknown>;
  const asBigInt = (value: unknown): bigint => {
    if (typeof value === "bigint") return value;
    if (typeof value === "string" || typeof value === "number") {
      return BigInt(value);
    }
    throw new Error("A numeric field in the backup is not a valid number.");
  };

  const reviveList = (
    key: keyof BackupData,
    fields: string[],
  ): Array<Record<string, unknown>> => {
    const list = data[key];
    if (!Array.isArray(list)) {
      throw new Error(`The backup is missing its "${String(key)}" records.`);
    }
    return list.map((item) => {
      const record = { ...(item as Record<string, unknown>) };
      for (const field of fields) {
        if (field in record) record[field] = asBigInt(record[field]);
      }
      return record;
    });
  };

  const entries = reviveList("entries", [
    "id",
    "amount",
    "date",
    "createdAt",
    "updatedAt",
  ]);
  const budgetCategories = reviveList("budgetCategories", [
    "id",
    "percentage",
    "allocated",
  ]);
  const projects = reviveList("projects", [
    "id",
    "target",
    "createdAt",
    "updatedAt",
  ]);
  const contributions = reviveList("contributions", [
    "id",
    "projectId",
    "amount",
    "date",
  ]);
  const projectExpenses = reviveList("projectExpenses", [
    "id",
    "projectId",
    "amount",
    "date",
  ]);
  const businessRecords = reviveList("businessRecords", [
    "id",
    "amount",
    "date",
  ]);
  const debts = reviveList("debts", [
    "id",
    "balance",
    "createdAt",
    "updatedAt",
  ]);
  const debtPayments = reviveList("debtPayments", [
    "id",
    "debtId",
    "amount",
    "date",
  ]);

  const settingsRaw = data.budgetSettings as Record<string, unknown> | null;
  const budgetSettings = settingsRaw
    ? {
        ...settingsRaw,
        expectedIncome: asBigInt(settingsRaw.expectedIncome),
        updatedAt: asBigInt(settingsRaw.updatedAt),
      }
    : null;

  return {
    entries,
    budgetCategories,
    budgetSettings,
    projects,
    contributions,
    projectExpenses,
    businessRecords,
    debts,
    debtPayments,
    exportedAt: asBigInt(data.exportedAt),
  } as unknown as BackupData;
}

function SummaryList({ summary }: { summary: BackupSummary }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {summary.total === 0
          ? "No records were included in this backup."
          : `${summary.total} record${summary.total === 1 ? "" : "s"} across ${summary.counts.filter((c) => c.count > 0).length} collection${summary.counts.filter((c) => c.count > 0).length === 1 ? "" : "s"}.`}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {summary.counts.map((item) => (
          <div
            key={item.label}
            className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-1"
          >
            <dt className="truncate text-xs text-muted-foreground">
              {item.label}
            </dt>
            <dd className="font-mono text-sm font-medium tabular-nums text-foreground">
              {item.count}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Captured {summary.exportedAt}
      </p>
    </div>
  );
}

export default function BackupPage() {
  const exportBackup = useExportBackup();
  const importBackup = useImportBackup();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exportSummary, setExportSummary] = useState<BackupSummary | null>(
    null,
  );
  const [exportError, setExportError] = useState<string | null>(null);

  const [importSummary, setImportSummary] = useState<BackupSummary | null>(
    null,
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleExport = () => {
    setExportError(null);
    exportBackup.mutate(undefined, {
      onSuccess: (data) => {
        try {
          const json = JSON.stringify(data, null, 2);
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const stamp = new Date().toISOString().slice(0, 10);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `ledgerly-backup-${stamp}.json`;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
          setExportSummary(summarize(data));
        } catch {
          setExportError("The backup was created but could not be downloaded.");
        }
      },
      onError: () => {
        setExportError(
          "We could not export your records. Please try again in a moment.",
        );
      },
    });
  };

  const handleFile = async (file: File) => {
    setImportError(null);
    setImportSummary(null);
    setFileName(file.name);
    let parsed: BackupData;
    try {
      const text = await file.text();
      parsed = reviveBackup(JSON.parse(text));
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "That file could not be read as a Ledgerly backup.",
      );
      return;
    }
    importBackup.mutate(parsed, {
      onSuccess: (result: LedgerlyOutcome<null>) => {
        if (result.__kind__ === "err") {
          setImportError(
            "The backup was rejected by the ledger. It may belong to a different account.",
          );
          return;
        }
        setImportSummary(summarize(parsed));
      },
      onError: () => {
        setImportError(
          "We could not restore that backup. Please try again in a moment.",
        );
      },
    });
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = "";
  };

  const exporting = exportBackup.isPending;
  const importing = importBackup.isPending;

  return (
    <section data-ocid="backup.page" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Backup
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Export every record in your ledger to a portable file, and restore a
          previous backup to recover the records it holds. Your data stays
          private to your Internet Identity.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Export */}
        <Card data-ocid="backup.export_card" className="rounded-lg shadow-none">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Download className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <CardTitle className="font-display text-lg">
                  Export records
                </CardTitle>
                <CardDescription>
                  Download a complete snapshot of your ledger.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              The file includes entries, budgets, projects, business records,
              debts and their payments. Keep it somewhere safe — it is a full
              copy of your financial history.
            </p>

            <Button
              type="button"
              data-ocid="backup.export_button"
              onClick={handleExport}
              disabled={exporting}
              className="w-full rounded-md sm:w-auto"
            >
              {exporting ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              {exporting ? "Preparing export…" : "Export backup"}
            </Button>

            {exporting && (
              <div
                data-ocid="backup.export_loading_state"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Gathering your records…
              </div>
            )}

            {exportError && (
              <Alert
                variant="destructive"
                data-ocid="backup.export_error_state"
              >
                <AlertTriangle aria-hidden="true" />
                <AlertTitle>Export failed</AlertTitle>
                <AlertDescription>{exportError}</AlertDescription>
              </Alert>
            )}

            {exportSummary && !exporting && (
              <div
                data-ocid="backup.export_success_state"
                className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/5 p-4"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CheckCircle2
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  Backup downloaded
                </div>
                <SummaryList summary={exportSummary} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Restore */}
        <Card
          data-ocid="backup.restore_card"
          className="rounded-lg shadow-none"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-md bg-accent/15 text-accent">
                <Upload className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <CardTitle className="font-display text-lg">
                  Restore from backup
                </CardTitle>
                <CardDescription>
                  Recover the records held in an exported file.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Choose a Ledgerly backup file. Its records are added back to your
              ledger, so you can recover from a mistake or move to a new device.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              data-ocid="backup.file_input"
              onChange={onFileChange}
            />
            <Button
              type="button"
              variant="outline"
              data-ocid="backup.upload_button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="w-full rounded-md sm:w-auto"
            >
              {importing ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <FileUp className="size-4" aria-hidden="true" />
              )}
              {importing ? "Restoring…" : "Choose backup file"}
            </Button>

            {fileName && (
              <p className="truncate text-xs text-muted-foreground">
                Selected: <span className="font-mono">{fileName}</span>
              </p>
            )}

            {importing && (
              <div
                data-ocid="backup.restore_loading_state"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Restoring your records…
              </div>
            )}

            {importError && (
              <Alert
                variant="destructive"
                data-ocid="backup.restore_error_state"
              >
                <AlertTriangle aria-hidden="true" />
                <AlertTitle>Restore failed</AlertTitle>
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            {importSummary && !importing && (
              <div
                data-ocid="backup.restore_success_state"
                className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/5 p-4"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CheckCircle2
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  Backup restored
                </div>
                <SummaryList summary={importSummary} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <ShieldCheck
          className="mt-0.5 size-5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">
          Backups are generated from your own ledger and never leave your
          account. Store exported files somewhere you trust, since anyone with
          the file can read your financial records.
        </p>
      </div>
    </section>
  );
}
