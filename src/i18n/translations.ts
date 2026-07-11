export type Language = "en" | "zh";

export interface Translations {
  // MainMenu
  file: string;
  open: string;
  openNewTab: string;
  savePipeline: string;
  importWorkflow: string;
  exportWorkflow: string;
  undo: string;
  redo: string;
  execute: string;
  executing: string;

  // ConfirmDialog
  confirm: string;
  refreshTitle: string;
  refreshMessage: string;

  // Settings
  preference: string;
  general: string;
  theme: string;
  light: string;
  dark: string;
  system: string;
  csvDelimiter: string;
  noHeaders: string;
  noHeadersDesc: string;
  showExecutionNotification: string;
  showExecutionNotificationDesc: string;
  minimizeToTray: string;
  minimizeToTrayDesc: string;
  resetToDefaults: string;
  saveSettings: string;
  selectDelimiter: string;
  delimiterDesc: string;
  language: string;
  historyLimit: string;
  historyLimitDesc: string;
  unlimited: string;

  // CommandList
  cmds: string;
  history: string;
  searchCommand: string;
  searchHistory: string;
  noCommandsFound: string;
  tryDifferentSearch: string;
  noHistoryFound: string;
  executePipelinesHint: string;
  newTab: string;

  // HomeView
  welcomeTitle: string;
  welcomeSubtitle: string;
  openFile: string;
  openFileFormats: string;
  importFlow: string;
  importFlowFormats: string;
  starOnGitHub: string;
  recentFiles: string;
  branchProgress: string;

  // UpdateDialog
  checkForUpdates: string;
  newVersionAvailable: string;
  currentVersion: string;
  latestVersion: string;
  usingLatestVersion: string;
  loadingUpdateInfo: string;
  cancel: string;
  update: string;

  // HelpDialog
  searchPlaceholder: string;
  searchShortcut: string;
  previousMatch: string;
  nextMatch: string;
  close: string;

  // FlowPanel
  searchFlow: string;
  connectionTips: string;
  headerRename: string;

  // LogPanel
  logs: string;
  noLogsYet: string;
  executePipelineHint: string;

  // DataProfile
  dataProfile: string;
  searchFields: string;
  noFieldsMatch: string;
  analyzingData: string;
  columns: string;
  rows: string;
  count: string;
  empty: string;
  min: string;
  max: string;
  mean: string;
  sum: string;
  minLen: string;
  maxLen: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // MainMenu
    file: "File",
    open: "Open",
    openNewTab: "Open New Tab",
    savePipeline: "Save Pipeline",
    importWorkflow: "Import Workflow",
    exportWorkflow: "Export Workflow",
    undo: "Undo",
    redo: "Redo",
    execute: "Execute",
    executing: "Executing",

    // ConfirmDialog
    confirm: "Confirm",
    refreshTitle: "Refresh Page",
    refreshMessage: "Are you sure you want to refresh the page? Unsaved changes will be lost.",

    // Settings
    preference: "Preference",
    general: "General",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
    csvDelimiter: "CSV Delimiter",
    noHeaders: "No Headers",
    noHeadersDesc: "When set, the first row will not be interpreted as headers",
    showExecutionNotification: "Notification",
    showExecutionNotificationDesc: "When enabled, Show system notification when pipeline execution completes",
    minimizeToTray: "Tray",
    minimizeToTrayDesc: "When enabled, closing the window will minimize to system tray instead of exiting",
    resetToDefaults: "Reset to Defaults",
    saveSettings: "Save Settings",
    selectDelimiter: "Select delimiter",
    delimiterDesc: "The field delimiter for reading CSV data",
    language: "Language",
    historyLimit: "History Limit",
    historyLimitDesc: "Maximum number of history entries to keep",
    unlimited: "Unlimited",

    // CommandList
    cmds: "Cmds",
    history: "History",
    searchCommand: "Search command",
    searchHistory: "Search history",
    noCommandsFound: "No commands found",
    tryDifferentSearch: "Try a different search term",
    noHistoryFound: "No history found",
    executePipelinesHint: "Execute pipelines to see them here",
    newTab: "New Tab",

    // HomeView
    welcomeTitle: "Welcome to Easy CSV",
    welcomeSubtitle: "Open a file or import a flow to get started",
    openFile: "Open File",
    openFileFormats: "CSV, Excel, JSON",
    importFlow: "Import Flow",
    importFlowFormats: ".xanflow files",
    starOnGitHub: "Star on GitHub",
    recentFiles: "Recent Files",
    branchProgress: "Branch",

    // UpdateDialog
    checkForUpdates: "Check for Updates",
    newVersionAvailable: "New version available",
    currentVersion: "Current version",
    latestVersion: "Latest version",
    usingLatestVersion: "You are using the latest version",
    loadingUpdateInfo: "Loading update information...",
    cancel: "Cancel",
    update: "Update",

