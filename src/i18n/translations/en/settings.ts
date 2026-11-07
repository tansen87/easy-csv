import type { Translations } from "@/i18n/translations/types";

/** Settings */
export const enSettings = {
  general: "General",
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  system: "System",
  csvDelimiter: "Delimiter",
  noHeaders: "No headers",
  noHeadersDesc:
    "When enabled, the first row will not be interpreted as headers",
  systemNotification: "Notification",
  systemNotificationDesc:
    "When enabled, Show system notification when pipeline execution completes",
  minimizeToTray: "Tray",
  minimizeToTrayDesc:
    "When enabled, closing the window will minimize to system tray instead of exiting",
  doubleClickFitView: "Fit View",
  doubleClickFitViewDesc:
    "When enabled, double-clicking an empty area of the canvas fits the view",
  resetToDefaults: "Reset to Defaults",
  saveSettings: "Save Settings",
  selectDelimiter: "Select delimiter",
  delimiterDesc: "The field delimiter for reading CSV data",
  language: "Language",

  // Directory navigation
  settingsSearchPlaceholder: "Search settings",
  settingsSearchEmpty: "No settings match \u201c{query}\u201d",
  settingsSearchEmptyHint:
    "Try \u201ctray\u201d, \u201cdark\u201d or \u201cconcurrency\u201d",
  settingsSearchResults: "{count} results",
  settingsNavHintClear: "Esc clears the search",
  settingsGroupAppearance: "Appearance",
  settingsGroupDataHelp: "Data & help",
  settingsGroupWindow: "Window",
  settingsGroupUpdate: "Updates",
  settingsClear: "Clear",
  settingsExpand: "Expand",
  settingsCollapse: "Collapse",
  settingsLanguageDesc: "Interface language",
  settingsThemeDesc: "Interface colours",
  settingsAccent: "Theme colour",
  settingsAccentDesc: "Theme colour",
  accentInk: "Ink",
  accentTeal: "Teal",
  accentClay: "Clay",
  accentGraphite: "Graphite",
  settingsLiveNote: "Changes apply now; saving writes them to disk",
  settingsSampleColumns: "{count} columns",
  settingsDecrease: "Decrease",
  settingsIncrease: "Increase",
  settingsShowKey: "Show key",
  settingsHideKey: "Hide key",
  settingsShowAgain: "Show again",
  clearExecutionHistoryDesc: "Delete every execution history record",
  aiClearConversationsDesc: "Delete your conversations with the AI",
  aiClearFeedbackDesc:
    "Delete the \u201chelpful / not helpful\u201d feedback records",
  aiClearCorrectionsDesc: "Delete the AI correction rules",
  aiCustomProviderSettingsDesc:
    "Name, base URL and model list used by a custom provider",
} satisfies Partial<Translations>;
