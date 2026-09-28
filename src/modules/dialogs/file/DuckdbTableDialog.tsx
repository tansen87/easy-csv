import { useEffect, useRef, useCallback } from "react";
import { X, Table2 } from "lucide-react";
import { useLanguage } from "@/i18n";
import { DuckdbTableInfo } from "@/types/xan";

interface DuckdbTableDialogProps {
  filePath: string;
  tables: DuckdbTableInfo[];
  onPick: (table: string) => void;
  onClose: () => void;
}

/**
 * `.duckdb` table picker (design 024): the backend needs a concrete table to
 * build the `input` relation, so opening a database with several tables asks
 * here. Single-table databases never reach this dialog (auto-selected).
 */
export function DuckdbTableDialog({
  filePath,
  tables,
  onPick,
  onClose,
}: DuckdbTableDialogProps) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (tables.length > 0) {
      dialogRef.current?.focus();
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tables.length, handleKeyDown]);

  if (tables.length === 0) return null;

  const fileName = filePath.split(/[\\/]/).pop() || filePath;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-none"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative bg-card rounded-lg shadow-xl w-full max-w-sm overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
          <h3 className="text-sm font-semibold text-foreground">
            {t.duckdbSelectTable}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground truncate">{fileName}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t.duckdbTableHint}
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto px-2 pb-2">
          {tables.map((info) => {
            const value =
              info.schema && info.schema !== "main"
                ? `${info.schema}.${info.name}`
                : info.name;
            return (
              <button
                key={value}
                onClick={() => onPick(value)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left"
              >
                <Table2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{info.name}</span>
                {info.schema && info.schema !== "main" && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {info.schema}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground shrink-0">
                  {info.kind}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
