/** Plugin catalog & in-app install */
export const enPlugins = {
  plugins: "Plugins",
  pluginDesc: "External CLI plugins, downloadable on demand",
  pluginNone: "No plugins available",
  pluginInstalled: "Installed",
  pluginMissing: "Not installed",

  // Row actions
  pluginDownload: "Download",
  pluginUpdate: "Update",
  pluginUninstall: "Uninstall",
  pluginOpenFolder: "Open plugin folder",
  pluginHomepage: "Homepage",
  pluginRefresh: "Fetch the latest version",
  pluginRetry: "Retry",

  // Progress / state
  pluginDownloading: "Downloading",
  pluginVerifying: "Verifying",
  pluginInstalling: "Installing",
  pluginChecking: "Checking",
  pluginCancel: "Cancel",
  pluginCancelling: "Cancelling…",
  pluginLoadingCatalog: "Loading the plugin catalog…",
  pluginStaleHint:
    "The network is unavailable; this is the cached catalog from an earlier fetch",

  // Sources
  pluginSourceRegistry: "Installed by the app",
  pluginSourceManual: "Added by hand",
  pluginSourcePath: "On system PATH",
  pluginRequiredBadge: "Required",
  pluginUpdateAvailable: "Update available",

  // Errors
  pluginCatalogFailed: "Failed to load the plugin catalog",
  pluginInstallFailed: "Plugin install failed",
  pluginUninstallFailed: "Plugin uninstall failed",
  pluginUninstallConfirmTitle: "Uninstall this plugin?",
  pluginUninstallConfirmDesc:
    "The executable will be deleted from the plugin folder and its commands will stop working.",
  pluginUninstallManualHint:
    "This plugin was not installed by the app; remove it with whatever put it there.",

  // Startup guidance
  pluginSetupTitle: "Missing required plugins",
  pluginSetupDesc:
    "Almost every Easy Csv command runs through xan. You can download and install it now, or place it in the plugin folder yourself",
  pluginSetupInstall: "Download and install",
  pluginSetupOpenFolder: "Open plugin folder",
  pluginSetupLater: "Later",
  pluginSetupInstalled: "xan is installed — every command is available now",

  // Download acceleration
  pluginPrefixTitle: "Download acceleration prefix",
  pluginPrefixDesc:
    "When GitHub is slow to reach directly, set a proxy prefix (e.g. https://ghproxy.example/). Downloads go through it first and fall back to the direct URL. Integrity is still guaranteed by the hashes pinned in the signed catalog, so a proxy cannot substitute the contents.",
  pluginPrefixPlaceholder: "https://ghproxy.example/",
  pluginPrefixSave: "Save",
  pluginPrefixClear: "Clear",
  pluginPrefixSaved: "Download prefix saved",
  pluginPrefixCleared: "Download prefix cleared",
} satisfies Record<string, string>;
