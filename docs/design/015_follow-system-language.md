# 语言设置支持「跟随系统」— 设计文档

> 状态: 已实现(2026-09-13)
> 日期: 2026-09-13
> 关联: `docs/AI/INDEX.md` → 修改设置项 / 修改国际化文本
> 备注: 实现阶段将初版方案中的双类型「`Language` + `LanguagePreference`」调整为合并式——`system` 直接并入 `Language`,生效语言用 `EffectiveLanguage` 表示,使语言设置与主题设置(`Theme = "dark" | "light" | "system"`)的类型模型完全对称。

---

## 1. 背景与目标

当前 Easy CSV 的界面语言只有两种显式选项: English / 中文,用户必须在设置中手动选择。首次启动时默认固定为英文(`src/i18n/index.tsx:19` 返回 `"en"`),中文用户第一次打开应用看到的是英文界面。

本次新增第三个选项 **「跟随系统」(System)**:

- 用户选择跟随系统后,界面语言由操作系统语言自动决定: 系统语言为中文 → 界面显示中文,否则显示英文。
- 「跟随系统」作为新用户的默认值(与主题设置 `ThemeProvider` 默认 `"system"` 的行为对齐)。
- 显式选择 English / 中文的行为保持不变,已有用户的本地存储值完全兼容,无需迁移。

### 非目标

- 不新增第三种界面语言(仍只有 en/zh 两套翻译)。
- 不做「系统语言切换后已运行实例实时切换界面语言」——WebView 的 `navigator.language` 在运行期不提供变更事件,系统语言变更通常也要求应用重启。本方案在启动时解析一次(见 §6 限制)。

---

## 2. 现状分析(基于当前代码)

### 2.1 语言上下文 — `src/i18n/index.tsx`

```ts
// src/i18n/index.tsx:14-20
function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {}
  return "en";                    // ← 固定默认英文,无系统语言探测
}
```

- 存储 key: `"easy-csv-language"`(`src/i18n/index.tsx:12`),仅存 `"en" | "zh"`。
- `LanguageContextType` 暴露 `language / setLanguage / t`(`src/i18n/index.tsx:4-8`)。所有消费方(设置页、帮助、AI 面板等)直接读 `language` 和 `t`,并存在 `language === "zh"` 分支(帮助文档、命令描述、参数占位符等),消费的是**生效语言**。

### 2.2 类型定义 — `src/i18n/translations.ts:1`

```ts
export type Language = "en" | "zh";
```

### 2.3 设置页语言选择器 — `src/components/setting/SettingsTabContent.tsx:220-254`

两段式切换按钮(grid-cols-2,滑块 `language === "zh" ? ... : ...`),直接 `setLanguage("en"/"zh")`。

### 2.4 可复用的参照: 主题「跟随系统」

`src/components/setting/ThemeProvider.tsx` 已实现完全同构的模式,可直接借鉴:

- 三态 `Theme = "dark" | "light" | "system"`,localStorage 存偏好值,context 暴露 `theme / setTheme`。
- 生效值解析: `system` → `window.matchMedia("(prefers-color-scheme: dark)")` 探测(`ThemeProvider.tsx:43-50`),解析结果直接应用到 DOM,不对外暴露。
- 设置页 UI: 三段式切换按钮(grid-cols-3,带图标),见 `SettingsTabContent.tsx:256-310`。

语言设置完整复制这套「偏好 + 生效值分离」的结构,只是探测函数从 `matchMedia` 换成 `navigator.language`;与主题不同,语言存在消费方需要按生效语言分支(zh/en),因此 context 额外暴露 `effectiveLanguage`。

---

## 3. 方案设计

### 3.1 数据模型: `system` 并入 `Language`,偏好与生效语言分离

```ts
// src/i18n/translations.ts
export type Language = "en" | "zh" | "system";   // 用户偏好(含跟随系统)
export type EffectiveLanguage = "en" | "zh";     // 生效语言
```

