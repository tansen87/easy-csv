import type { Translations } from "../types";

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
} satisfies Partial<Translations>;
