import { MoreHorizontal, X } from "lucide-react";
import { PipelineVersion, StoredPipelineStep } from "@/types/xan";
import { xanCommands } from "@/data/commands";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { VersionDiff, VersionDiffSummary } from "@/utils/versionDiff";

export type EditorKind = "message" | "tag";

export interface RowEditor {
  kind: EditorKind;
  value: string;
}

/** Everything the row can trigger; one object so the row stays presentational. */
export interface RowActions {
  toggle: (version: PipelineVersion) => void;
  openMenu: (
    version: PipelineVersion,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void;
  removeTag: (version: PipelineVersion, tag: string) => void;
  restore: (versionId: string) => void;
  remove: (versionId: string) => void;
  setCompareTarget: (versionId: string) => void;
  setEditorValue: (value: string) => void;
  commitEditor: () => void;
  cancelEditor: () => void;
}

interface VersionLogRowProps {
  version: PipelineVersion;
  depth: number;
  first: boolean;
  last: boolean;
  isCurrent: boolean;
  isExpanded: boolean;
  menuOpen: boolean;
  /** `+n −n ~n` against the parent version; `null` for the root row. */
  summary: VersionDiffSummary | null;
  timeLabel: string;
  /** Only computed for the expanded row. */
  diff: VersionDiff | null;
  versions: PipelineVersion[];
  compareTargetId: string;
  editor: RowEditor | null;
  actions: RowActions;
}

function commandLabel(step: StoredPipelineStep): string {
  const command = xanCommands.find((c) => c.id === step.commandId);
  return step.alias || command?.name || step.commandId;
}

function DiffLine({
  glyph,
  tone,
  label,
}: {
  glyph: string;
  tone: string;
  label: string;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className={cn("w-3 shrink-0 font-mono text-[11px]", tone)}>
        {glyph}
      </span>
      <span className="min-w-0 truncate text-foreground">{label}</span>
    </div>
  );
}

/**
 * One 56px log entry plus, when expanded, its diff / editor block.
 *
 * The rail is a CSS pseudo-element (`.version-rail`, `src/index.css`) joined
 * across rows, so the list reads as a continuous history instead of a stack of
 * separate cards.
 */
export function VersionLogRow({
  version,
  depth,
  first,
  last,
  isCurrent,
  isExpanded,
  menuOpen,
  summary,
  timeLabel,
  diff,
  versions,
  compareTargetId,
  editor,
  actions,
}: VersionLogRowProps) {
  const { t } = useLanguage();
  const tags = version.tags || [];

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        data-version-id={version.id}
        onClick={() => actions.toggle(version)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            actions.toggle(version);
          }
        }}
        className={cn(
          "group relative grid min-h-14 grid-cols-[20px_minmax(0,1fr)_24px] items-center gap-2 px-4 py-2.5",
          "cursor-default transition-colors hover:bg-muted/70",
          isExpanded && "bg-muted",
        )}
      >
        {isExpanded && (
          <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
        )}
        <span
          className="version-rail"
          data-first={first}
          data-last={last}
          data-current={isCurrent}
          aria-hidden="true"
        >
          <i />
        </span>

        {/* Indent caps at two levels: a linear history would otherwise push the
            message ~70px right inside a 320px panel and clip it. */}
        <div
          className="min-w-0"
          style={{ paddingLeft: Math.min(depth, 2) * 8 }}
        >
          <div
            className={cn(
              "truncate text-[12.5px] leading-[18px]",
              !version.message && "text-muted-foreground",
            )}
          >
            {version.message || t.untitledVersion}
          </div>
          <div className="mt-0.5 flex h-4 items-center gap-1.5 whitespace-nowrap text-[10.5px] text-muted-foreground tabular-nums">
            <span title={version.createdAt}>{timeLabel}</span>
            <span className="opacity-60">·</span>
            <span>
              {version.steps.length} {t.versionStepUnit}
            </span>
            <span className="opacity-60">·</span>
            <span>
              {version.edges.length} {t.versionEdgeUnit}
            </span>
            {tags.length > 0 && (
              <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                {tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="group/tag flex items-center">
                    #{tag}
                    <button
                      type="button"
                      aria-label={t.versionRemoveTag.replace("{tag}", tag)}
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.removeTag(version, tag);
                      }}
                      className="ml-0.5 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/tag:opacity-100"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                {tags.length > 2 && <span>+{tags.length - 2}</span>}
              </span>
            )}
            <span className="ml-auto flex items-center gap-1.5">
              {summary && summary.addedSteps > 0 && (
                <span className="text-success">+{summary.addedSteps}</span>
              )}
              {summary && summary.removedSteps > 0 && (
                <span className="text-destructive">
                  −{summary.removedSteps}
                </span>
              )}
              {summary && summary.modifiedSteps > 0 && (
                <span className="text-warning">~{summary.modifiedSteps}</span>
              )}
              {isCurrent && (
                <span className="text-primary">{t.versionCurrent}</span>
              )}
            </span>
          </div>
        </div>

        <button
          type="button"
          aria-label={t.versionActions}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => actions.openMenu(version, e)}
          className={cn(
            "grid h-6 w-6 place-items-center rounded-md text-muted-foreground/70",
            "opacity-60 transition-[opacity,background-color] hover:bg-card hover:text-foreground",
            "group-hover:opacity-100",
            menuOpen && "bg-card text-foreground opacity-100",
          )}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {isExpanded && (
        <div className="version-exp relative bg-muted pb-3.5 pl-11 pr-4 pt-0.5">
          {/* The selection bar runs down the diff too, so row + diff read as one
              selected block instead of a bar that stops at the row edge. */}
          <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span>{t.versionDiff}</span>
            {/* The app's Select (searchable combobox) rather than a native one:
                the panel already speaks that control language everywhere else,
                and long version messages stay findable in the popup. */}
            <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
              <Select
                value={compareTargetId}
                onChange={actions.setCompareTarget}
                options={[
                  { value: "current", label: t.versionWorkspace },
                  ...versions.map((v) => ({
                    value: v.id,
                    label: v.message || t.untitledVersion,
                  })),
                ]}
                placeholder={t.versionWorkspace}
                ariaLabel={t.versionCompareWithCurrent}
                height="h-6 px-2 pr-6 text-[11px]"
                width={136}
                flip
                listMaxHeight="max-h-32"
              />
            </span>
          </div>

          <div className="mt-2 grid gap-[3px] text-[11px] leading-[15px]">
            {diff ? (
              <>
                {diff.addedSteps.map((step) => (
                  <DiffLine
                    key={`a-${step.id}`}
                    glyph="+"
                    tone="text-success"
                    label={commandLabel(step)}
                  />
                ))}
                {diff.removedSteps.map((step) => (
                  <DiffLine
                    key={`r-${step.id}`}
                    glyph="−"
                    tone="text-destructive"
                    label={commandLabel(step)}
                  />
                ))}
                {diff.modifiedSteps.map(({ id, after }) => (
                  <DiffLine
                    key={`m-${id}`}
                    glyph="~"
                    tone="text-warning"
                    label={commandLabel(after)}
                  />
                ))}
                {diff.addedEdges.length > 0 && (
                  <DiffLine
                    glyph="+"
                    tone="text-success"
                    label={`${diff.addedEdges.length} ${t.versionEdges}`}
                  />
                )}
                {diff.removedEdges.length > 0 && (
                  <DiffLine
                    glyph="−"
                    tone="text-destructive"
                    label={`${diff.removedEdges.length} ${t.versionEdges}`}
                  />
                )}
                {diff.addedSteps.length === 0 &&
                  diff.removedSteps.length === 0 &&
                  diff.modifiedSteps.length === 0 &&
                  diff.addedEdges.length === 0 &&
                  diff.removedEdges.length === 0 && (
                    <div className="text-[11px] text-muted-foreground">
                      {t.versionNoChanges}
                    </div>
                  )}
              </>
            ) : null}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                actions.restore(version.id);
              }}
              className="h-[26px] rounded-md border border-border bg-card px-2.5 text-[11px] text-foreground transition-colors hover:bg-background"
            >
              {t.restore}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                actions.remove(version.id);
              }}
              className="ml-auto text-[11px] text-muted-foreground transition-colors hover:text-destructive"
            >
              {t.versionMenuDelete}
            </button>
          </div>
        </div>
      )}

      {editor && (
        <div className="bg-muted pb-3 pl-11 pr-4 pt-0.5">
          <input
            type="text"
            autoFocus
            value={editor.value}
            onChange={(e) => actions.setEditorValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") actions.commitEditor();
              if (e.key === "Escape") actions.cancelEditor();
            }}
            placeholder={
              editor.kind === "message" ? t.versionMessagePlaceholder : t.addTag
            }
            className="h-7 w-full rounded-md border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={actions.commitEditor}
              className="h-6 rounded-md bg-primary px-2.5 text-[11px] text-primary-foreground"
            >
              {t.save}
            </button>
            <button
              type="button"
              onClick={actions.cancelEditor}
              className="h-6 rounded-md px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
