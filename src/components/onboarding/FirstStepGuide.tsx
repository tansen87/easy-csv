import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

export interface FirstStepGuideProps {
  /** Show the "start here" card: input loaded, pipeline still empty, guide unseen. */
  showGuide: boolean;
  /** Number of xan commands, for the "browse all N operations" line. */
  commandCount: number;
  /** Whether the gesture card starts expanded (first run). */
  gestureCardExpanded?: boolean;
  /**
   * Caption for the sample pipeline's step-by-step reveal (design 027 §11.2).
   * Shown as a pill while the demo builds itself, so the user sees *how* each
   * step gets added instead of receiving a finished pipeline. `progress` counts
   * the steps **already on the canvas** (0-based at the start); it is omitted
   * for the "now running it" phase.
   */
  reveal?: {
    caption: string;
    progress?: { installed: number; total: number };
    /** Every step is on the canvas: the button becomes "Run it". */
    isComplete?: boolean;
  } | null;
  /**
   * Advance the reveal — one more step, or run the pipeline once every step is
   * on the canvas. **The reveal is entirely click-driven**: no timer decides
   * the pace, the user does (design 027 §11.2, second iteration).
   */
  onAdvanceReveal?: () => void;
  onSkipReveal?: () => void;
  /** All three routes lead into the one real "add an operation" entry point. */
  onAddStep: () => void;
  onAskAi: () => void;
  onSeeExample: () => void;
  onDismissGuide: () => void;
}

/**
 * Canvas overlays for first-run onboarding:
 * the empty-state guide card and the persistent gesture card.
 *
 * Both are **plain overlays, not nodes**: nothing here touches ReactFlow's
 * `nodes` array, the pipeline state, dagre layout, or any canvas gesture. The
 * overlay root is `pointer-events-none` so panning / box-selecting / the
 * right-drag gestures keep working everywhere except on the cards themselves.
 *
 * There is deliberately no ghost/mock node: adding an operation has exactly one
 * entry point (the command panel, `Alt+C` / `Ctrl+K`), and inventing a
 * node-shaped second one both misleads about where the new node lands and opens
 * something else when clicked.
 */
