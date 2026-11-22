import type { Translations } from "@/i18n/translations/types";

/** First-run onboarding: canvas guide card, gesture card, sample data, completion toast, built-in templates. */
export const enOnboarding = {
  // Canvas empty-state guide card
  onboardingStartTitle: "Start here",
  onboardingStartDesc:
    "Your data is ready. Add one operation to get going - chain them up later if you want.",
  onboardingAddStep: "Add an operation",
  onboardingAddStepDesc:
    "Browse all {count} operations in the field above the canvas",
  onboardingAskAi: "Describe what you need",
  onboardingAskAiDesc: '"Total the amount by region"',
  onboardingSeeExample: "See an example",
  onboardingSeeExampleDesc: "Loads sample data plus a ready-made pipeline",
  onboardingBranchNote:
    "A new step becomes its own branch and can run right away - connect it only if you want to chain.",
  onboardingDismiss: "Got it",
  onboardingDismissHint:
    "Won't appear again; you can bring it back in Settings",

  // Sample data
  onboardingSampleFailed: "Could not prepare the sample data: {error}",
  // Step-by-step replay: each caption names the action that added the step.
  onboardingDemoRevealAction1:
    "Press Ctrl F, click search → drop empty amounts",
  onboardingDemoRevealAction2: "Click dedup → drop exactly duplicated rows",
  onboardingDemoRevealAction3: "Click groupby → total the amount by region",
  onboardingDemoRevealRunning: "Three steps built - running it…",
  onboardingDemoRevealReady:
    "All three are on the canvas - click Run to see the result",
  onboardingDemoRevealNext: "Next",
  onboardingDemoRevealRun: "Run it",
  onboardingDemoRevealSkip: "Skip",

  // Settings
  onboardingReset: "Onboarding",
  onboardingResetDesc:
    "Clears the “intro seen” flag so the guide reappears the next time you open a file.",

  // Template library
  myTemplatesGroup: "Mine",
  builtinTplDemoName: "Example",
  builtinTplDemoDesc:
    "Ships with sample sales data and a three-step clean-up. Runs as soon as you open it.",
  builtinStepSearchAmount: "1 Drop rows with an empty amount",
  builtinStepDedup: "2 Remove duplicate rows",
  builtinStepGroupByRegion: "3 Total the amount by region",
} satisfies Partial<Translations>;
