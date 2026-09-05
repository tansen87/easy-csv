export type Language = "en" | "zh";

export interface Translations {
  rows: string;
  confirm: string;
  open: string;
  ai: string;
  recentFiles: string;
  modify: string;
  close: string;
  searchColumns: string;
  remove: string;

  // MainMenu
  file: string;
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
  morePanels: string;
  helpCenter: string;
  dataProfileRequiresInput: string;
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
  clearAllVersions: string;
  confirmClearAllVersions: string;
  versionCurrent: string;
  versionSteps: string;
  versionSearchPlaceholder: string;
  noMatchingVersions: string;
  listView: string;
  versionDiff: string;
  versionCompareWithCurrent: string;
  versionAddedSteps: string;
  versionRemovedSteps: string;
  versionModifiedSteps: string;
  versionEdges: string;
  versionNoChanges: string;
  versionEditMessage: string;
  versionEditTag: string;
  confirmRestoreTitle: string;
  confirmRestoreDesc: string;

  // ConfirmDialog
  refreshTitle: string;
  refreshMessage: string;

  // Settings
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
  doubleClickFitView: string;
  doubleClickFitViewDesc: string;
  resetToDefaults: string;
  saveSettings: string;
  selectDelimiter: string;
  delimiterDesc: string;
  language: string;

  // CommandList
  cmds: string;
  searchCommand: string;
  noCommandsFound: string;
  tryDifferentSearch: string;
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
  headerRename: string;
  deleteSteps: string;
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
  saved: string;
  unsaved: string;

  // LogPanel
  logs: string;
  noLogsYet: string;
  executePipelineHint: string;
  restore: string;
  maximize: string;
  allLogs: string;
  copy: string;
  copied: string;
  scrollToBottom: string;
  noMatchingLogs: string;

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
  count: string;
  empty: string;
  min: string;
  max: string;
  mean: string;
  sum: string;
  minLen: string;
  maxLen: string;

  // AIPanel
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
  aiClearData: string;
  aiClearDataDesc: string;
  aiClearConversations: string;
  aiClearFeedback: string;
  aiClearCorrections: string;
  aiClearConfirmTitle: string;
  aiClearConfirmDesc: string;

  // AI Settings
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
  aiCustomProviderSettings: string;
  aiProviderName: string;
  aiBaseUrl: string;
  aiModels: string;
  aiAddModel: string;

  // Plugins
  plugins: string;
  pluginDesc: string;
  pluginNone: string;
  pluginInstalled: string;
  pluginMissing: string;

  // CommandPalette
  commandPalette: string;
  palettePlaceholder: string;
  paletteActions: string;
  paletteCommands: string;
  paletteTabs: string;
  paletteNoResults: string;
  paletteNavigateHint: string;
  paletteSelectHint: string;
  paletteCloseHint: string;

  // CsvDiff
  csvDiff: string;
  fileA: string;
  fileB: string;
  csvDiffFileAPlaceholder: string;
  csvDiffFileBPlaceholder: string;
  compare: string;
  comparing: string;
  csvDiffSelectBoth: string;
  csvDiffNoResult: string;
  added: string;
  removed: string;
  equal: string;
  columnA: string;
  columnB: string;
  keyColumns: string;
  keyColumnsHint: string;
  equalRows: string;
  prev: string;
  next: string;
  page: string;

  // CsvEncoding
  csvEncoding: string;
  inputFile: string;
  outputFile: string;
  sourceEncoding: string;
  targetEncoding: string;
  convert: string;
  converting: string;
  csvEncodingSelectFiles: string;
  csvEncodingNoResult: string;
  success: string;
  sameEncoding: string;
  bytes: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    rows: "Rows",
    confirm: "Confirm",
    open: "Open",
    ai: "AI",
    recentFiles: "Recent Files",
    modify: "Modify",
    close: "Close",
    searchColumns: "Search columns",
    remove: "Remove",

