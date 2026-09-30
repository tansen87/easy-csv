import type { Translations } from "@/i18n/translations/types";

/** First-run onboarding: canvas guide card, gesture card, sample data, completion toast, built-in templates. */
export const enOnboarding = {
  // Canvas empty-state guide card
  onboardingStartTitle: "Start here",
  onboardingStartDesc:
    "Your data is ready. Add one operation to get going — chain them up later if you want.",
  onboardingAddStep: "Add an operation",
  onboardingAddStepDesc:
    "Open the command panel and browse all {count} operations",
  onboardingAskAi: "Describe what you need",
  onboardingAskAiDesc: '"Total the amount by region"',
  onboardingSeeExample: "See an example",
  onboardingSeeExampleDesc: "Loads sample data plus a ready-made pipeline",
  onboardingRecommendedBadge: "Recommended · 30s",
  onboardingFlowOpenData: "Open data",
  onboardingFlowAddStep: "Add steps",
  onboardingFlowExecute: "Run & export",
  onboardingFlowNote: "All of it happens on this canvas — no code",
  onboardingBranchNote:
    "A new step becomes its own branch and can run right away — connect it only if you want to chain.",
  onboardingDismiss: "Got it",
  onboardingDismissHint:
    "Won't appear again; you can bring it back in Settings",

  // Hint inside the command panel
  onboardingPanelHint:
    "Your first operation applies straight to the input data (its own branch) — no need to connect anything first.",

  // Gesture card
  onboardingGestureTitle: "Canvas gestures",
  onboardingGestureCollapse: "Collapse",
  onboardingGestureRightDrag: "Right-drag",
  onboardingGestureConnect: "from a step node onto a target → connect",
  onboardingGestureRightSlash: "Right-slash",
  onboardingGestureCut: "cuts an edge / node",
  onboardingGestureSpaceOrMiddle: "Space / middle",
  onboardingGesturePan: "drag to pan the canvas",
  onboardingGestureLeftDrag: "Left-drag",
  onboardingGestureSelect: "on empty space to box-select nodes",
  onboardingGestureNote:
    "A connection must start on a step node, not on the input node",

  // Sample data
  onboardingSampleFailed: "Could not prepare the sample data: {error}",
  // Step-by-step replay: each caption names the action that added the step.
  onboardingDemoRevealAction1:
    "Open the command panel, click search → drop empty amounts",
  onboardingDemoRevealAction2: "Click dedup → drop exactly duplicated rows",
  onboardingDemoRevealAction3: "Click groupby → total the amount by region",
  onboardingDemoRevealRunning: "Three steps built — running it…",
  onboardingDemoRevealReady:
    "All three are on the canvas — click Run to see the result",
  onboardingDemoRevealNext: "Next",
  onboardingDemoRevealRun: "Run it",
  onboardingDemoRevealSkip: "Skip",


  // Settings
  onboardingReset: "Show the intro again",
  onboardingResetDesc:
    "Clears the “intro seen” flag so the guide reappears the next time you open a file.",

  // Built-in templates
  builtinTemplatesGroup: "Built-in",
  myTemplatesGroup: "Mine",
  copyToMyTemplates: "Copy to my templates",
  builtinTemplateCopied: "Copied to my templates: {name}",
  builtinTplDemoName: "Example",
  builtinTplDemoDesc:
    "Ships with sample sales data and a three-step clean-up. Runs as soon as you open it.",
  builtinTplCleanName: "Quick clean",
  builtinTplCleanDesc:
    "Drops rows that are empty all the way across, then removes duplicates. Works on any file.",
  builtinTplProfileName: "Get to know the data",
  builtinTplProfileDesc:
    "Lists the column names, then the per-column statistics (type, empty count, extremes).",
  builtinTplGroupName: "Count rows per first column",
  builtinTplGroupDesc:
    "Groups by the first column and counts rows. Change “0” to your own column name.",
  builtinTplTopName: "Sort and take the top 100",
  builtinTplTopDesc:
    "Sorts by the first column, then keeps the first 100 rows. Change “0” to your column name.",
  builtinStepSearchAmount: "1 Drop rows with an empty amount",
  builtinStepDedup: "2 Remove duplicate rows",
  builtinStepGroupByRegion: "3 Total the amount by region",
} satisfies Partial<Translations>;