- **localStorage 只存偏好**,取值 `"en" | "zh" | "system"`;`system` 本身就是 `Language` 的一员,不再引入 `LanguagePreference` 包装类型。
- **context 暴露两个字段**:
  - `language: Language` —— 用户偏好,语义与主题的 `theme` 对齐(设置页三态按钮直接使用)。
  - `effectiveLanguage: EffectiveLanguage` —— 生效语言,供 `t` 索引和所有 `language === "zh"` 分支使用。
- `t` 永远基于 `effectiveLanguage`,偏好为 `system` 时由系统语言解析得出,消费方无需感知解析过程。
- 兼容性: 旧存储值 `"en"` / `"zh"` 是新 `Language` 联合类型的合法子集,老用户升级后行为不变。

### 3.2 系统语言探测 — `src/i18n/index.tsx` 内纯函数

```ts
export function resolveSystemLanguage(): EffectiveLanguage {
  const raw =
    typeof navigator !== "undefined" ? navigator.language || "" : "";
  return raw.toLowerCase().startsWith("zh") ? "zh" : "en";
}
```

- 用 `startsWith("zh")` 归一化所有中文变体(`zh-CN`、`zh-TW`、`zh-HK`、`zh-Hans` 等)到 `zh`;其余一切(含 `en-*`、未知 locale、空值)统一回退 `en`。项目只有中英两套翻译,不做 locale 精确匹配表。
- 选择 `navigator.language` 而非后端命令的理由: Tauri v2 WebView 中该值反映系统 UI 语言,纯前端同步可用,与 ThemeProvider 的 `matchMedia` 同级复杂度;无需新增 `tauri-plugin-os` 依赖。
- 函数无副作用,便于单测。

### 3.3 Provider 改造 — `src/i18n/index.tsx`

```ts
function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh" || saved === "system") return saved;
  } catch {}
  return "system";                       // ← 新用户默认跟随系统
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const effectiveLanguage: EffectiveLanguage =
    language === "system" ? resolveSystemLanguage() : language;

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  };

  const t = translations[effectiveLanguage];

  return (
    <LanguageContext.Provider
      value={{ language, effectiveLanguage, setLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
```

要点:

- context 暴露 `language / effectiveLanguage / setLanguage / t`,命名与主题 `theme / setTheme` 一致;`useLanguage()` 返回类型即此四字段。
- 消费方按生效语言分支的代码(`language === "zh"`)一律改用 `effectiveLanguage`;仅设置页直接使用 `language`(偏好)驱动三态滑块。

### 3.4 设置页 UI — `src/components/setting/SettingsTabContent.tsx`

把现有两段式语言切换(220-254 行)改为与主题选择(256-310 行)一致的三段式:

- `grid-cols-3`,滑块位置按 `language === "en" | "zh" | "system"` 三分支定位(抄主题滑块的 `left-[calc(33.333%+1px)]` 写法)。
- 三个按钮: `English` / `中文` / `<Monitor 图标> {t.system}`。`t.system` 翻译 key 已存在(主题在用),直接复用,未新增文案。
- 状态来源与点击回调直接使用 context 的 `language` / `setLanguage("en" | "zh" | "system")`。
- 按钮文案 `English` / `中文` 保持原文(语言名不做翻译,与现状一致)。

### 3.5 翻译文件 — `src/i18n/translations.ts`

最小方案: 不新增翻译 key(复用 `t.system`)。
可选增强: 若希望在语言标题下加一行说明文案,新增:

| key | en | zh |
|-----|----|----|
| `languageDesc` | `Follow the operating system language` | `跟随操作系统语言` |

---

## 4. 影响面与改动清单