    // MainMenu
    file: "File",
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
    morePanels: "More Panels",
    helpCenter: "Help Center",
    dataProfileRequiresInput: "Requires an input file",
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
    addTag: "Add tag",
    versionMessagePlaceholder: "Version message",
    tagsPlaceholder: "Tags (comma separated)",
    confirmDeleteVersion: "Are you sure you want to delete this version?",
    clearAllVersions: "Clear all versions",
    confirmClearAllVersions:
      "Are you sure you want to clear all versions? This cannot be undone.",
    versionCurrent: "current",
    versionSteps: "steps",
    versionSearchPlaceholder: "Search versions",
    noMatchingVersions: "No matching versions",
    listView: "List",
    versionDiff: "Diff",
    versionCompareWithCurrent: "Compare with current workspace",
    versionAddedSteps: "steps added",
    versionRemovedSteps: "steps removed",
    versionModifiedSteps: "steps modified",
    versionEdges: "connections",
    versionNoChanges: "No changes",
    versionEditMessage: "Edit message",
    versionEditTag: "Edit tag",
    confirmRestoreTitle: "Restore this version?",
    confirmRestoreDesc:
      "This will replace the current pipeline with the selected version.",

    // ConfirmDialog
    refreshTitle: "Refresh Page",
    refreshMessage:
      "Are you sure you want to refresh the page? Unsaved changes will be lost.",

    // Settings
    general: "General",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
    csvDelimiter: "Delimiter",
    noHeaders: "No Headers",
    noHeadersDesc: "When set, the first row will not be interpreted as headers",
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

    // CommandList
    cmds: "Cmd",
    searchCommand: "Search command",
    noCommandsFound: "No commands found",
    tryDifferentSearch: "Try a different search term",
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
    headerRename: "Search the header to modify",
    deleteSteps: "Delete",
    justNow: "just now",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
    saved: "Saved",
    unsaved: "Unsaved",

    // LogPanel
    logs: "Logs",
    noLogsYet: "No logs yet",
    executePipelineHint: "Execute a pipeline to see output",
    restore: "Restore",
    maximize: "Maximize",
    allLogs: "All",
    copy: "Copy",
    copied: "Copied",
    scrollToBottom: "Scroll to bottom",
    noMatchingLogs: "No logs match this filter",

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
    count: "Count",
    empty: "Empty",
    min: "Min",
    max: "Max",
    mean: "Mean",
    sum: "Sum",
    minLen: "Min Len",
    maxLen: "Max Len",

    // AIPanel
    aiPlaceholder: "Describe operations (Ctrl+Enter to send)",
    aiWelcomeMessage: "Easy CSV AI Assistant",
    aiThinking: "Thinking...",
    aiAddToPipeline: "Add to Pipeline",
    aiCommandPreview: "Command Preview",
    aiClear: "Clear",
    aiTokenUsed: "Used",
    aiConfigureApiKey: "Please configure API Key in settings",
    aiFeedbackPositive: "Helpful",
    aiFeedbackNegative: "Not helpful",
    aiFeedbackPlaceholder: "Please describe what's wrong or how to improve",
    aiClearData: "Clear AI Learning Data",
    aiClearDataDesc:
      "Delete all AI conversation history, feedback, and correction rules",
    aiClearConversations: "Clear Conversations",
    aiClearFeedback: "Clear Feedback",
    aiClearCorrections: "Clear Corrections",
    aiClearConfirmTitle: "Confirm Delete",
    aiClearConfirmDesc: "This action cannot be undone. Are you sure?",

    // AI Settings
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
    aiCustomProviderSettings: "Custom Provider Settings",
    aiProviderName: "Provider Name",
    aiBaseUrl: "Base URL",
    aiModels: "Models",
    aiAddModel: "Add Model",

    // Plugins
    plugins: "Plugins",
    pluginDesc: "Register external CLI plugins",
    pluginNone: "No plugins registered",
    pluginInstalled: "Found",
    pluginMissing: "Not found",

    // CommandPalette
    commandPalette: "Command Palette",
    palettePlaceholder: "Type a command or search",
    paletteActions: "Actions",
    paletteCommands: "Commands",
    paletteTabs: "Tabs",
    paletteNoResults: "No matching commands",
    paletteNavigateHint: "Navigate",
    paletteSelectHint: "Select",
    paletteCloseHint: "ESC Close",

