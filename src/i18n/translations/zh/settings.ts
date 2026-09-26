import type { Translations } from "../types";

/** Settings */
export const zhSettings = {
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
} satisfies Partial<Translations>;
