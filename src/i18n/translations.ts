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
  cancelExecution: string;
  executionCancelled: string;
  commandPanel: string;
  logPanel: string;
  checkUpdate: string;
  help: string;
  settings: string;
  versionHistory: string;
  dataLineage: string;
  columnLineage: string;
  dagView: string;
  fullscreen: string;
  exitFullscreen: string;
  timelineView: string;
  inputColumns: string;
  outputColumns: string;
  lineageTransformations: string;
  rowsCount: string;
  lineagePath: string;
  sourceStep: string;
  noLineageData: string;
  lineageForColumn: string;

  // VersionControl
  save: string;
  saving: string;
  saveVersion: string;
  untitledVersion: string;
  noVersionsSaved: string;
  addTag: string;
  versionMessagePlaceholder: string;
  tagsPlaceholder: string;
  confirmDeleteVersion: string;

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
  systemNotification: string;
  systemNotificationDesc: string;
  minimizeToTray: string;
  minimizeToTrayDesc: string;
  resetToDefaults: string;
  saveSettings: string;
  selectDelimiter: string;
  delimiterDesc: string;
  language: string;
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
  helpClose: string;

  // FlowPanel
  searchFlow: string;
  connectionTips: string;
  headerRename: string;

  // LogPanel
  logs: string;
  noLogsYet: string;
  executePipelineHint: string;
  restore: string;
  maximize: string;

  // ChartPanel
  chart: string;
  chartType: string;
  xAxis: string;
  yAxis: string;
  category: string;
  title: string;
  noData: string;
  download: string;

  // DataProfile
  dataProfile: string;
  noColumnsMatch: string;
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

  // AIPanel
  aiPanel: string;
  aiPlaceholder: string;
  aiWelcomeMessage: string;
  aiThinking: string;
  aiAddToPipeline: string;
  aiCommandPreview: string;
  aiClear: string;
  aiTokenUsed: string;
  aiConfigureApiKey: string;
  aiFeedbackPositive: string;
  aiFeedbackNegative: string;
  aiFeedbackPlaceholder: string;
  aiClarificationConfirm: string;
  aiClarificationModify: string;
  aiClearData: string;
  aiClearDataDesc: string;
  aiClearConversations: string;
  aiClearFeedback: string;
  aiClearCorrections: string;
  aiClearConfirmTitle: string;
  aiClearConfirmDesc: string;

  // AI Settings
  ai: string;
  aiProvider: string;
  aiProviderDesc: string;
  aiSelectProvider: string;
  aiApiKey: string;
  aiApiKeyDesc: string;
  aiGetToken: string;
  aiCheckBalance: string;
  aiModel: string;
  aiModelDesc: string;
  aiSelectModel: string;

  // CommandPalette
  commandPalette: string;
  commandPalettePlaceholder: string;
  paletteActions: string;
  paletteCommands: string;
  paletteTabs: string;
  paletteRecentFiles: string;
  paletteNoResults: string;
  paletteNavigateHint: string;
  paletteSelectHint: string;
  paletteCloseHint: string;

  // General
  close: string;
  searchColumns: string;

  // CsvDiff
  csvDiff: string;
  csvDiffFileA: string;
  csvDiffFileB: string;
  csvDiffFileAPlaceholder: string;
  csvDiffFileBPlaceholder: string;
  csvDiffBrowse: string;
  csvDiffCompare: string;
  csvDiffComparing: string;
  csvDiffSelectBoth: string;
  csvDiffNoResult: string;
  csvDiffAdded: string;
  csvDiffRemoved: string;
  csvDiffModified: string;
  csvDiffEqual: string;
  csvDiffColsLeft: string;
  csvDiffColsRight: string;
  csvDiffKeyColumns: string;
  csvDiffKeyColumnsHint: string;
  csvDiffEqualRows: string;
  csvDiffPrev: string;
  csvDiffNext: string;
  csvDiffPage: string;

  // CsvEncoding
  csvEncoding: string;
  csvEncodingInputFile: string;
  csvEncodingOutputFile: string;
  csvEncodingBrowse: string;
  csvEncodingSourceEncoding: string;
  csvEncodingTargetEncoding: string;
  csvEncodingConvert: string;
  csvEncodingConverting: string;
  csvEncodingSelectFiles: string;
  csvEncodingNoResult: string;
  csvEncodingSuccess: string;
  csvEncodingSameEncoding: string;
  csvEncodingBytes: string;
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
    cancelExecution: "Cancel Execution",
    executionCancelled: "Execution cancelled",
    commandPanel: "Command",
    logPanel: "Logs",
    dataProfile: "Data Profile",
    checkUpdate: "Check Update",
    help: "Help",
    settings: "Settings",
    versionHistory: "Version History",
    dataLineage: "Data Lineage",
    columnLineage: "Column Lineage",
    dagView: "Graph",
    timelineView: "Timeline",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit Fullscreen",
    inputColumns: "Input Columns",
    outputColumns: "Output Columns",
    lineageTransformations: "Transformations",
    rowsCount: "Rows",
    lineagePath: "Lineage Path",
    sourceStep: "Source",
    noLineageData: "Execute a pipeline to see data lineage",
    lineageForColumn: "Lineage for column:",

    // VersionControl
    save: "Save",
    saving: "Saving...",
    saveVersion: "Save Version",
    untitledVersion: "Untitled version",
    noVersionsSaved: "No versions saved yet",
    addTag: "Add tag...",
    versionMessagePlaceholder: "Version message...",
    tagsPlaceholder: "Tags (comma separated)...",
    confirmDeleteVersion: "Are you sure you want to delete this version?",

    // ConfirmDialog
    confirm: "Confirm",
    refreshTitle: "Refresh Page",
    refreshMessage:
      "Are you sure you want to refresh the page? Unsaved changes will be lost.",

    // Settings
    preference: "Preference",
    general: "General",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
    csvDelimiter: "Delim",
    noHeaders: "No Headers",
    noHeadersDesc: "When set, the first row will not be interpreted as headers",
    systemNotification: "Notification",
    systemNotificationDesc:
      "When enabled, Show system notification when pipeline execution completes",
    minimizeToTray: "Tray",
    minimizeToTrayDesc:
      "When enabled, closing the window will minimize to system tray instead of exiting",
    resetToDefaults: "Reset to Defaults",
    saveSettings: "Save Settings",
    selectDelimiter: "Select delimiter",
    delimiterDesc: "The field delimiter for reading CSV data",
    language: "Language",
    unlimited: "Unlimited",

    // CommandList
    cmds: "Command",
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
    helpClose: "ESC: Close",

    // FlowPanel
    searchFlow: "Search in the workflow",
    connectionTips: "Release the right-click connection",
    headerRename: "Search the header to modify",

    // LogPanel
    logs: "Logs",
    noLogsYet: "No logs yet",
    executePipelineHint: "Execute a pipeline to see output",
    restore: "Restore",
    maximize: "Maximize",

    // ChartPanel
    chart: "Chart",
    chartType: "Chart Type",
    xAxis: "X Axis",
    yAxis: "Y Axis",
    category: "Category",
    title: "Title",
    noData: "No data to display",
    download: "Download",

    // DataProfile
    noColumnsMatch: "No columns matching",
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

    // AIPanel
    aiPanel: "AI",
    aiPlaceholder: "Describe operations (Ctrl+Enter to send)...",
    aiWelcomeMessage: "Easy CSV AI Assistant",
    aiThinking: "Thinking...",
    aiAddToPipeline: "Add to Pipeline",
    aiCommandPreview: "Command Preview",
    aiClear: "Clear",
    aiTokenUsed: "Used",
    aiConfigureApiKey: "Please configure API Key in settings",
    aiFeedbackPositive: "Helpful",
    aiFeedbackNegative: "Not helpful",
    aiFeedbackPlaceholder: "Please describe what's wrong or how to improve...",
    aiClarificationConfirm: "Confirm",
    aiClarificationModify: "Modify",
    aiClearData: "Clear AI Learning Data",
    aiClearDataDesc:
      "Delete all AI conversation history, feedback, and correction rules",
    aiClearConversations: "Clear Conversations",
    aiClearFeedback: "Clear Feedback",
    aiClearCorrections: "Clear Corrections",
    aiClearConfirmTitle: "Confirm Delete",
    aiClearConfirmDesc: "This action cannot be undone. Are you sure?",

    // AI Settings
    ai: "AI",
    aiProvider: "Provider",
    aiProviderDesc: "Select AI service provider",
    aiSelectProvider: "Select provider",
    aiApiKey: "API Key",
    aiApiKeyDesc: "Your API token for accessing AI models",
    aiGetToken: "Get API Token",
    aiCheckBalance: "Check Balance",
    aiModel: "Model",
    aiModelDesc: "Select the AI model to use for generating commands",
    aiSelectModel: "Select a model",

    // CommandPalette
    commandPalette: "Command Palette",
    commandPalettePlaceholder: "Type a command or search",
    paletteActions: "Actions",
    paletteCommands: "Commands",
    paletteTabs: "Tabs",
    paletteRecentFiles: "Recent Files",
    paletteNoResults: "No matching commands",
    paletteNavigateHint: "Navigate",
    paletteSelectHint: "Select",
    paletteCloseHint: "esc Close",

    // General
    close: "Close",
    searchColumns: "Search columns",

    // CsvDiff
    csvDiff: "CSV Compare",
    csvDiffFileA: "File A",
    csvDiffFileB: "File B",
    csvDiffFileAPlaceholder: "Original CSV file",
    csvDiffFileBPlaceholder: "Modified CSV file",
    csvDiffBrowse: "Browse",
    csvDiffCompare: "Compare",
    csvDiffComparing: "Comparing...",
    csvDiffSelectBoth: "Please select both files",
    csvDiffNoResult: "Select two CSV files and click Compare",
    csvDiffAdded: "Added",
    csvDiffRemoved: "Removed",
    csvDiffModified: "Modified",
    csvDiffEqual: "Equal",
    csvDiffColsLeft: "cols A",
    csvDiffColsRight: "cols B",
    csvDiffKeyColumns: "Key",
    csvDiffKeyColumnsHint:
      "Select key columns to match rows (faster for large files)",
    csvDiffEqualRows: "identical rows",
    csvDiffPrev: "Prev",
    csvDiffNext: "Next",
    csvDiffPage: "Page",

    // CsvEncoding
    csvEncoding: "CSV Encoding",
    csvEncodingInputFile: "Input",
    csvEncodingOutputFile: "Output",
    csvEncodingBrowse: "Browse",
    csvEncodingSourceEncoding: "Source Encoding",
    csvEncodingTargetEncoding: "Target Encoding",
    csvEncodingConvert: "Convert",
    csvEncodingConverting: "Converting...",
    csvEncodingSelectFiles: "Select input and output files",
    csvEncodingNoResult:
      "Choose an input file, an output file and encodings, then click Convert. The result is written directly to the output file.",
    csvEncodingSuccess: "Conversion successful",
    csvEncodingSameEncoding: "Source and target encodings are the same",
    csvEncodingBytes: "bytes",
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
    cancelExecution: "取消执行",
    executionCancelled: "执行已取消",
    commandPanel: "命令",
    logPanel: "日志",
    dataProfile: "数据概览",
    checkUpdate: "检查更新",
    help: "帮助",
    settings: "设置",
    versionHistory: "版本控制",
    dataLineage: "数据血缘",
    columnLineage: "列级血缘",
    dagView: "图形",
    fullscreen: "全屏",
    exitFullscreen: "退出全屏",
    timelineView: "时间线",
    inputColumns: "输入列",
    outputColumns: "输出列",
    lineageTransformations: "变换",
    rowsCount: "行数",
    lineagePath: "血缘路径",
    sourceStep: "来源",
    noLineageData: "执行后可查看数据血缘",
    lineageForColumn: "列的血缘：",

    // VersionControl
    save: "保存",
    saving: "保存中...",
    saveVersion: "保存版本",
    untitledVersion: "未命名版本",
    noVersionsSaved: "暂无版本记录",
    addTag: "添加标签...",
    versionMessagePlaceholder: "版本描述...",
    tagsPlaceholder: "标签（逗号分隔）...",
    confirmDeleteVersion: "确定要删除此版本吗？",

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
    csvDelimiter: "分隔符",
    noHeaders: "无表头",
    noHeadersDesc: "启用后,第一行将不被视为表头",
    systemNotification: "系统通知",
    systemNotificationDesc: "启用后,管道执行完成后显示系统通知",
    minimizeToTray: "系统托盘",
    minimizeToTrayDesc: "启用后,关闭窗口将最小化到系统托盘而非退出应用",
    resetToDefaults: "恢复默认",
    saveSettings: "保存设置",
    selectDelimiter: "选择分隔符",
    delimiterDesc: "用于读取 CSV 数据的字段分隔符",
    language: "语言",
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
    helpClose: "ESC: 关闭",

    // FlowPanel
    searchFlow: "在工作流中搜索",
    connectionTips: "松开右键连接",
    headerRename: "查询表头以修改",

    // LogPanel
    logs: "日志",
    noLogsYet: "暂无日志",
    executePipelineHint: "执行工作流后查看输出",
    restore: "恢复",
    maximize: "最大化",

    // ChartPanel
    chart: "图表",
    chartType: "图表类型",
    xAxis: "X轴",
    yAxis: "Y轴",
    category: "分类",
    title: "标题",
    noData: "无数据可显示",
    download: "下载",

    // DataProfile
    noColumnsMatch: "没有匹配的列",
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

    // AIPanel
    aiPanel: "AI",
    aiPlaceholder: "描述操作 (Ctrl+Enter 发送)...",
    aiWelcomeMessage: "Easy CSV AI助手",
    aiThinking: "思考中...",
    aiAddToPipeline: "添加到管道",
    aiCommandPreview: "命令预览",
    aiClear: "清空",
    aiTokenUsed: "已用",
    aiConfigureApiKey: "请先在设置中配置 API Key",
    aiFeedbackPositive: "有帮助",
    aiFeedbackNegative: "没帮助",
    aiFeedbackPlaceholder: "请描述哪里不对或如何改进...",
    aiClarificationConfirm: "确认",
    aiClarificationModify: "修改",
    aiClearData: "清除AI学习数据",
    aiClearDataDesc: "删除所有AI对话历史、反馈记录和纠正规则",
    aiClearConversations: "清除对话历史",
    aiClearFeedback: "清除反馈记录",
    aiClearCorrections: "清除纠正规则",
    aiClearConfirmTitle: "确认删除",
    aiClearConfirmDesc: "此操作不可撤销，确定要继续吗？",

    // AI Settings
    ai: "AI",
    aiProvider: "服务提供商",
    aiProviderDesc: "选择AI服务提供商",
    aiSelectProvider: "选择提供商",
    aiApiKey: "API Key",
    aiApiKeyDesc: "用于访问AI模型的API令牌",
    aiGetToken: "获取API令牌",
    aiCheckBalance: "查询余额",
    aiModel: "模型",
    aiModelDesc: "选择用于生成命令的AI模型",
    aiSelectModel: "选择模型",

    // CommandPalette
    commandPalette: "命令面板",
    commandPalettePlaceholder: "输入命令或搜索",
    paletteActions: "操作",
    paletteCommands: "命令",
    paletteTabs: "标签页",
    paletteRecentFiles: "最近文件",
    paletteNoResults: "没有匹配的命令",
    paletteNavigateHint: "导航",
    paletteSelectHint: "选择",
    paletteCloseHint: "esc 关闭",

    // General
    close: "关闭",
    searchColumns: "搜索列",

    // CsvDiff
    csvDiff: "CSV 对比",
    csvDiffFileA: "文件 A",
    csvDiffFileB: "文件 B",
    csvDiffFileAPlaceholder: "原始 CSV 文件",
    csvDiffFileBPlaceholder: "修改后的 CSV 文件",
    csvDiffBrowse: "浏览",
    csvDiffCompare: "开始对比",
    csvDiffComparing: "对比中...",
    csvDiffSelectBoth: "请选择两个文件",
    csvDiffNoResult: "选择两个 CSV 文件并点击开始对比",
    csvDiffAdded: "新增",
    csvDiffRemoved: "删除",
    csvDiffModified: "修改",
    csvDiffEqual: "相同",
    csvDiffColsLeft: "列 A",
    csvDiffColsRight: "列 B",
    csvDiffKeyColumns: "关键列",
    csvDiffKeyColumnsHint: "选择关键列以按主键匹配行(大文件更快)",
    csvDiffEqualRows: "行相同",
    csvDiffPrev: "上一页",
    csvDiffNext: "下一页",
    csvDiffPage: "页",

    // CsvEncoding
    csvEncoding: "编码转换",
    csvEncodingInputFile: "输入",
    csvEncodingOutputFile: "输出",
    csvEncodingBrowse: "浏览",
    csvEncodingSourceEncoding: "源编码",
    csvEncodingTargetEncoding: "目标编码",
    csvEncodingConvert: "开始转换",
    csvEncodingConverting: "转换中...",
    csvEncodingSelectFiles: "请选择输入和输出文件",
    csvEncodingNoResult:
      "选择输入文件、输出文件与编码,点击开始转换。结果直接写入输出文件。",
    csvEncodingSuccess: "转换成功",
    csvEncodingSameEncoding: "源编码与目标编码相同",
    csvEncodingBytes: "字节",
  },
};
