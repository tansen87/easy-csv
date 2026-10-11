import type { Translations } from "@/i18n/translations/types";

/**
 * The settings directory (design 030): groups and rows defined **once**, then
 * rendered by both the sidebar (`SettingsNav`) and the content list
 * (`SettingsTabContent`). Two contracts hang off this file (§0.4):
 *
 * 1. every row id appears exactly once here and is used verbatim as the row's
 *    `data-settings-row` / anchor id — no second list to drift;
 * 2. the group list is the single source for both the nav entries and the
 *    content headings.
 *
 * Both are asserted by a contract test in `settingsSections.test.ts`.
 *
 * Group order (§11.18): `界面` first, then the merged `数据与帮助`, then the
 * rest in their historical order. The catalogue list that used to be the
 * plugins pane is gone (§11.12) — the plugin group is a status line on its
 * heading plus one row per catalogue entry (§11.11).
 */

export type SettingsTextKey = keyof Translations;

/** What the row's third column holds. Also picks the whole-row click action. */
export type SettingsControl =
  | "delimiter"
  | "checkbox"
  | "number"
  | "language"
  | "theme"
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
   * Destructive rows never delegate a whole-row click (design 030 §4.2) —
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
  /**
   * The group's content is one embedded panel instead of rows. `插件管理` is
   * the only one: `PluginManager` brings its own list and scrolling.
   */
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
    ],
  },
  {
    id: "data-help",
    nameKey: "settingsGroupDataHelp",
    rows: [
      {
        id: "delimiter",
        titleKey: "csvDelimiter",
        descKey: "delimiterDesc",
        control: "delimiter",
        keywords: [
          "delimiter",
          "separator",
          "sep",
          "tab",
          "分隔符",
          "分隔",
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
      {
        id: "max-concurrent",
        titleKey: "maxConcurrentRuns",
        descKey: "maxConcurrentRunsDesc",
        control: "number",
        keywords: [
          "concurrency",
          "concurrent",
          "parallel",
          "tabs",
          "queue",
          "并发",
          "并行",
          "标签页",
          "排队",
        ],
      },
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
    id: "update",
    nameKey: "settingsGroupUpdate",
    rows: [
      {
        id: "auto-check-update",
        titleKey: "updateSection",
        descKey: "settingsAutoCheckUpdateDesc",
        control: "checkbox",
        keywords: ["update", "upgrade", "version", "release", "更新", "升级", "版本"],
      },
    ],
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
      // The old single "clear AI learning data" cluster, split into one row per
      // action so each of them can be searched and described (design 030 §0.5).
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
    id: "plugins",
    nameKey: "plugins",
    groupKeywords: ["plugin", "plugins", "xan", "extension", "插件", "扩展"],
    // No rows: the heading itself is the plugin line.
    rows: [],
    summary: "plugins",
  },
];

/** Anchor id of a group's heading, in both the nav and the content list. */
export const SECTION_ID_PREFIX = "settings-section-";

export const sectionElementId = (groupId: string) =>
  `${SECTION_ID_PREFIX}${groupId}`;

export const rowElementId = (rowId: string) => `settings-row-${rowId}`;

/** Group ids in render order — what the scroll spy watches. */
export const SETTINGS_GROUP_IDS = SETTINGS_GROUPS.map((group) => group.id);

export interface SettingsRowModel extends SettingsRowDef {
  title: string;
  description?: string;
}

export interface SettingsGroupModel {
  id: string;
  name: string;
  groupKeywords?: string[];
  rows: SettingsRowModel[];
  summary?: "plugins";
}

/** Resolve i18n keys once, so search / render work on plain strings. */
export function buildSettingsModel(t: Translations): SettingsGroupModel[] {
  return SETTINGS_GROUPS.map((group) => ({
    id: group.id,
    name: t[group.nameKey],
    groupKeywords: group.groupKeywords,
    summary: group.summary,
    rows: group.rows.map((row) => ({
      ...row,
      title: t[row.titleKey],
      description: row.descKey ? t[row.descKey] : undefined,
    })),
  }));
}