| 文件 | 改动 |
|------|------|
| `src/i18n/translations.ts` | `Language` 加入 `"system"`;新增 `export type EffectiveLanguage = "en" \| "zh"`;删除 `LanguagePreference`;`translations` 索引类型改 `Record<EffectiveLanguage, Translations>` |
| `src/i18n/index.tsx` | 新增 `resolveSystemLanguage()`;`getInitialLanguage` 接受 `"system"` 且默认 `"system"`;context 暴露 `language / effectiveLanguage / setLanguage / t` |
| `src/components/setting/SettingsTabContent.tsx` | 语言选择器两段改三段(参照 256-310 行主题样式);改用 `language / setLanguage` |
| `src/components/help/HelpContent.ts` | `getHelpContent` 参数类型由写死的 `"en" \| "zh"` 改为引用 `EffectiveLanguage` |
| `src/components/dialog/commands/parameterDescriptions.ts` | 同上,`language` 参数类型改 `EffectiveLanguage`(默认 `"en"`) |
| `src/App.tsx` | `language === "zh"` 分支(帮助文档/帮助按钮/命令描述)与 `getHelpContent` 传参改用 `effectiveLanguage`;useMemo/useCallback 依赖数组同步 |
| `src/components/CommandList.tsx` | 同上,`language === "zh"` 分支与依赖数组改用 `effectiveLanguage` |
| `src/components/expression/DuckdbEditor.tsx` | `isZh = effectiveLanguage === "zh"` |
| `src/components/dialog/commands/PluginForms.tsx` | 同上(两个组件内) |
| 12 个表单文件(AggregateForms / CombineForms / CustomForms / ExploreForms / FormatForms / GenerateForms / PartitionForms / ScriptingForms / SortDedupForms / SearchFilterForms / TransformForms / TransposePivotForms) | `getParameterDescription(..., language)` 传参改用 `effectiveLanguage`,解构同步为 `const { effectiveLanguage } = useLanguage()` |
| `src/__tests__/i18n.test.tsx`(新增) | 见 §5 |

不需要改动后端(`src-tauri/`): 语言偏好只在前端 localStorage,不进 `AppConfig`。

## 5. 测试计划

新增 `src/__tests__/i18n.test.tsx`(vitest + jsdom,复用 `src/test/setup.ts` 的 localStorage mock;含 JSX 故用 `.tsx`):

1. `resolveSystemLanguage`: `navigator.language` 为 `zh-CN` / `zh-TW` / `zh-HK` / `zh-Hans` / `zh` → `"zh"`;`en-US` / `fr-FR` / 空字符串 → `"en"`(通过 `Object.defineProperty(navigator, "language", ...)` 注入)。
2. `getInitialLanguage` 行为: 无存储值 → `"system"`;存储 `"zh"` → `"zh"`;存储 `"system"` → `"system"`;存储非法值(如 `"ja"`)→ `"system"`;localStorage 抛异常 → `"system"`。
3. Provider 集成: 偏好 `system` 且系统语言为中文时 `effectiveLanguage` 为 `"zh"`、`t` 取 `translations.zh`;显式 `en` 时不受系统语言影响;`setLanguage("en"/"system")` 切换后 `effectiveLanguage`、`t` 与 localStorage 同步更新。
4. 既有回归: `invoke.test.ts` 等现有测试不依赖 `setLanguage`,全绿。

手动验收: 首启(清 localStorage)在中文 Windows 上界面为中文;切换三档后重启偏好保持;旧版本升级(存储值为 en/zh)界面语言不变。

## 6. 已知限制与备注

- **不做运行期系统语言监听**: `navigator.language` 无变更事件;用户改系统语言后需重启应用生效。若未来需要实时切换,可引入 `tauri-plugin-os` 的 `locale()` 命令并监听窗口事件,属独立增强,本方案不引入新依赖。
- 主题与语言对「system」语义不完全对称: 主题的 system 模式有 `matchMedia` 变更事件可实时响应(ThemeProvider 实际未监听,同样是一次性解析),语言保持同等的简单实现。
- 类型模型与主题对齐: `Language` 三态(含 `system`)对应用户偏好,`EffectiveLanguage` 两态对应用户实际看到的界面语言;`zh-TW`/`zh-HK` 用户会被映射到简体中文 `zh`,与项目现有翻译覆盖一致(只有简中一套)。
