# 034 · 主题系统(默认墨蓝)— 设计与迁移方案

> 状态: **A + B + C + D(图表/热力/语法)+ E 视觉矩阵 + F 颜色守卫均已完成**(token / 两轴 Provider / 设置页主题色行 / 语义色迁移 / 独立调色板 / 8 组合矩阵 / `pnpm check:theme-colors`);剩余:类型色(Text/Number/Date…)的 `--type-*` 调色板
> 日期: 2026-11-07
> 关联: `src/components/setting/ThemeProvider.tsx` · `src/components/setting/SettingsTabContent.tsx` · `src/components/setting/settingsSections.ts` · `src/components/setting/SettingsDialog.tsx` · `src/index.css` · `src/components/ui/Button.tsx` · `src/components/setting/SettingsNav.tsx` · `src/modules/data-preview/charts/*` · `src/i18n/translations/{types,zh,en}`
> 目标: 把「明暗外观」与「主题色」拆成两个维度;默认主题色为**墨蓝**;以后只加一段 token 就能增加新主题;把散落在组件里的绿色/蓝色/琥珀/红色收敛为语义 token。

---

## 0. 结论速览

### 0.1 一句话

现在应用只有「亮色 / 暗色 / 跟随系统」一条轴;强调色并没有统一的品牌 token,而是分散在 `primary`、绿色、蓝色、紫色和大量 raw Tailwind 颜色里。**先建立 `--brand` + 语义色 token,再把 `--primary` 映射到 `--brand`,默认设为墨蓝**;之后新增主题只覆盖 brand 相关变量,组件不再改。

### 0.2 推荐架构(两轴,不是一条轴)

| 维度 | 取值 | 存储键 | 作用 |
|------|------|--------|------|
| 外观 | `system` / `light` / `dark` | `vite-ui-theme`(沿用) | `<html class="light|dark">` |
| 主题色 | `ink`(默认)/ `teal` / `clay` / `graphite` | `easy-csv-accent`(新增) | `<html data-accent="ink">` |

> 不要做「亮色墨蓝 / 暗色墨蓝 / 亮色青碧……」这样的组合主题。两轴独立后,4 个主题 × 2 种外观 = 8 种组合,但 token 只有 8 组,维护成本可控。

### 0.3 改动清单(按依赖顺序)

| # | 改动 | 为什么 |
|---|------|--------|
| 1 | `ThemeProvider` 增加 `accent` / `setAccent` / `resolvedTheme`;监听系统明暗变化 | 现在只有明暗一条轴;`ChartPanel` 还在自己判断系统主题 |
| 2 | `src/index.css` 增加 `--brand` / `--brand-foreground` / `--brand-soft` / `--brand-border`,并把 `--primary`、`--ring`、`--canvas-ink`、`--empty-ink` 指向 brand | 让现有 137 处 `primary` 自动跟随主题色 |
| 3 | 增加 `success` / `warning` / `info` 语义 token,替换 61 处绿、93 处琥珀、67 处蓝 | 语义色不应跟着主题色漂移 |
| 4 | 设置页增加「主题色」一行(墨蓝 / 青碧 / 赭石 / 石墨) | 用户可切换 |
| 5 | 启动前写入 `class` + `data-accent`,避免首帧闪白/闪黑 | 体验 |
| 6 | 图表、语法高亮、血缘图使用各自的调色板 | 不能把代码高亮和图表也全部染成墨蓝 |
| 7 | 增加回归检查(禁止核心界面出现 raw `green-*` / `blue-*` / `amber-*` / `red-*`) | 防止以后又散回去 |

---

## 1. 现状审计

### 1.1 主题系统只覆盖明暗

