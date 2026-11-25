import type { Translations } from "@/i18n/translations/types";

/**
 * The settings directory: groups and rows defined **once**, then
 * rendered by both the sidebar (`SettingsNav`) and the content list
 * (`SettingsTabContent`). Two contracts hang off this file:
 *
 * 1. every row id appears exactly once here and is used verbatim as the row's
 *    `data-settings-row` / anchor id - no second list to drift;
 * 2. the group list is the single source for both the nav entries and the
 *    content headings. Both are asserted in `SettingsDialog.test.tsx`.
 *
 * Group order: `界面`, `数据`, `窗口`, `运行`, `日志`, then **plugins before
 * AI** (xan must be installed before anything runs; AI is optional), then
 * `更新` and `维护` last - resets and destructive actions go at the bottom.
 * The plugin group is a heading status line, not a list.
 */

export type SettingsTextKey = keyof Translations;

/** What the row's third column holds. Also picks the whole-row click action. */
export type SettingsControl =
  | "delimiter"
  | "checkbox"
  | "number"
  | "language"
  | "theme"
  | "accent"
  | "action"
  | "disclosure"
  | "provider"
  | "model"
  | "apiKey"
  | "danger";

export interface SettingsRowDef {
  id: string;
  titleKey: SettingsTextKey;
  descKey?: SettingsTextKey;
  /**
   * Extra search aliases. Deliberately **data, not i18n**: a Chinese user
   * looking for the tray should be able to type `tray`, and an English user
   * should be able to type `托盘`.
   */
  keywords?: string[];
  control: SettingsControl;
  /**
   * Destructive rows never delegate a whole-row click (design 030 §4.2) -
   * clicking a description must not delete data.
   */
  dangerous?: true;
}

export interface SettingsGroupDef {
  id: string;
  nameKey: SettingsTextKey;
  /** Aliases for the group name itself (lets a category name be searched). */
  groupKeywords?: string[];
  rows: SettingsRowDef[];
  /** The group's content is an embedded panel instead of rows. */
  summary?: "plugins";
}

