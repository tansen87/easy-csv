import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { ColumnSummary } from "@/modules/pipeline/panels/lib/columnLineage";

export function GroupLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex h-[30px] items-center gap-1.5 px-4 text-[10.5px] text-muted-foreground">
      {label}
      <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/60">
        {count}
      </span>
    </div>
  );
}

interface ColumnRowProps {
  column: ColumnSummary;
  open: boolean;
  onToggle: () => void;
}

export function ColumnRow({ column, open, onToggle }: ColumnRowProps) {
  const { t } = useLanguage();
  const removed = column.removedAt !== undefined;

  const meta: string[] = [];
  if (removed) {
    meta.push(
      `${String(column.removedAt).padStart(2, "0")} · ${t.lineageRemovedHint}`,
    );
  } else {
    meta.push(`${column.steps} ${t.lineageStepsUnit}`);
    // 一行只报一个最有信息量的变化：改名 > 生成 > 分组键 > 改类型
    if (column.renamedCount > 0) {
      meta.push(
        t.lineageRenamedTimes.replace("{count}", String(column.renamedCount)),
      );
    } else if (column.derivedAt !== undefined) {
      meta.push(
        t.lineageStepGeneratedAt.replace("{index}", String(column.derivedAt)),
      );
    } else if (column.groupKeyAt !== undefined) {
      meta.push(
        t.lineageStepGroupKeyAt.replace("{index}", String(column.groupKeyAt)),
      );
    } else if (column.castCount > 0) {
      meta.push(t.lineageCastTimes.replace("{count}", String(column.castCount)));
    }
  }

  return (
    <button
      type="button"
      data-lineage-row="true"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 px-4 py-1.5 text-left outline-none transition-colors",
        "focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40",
        open ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      {open && (
        <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-r bg-primary" />
      )}
      <span
        className={cn(
          "min-w-0 truncate text-[12.5px] leading-[18px]",
          removed && "text-muted-foreground",
        )}
      >
        {column.name}
      </span>
      <span className="font-mono text-[9.5px] leading-[18px] text-muted-foreground/60">
        {column.type}
      </span>
      <span className="col-span-2 truncate text-[10.5px] leading-4 text-muted-foreground">
        {meta.join(" · ")}
      </span>
    </button>
  );
}