export const FirstStepGuide = React.memo(function FirstStepGuide({
  showGuide,
  commandCount,
  gestureCardExpanded = false,
  reveal,
  onAdvanceReveal,
  onSkipReveal,
  onAddStep,
  onAskAi,
  onSeeExample,
  onDismissGuide,
}: FirstStepGuideProps) {
  const { t } = useLanguage();
  const [showGestures, setShowGestures] = useState(gestureCardExpanded);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {/* Sample-pipeline reveal caption (design 027 §11.2). Bottom centre: the
          top of the canvas belongs to the data being built on, and a control
          the user must keep clicking sits more naturally at the bottom. The
          right inset keeps it clear of the gesture card, which lives in the
          bottom-right corner. */}
      {reveal && (
        <div className="absolute bottom-4 left-0 right-[272px] flex justify-center pl-4">
          <div
            data-testid="onboarding-reveal"
            className="animate-slide-up pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full border border-blue-200 bg-blue-50/95 py-1.5 pl-3 pr-2 shadow-md backdrop-blur-sm dark:border-blue-900 dark:bg-blue-950/90"
          >
            {reveal.progress && (
              <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white">
                {reveal.progress.installed}/{reveal.progress.total}
              </span>
            )}
            <span className="min-w-0 truncate text-xs font-medium text-blue-900 dark:text-blue-100">
              {reveal.caption}
            </span>
            {/* The reveal is click-driven: the button installs the next step
                and, once *all* of them are on the canvas, runs the pipeline.
                The label keys off `isComplete` — the progress counter alone
                was off by one and showed "Run it" one click too early. */}
            {onAdvanceReveal && reveal.progress && (
              <button
                onClick={onAdvanceReveal}
                data-testid="onboarding-reveal-next"
                className="shrink-0 rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700"
              >
                {reveal.isComplete
                  ? t.onboardingDemoRevealRun
                  : t.onboardingDemoRevealNext}
              </button>
            )}
            {onSkipReveal && (
              <button
                onClick={onSkipReveal}
                data-testid="onboarding-reveal-skip"
                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold text-blue-700/80 transition-colors hover:bg-blue-100 hover:text-blue-900 dark:text-blue-200/80 dark:hover:bg-blue-900"
              >
                {t.onboardingDemoRevealSkip}
              </button>
            )}
          </div>
        </div>
      )}

      {showGuide && (
        <div className="absolute left-0 right-0 top-16 flex justify-center px-4">
          <div
            className="pointer-events-auto w-[344px] max-w-full rounded-2xl border border-border bg-card p-4 shadow-lg"
            data-testid="onboarding-guide"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold">{t.onboardingStartTitle}</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t.onboardingStartDesc}
            </p>

            <div className="mt-3 space-y-2">
              <button
                onClick={onAddStep}
                data-testid="onboarding-add-step"
                className="flex w-full items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 text-left transition-colors hover:bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-blue-800 dark:text-blue-200">
                    {t.onboardingAddStep}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-blue-700/70 dark:text-blue-300/70">
                    {t.onboardingAddStepDesc.replace(
                      "{count}",
                      String(commandCount),
                    )}
                  </span>
                </span>
                <kbd className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  Alt+C
                </kbd>
              </button>

              <button
                onClick={onAskAi}
                data-testid="onboarding-ask-ai"
                className="flex w-full items-center gap-2.5 rounded-xl border border-border px-3 py-2 text-left transition-colors hover:bg-accent/50"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">
                    {t.onboardingAskAi}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {t.onboardingAskAiDesc}
                  </span>
                </span>
                <kbd className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  Alt+A
                </kbd>
              </button>

              <button
                onClick={onSeeExample}
                data-testid="onboarding-see-example"
                className="flex w-full items-center gap-2.5 rounded-xl border border-border px-3 py-2 text-left transition-colors hover:bg-accent/50"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Play className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">
                    {t.onboardingSeeExample}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {t.onboardingSeeExampleDesc}
                  </span>
                </span>
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
              {t.onboardingBranchNote}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[10.5px] leading-tight text-muted-foreground/70">
                {t.onboardingDismissHint}
              </span>
              <button
                onClick={onDismissGuide}
                data-testid="onboarding-dismiss"
                className="shrink-0 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {t.onboardingDismiss}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-3 right-3">
        <div className="pointer-events-auto w-[248px] max-w-[calc(100vw-24px)] rounded-xl border border-border bg-card/95 p-3 shadow-md backdrop-blur-sm">
          <button
            onClick={() => setShowGestures((prev) => !prev)}
            aria-expanded={showGestures}
            className="flex w-full items-center gap-1.5 text-[11.5px] font-bold text-foreground/80"
          >
            {t.onboardingGestureTitle}
            <span className="ml-auto font-medium text-muted-foreground/70">
              {showGestures
                ? t.onboardingGestureCollapse
                : t.onboardingGestureTitle}
              {showGestures ? (
                <ChevronDown className="ml-1 inline h-3 w-3" />
              ) : (
                <ChevronUp className="ml-1 inline h-3 w-3" />
              )}
            </span>
          </button>

          {showGestures && (
            <div className="mt-2">
              {[
                [t.onboardingGestureRightDrag, t.onboardingGestureConnect],
                [t.onboardingGestureRightSlash, t.onboardingGestureCut],
                [t.onboardingGestureSpaceOrMiddle, t.onboardingGesturePan],
                [t.onboardingGestureLeftDrag, t.onboardingGestureSelect],
              ].map(([gesture, meaning]) => (
                <div
                  key={gesture}
                  className={cn(
                    "flex items-center gap-2 py-0.5 text-[11px] text-muted-foreground",
                  )}
                >
                  <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {gesture}
                  </span>
                  <span className="min-w-0">{meaning}</span>
                </div>
              ))}
              <div className="mt-2 border-t border-dashed border-border pt-2 text-[10px] leading-relaxed text-muted-foreground/70">
                {t.onboardingGestureNote}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
