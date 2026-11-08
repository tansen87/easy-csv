import type { Translations } from "@/i18n/translations/types";

/** (none) · ConfirmDialog · HomeView · UpdateDialog · Floating panel docking ·
 * Result preview · CommandPalette
 */
export const enCommon = {
  rows: "Rows",
  confirm: "Confirm",
  open: "Open",
  ai: "AI",
  recentFiles: "Recent Files",
  modify: "Modify",
  close: "Close",
  titlebarMinimize: "Minimize",
  titlebarMaximize: "Maximize",
  titlebarRestore: "Restore",
  titlebarClose: "Close",
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
  overwrite: "Overwrite",
  clear: "Clear",
  emptyTitle: "Chain your tables into a pipeline",
  emptySubtitle:
    "Open data, filter by column, sort, group, then run and export",
  emptyFormats: "CSV · Excel · Parquet · DuckDB",
  emptyImportFlow: "Import a .xanflow pipeline",
  emptyAddStepShort: "Add a step",
  emptySampleCaption:
    "Sample data, 219 rows · row 8 has no amount; search drops it",
  emptyResultRows: "5 rows",
  openFile: "Open File",
  openFileFormats: "CSV, Excel, JSON",
  starOnGitHub: "Star on GitHub",
  branchProgress: "Branch",
  // Execute menu
  runStateQueued: "Queued",
  runStatePending: "Needs input",
  runStateDone: "Done",
  runStateFailed: "Failed",
  cancelShort: "Cancel",
  otherTabsRunning: "{count} other tab(s) running",
  crossTabOverwriteTitle: "Another tab is writing this file?",
  crossTabOverwriteMessage:
    'Tab "{name}" is writing the same output file: {path}. Continuing will overwrite its result.',
  logFilterCurrent: "Current tab",
  logFilterAll: "All",
  logLevelFilter: "Log level filter",
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
