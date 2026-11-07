import { Fragment } from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/i18n";
import { formatShortDateTime } from "@/utils/format";

export interface RecentFile {
  path: string;
  name: string;
  openedAt: string;
}

interface EmptyStateProps {
  onOpenFile?: () => void;
  onImportPipeline?: () => void;
  onLoadDemo?: () => void;
  onOpenUrl?: (url: string) => void;
  recentFiles?: RecentFile[];
  onOpenRecentFile?: (filePath: string) => void;
}

const GITHUB_URL = "https://github.com/tansen87/easy-csv";
const MAX_RECENT_FILES = 5;

/**
 * First 8 data rows of `src-tauri/samples/easy-csv-sample-sales.csv`.
 * Real values on purpose (design 032): row 8 has an empty amount, which is
 * exactly what the `search` step in the pipeline strip drops.
 */
const SAMPLE_ROWS: {
  date: string;
  region: string;
  category: string;
  amount: string | null;
}[] = [
  { date: "2026-07-01", region: "西南", category: "服饰", amount: "14,447.65" },
  { date: "2026-07-01", region: "华东", category: "数码", amount: "12,950.81" },
  { date: "2026-07-01", region: "西南", category: "数码", amount: "13,200.21" },
  { date: "2026-07-02", region: "华南", category: "食品", amount: "13,774.78" },
  { date: "2026-07-02", region: "东北", category: "家电", amount: "12,199.54" },
  { date: "2026-07-02", region: "华东", category: "服饰", amount: "11,191.66" },
  { date: "2026-07-02", region: "华南", category: "服饰", amount: "14,091.62" },
  { date: "2026-07-03", region: "华南", category: "家电", amount: null },
];

const SAMPLE_STEPS = ["search", "dedup", "groupby"];

const TABLE_HEADER = ["日期", "地区", "品类", "金额"];

const TABLE_GRID =
  "grid grid-cols-[24px_84px_48px_48px_minmax(0,1fr)] items-center gap-2.5";

/**
 * The blank canvas (no input file, no steps) - design 032.
 *
 * Asymmetric split: copy and two actions on the left, one sample table plus
 * its pipeline strip on the right. The table is the only place that carries
 * colour; everything else stays on the neutral ramp.
 */
export function EmptyState({
  onOpenFile,
  onImportPipeline,
  onLoadDemo,
  onOpenUrl,
  recentFiles = [],
  onOpenRecentFile,
}: EmptyStateProps) {
  const { t } = useLanguage();

  return (
    <div className="relative h-full">
      <div
        className="absolute inset-0 overflow-y-auto"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex min-h-full items-center justify-center px-6 py-16 lg:px-10 xl:px-14">
          <div className="animate-empty-enter grid w-full max-w-[520px] items-center gap-16 lg:max-w-[928px] lg:grid-cols-[412px_452px]">
            <div className="flex min-w-0 flex-col">
              <p className="text-xs text-muted-foreground">{t.emptyFormats}</p>
              <h1 className="mt-3 text-[28px] font-medium leading-[1.25] tracking-[-0.015em] text-foreground">
                {t.emptyTitle}
              </h1>
              <p className="mt-3 max-w-[25rem] text-sm leading-6 text-muted-foreground">
                {t.emptySubtitle}
              </p>

              <div className="mt-8 flex items-center gap-3">
                <Button
                  size="lg"
                  onClick={onOpenFile}
                  className="px-5 text-[13px]"
                >
                  {t.openFile}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onLoadDemo}
                  className="px-5 text-[13px]"
                >
                  {t.onboardingSeeExample}
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <Button
                  variant="link"
                  size="xs"
                  onClick={onImportPipeline}
                  className="h-auto gap-1.5 px-0 text-xs font-normal text-muted-foreground hover:text-foreground hover:no-underline"
                >
                  {t.emptyImportFlow}
                </Button>
                <span className="h-3 w-px bg-border" />
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px]">
                    Alt C
                  </kbd>
                  {t.emptyAddStepShort}
                  <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px]">
                    Ctrl O
                  </kbd>
                  {t.openFile}
                </span>
              </div>

              {recentFiles.length > 0 && (
                <div className="mt-8 border-t border-border pt-4">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {t.recentFiles}
                  </p>
                  <div>
                    {recentFiles
                      .slice(0, MAX_RECENT_FILES)
                      .map((file, index) => (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => onOpenRecentFile?.(file.path)}
                          className="grid h-9 w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[7px] px-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="text-right font-mono text-xs text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] leading-5 text-foreground">
                              {file.name}
                            </span>
                            <span className="block truncate text-xs leading-4 text-muted-foreground">
                              {file.path}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            {formatShortDateTime(file.openedAt)}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <div className="overflow-hidden rounded-[14px] border border-border bg-paper shadow-[0_1px_2px_rgba(0,0,0,.05)] dark:shadow-none">
                <div
                  className={`${TABLE_GRID} h-8 border-b border-paper-rule pl-2.5 pr-3.5 text-xs text-muted-foreground`}
                >
                  <span />
                  <span>{TABLE_HEADER[0]}</span>
                  <span>{TABLE_HEADER[1]}</span>
                  <span>{TABLE_HEADER[2]}</span>
                  <span className="text-right">{TABLE_HEADER[3]}</span>
                </div>
                {SAMPLE_ROWS.map((row, index) => {
                  const flagged = row.amount === null;
                  return (
                    <div
                      key={`${row.date}-${index}`}
                      className={`${TABLE_GRID} h-7 pl-2.5 pr-3.5 text-[13px] ${
                        flagged ? "bg-empty-warn/10" : ""
                      }`}
                    >
                      <span
                        className={`text-right font-mono text-xs ${
                          flagged
                            ? "font-semibold text-empty-warn"
                            : "text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground">{row.date}</span>
                      <span className="text-muted-foreground">
                        {row.region}
                      </span>
                      <span className="text-muted-foreground">
                        {row.category}
                      </span>
                      <span
                        className={`text-right font-mono text-xs tabular-nums ${
                          flagged ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {row.amount ?? "—"}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center border-t border-paper-rule px-3.5 py-3 font-mono text-xs">
                  {SAMPLE_STEPS.map((step, index) => (
                    <Fragment key={step}>
                      {index > 0 && (
                        <span className="mx-1 text-muted-foreground">→</span>
                      )}
                      <span
                        className={`rounded-[5px] border bg-card px-1.5 py-0.5 ${
                          index === 0
                            ? "border-foreground/20 text-foreground"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {step}
                      </span>
                    </Fragment>
                  ))}
                  <span className="ml-auto flex items-center gap-1.5 text-empty-ink">
                    <span>{TABLE_HEADER[1]}</span>
                    <span>→</span>
                    <span className="font-semibold">{t.emptyResultRows}</span>
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.emptySampleCaption}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Button
        variant="link"
        size="xs"
        onClick={() => onOpenUrl?.(GITHUB_URL)}
        className="absolute bottom-5 right-6 h-auto gap-1.5 px-0 text-xs font-normal text-muted-foreground hover:text-foreground hover:no-underline"
      >
        <Star className="size-3.5" strokeWidth={1.5} />
        {t.starOnGitHub}
      </Button>
    </div>
  );
}
