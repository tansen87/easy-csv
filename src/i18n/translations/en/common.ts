import type { Translations } from "@/i18n/translations/types";

/** (none) · ConfirmDialog · HomeView · UpdateDialog · Floating panel docking ·
 * Result preview (F1) · CommandPalette
 */
export const enCommon = {
  rows: "Rows",
  confirm: "Confirm",
  open: "Open",
  ai: "AI",
  recentFiles: "Recent Files",
  modify: "Modify",
  close: "Close",
  searchColumns: "Search columns",
  remove: "Remove",
  refreshTitle: "Refresh Page",
  refreshMessage:
    "Are you sure you want to refresh the page? Unsaved changes will be lost.",
  cycleRejected:
    "Connection rejected: it would create a cycle in the pipeline.",
  cycleDetected: "Detected a cycle in the pipeline",
  branchOverwriteTitle: "Overwrite output file?",
  branchOverwriteMessage:
    "{count} branches will write to the same file; later writes overwrite earlier ones. Continue?",
  welcomeTitle: "Welcome to Easy CSV",
  welcomeSubtitle: "Open a file or import a flow to get started",
  openFile: "Open File",
  openFileFormats: "CSV, Excel, JSON",
  importFlow: "Import Flow",
  importFlowFormats: ".xanflow files",
  starOnGitHub: "Star on GitHub",
  branchProgress: "Branch",
  // Execute menu (design 028 §5.6)
  runStateQueued: "Queued",
  runStatePending: "Needs input",
  runStateDone: "Done",
  runStateFailed: "Failed",
  cancelShort: "Cancel",
  otherTabsRunning: "{count} other tab(s) running",
  crossTabOverwriteTitle: "Another tab is writing this file?",
  crossTabOverwriteMessage:
    'Tab "{name}" is writing the same output file: {path}. Continuing will overwrite its result.',
  logFilterCurrent: "Current tab only",
  logFilterAll: "All",
  checkForUpdates: "Check for Updates",
  newVersionAvailable: "New version available",
  currentVersion: "Current version",
  latestVersion: "Latest version",
  usingLatestVersion: "You are using the latest version",
  loadingUpdateInfo: "Loading update information...",
  cancel: "Cancel",
  update: "Update",
  collapsePanel: "Collapse",
  copyCsv: "Copy as CSV",
  copyMarkdown: "Copy as Markdown table",
  resultTruncated:
    "Result truncated to first rows; use an output/to step to export the full data.",
  commandPalette: "Command Palette",
  palettePlaceholder: "Type a command or search",
  paletteActions: "Actions",
  paletteCommands: "Commands",
  paletteTabs: "Tabs",
  paletteNoResults: "No matching commands",
  paletteNavigateHint: "Navigate",
  paletteSelectHint: "Select",
  paletteCloseHint: "ESC Close",
} satisfies Partial<Translations>;
