import React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * The one header every docked panel uses (design 076).
 *
 * Before this, each of the four panels carried its own title row: two different
 * left paddings, two title sizes, and a close button that sat at a different
 * offset in every one of them. Inside a single dock the header is the seam the
 * eye follows when panels are switched, so it has to be identical.
 *
 * `meta` is the panel's fact line ("5,000 行 · 5 列 · 2 列有缺失"); `actions`
 * holds the page's own buttons (refresh, save version, …). Close is always last.
 */
interface DockHeaderProps {
  /** "01"–"04"; the same number the rail shows. */
  index: string;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
  className?: string;
}

export function DockHeader({
  index,
  title,
  meta,
  actions,
  onClose,
  closeLabel,
  className,
}: DockHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-none flex-col border-b border-border-soft",
        className,
      )}
    >
      <div className="flex h-9 items-center gap-2 pl-3 pr-1.5">
        <span
          aria-hidden="true"
          className="font-mono text-[9.5px] tabular-nums text-muted-foreground/70"
        >
          {index}
        </span>
        <h3 className="text-[13px] font-medium">{title}</h3>
        <div className="ml-auto flex items-center gap-0.5">
          {actions}
          <Tooltip content={closeLabel}>
            <button
              type="button"
              aria-label={closeLabel}
              onClick={onClose}
              className="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
      {meta && (
        <div className="flex h-6 items-center gap-1.5 truncate px-3 text-[10.5px] leading-4 tabular-nums text-muted-foreground">
          {meta}
        </div>
      )}
    </div>
  );
}