    // CsvDiff
    csvDiff: "CSV Compare",
    fileA: "File A",
    fileB: "File B",
    csvDiffFileAPlaceholder: "Original CSV file",
    csvDiffFileBPlaceholder: "Modified CSV file",
    compare: "Compare",
    comparing: "Comparing...",
    csvDiffSelectBoth: "Please select both files",
    csvDiffNoResult: "Select two CSV files and click Compare",
    added: "Added",
    removed: "Removed",
    equal: "Equal",
    columnA: "cols A",
    columnB: "cols B",
    keyColumns: "Key",
    keyColumnsHint: "Select key columns to match rows (faster for large files)",
    equalRows: "identical rows",
    prev: "Prev",
    next: "Next",
    page: "Page",

    // CsvEncoding
    csvEncoding: "CSV Encoding",
    inputFile: "Input",
    outputFile: "Output",
    sourceEncoding: "Source",
    targetEncoding: "Target",
    convert: "Convert",
    converting: "Converting...",
    csvEncodingSelectFiles: "Select input and output files",
    csvEncodingNoResult:
      "Choose an input file, an output file and encodings, then click Convert. The result is written directly to the output file.",
    success: "Conversion successful",
    sameEncoding: "Source and target encodings are the same",
    bytes: "bytes",
  },
  zh: {
    rows: "行数",
    confirm: "确认",
    open: "打开",
    ai: "AI",
    recentFiles: "最近文件",
    modify: "修改",
    close: "关闭",
    searchColumns: "搜索列",
    remove: "移除",

    // MainMenu
    file: "文件",
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
    morePanels: "更多面板",
    helpCenter: "帮助中心",
    dataProfileRequiresInput: "需要载入输入文件",
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
    addTag: "添加标签",
    versionMessagePlaceholder: "版本描述",
    tagsPlaceholder: "标签(逗号分隔)",
    confirmDeleteVersion: "确定要删除此版本吗?",
    clearAllVersions: "清除所有版本",
    confirmClearAllVersions: "确定要清除所有版本历史吗?此操作不可撤销.",
    versionCurrent: "当前",
    versionSteps: "个步骤",
    versionSearchPlaceholder: "搜索版本",
    noMatchingVersions: "没有匹配的版本",
    listView: "列表",
    versionDiff: "对比",
    versionCompareWithCurrent: "与当前工作区对比",
    versionAddedSteps: "个新增步骤",
    versionRemovedSteps: "个删除步骤",
    versionModifiedSteps: "个修改步骤",
    versionEdges: "条连接",
    versionNoChanges: "无变化",
    versionEditMessage: "编辑描述",
    versionEditTag: "编辑标签",
    confirmRestoreTitle: "恢复此版本?",
    confirmRestoreDesc: "这将用所选版本替换当前管道.",

    // ConfirmDialog
    refreshTitle: "刷新页面",
    refreshMessage: "确定要刷新页面吗?未保存的更改将会丢失.",

    // Settings
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
    doubleClickFitView: "适配视图",
    doubleClickFitViewDesc: "启用后,双击画布空白区域将自动缩放视图",
    resetToDefaults: "恢复默认",
    saveSettings: "保存设置",
    selectDelimiter: "选择分隔符",
    delimiterDesc: "用于读取 CSV 数据的字段分隔符",
    language: "语言",

    // CommandList
    cmds: "命令",
    searchCommand: "搜索命令",
    noCommandsFound: "未找到命令",
    tryDifferentSearch: "请尝试其他搜索词",
    executePipelinesHint: "执行工作流后将在此显示",
    newTab: "新标签页打开",

    // HomeView
    welcomeTitle: "欢迎使用 Easy CSV",
    welcomeSubtitle: "打开文件或导入工作流开始使用",
    openFile: "打开文件",
    openFileFormats: "CSV, Excel, JSON",
    importFlow: "导入工作流",
    importFlowFormats: ".xanflow 文件",
    starOnGitHub: "GitHub 点赞",
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
    headerRename: "查询表头以修改",
    deleteSteps: "删除",
    justNow: "刚刚",
    minutesAgo: "{n} 分钟前",
    hoursAgo: "{n} 小时前",
    daysAgo: "{n} 天前",
    saved: "已保存",
    unsaved: "未保存",

    // LogPanel
    logs: "日志",
    noLogsYet: "暂无日志",
    executePipelineHint: "执行工作流后查看输出",
    restore: "恢复",
    maximize: "最大化",
    allLogs: "全部",
    copy: "复制",
    copied: "已复制",
    scrollToBottom: "滚动到底部",
    noMatchingLogs: "没有符合筛选条件的日志",

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
    count: "计数",
    empty: "空值",
    min: "最小值",
    max: "最大值",
    mean: "平均值",
    sum: "求和",
    minLen: "最小长度",
    maxLen: "最大长度",

    // AIPanel
    aiPlaceholder: "描述操作 (Ctrl+Enter 发送)",
    aiWelcomeMessage: "Easy CSV AI助手",
    aiThinking: "思考中...",
    aiAddToPipeline: "添加到管道",
    aiCommandPreview: "命令预览",
    aiClear: "清空",
    aiTokenUsed: "已用",
    aiConfigureApiKey: "请先在设置中配置 API Key",
    aiFeedbackPositive: "有帮助",
    aiFeedbackNegative: "没帮助",
    aiFeedbackPlaceholder: "请描述哪里不对或如何改进",
    aiClearData: "清除AI学习数据",
    aiClearDataDesc: "删除所有AI对话历史、反馈记录和纠正规则",
    aiClearConversations: "清除对话历史",
    aiClearFeedback: "清除反馈记录",
    aiClearCorrections: "清除纠正规则",
    aiClearConfirmTitle: "确认删除",
    aiClearConfirmDesc: "此操作不可撤销,确定要继续吗?",

    // AI Settings
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
    aiCustomProviderSettings: "自定义提供商设置",
    aiProviderName: "提供商名称",
    aiBaseUrl: "Base URL",
    aiModels: "模型列表",
    aiAddModel: "添加模型",

    // Plugins
    plugins: "插件",
    pluginDesc: "注册外部 CLI 插件",
    pluginNone: "暂无已注册插件",
    pluginInstalled: "已找到",
    pluginMissing: "未找到",

    // CommandPalette
    commandPalette: "命令面板",
    palettePlaceholder: "输入命令或搜索",
    paletteActions: "操作",
    paletteCommands: "命令",
    paletteTabs: "标签页",
    paletteNoResults: "没有匹配的命令",
    paletteNavigateHint: "导航",
    paletteSelectHint: "选择",
    paletteCloseHint: "ESC 关闭",

    // CsvDiff
    csvDiff: "CSV 对比",
    fileA: "文件 A",
    fileB: "文件 B",
    csvDiffFileAPlaceholder: "原始 CSV 文件",
    csvDiffFileBPlaceholder: "修改后的 CSV 文件",
    compare: "开始对比",
    comparing: "对比中...",
    csvDiffSelectBoth: "请选择两个文件",
    csvDiffNoResult: "选择两个 CSV 文件并点击开始对比",
    added: "新增",
    removed: "删除",
    equal: "相同",
    columnA: "列 A",
    columnB: "列 B",
    keyColumns: "关键列",
    keyColumnsHint: "选择关键列以按主键匹配行(大文件更快)",
    equalRows: "行相同",
    prev: "上一页",
    next: "下一页",
    page: "页",

    // CsvEncoding
    csvEncoding: "CSV 编码转换",
    inputFile: "输入",
    outputFile: "输出",
    sourceEncoding: "源编码",
    targetEncoding: "目标编码",
    convert: "开始转换",
    converting: "转换中...",
    csvEncodingSelectFiles: "请选择输入和输出文件",
    csvEncodingNoResult:
      "选择输入文件、输出文件与编码,点击开始转换.结果直接写入输出文件.",
    success: "转换成功",
    sameEncoding: "源编码与目标编码相同",
    bytes: "字节",
  },
};
