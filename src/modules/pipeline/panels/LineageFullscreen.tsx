import { useState } from "react";
import { Search, X } from "lucide-react";
import { useLanguage } from "@/i18n";
import { StepLineage } from "@/types/xan";
import { Tooltip } from "@/components/ui/Tooltip";
import { LineageGraph } from "@/modules/pipeline/panels/LineageGraph";

interface LineageFullscreenProps {
  lineageData: StepLineage[];
  tracedColumn: string | null;
  onTrace: (name: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function LineageFullscreen({
  lineageData,
  tracedColumn,
  onTrace,
  onClose,
  onSave,
}: LineageFullscreenProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const lastStep = lineageData[lineageData.length - 1];
  const firstStep = lineageData[0];

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-10 z-50 flex flex-col bg-background"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex h-12 flex-none items-center gap-2.5 border-b border-border/60 bg-card px-4">
        <span className="text-[13px] font-medium">{t.dataLineage}</span>
        <span className="flex h-3.5 items-center border-l border-border pl-2.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          {lineageData.length} {t.lineageStepsUnit} ·{" "}
          {firstStep?.inputRowCount ?? 0} → {lastStep?.outputRowCount ?? 0}{" "}
          {t.lineageRowsUnit}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative w-44">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchColumns}
              className="h-7 w-full rounded-[7px] border border-border bg-background pl-7 pr-2 text-[11.5px] outline-none placeholder:text-muted-foreground/70 focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={onSave}
            className="flex h-7 items-center gap-1.5 rounded-[7px] border border-border bg-card px-2.5 text-[11.5px] transition-colors hover:bg-muted"
          >
            {t.lineageExportJson}
          </button>
          <Tooltip content={t.exitFullscreen}>
            <button
              type="button"
              aria-label={t.exitFullscreen}
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>
      <div
        className="min-h-0 flex-1 bg-background"
        style={{
          backgroundImage:
            "radial-gradient(var(--canvas-dot) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <LineageGraph
          lineage={lineageData}
          tracedColumn={tracedColumn}
          query={query}
          onTrace={onTrace}
        />
      </div>
    </div>
  );
}