    // HelpDialog
    searchPlaceholder: "Search (Ctrl+F)",
    searchShortcut: "Ctrl+F: Search",
    previousMatch: "↑: Previous match",
    nextMatch: "↓: Next match",
    close: "ESC: Close",

    // FlowPanel
    searchFlow: "Search in the workflow",
    connectionTips: "Release the right-click connection",
    headerRename: "Search the header to modify",

    // LogPanel
    logs: "Logs",
    noLogsYet: "No logs yet",
    executePipelineHint: "Execute a pipeline to see output",

    // DataProfile
    dataProfile: "Data Profile",
    searchFields: "Search fields",
    noFieldsMatch: "No fields matching",
    analyzingData: "Analyzing data...",
    columns: "Columns",
    rows: "Rows",
    count: "Count",
    empty: "Empty",
    min: "Min",
    max: "Max",
    mean: "Mean",
    sum: "Sum",
    minLen: "Min Len",
    maxLen: "Max Len",
  },
  zh: {
    // MainMenu
    file: "文件",
    open: "打开",
    openNewTab: "新标签页打开",
    savePipeline: "保存Pipeline",
    importWorkflow: "导入工作流",
    exportWorkflow: "导出工作流",
    undo: "撤销",
    redo: "重做",
    execute: "执行",
    executing: "执行中",

    // ConfirmDialog
    confirm: "确认",
    refreshTitle: "刷新页面",
    refreshMessage: "确定要刷新页面吗？未保存的更改将会丢失。",

    // Settings
    preference: "偏好设置",
    general: "通用",
    theme: "主题",
    light: "浅色",
    dark: "深色",
    system: "跟随系统",
    csvDelimiter: "CSV 分隔符",
    noHeaders: "无表头",
    noHeadersDesc: "启用后,第一行将不被视为表头",
    showExecutionNotification: "系统通知",
    showExecutionNotificationDesc: "启用后,管道执行完成后显示系统通知",
    minimizeToTray: "系统托盘",
    minimizeToTrayDesc: "启用后,关闭窗口将最小化到系统托盘而非退出应用",
    resetToDefaults: "恢复默认",
    saveSettings: "保存设置",
    selectDelimiter: "选择分隔符",
    delimiterDesc: "用于读取 CSV 数据的字段分隔符",
    language: "语言",
    historyLimit: "历史记录上限",
    historyLimitDesc: "保留的最大历史记录条数",
    unlimited: "无限制",

    // CommandList
    cmds: "命令",
    history: "历史",
    searchCommand: "搜索命令",
    searchHistory: "搜索历史",
    noCommandsFound: "未找到命令",
    tryDifferentSearch: "请尝试其他搜索词",
    noHistoryFound: "暂无历史记录",
    executePipelinesHint: "执行工作流后将在此显示",
    newTab: "新Tab打开",

    // HomeView
    welcomeTitle: "欢迎使用 Easy CSV",
    welcomeSubtitle: "打开文件或导入工作流开始使用",
    openFile: "打开文件",
    openFileFormats: "CSV, Excel, JSON",
    importFlow: "导入工作流",
    importFlowFormats: ".xanflow 文件",
    starOnGitHub: "GitHub 点赞",
    recentFiles: "最近文件",
    branchProgress: "分支",

    // UpdateDialog
    checkForUpdates: "检查更新",
    newVersionAvailable: "有新版本可用",
    currentVersion: "当前版本",
    latestVersion: "最新版本",
    usingLatestVersion: "您正在使用最新版本",
    loadingUpdateInfo: "正在加载更新信息...",
    cancel: "取消",
    update: "更新",

    // HelpDialog
    searchPlaceholder: "搜索 (Ctrl+F)",
    searchShortcut: "Ctrl+F: 搜索",
    previousMatch: "↑: 上一个匹配",
    nextMatch: "↓: 下一个匹配",
    close: "ESC: 关闭",

    // FlowPanel
    searchFlow: "在工作流中搜索",
    connectionTips: "松开右键连接",
    headerRename: "查询表头以修改",

    // LogPanel
    logs: "日志",
    noLogsYet: "暂无日志",
    executePipelineHint: "执行工作流后查看输出",

    // DataProfile
    dataProfile: "数据概况",
    searchFields: "搜索字段",
    noFieldsMatch: "无匹配字段",
    analyzingData: "分析数据中...",
    columns: "列数",
    rows: "行数",
    count: "计数",
    empty: "空值",
    min: "最小值",
    max: "最大值",
    mean: "平均值",
    sum: "求和",
    minLen: "最小长度",
    maxLen: "最大长度",
  },
};