export const SETTINGS_GROUPS: SettingsGroupDef[] = [
  {
    id: "appearance",
    nameKey: "settingsGroupAppearance",
    rows: [
      {
        id: "language",
        titleKey: "language",
        descKey: "settingsLanguageDesc",
        control: "language",
        keywords: [
          "language",
          "locale",
          "chinese",
          "english",
          "语言",
          "中文",
          "英文",
        ],
      },
      {
        id: "theme",
        titleKey: "theme",
        descKey: "settingsThemeDesc",
        control: "theme",
        keywords: [
          "theme",
          "dark",
          "light",
          "appearance",
          "color",
          "colour",
          "主题",
          "暗色",
          "深色",
          "浅色",
          "配色",
        ],
      },
      {
        id: "accent",
        titleKey: "settingsAccent",
        descKey: "settingsAccentDesc",
        control: "accent",
        keywords: [
          "accent",
          "brand",
          "ink",
          "teal",
          "clay",
          "graphite",
          "rose",
          "violet",
          "pink",
          "purple",
          "主题色",
          "强调色",
          "品牌色",
          "墨蓝",
          "青碧",
          "赭石",
          "石墨",
          "胭脂",
          "青莲",
          "粉色",
          "紫色",
        ],
      },
    ],
  },
  {
    id: "data",
    nameKey: "settingsGroupData",
    rows: [
      {
        id: "delimiter",
        titleKey: "csvDelimiter",
        descKey: "delimiterDesc",
        control: "delimiter",
        keywords: [
          "delimiter",
          "separator",
          "tab",
          "分隔符",
          "逗号",
          "分号",
          "制表符",
        ],
      },
      {
        id: "no-headers",
        titleKey: "noHeaders",
        descKey: "noHeadersDesc",
        control: "checkbox",
        keywords: ["header", "headers", "column names", "表头", "首行", "列名"],
      },
    ],
  },
  {
    id: "window",
    nameKey: "settingsGroupWindow",
    rows: [
      {
        id: "notification",
        titleKey: "systemNotification",
        descKey: "systemNotificationDesc",
        control: "checkbox",
        keywords: ["notification", "notify", "alert", "通知", "提醒"],
      },
      {
        id: "tray",
        titleKey: "minimizeToTray",
        descKey: "minimizeToTrayDesc",
        control: "checkbox",
        keywords: [
          "tray",
          "minimize",
          "background",
          "close",
          "托盘",
          "最小化",
          "后台",
        ],
      },
      {
        id: "fit-view",
        titleKey: "doubleClickFitView",
        descKey: "doubleClickFitViewDesc",
        control: "checkbox",
        keywords: [
          "fit",
          "zoom",
          "canvas",
          "double click",
          "视图",
          "缩放",
          "双击",
          "画布",
        ],
      },
    ],
  },
  {
    id: "run",
    nameKey: "settingsGroupRun",
    rows: [
      {
        id: "max-concurrent",
        titleKey: "maxConcurrentRuns",
        descKey: "maxConcurrentRunsDesc",
        control: "number",
        keywords: [
          "concurrency",
          "parallel",
          "tabs",
          "queue",
          "并行",
          "标签页",
          "排队",
        ],
      },
      {
        id: "usage-ledger",
        titleKey: "usageLedger",
        descKey: "usageLedgerDesc",
        control: "checkbox",
        keywords: [
          "ledger",
          "usage",
          "stats",
          "milestone",
          "账本",
          "历程",
          "统计",
          "刻痕",
        ],
      },
    ],
  },
  {
    id: "logs",
    nameKey: "settingsGroupLogs",
    rows: [
      {
        id: "auto-open-logs",
        titleKey: "autoShowLogPanel",
        descKey: "autoShowLogPanelDesc",
        control: "checkbox",
        keywords: ["drawer", "panel", "抽屉"],
      },
      {
        id: "log-retention",
        titleKey: "logRetentionDays",
        descKey: "logRetentionDaysDesc",
        control: "number",
        keywords: ["logs", "prune", "jsonl", "清理"],
      },
      {
        id: "open-logs-dir",
        titleKey: "logOpenDirAction",
        descKey: "logOpenDirDesc",
        control: "action",
        keywords: [
          "log",
          "folder",
          "directory",
          "open",
          "reveal",
          "日志",
          "目录",
          "文件夹",
        ],
      },
    ],
  },
  {
    id: "plugins",
    nameKey: "plugins",
    groupKeywords: ["plugin", "plugins", "xan", "extension", "插件", "扩展"],
    // No rows: the heading itself is the plugin line.
    rows: [],
    summary: "plugins",
  },
  {
    id: "ai",
    nameKey: "ai",
    rows: [
      {
        id: "ai-provider",
        titleKey: "aiProvider",
        descKey: "aiProviderDesc",
        control: "provider",
        keywords: [
          "provider",
          "api",
          "deepseek",
          "qwen",
          "glm",
          "服务商",
          "提供商",
        ],
      },
      {
        id: "ai-model",
        titleKey: "aiModel",
        descKey: "aiModelDesc",
        control: "model",
        keywords: ["model", "llm", "模型"],
      },
      {
        id: "ai-custom-provider",
        titleKey: "aiCustomProviderSettings",
        descKey: "aiCustomProviderSettingsDesc",
        control: "disclosure",
        keywords: ["custom", "base url", "endpoint", "自定义", "接口", "地址"],
      },
      {
        id: "ai-api-key",
        titleKey: "aiApiKey",
        descKey: "aiApiKeyDesc",
        control: "apiKey",
        keywords: [
          "api key",
          "token",
          "sk",
          "secret",
          "credential",
          "密钥",
          "凭据",
          "令牌",
        ],
      },
      // One row per AI data action, so each is searchable (design 030 §0.5).
      {
        id: "ai-clear-conversations",
        titleKey: "aiClearConversations",
        descKey: "aiClearConversationsDesc",
        control: "danger",
        dangerous: true,
        keywords: ["conversation", "chat", "history", "对话", "聊天", "清除", "删除"],
      },
      {
        id: "ai-clear-feedback",
        titleKey: "aiClearFeedback",
        descKey: "aiClearFeedbackDesc",
        control: "danger",
        dangerous: true,
        keywords: ["feedback", "rating", "反馈", "评价", "清除", "删除"],
      },
      {
        id: "ai-clear-corrections",
        titleKey: "aiClearCorrections",
        descKey: "aiClearCorrectionsDesc",
        control: "danger",
        dangerous: true,
        keywords: ["correction", "rule", "纠正", "规则", "清除", "删除"],
      },
    ],
  },
  {
    id: "update",
    nameKey: "settingsGroupUpdate",
    rows: [
      {
        id: "auto-check-update",
        // Names what happens on its own, not the menu command.
        titleKey: "settingsAutoCheckUpdate",
        descKey: "settingsAutoCheckUpdateDesc",
        control: "checkbox",
        keywords: ["update", "upgrade", "version", "release", "更新", "升级", "版本"],
      },
    ],
  },
  {
    id: "maintenance",
    nameKey: "settingsGroupMaintenance",
    rows: [
      {
        id: "onboarding-reset",
        titleKey: "onboardingReset",
        descKey: "onboardingResetDesc",
        control: "action",
        keywords: [
          "onboarding",
          "guide",
          "tour",
          "welcome",
          "引导",
          "新手",
          "教程",
        ],
      },
      {
        id: "clear-execution-history",
        titleKey: "clearExecutionHistory",
        descKey: "clearExecutionHistoryDesc",
        control: "danger",
        dangerous: true,
        keywords: ["history", "clear", "delete", "历史", "清除", "删除", "记录"],
      },
      {
        id: "clear-ledger",
        titleKey: "clearLedger",
        descKey: "clearLedgerDesc",
        control: "danger",
        dangerous: true,
        keywords: ["ledger", "clear", "delete", "账本", "历程", "清除", "删除"],
      },
    ],
  },
];

/** Anchor id of a group's heading, in both the nav and the content list. */
export const SECTION_ID_PREFIX = "settings-section-";

export const sectionElementId = (groupId: string) =>
  `${SECTION_ID_PREFIX}${groupId}`;

export const rowElementId = (rowId: string) => `settings-row-${rowId}`;

/** Group ids in render order - what the scroll spy watches. */
export const SETTINGS_GROUP_IDS = SETTINGS_GROUPS.map((group) => group.id);

export interface SettingsRowModel extends SettingsRowDef {
  title: string;
  description?: string;
}

export interface SettingsGroupModel {
  id: string;
  name: string;
  /**
   * 1-based position in `SETTINGS_GROUPS`, rendered as the `01`…`09` beside the
   * group name. Kept on the model rather than derived from the rendered list so
   * a filtered list still shows the original number (design 040 §3).
   */
  index: number;
  groupKeywords?: string[];
  rows: SettingsRowModel[];
  summary?: "plugins";
}

/** Resolve i18n keys once, so search / render work on plain strings. */
export function buildSettingsModel(t: Translations): SettingsGroupModel[] {
  return SETTINGS_GROUPS.map((group, position) => ({
    id: group.id,
    name: t[group.nameKey],
    index: position + 1,
    groupKeywords: group.groupKeywords,
    summary: group.summary,
    rows: group.rows.map((row) => ({
      ...row,
      title: t[row.titleKey],
      description: row.descKey ? t[row.descKey] : undefined,
    })),
  }));
}