- [ThemeProvider.tsx](file:///D:/init/Deaktop/workspace/rs/easy-csv/src/components/setting/ThemeProvider.tsx#L3-L53):`type Theme = "dark" | "light" | "system"`;只写 `vite-ui-theme`;`theme === "system"` 只在挂载时读一次 `matchMedia`,**没有监听系统主题变化**。
- [SettingsTabContent.tsx](file:///D:/init/Deaktop/workspace/rs/easy-csv/src/components/setting/SettingsTabContent.tsx#L112-L140):`SegmentChoice` 固定三列 `210px`,`bg-primary` 作为滑块;主题只有 system/light/dark。
- [settingsSections.ts](file:///D:/init/Deaktop/workspace/rs/easy-csv/src/components/setting/settingsSections.ts#L89-L99):主题行的关键词包含 `theme/dark/light/appearance/color`,没有 `accent/brand/ink/墨蓝`。
- [SettingsDialog.tsx](file:///D:/init/Deaktop/workspace/rs/easy-csv/src/components/setting/SettingsDialog.tsx#L145-L155):「恢复默认」只重置 `theme = "light"`,没有主题色。
- [ChartPanel.tsx](file:///D:/init/Deaktop/workspace/rs/easy-csv/src/modules/data-preview/charts/ChartPanel.tsx#L461-L490):图表自己用 `useTheme().theme` + `matchMedia` 判断暗色,系统切换时不会自动重渲染。

### 1.2 现有颜色 token

`src/index.css` 已有完整的一套中性 token,但「品牌/强调」并不存在:

| 位置 | 现状 | 问题 |
|------|------|------|
| `:root` / `.dark` | `--primary` 在亮色是近黑、暗色是近白;`--ring` 是中性灰 | 没有「品牌色」概念;primary 不是主题色 |
| `--accent` | 中性 hover 底色 | 如果直接把 `accent` 改成品牌色,所有 hover 都会变蓝 |
| `--empty-ink` / `--canvas-ink` | 墨蓝,只用于空白页/画布 | 主题切换时不会跟着变 |
| `--chart-1..5` | 5 档灰度 | 图表系列无法区分;需要真正可区分的调色板 |
| `@theme inline` | 只映射到 `--color-primary` 等 | 新增 `success/warning/info/brand` 后要补映射,否则不能写 `bg-success-soft` |

关键入口:
- [Button.tsx](file:///D:/init/Deaktop/workspace/rs/easy-csv/src/components/ui/Button.tsx#L12-L20):`bg-primary text-primary-foreground`。
- [SettingsNav.tsx](file:///D:/init/Deaktop/workspace/rs/easy-csv/src/components/setting/SettingsNav.tsx#L82-L90):当前项用 `bg-primary` 左侧指示条。
- [index.css](file:///D:/init/Deaktop/workspace/rs/easy-csv/src/index.css#L401-L417):checkbox/radio 的 stroke/ring 也来自 `--primary`。

### 1.3 硬编码颜色统计(粗略 grep,含少量测试/生成文件)

| 颜色族 | 约出现次数 | 当前用途 | 目标 |
|--------|-----------|----------|------|
| `primary` 系 | **137** | 主按钮、选中、焦点、导航、菜单、弹窗 | 自动跟随 `--brand` |
| 绿 / emerald / teal | **61** | 已保存、成功、完成、已安装、分隔符检测、正向反馈 | `--success` |
| 琥珀 / 黄 / 橙 | **93** | 未保存、待确认、截断、重复列、警告、排队 | `--warning` |
| 蓝 / indigo / sky / cyan | **67**(其中 `FirstStepGuide` 28) | 引导、信息提示、更新进度、搜索焦点 | `--info` / `--brand` |
| 红 / rose | **53** | 错误、失败、删除、取消 | `--destructive` |
| 紫 / violet / fuchsia | **12** | 表达式编辑器语法高亮 | 语法调色板,不跟主题色 |
| raw 中性(gray/slate/zinc/neutral/stone) | **8** | 少量面板/血缘图 | `--muted-foreground` / `--border` |
| 渐变 / `shadow-lg` / `hover:scale` | **~40 UI 处**(另有 generated docs) | 旧 AI 风格残留 | 按 032/033 规则清理 |

> 数量是为了说明「这不是改几行」:核心 chrome 约 137 处 `primary`,再加上约 274 处原始语义色。必须分阶段、按颜色族迁移,不能一次性全替换。

### 1.4 最需要处理的文件

| 文件 | 粗计数 | 主要问题 | 迁移动作 |
|------|--------|----------|----------|
| `components/menu/MainMenu.tsx` | primary 18、绿/蓝/琥珀若干 | 菜单激活、检查更新、成功/警告色 | primary→brand;绿/琥珀→success/warning |
| `modules/pipeline/panels/VersionControlPanel.tsx` | primary 25、emerald 3 | 版本选中、保存成功、标签 | primary→brand;emerald→success |
| `modules/pipeline/panels/DataLineagePanel.tsx` | primary 13、绿 4、琥珀 2 | 列选中、类型标签、提示 | primary→brand;类型色→独立 type/chart token |
| `modules/pipeline/nodes/PipelineStepNode.tsx` | primary 11、红 8、绿 3 | 选中、错误、别名保存 | 选中已是墨蓝;红→danger,绿→success |
| `modules/logs/LogPanel.tsx` | primary 8、绿/琥珀/红各 3 | 日志等级、过滤 | 语义 token |
| `modules/logs/CommandList.tsx` | 蓝 8、primary 7 | 搜索框焦点、分类高亮 | brand |
| `components/onboarding/FirstStepGuide.tsx` | 蓝 28 | 首次引导卡、步骤提示 | `--info`(默认指向 brand) |
| `modules/data-preview/HomeView.tsx` | 绿/蓝/红 + primary | 标签运行徽标、分支进度、取消 | success/warning/danger/brand |
| `components/setting/Toast.tsx` | 绿/蓝/琥珀/红各 4 | 四类 toast | 语义 token |
| `modules/data-preview/charts/ChartPanel.tsx` + `ChartPrimitives.tsx` | 琥珀 8、图表色 | 分类色、热力色阶、图例 | `--chart-1..5` |
| `components/expression/{ExpressionEditor,DuckdbEditor}.tsx` | 紫/蓝/绿 16 | 语法高亮 | `--syntax-*` |
| 文件类弹窗(SeparateCSV / MergeExcel / CsvDiff / CsvToExcel / SplitLines / EnumerateByGroup / CsvEncoding / ExecutionHistory / Update) | 琥珀/红/绿若干 | 警告、错误、成功、上次记录 | 语义 token |

### 1.5 测试与现有约束

- `SeparateCSVDialog.test.tsx:562/570` **直接断言** `text-amber-600`;迁移到 `text-warning` 时必须同步改测试。
- 目前没有 `ThemeProvider` 单测;新增 accent 后应补:默认 ink、切换持久化、`data-accent` 落地、系统明暗变化。
- `ChartPanel` 的暗色判断依赖 `matchMedia`;如果 provider 增加系统监听,图表应改为使用 `resolvedTheme`,避免两套判断。
- `--accent` 是**中性 hover**,不要把它改成品牌色;品牌强调用 `--brand-soft`,否则所有列表 hover 都会变蓝。

---

## 2. 目标架构

### 2.1 两轴模型

```
<html class="light|dark" data-accent="ink|teal|clay|graphite">
  ├─ class        → 明暗外观(system 解析后落到 light/dark)
  └─ data-accent  → 主题色(只覆盖 brand 相关 token)
```

- **外观**决定 surface / border / text 的明暗。
- **主题色**只决定 `--brand` / `--brand-foreground` / `--brand-soft` / `--brand-border`;不改变中性表面。
- 语义色(`success` / `warning` / `info` / `destructive`)不随主题色变化;主题只影响强调/选择/焦点/主操作。
- `--canvas-ink` 与 `--empty-ink` 改为 `var(--brand)`,所以画布选中、空白页管道条、标签页、输入表/步骤选中会一起切换。

### 2.2 默认与后续主题

| 主题 | 亮色 brand | 亮色前景 | 暗色 brand | 暗色前景 | 说明 |
|------|------------|----------|------------|----------|------|
| **墨蓝 Ink(默认)** | `oklch(0.42 0.055 250)` | `oklch(0.985 0 0)` | `oklch(0.78 0.045 245)` | `oklch(0.205 0 0)` | 现有 `--empty-ink` / `--canvas-ink` |
| 青碧 Teal | `oklch(0.43 0.06 200)` | `oklch(0.985 0 0)` | `oklch(0.78 0.05 200)` | `oklch(0.205 0 0)` | 与成功绿拉开色相 |
| 赭石 Clay | `oklch(0.47 0.075 50)` | `oklch(0.985 0 0)` | `oklch(0.79 0.06 55)` | `oklch(0.205 0 0)` | 暖色,但不要和 warning 琥珀混用 |
| 石墨 Graphite | `oklch(0.30 0.006 80)` | `oklch(0.985 0 0)` | `oklch(0.80 0.004 85)` | `oklch(0.205 0 0)` | 保留原「近黑 primary」的选项 |

- `--brand-soft` 由 brand 派生:亮色 9%、暗色 12%;`--brand-border`:亮色 40%、暗色 46%。
- 暗色 brand 是浅色,所以 `--brand-foreground` 用深色;亮色 brand 是深色,前景用近白。对比度按 4.5:1 检查。
- 新增主题只需要一段 `[data-accent="..."]` token + 一个设置项文案,不需要改组件。

### 2.3 CSS token 结构(建议直接按此落地)

```css
:root {
  /* Brand (default = ink) */
  --brand: oklch(0.42 0.055 250);
  --brand-foreground: oklch(0.985 0 0);
  --brand-soft: color-mix(in oklab, var(--brand) 9%, transparent);
  --brand-border: color-mix(in oklab, var(--brand) 40%, transparent);

  /* shadcn-compatible alias: existing primary usages follow the theme */
  --primary: var(--brand);
  --primary-foreground: var(--brand-foreground);
  --ring: var(--brand);

  /* Canvas / empty state share the same accent */
  --canvas-ink: var(--brand);
  --empty-ink: var(--brand);

  /* Semantic colors (do NOT follow the accent) */
  --success: oklch(0.52 0.09 150);
  --success-soft: color-mix(in oklab, var(--success) 10%, transparent);
  --warning: oklch(0.55 0.10 72);
  --warning-soft: color-mix(in oklab, var(--warning) 10%, transparent);
  --info: var(--brand); /* info hints follow the accent */
  --info-soft: var(--brand-soft);
  --danger: var(--destructive);
  --danger-soft: color-mix(in oklab, var(--destructive) 8%, transparent);
}

:root.dark {
  --brand: oklch(0.78 0.045 245);
  --brand-foreground: oklch(0.205 0 0);
  --brand-soft: color-mix(in oklab, var(--brand) 12%, transparent);
  --brand-border: color-mix(in oklab, var(--brand) 46%, transparent);
  --success: oklch(0.74 0.10 150);
  --warning: oklch(0.78 0.11 75);
}

/* Accent overrides — only brand tokens */
:root[data-accent="teal"] { --brand: oklch(0.43 0.06 200); }
:root.dark[data-accent="teal"] { --brand: oklch(0.78 0.05 200); }
:root[data-accent="clay"] { --brand: oklch(0.47 0.075 50); }
:root.dark[data-accent="clay"] { --brand: oklch(0.79 0.06 55); }
:root[data-accent="graphite"] { --brand: oklch(0.30 0.006 80); }
:root.dark[data-accent="graphite"] { --brand: oklch(0.80 0.004 85); }
```

在 `@theme inline` 中补齐:

```css
--color-brand: var(--brand);
--color-brand-soft: var(--brand-soft);
--color-success: var(--success);
--color-success-soft: var(--success-soft);
--color-warning: var(--warning);
--color-warning-soft: var(--warning-soft);
--color-info: var(--info);
--color-info-soft: var(--info-soft);
--color-danger: var(--danger);
--color-danger-soft: var(--danger-soft);
```

> `--accent` 保持中性 hover,不映射到 brand。强调态请使用 `bg-brand-soft` / `border-brand-border` / `text-brand`。

### 2.4 语义色、图表色、语法色

| 类型 | 是否跟随主题色 | 方案 |
|------|----------------|------|
| 选中 / 焦点 / 主操作 / 标签页 / 画布选中 | **是** | `brand` 系 |
| 成功 / 已保存 / 完成 / 已安装 | 否 | `success` |
| 警告 / 未保存 / 待确认 / 截断 / 重复列 | 否 | `warning` |
| 错误 / 删除 / 失败 | 否 | `danger` |
| 引导 / 信息提示 | 默认跟随 brand | `info`(`--info: var(--brand)`) |
| 图表系列 | **部分** | 每个主题给 `--chart-1..5`;chart-1 = brand,其余 4 个固定但互相可区分的柔和色;不要全是墨蓝 |
| 表达式语法高亮 | 否 | 独立 `--syntax-keyword/string/number/function/comment/operator` 调色板;主题切换只换 chrome,不换代码语义 |
| 数据类型标签(Text/Number/Date…) | 否 | `--type-*` 或复用 chart 2–4;保持类型间可区分 |
| 血缘图类型色 | 否 | 复用 type/chart palette;不要全部 brand |

### 2.5 持久化与启动

- `ThemeProvider` 状态:
  ```ts
  type Appearance = "light" | "dark" | "system";
  type Accent = "ink" | "teal" | "clay" | "graphite";
  ```
- 存储:`vite-ui-theme`(沿用)+ `easy-csv-accent`(新);读取失败一律回退 `system` / `ink`。
- 应用:`root.classList` 设置 light/dark;`root.dataset.accent = accent`;`root.style.colorScheme = resolved`。
- 系统模式:增加 `matchMedia("(prefers-color-scheme: dark)")` 的 `change` 监听,并暴露 `resolvedTheme`;`ChartPanel` 等改用 `resolvedTheme`,删掉自己的 `matchMedia` 判断。
- 防闪烁:在 `index.html` 的 app bundle 之前放一段极小的内联脚本,从 localStorage 读取两个键并先写 `class` / `data-accent`;React 挂载后 ThemeProvider 接管。若不做,首帧可能先白再暗、先石墨再墨蓝。
- 「恢复默认」:外观回 `system`,主题色回 `ink`;同步测试。

### 2.6 设置 UI

在当前「主题(明暗)」行下方新增「主题色」行:

```
外观      [跟随系统] [亮色] [暗色]        (现有,保留 system 在最左)
主题色    [墨蓝] [青碧] [赭石] [石墨]     (新增,默认墨蓝)
```

- 复用 `SegmentChoice`,但把固定 `grid-cols-3 w-[210px]` 改成按 `options.length` 生成列宽,宽度约 280px;4 个中文标签足够。
- 选中态使用 `bg-primary`(映射 brand 后自动变墨蓝),不额外做发光/渐变。
- i18n 新增:
  - `settingsAccent`(主题色 / Theme color)
  - `settingsAccentDesc`(强调色, 用于选中、焦点与主操作 / Accent used for selection, focus and primary actions)
  - `accentInk`(墨蓝 / Ink)
  - `accentTeal`(青碧 / Teal)
  - `accentClay`(赭石 / Clay)
  - `accentGraphite`(石墨 / Graphite)
- `settingsSections` 增加 `id: "accent"` 行,关键词包含 `accent / brand / ink / 墨蓝 / 青碧 / 赭石 / 石墨`。
- `SettingsDialog` 的 props 增加 `accent` / `onAccentChange`,透传到 `SettingsTabContent`。
- `settingsSearch.test.ts` 需补一条「搜索 墨蓝 / ink 命中主题色行」。

---

## 3. 迁移方案(先 token,后组件)

### 3.1 P0:建立 token 与默认墨蓝(不改组件)

1. 在 `index.css` 增加 brand / success / warning / info / danger token 与 `@theme inline` 映射。
2. 把 `--primary`、`--primary-foreground`、`--ring`、`--canvas-ink`、`--empty-ink` 改为指向 brand。
3. 默认 `<html data-accent="ink">`(ThemeProvider 或启动脚本)。
4. 跑一遍亮色/暗色截图。

**预期结果**:现有 137 处 `primary` 自动变成墨蓝;不需要逐个组件改。需要重点复查:
- `Button` 默认主按钮;
- `SettingsNav` 左侧指示条;
- `SettingsTabContent` 分段滑块;
- `MainMenu` 激活按钮;
- `VersionControlPanel` / `DataLineagePanel` 选中态;
- `PipelineStepNode` 输入框 focus ring;
- `ChartPanel` 若用到 primary。

> 如果发现蓝色过多(例如所有 hover、所有 badge 都变蓝),再决定是否保留 `primary` 为中性、只把选中/链接/焦点迁移到 `brand`。这是本方案唯一需要用户拍板的架构分歧(见 §7-Q2)。

### 3.2 P1:成功 / 警告 / 错误

按颜色族替换,不按文件替换,保证语义一致:

| 现状族 | 现状示例 | 替换为 |
|--------|----------|--------|
| `text-green-600 dark:text-green-400` | `HomeView` 完成徽标、`Toast` 成功 | `text-success` |
| `bg-green-500/10` | 已保存点、分隔符检测、成功 toast | `bg-success-soft` |
| `text-amber-600 dark:text-amber-400` | 未保存、截断、待确认 | `text-warning` |
| `bg-amber-500/10` | 截断条、待确认徽标 | `bg-warning-soft` |
| `text-red-500` / `text-red-600` | 错误、删除、取消 | `text-danger` |
| `bg-red-500/10` | 错误块、失败徽标 | `bg-danger-soft` |

注意:
- `TableNode` 的重复列提示、`ResultTableNode` 的截断条、`FlowPanel` 的未保存点优先迁移。
- 红/绿/琥珀的 `dark:` 变体全部删掉,由 `--success` / `--warning` / `--danger` 的暗色值接管。
- `SeparateCSVDialog.test.tsx` 断言 `text-amber-600`,同步改为 `text-warning`。

### 3.3 P2:蓝色 / 引导 / 信息

- `FirstStepGuide.tsx` 28 处蓝:统一换 `info` token;`--info` 默认等于 `--brand`,所以默认会变墨蓝。
- `CommandList` 搜索框焦点、分类高亮:换 `brand`。
- `UpdateDialog` 进度:换 `brand`;错误/警告分别用 danger/warning。
- `MainMenu` 检查更新/帮助高亮:换 `brand` 或 `info`。
- `Toast` 的 info 类型:换 `info`。
- 迁移后,原 `blue-*` / `indigo-*` 不再出现在核心 chrome。

### 3.4 P3:图表 / 语法 / 血缘

- **图表**:在 `index.css` 为每个主题定义 `--chart-1..5`;`chart-1 = brand`,其余 4 个用固定柔和色(亮/暗各一组)。`ChartPanel` / `ChartPrimitives` 用 token,不再用 raw amber/blue。
- **热力图**:单独 `--heat-1..5`,不要复用 chart 系列色,避免「热力=分类」混淆。
- **表达式编辑器**:新增 `--syntax-*`;语法高亮不跟主题色,保证代码语义稳定。只把编辑器 chrome(边框、焦点、下拉)换 brand。
- **数据概况 / 血缘类型**:数据类型是语义分类,给 `--type-*`(Text/Number/Date/Boolean/Empty),不要全部 brand。

### 3.5 P4:残余中性色与旧 AI 风格

- `gray/slate/zinc/neutral/stone-*`(仅 8 处)→ `text-muted-foreground` / `border-border` / `bg-muted`。
- 渐变、`shadow-lg`、`hover:scale` 按 032/033 已有规则清理,不要借主题迁移再引入新装饰。
- `FirstStepGuide` 的蓝色卡如果换成 brand,还需要把它的圆角/阴影/文案与 033 的纸面/墨蓝体系统一;可作为后续单独一小批。

---

## 4. 分阶段实施

| 阶段 | 内容 | 可见结果 |
|------|------|----------|
| **A** | token + `data-accent` + ThemeProvider accent(默认 ink)+ 启动脚本 | 全应用默认变墨蓝,`primary` 全部跟随;先只改 CSS 和 provider |
| **B** | 设置页「主题色」行 + 持久化 + i18n + 搜索关键词 + 恢复默认 | 用户可切换 4 个主题 |
| **C1** | 绿 / 琥珀 / 红 → success / warning / danger(核心画布与标签页优先) | 语义色不再和主题色混用 |
| **C2** | 蓝 / 引导 / Toast / Update → brand / info | 首屏与提示体系统一 |
| **D** | 图表 / 热力 / 语法 / 血缘调色板 | 图表可区分,代码高亮稳定 |
| **E** | 加入青碧 / 赭石 / 石墨的 token 与视觉矩阵 | 4 主题 × 明暗全部可用 |
| **F** | 可选:CI 颜色守卫脚本 | 防止 raw 颜色回流 |

> 如果只想先要「默认墨蓝」,完成 A 即可;B 可以紧接着做;颜色族迁移可以按文件分批。

---

## 5. 验证与测试

### 5.1 自动化

- 新增 `ThemeProvider.test.tsx`:
  - 无存储时默认 `system` + `ink`;
  - `setAccent("teal")` 写入 `easy-csv-accent` 并给 `<html>` 加 `data-accent="teal"`;
  - 存储值非法时回退 ink;
  - `system` 模式下 `matchMedia` 变化会切换 class。
- `SettingsDialog.test.tsx`:
  - 「主题色」行存在,4 个选项,默认选中墨蓝;
  - 选择青碧后调用 `onAccentChange`;
  - 搜索 `墨蓝` / `ink` 能命中该行;
  - 「恢复默认」同时重置 appearance 与 accent。
- `settingsSearch.test.ts`:新增 accent 行的关键词断言。
- `ChartPanelRender.test.tsx`:主题切换后图表仍渲染;如使用 `resolvedTheme`,补一条系统切换用例。
- 现有 `SeparateCSVDialog.test.tsx` 的 amber 断言同步改。

### 5.2 视觉矩阵

至少检查 4 主题 × 2 外观 × 3 屏:

| 屏 | 检查点 |
|----|--------|
| 空白页 | 主按钮、管道条结果数字、链接、GitHub 链接 |
| 画布 | 输入表/步骤选中、框选、标签页、搜索浮层、多选浮条、模式条、HUD、状态栏 |
| 设置 | 外观分段、主题色分段、导航选中条、搜索命中、Toast |

每格检查:
- 主按钮文字对比度 ≥ 4.5:1;
- 选中/焦点可见;
- success/warning/danger 仍可区分;
- 图表 5 个系列可区分;
- 不改动任何布局尺寸。

### 5.3 静态检查(建议)

新增 `scripts/check-theme-colors.ts`(`pnpm check:theme-colors`,类似 `check:index`):
- 扫描 `src/` 下全部 `.ts` / `.tsx`(335 个文件);
- 禁止 `text-green-*` / `bg-green-*` / `text-blue-*` / `bg-amber-*` / `text-red-*` / `text-slate-*` 等 raw 类;
- 允许:图表 / 热力 / 语法 token(已集中到 `index.css`),以及 `DataProfilePanel` / `DataLineagePanel` 两处尚未迁移的**数据类型调色板**(按声明行窄范围豁免,注释标明待 `--type-*`);
- 输出违规文件+行号,CI 失败。

---

## 6. 风险

| 风险 | 说明 | 缓解 |
|------|------|------|
| **137 处 primary 一次性变蓝** | `--primary` 映射到 brand 后,所有主按钮/选中/焦点一起变 | 先做 A 阶段截图评审;如太蓝,保留 primary 中性,只迁移选中/链接/焦点到 brand |
| **暗色对比度** | 暗色 brand 是浅色,主按钮需要深色前景 | `--brand-foreground` 在暗色用 `oklch(0.205 0 0)`;逐主题检查 4.5:1 |
| **语义色与主题色混淆** | 青碧 vs 成功绿、赭石 vs 警告琥珀 | 主题色只用于强调;success/warning/danger 保持固定色相,并检查同屏对比 |
| **图表全变墨蓝** | 单一品牌色会让 5 个系列无法区分 | 每主题单独 `--chart-1..5`,chart-1 为 brand,其余 4 个固定柔和色 |
| **表达式编辑器变色** | 语法高亮跟着主题漂移会降低可读性 | 语法用独立 `--syntax-*`,不跟 accent |
| **旧测试断言颜色** | `text-amber-600` 等 | 迁移时同步改测试;新测试断言 token 类而不是色值 |
| **首帧闪烁** | React 挂载后才设置 class/data-accent | `index.html` 内联预置脚本 |
| **系统主题不更新** | 现有 provider 只在挂载时读 matchMedia | 增加 change 监听 + `resolvedTheme` |
| **渐变/旧 AI 风格混入** | 主题迁移时容易顺手加渐变/光晕 | 明确禁止;只做 token 替换 |

---

## 7. 待拍板

| # | 问题 | 建议 | 备选 |
|---|------|------|------|
| 1 | 「主题」是**只换强调色**,还是连表面也换? | 只换强调色;中性表面共享,维护成本最低 | 每个主题一套完整 surface(4×2×更多 token,后期再考虑) |
| 2 | **`--primary` 是否直接映射到 brand** | 是:137 处 primary 自动跟随,默认即墨蓝 | 保留 primary 中性,只把选中/焦点/链接迁到 brand(更克制但改动更多) |
| 3 | 首批主题数量 | 墨蓝 + 青碧 + 赭石 + 石墨(4 个) | 先只做墨蓝 + 石墨(2 个) |
| 4 | 图表调色板 | 每主题 `--chart-1..5`,chart-1=brand,其余固定柔和色 | 所有主题共用一套图表色(主题切换不影响图表) |
| 5 | 语法高亮 | 独立 `--syntax-*`,不跟主题 | 关键字跟 brand(可读性风险) |
| 6 | 设置 UI 形态 | 分段控件 4 项,约 280px | 4 个色块 swatch + 标签(更直观但占宽) |
| 7 | 是否允许自定义主题色 | v1 不支持,只做预设 | 后期加 color picker(需要生成 soft/border/foreground,复杂) |

---

## 8. 非目标

- 不改布局、圆角、间距、字体。
- 不引入渐变、发光、彩色阴影、玻璃/噪点等新装饰。
- 不把成功/警告/错误也做成主题色。
- 不把表达式语法高亮统一成墨蓝。
- 不允许用户在 v1 自定义任意颜色(先做 4 个预设,验证 token 体系)。
- 不改 Tauri 原生标题栏/系统托盘颜色(由操作系统或后续单独处理)。

---

## 9. 实施顺序(可直接照做)

1. `src/index.css`:brand / success / warning / info / danger token + `@theme inline` 映射;`--primary`、`--ring`、`--canvas-ink`、`--empty-ink` 指向 brand。
2. `ThemeProvider.tsx`:`Accent` 类型、`accent`/`setAccent`、`resolvedTheme`、系统监听、`data-accent`。
3. `index.html` 预热脚本(读取 `vite-ui-theme` + `easy-csv-accent`)。
4. `settingsSections.ts` / `SettingsTabContent.tsx` / `SettingsDialog.tsx`:新增主题色行,复用分段控件,重置默认。
5. i18n(`types` / `zh` / `en`):6 个 key;`settingsSearch` 关键词。
6. 分批替换颜色族:TableNode / ResultTableNode / FlowPanel / HomeView / MainMenu / VersionControlPanel / DataLineagePanel / LogPanel / Toast / FirstStepGuide / UpdateDialog / 文件类弹窗。
7. 图表 / 热力 / 语法 / 血缘调色板。
8. 测试 + 4×2 视觉矩阵 + 可选颜色守卫脚本。
9. 更新 `docs/AI/INDEX.md` 与相关设计文档。
