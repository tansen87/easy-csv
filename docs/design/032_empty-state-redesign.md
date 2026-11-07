# 空白页(空状态)重新设计 — 设计文档

> 状态: **已实现(2026-11-07,§10 实施记录)**
> 日期: 2026-11-07
> 关联: `src/modules/data-preview/HomeView.tsx`(空状态分支 `285-494` 行) · `src/i18n/translations/{zh,en}/{common,onboarding}.ts` · `src/i18n/translations/types.ts` · `src/index.css` · `src/utils/format.ts` · `src/hooks/useTabs.ts`
> 原型: `docs/design/prototypes/032/01-empty-state.html`(独立 HTML,浏览器直接打开,不随文档分发;含「改造前 / 改造后 · 亮色 / 改造后 · 暗色」三张 + 编号标注)
> 方法: [unslop](https://x.com/heydamir)(Damir Sokolovsky, CC BY 4.0)

---

## 0. 结论速览

### 0.1 一句话诊断

这一屏的问题不是「不好看」,而是 **四个同等重量的入口抢一个动作、唯一的内容资产(表格)缺席、标题是一句问候语**。于是它长得像任意一个软件的欢迎页,而不像「一个处理表格的工具」。

### 0.2 设计方向(五行)

| 项 | 结论 |
|----|------|
| **Product** | 把 CSV / Parquet / DuckDB 表格串成一条可视化管道,一键执行并导出;给需要清洗、汇整表格但不想写命令行的人 |
| **Character** | 安静、精确、有一点纸张感(`calm, exact, paper-like`) |
| **World** | 账本 / 工作台 —— 纸质表格、格线、行号、铅笔批注。中性色因此偏暖,强调色用墨蓝 |
| **Moments** | ① 右列的**示例表格**:真实字段与真实数值,金额右对齐、等宽数字,一行金额为空被标出;② 表格底部的**管道条**:`search → dedup → groupby → 5 行` |
| **Signature** | **行号**:表格左侧的 `1…8` 与最近文件列表前的 `1 2 3` 用同一种等宽灰字。只此一个,不复用到别处 |

> 这一屏只花两处「颜色」:纸面表格的暖白与墨蓝的结果数字;其余全是同一支中性灰 + 一个实心主按钮。

### 0.3 改动清单

| # | 现状 | 改为 |
|---|------|------|
| 1 | 竖向居中堆叠(Logo → 标题 → 四卡 → 虚线三步条 → 最近文件) | **不对称双列**:左 412 文本 / 右 452 示例表,整体垂直居中 |
| 2 | `欢迎使用 Easy CSV` + `打开文件或导入工作流开始使用` | `把表格串成一条管道` + 一句说清做什么的说明 |
| 3 | 四张等宽功能卡(含蓝色推荐卡 + `推荐 · 30 秒`徽章) | **一个主操作**(打开文件)+ **一个次操作**(看看示例),其余降级 |
| 4 | 「导入工作流」也是一张同尺寸卡 | 降为说明行里的**文字链接** `导入 .xanflow 工作流` |
| 5 | 「GitHub 点赞」黄色星卡 | 降为画布**右下角 12px 文字链接** |
| 6 | 虚线三步条(编号圆点 + `›`) | **管道条**:真实命令 `search → dedup → groupby`,右侧 `地区 → 5 行` |
| 7 | 无任何内容预览 | **示例表格**(内置示例销售数据;唯一亮点) |
| 8 | 最近文件:文件图标 + 大写宽字距小标题 + `h-[26vh]` | 行号签名 + 12px 小标题 + 每行 36px,最多 5 条,不用视口单位 |
| 9 | 渐变图标底 / 蓝色与黄色语义色 / 悬停浮起阴影 + `scale-105` | 全部去掉;悬停只换背景色 |
| 10 | 文案称支持 `CSV, Excel, JSON` | 改为 `CSV · Parquet · DuckDB`(见 §3.4) |

---

## 1. 审计:现状里的 AI 味

按 [unslop `signs.md`](https://github.com/) 的分类逐条对照,证据均来自 `HomeView.tsx` 当前空状态分支。

### 1.1 表面与颜色

| 标志 | 位置 | 问题 | 修法 |
|------|------|------|------|
| 渐变底板 | `:294` `bg-gradient-to-br from-primary/15 to-primary/5` | 76px 圆角方块 + 渐变,是典型的「AI 应用图标」做法 | 整个删除,标题直接落在画布上 |
| 多色强调 | `:363` 蓝卡 + `:419` 黄星 + `:385` `primary/10` | 同一屏三种强调色,没有一个是真正的主操作 | 只留一个实心主按钮 |
| 彩色边框 | `:363` `border-blue-200` / `:419` `border-yellow-500/30` | 边框用语义色,更像促销位 | 统一 hairline |
| 悬停浮起 | `:363/383/400/419` `hover:shadow-md` | 四张卡一悬停就抬起来 | 只改背景/边框色 |
| 自定义彩色插画 | `:295-347` 8 条 `path` 硬编码 `fill="#89A4A8"` | 一张与产品无关的网络拓扑图 | 删除 |

### 1.2 字体与排版

| 标志 | 位置 | 问题 | 修法 |
|------|------|------|------|
| 问候式标题 | `:350` `t.welcomeTitle`(`欢迎使用 Easy CSV`) | 欢迎页句式,可以放在任何产品上 | 换成一句产品说明 |
| 700 字重标题 | `:349` `text-2xl font-bold tracking-tight` | 层级靠字重堆 | 28px / 500,靠尺寸与颜色分层 |
| 小号字过多 | `:365` `text-[10px]`、`:444` `text-[10.5px]`、`:451` `text-[11px]`、`:375` `text-xs`、`:373` `text-sm` | 一屏 5 档字号,其中两档是任意值 | 12 / 13 / 14 / 28 四档 |
| 大写宽字距小标题 | `:461` `uppercase tracking-wider` | `RECENT FILES` 式标签 | 12px 普通大小写 |

### 1.3 图标

| 标志 | 位置 | 问题 | 修法 |
|------|------|------|------|
| 图标各带颜色 | `:369` 蓝、`:386/403` primary、`:422` 黄 | 图标自己着色,不跟随文字层级 | 统一 16px / 1.5,取文字色 |
| 图标当装饰 | 每张卡一个 48px 图标底 | 图标不解释任何东西 | 主/次操作保留 16px 图标,其余删掉 |
| 图标占列不齐 | 最近文件 `:473` 32px 图标底 + 两行文字 | 图标列宽固定但行高不统一 | 换成 `行号` 列,行高统一 36 |

### 1.4 文案

| 标志 | 位置 | 问题 | 修法 |
|------|------|------|------|
| 四个并行入口 | `:358-430` | 打开文件 / 导入 / 示例 / GitHub 同为一张卡 | 主 + 次 + 文字链接 |
| 无法核实的承诺 | `:366` `推荐 · 30 秒` | 「30 秒」没依据,还是促销徽章 | 删除 |
| 虚假格式承诺 | `:393` `CSV, Excel, JSON` | 画布只能即时预览 csv / parquet / duckdb;`useTabs.ts:165-187` 对未知扩展名只写一条日志、不出预览 | 只写 `CSV · Parquet · DuckDB` |

### 1.5 组件 / 布局 / 动效

| 标志 | 位置 | 问题 | 修法 |
|------|------|------|------|
| 四张等宽卡 | `:358` `w-44` × 4 | 模板感的标准形态 | 不对称双列,右侧给内容 |
| 全是居中堆叠 | `:289` `absolute inset-0 flex flex-col items-center justify-center` | 没有单一亮点,视线无处可落 | 左文右表 |
| 徽章压在卡顶 | `:365` `absolute -top-2.5` 药丸 | AI 促销风 | 删除 |
| `transition-all` + `hover:scale-105` | `:363`、`:368`、`:385`、`:402`、`:421` | 缩放 + 全属性过渡 | `transition-colors` 150ms |
| 视口单位当列表高 | `:465` `h-[26vh]` | 小窗口下挤、大窗口下空 | 5 行 × 36px |
| 无内容资产 | 整屏 | 一个 CSV 工具的空页面里没有表格 | 示例表格 + 管道条 |

---

## 2. 方案

### 2.1 布局

```
┌ 画布(点阵背景,不新增任何装饰) ─────────────────────────────┐
│                                                          │
│   CSV · Parquet · DuckDB          ┌ 纸面表格 ─────────┐    │
│   把表格串成一条管道               │ 日期 地区 品类   金额│    │
│   打开数据,按列筛选、排序、分组,   │ 1 …               │    │
│   一键执行并导出 —— 整个过程都在   │ 8 …  金额为空 → 琥珀│    │
│   这块画布上                      ├───────────────────┤    │
│                                  │ search→dedup→      │    │
│   [打开文件]  [看看示例]           │ groupby  地区 → 5 行│    │
│   ↗ 导入 .xanflow 工作流          └───────────────────┘    │
│   Alt C 添加操作 · Ctrl O 打开文件  示例销售数据 219 行 · …  │
│   ───────────────────────────                             │
│   最近文件                                                 │
│   1  easy-csv-sample-sales.csv        11-06 14:32          │
│   2  2026-Q3-订单明细.csv             11-05 09:14          │
│   3  渠道库存.xlsx                    11-04 18:02          │
│                                                          │
│                                    ☆ 在 GitHub 上给个星    │
└──────────────────────────────────────────────────────────┘
```

- 容器:画布内 `overflow-y-auto` + `min-h-full`,内容 `flex items-center justify-center`,页面边距 `px-6 py-16`,≥1024 为 `px-10`、≥1280 为 `px-14`(1024px 宽时两列 928 仍需塞进 944 的可用宽度)。
- 栅格:≥1024px 时 `grid-cols-[412px_452px] gap-16`(64);<1024px(或窗口被压窄)时单列 `max-w-[520px]`,示例表移到操作按钮下方。
- 两列**垂直居中对齐**,右列总高(约 340)小于左列(约 390),因此右列居中于左列,避免右下出现大块空白。
- 画布右下角 GitHub 文字链接 `absolute bottom-5 right-6`。

### 2.2 间距(第 1 个 pass)

| 位置 | 值 |
|------|-----|
| 眉标 → 标题 | 12 |
| 标题 → 说明 | 12 |
| 说明 → 操作按钮行 | 32 |
| 按钮行 → 说明行(导入 + 快捷键) | 16 |
| 说明行 → 最近文件分隔线 | 32 |
| 分隔线 → `最近文件` 小标题 | 16 |
| 小标题 → 第一行 | 8 |
| 最近文件行高 / 行间距 | 36 / 0(靠 hover 底色区分,不加 gap) |
| 表格行高 / 表头行高 | 28 / 32 |
| 纸面卡片 → 说明文字 | 12 |
| 列间距 | 64 |
| 按钮:高 40、左右内边距 20、两按钮间距 12 |
| 卡片内边距:表头 10/14,管道条 12/14 |

### 2.3 颜色(第 2 个 pass)

只新增 **4 个空状态专用变量**,进入 `src/index.css`,不改全局 token(其余全部沿用现有 `--background/--foreground/--card/--muted-foreground/--border/--primary`):

| 变量 | 亮色 | 暗色 | 用途 |
|------|------|------|------|
| `--paper` | `oklch(0.995 0.004 85)` | `oklch(0.215 0.008 75)` | 示例表的纸面(暖白 / 暖深) |
| `--paper-rule` | `oklch(0.20 0.01 80 / 8%)` | `oklch(0.96 0.005 85 / 9%)` | 表头与行分隔线 |
| `--empty-warn` | `oklch(0.55 0.10 72)` | `oklch(0.78 0.11 75)` | 空金额行的行号与 9% 底色 |
| `--empty-ink` | `oklch(0.42 0.055 250)` | `oklch(0.78 0.045 245)` | 管道条结果数字(全屏唯一墨蓝) |

- 主按钮:亮色 `bg-foreground text-background`,暗色反之(现有 `--primary` 本身就是近黑/近白,直接用)。悬停只用 `--primary` 的 90% 透明度或 `--accent`。
- 不用任何渐变、发光、彩色阴影、彩色边框。
- 纸面卡片阴影:`0 1px 2px rgba(0,0,0,.05)`(亮色)/ 无(暗色,靠 `--paper` 与 `--card` 的表面差 + hairline)。

### 2.4 图标(第 3 个 pass)

lucide,4 个,全部 16px / stroke 1.5 / 取文字色:

| 位置 | 图标 |
|------|------|
| 主操作 | `FolderOpen` |
| 次操作 | `Play` |
| 导入链接 | `FileUp` |
| GitHub 链接 | `Star` |

删除:大插画 SVG、最近文件每行的 `File` 图标、`Clock` 小标题图标。管道条里**不放图标**,只用文字命令名与 `→`。

### 2.5 文案(第 4 个 pass)

| 位置 | 中文 | English |
|------|------|---------|
| 眉标 | `CSV · Parquet · DuckDB` | 同 |
| 标题 | `把表格串成一条管道` | `Chain your tables into a pipeline` |
| 说明 | `打开数据,按列筛选、排序、分组,一键执行并导出 —— 整个过程都在这块画布上` | `Open data, filter by column, sort, group, then run and export — all on this canvas` |
| 主操作 | `打开文件` | `Open file` |
| 次操作 | `先看看示例`(复用 `onboardingSeeExample`) | `See an example` |
| 导入链接 | `导入 .xanflow 工作流` | `Import a .xanflow pipeline` |
| 快捷键 | `Alt C 添加操作` · `Ctrl O 打开文件` | `Alt C Add a step` · `Ctrl O Open file` |
| 最近文件 | `最近文件`(复用 `recentFiles`) | `Recent files` |
| 表格说明 | `示例销售数据 219 行 · 第 8 行金额为空,会被 search 去掉` | `Sample data, 219 rows · row 8 has no amount; search drops it` |
| 管道结果 | `地区 → 5 行` | `region → 5 rows` |
| GitHub | `在 GitHub 上给个星`(复用 `starOnGitHub`) | `Star on GitHub` |

文案规则:无感叹号、短句不带句号、无「欢迎 / 开始使用」、无不可核实的时长或数量。表格里的数字全部来自 `src-tauri/samples/easy-csv-sample-sales.csv`(219 行、5 个地区、第 8 条金额为空),不是编的。

### 2.6 字体(第 5 个 pass)

| 用途 | 规格 |
|------|------|
| 眉标 | 12 / 16,400,`--muted-foreground`,字距 0 |
| 标题 | 28 / 1.25,500,`--foreground`,`-0.015em` |
| 说明 | 14 / 24,400,secondary,`max-w-[25rem]` |
| 按钮 | 13.5 → **13** / 20,500 |
| 说明行 / 最近文件标签 | 12 / 16,400,muted |
| 最近文件:文件名 / 路径 / 时间 | 13 / 20 · 12 / 16 · 12 / 16 |
| 表头 | 12 / 16,400,muted |
| 表格单元格 | 13 / 20,400,secondary;金额 12 等宽 `tabular-nums`,靠右 |
| 行号 | 12,等宽,muted |
| 管道命令 / 结果 | 12,等宽 |

不出现 400 以上字重(标题 500、按钮 500 是上限);数字统一等宽 + `tabular-nums`。

### 2.7 细节(第 6 个 pass)

- 圆角:纸面卡 14,内部管道条下沿随卡(`overflow-hidden`);按钮 8;行 hover 底色 7;管道命令胶囊 5;`kbd` 4。嵌套半径 = 14 − 卡内边距 ≥ 4,恒成立。
- `kbd`:`height 18 / padding 0 5 / 1px hairline / bg --accent / 10.5→11px 等宽`。
- 首行不做永久高亮;**hover 才给 `--accent` 底色**。
- 焦点环:`focus-visible:ring-2 ring-ring ring-offset-2`(键盘可达)。
- 金额列右对齐、`tabular-nums`;行号列右对齐 —— 与表头 `金额` 同一列线。
- 页面滚动条用现有 `ScrollArea` 或原生 `overflow-y:auto`,不套 Radix(空状态里是整块内容,不是列表组件)。

### 2.8 视觉(第 7 个 pass)

唯一「亮」的地方是右列纸面表格,不再生成任何图片:

- 表格用**纸面**底色而非 `--card`,暖一档,在一屏灰里立刻可辨;
- 8 行真实示例数据,最后一行金额为 `—`,行号泛琥珀、整行 9% 琥珀底 —— 这一行正是 `search` 要去掉的那行,和下方管道条形成因果;
- 管道条作为表格卡的下半部分,中间用 `--paper-rule` 细线隔开,右侧结果 `5 行` 用 `--empty-ink`;
- 表头无底色、无大写,只有一条细线。

### 2.9 动效(第 8 个 pass)

- 一次入场:`empty-enter`(opacity 0→1,translateY 6px→0,320ms,`cubic-bezier(.22,1,.36,1)`),只加在栅格容器上,一次性,不逐卡错峰。
- 悬停:`transition-colors 150ms`;禁止 `transition-all`、`hover:scale`、阴影变大。
- 不加呼吸、漂浮、脉冲。

---

## 3. 文案与 i18n 变更

### 3.1 新增 key(放 `common` 域,与 `welcomeTitle` 同级)

| key | zh | en |
|-----|----|----|
| `emptyTitle` | `把表格串成一条管道` | `Chain your tables into a pipeline` |
| `emptySubtitle` | `打开数据,按列筛选、排序、分组,一键执行并导出 —— 整个过程都在这块画布上` | `Open data, filter by column, sort, group, then run and export — all on this canvas` |
| `emptyFormats` | `CSV · Parquet · DuckDB` | `CSV · Parquet · DuckDB` |
| `emptyImportFlow` | `导入 .xanflow 工作流` | `Import a .xanflow pipeline` |
| `emptyAddStepShort` | `添加操作` | `Add a step` |
| `emptySampleCaption` | `示例销售数据 219 行 · 第 8 行金额为空,会被 search 去掉` | `Sample data, 219 rows · row 8 has no amount; search drops it` |
| `emptyResultRows` | `5 行` | `5 rows` |

三条约束:中英文 key 数量必须一致(`translations/types.ts` 会直接编译报错);`emptySampleCaption` 里的数字与示例 CSV 绑定,改示例数据需同步改这条文案;`emptyFormats` 不含 Excel / JSON(理由见 §3.4)。

### 3.2 删除 key(仅空状态在用)

| key | 原 zh | 删除理由 |
|-----|-------|----------|
| `welcomeTitle` | 欢迎使用 Easy CSV | 问候式标题 |
| `welcomeSubtitle` | 打开文件或导入工作流开始使用 | 同上,被 `emptySubtitle` 替代 |
| `onboardingRecommendedBadge` | 推荐 · 30 秒 | 促销徽章 |
| `onboardingFlowOpenData` / `onboardingFlowAddStep` / `onboardingFlowExecute` / `onboardingFlowNote` | 打开数据 / 添加操作 / 执行并导出 / 整条流程都在这块画布上 | 虚线三步条被管道条替代 |
| `importFlow` / `importFlowFormats` | 导入工作流 / .xanflow 文件 | 合并为 `emptyImportFlow` |

`onboardingSeeExample` / `onboardingSeeExampleDesc` **保留**:前者空状态复用,两者仍被首次引导卡 `FirstStepGuide.tsx:195-198` 使用。
`openFileFormats` **保留**:命令面板 `App.tsx:1443` 仍在用。

### 3.3 需要同步的文件

- `src/i18n/translations/types.ts`(增 7 / 删 8)
- `src/i18n/translations/zh/common.ts`、`en/common.ts`
- `src/i18n/translations/zh/onboarding.ts`、`en/onboarding.ts`(只删 4 个 `onboardingFlow*` 与 `onboardingRecommendedBadge`)
- 帮助文档/README 未引用这些 key,无需改

### 3.4 关于 `CSV · Parquet · DuckDB`

`useTabs.ts:165-187`:未知扩展名(xlsx / json)会**设为输入文件但不读预览**,只在日志里提示「用 `from` 命令转换」。因此 `CSV, Excel, JSON` 是对画布的过度承诺。空状态只列三种开箱即用格式;Excel / JSON 仍可通过 `from` 步骤处理,属于进阶路径,不在首屏宣称。

---

## 4. 组件与实现

### 4.1 新文件 `src/modules/data-preview/EmptyState.tsx`

把空状态从 `HomeView.tsx`(`285-494`)整块搬出来,理由:它目前有 210 行、占去 `HomeView` 的近四成,且与 `HomeView` 的其它逻辑(命令对话框、快速浮窗、标签栏)无关。

```
interface EmptyStateProps {
  onOpenFile?: () => void;
  onImportPipeline?: () => void;
  onLoadDemo?: () => void;
  onOpenUrl?: (url: string) => void;
  recentFiles: RecentFile[];
  onOpenRecentFile?: (path: string) => void;
}
```

- `RecentFile` 类型从 `HomeView.tsx` 移到本文件并导出,`HomeView` 继续以 `recentFiles?: RecentFile[]` 接收。
- 示例数据:模块内常量 `SAMPLE_PREVIEW`(8 行,逐字取自 `src-tauri/samples/easy-csv-sample-sales.csv` 前 8 条数据行),不做后端读取、不引入异步。
- 管道条:常量 `["search", "dedup", "groupby"]`,与内置示例模板 `src/data/templates/builtin.ts` 的三步一致(文案 `builtinStepSearchAmount` / `builtinStepDedup` / `builtinStepGroupByRegion` 已存在,本轮不复用其长文案)。
- 最近文件最多渲染 `recentFiles.slice(0, 5)`;`recentFiles.length === 0` 时**整块不渲染**(不留空盒)。
- GitHub 链接:`onOpenUrl?.("https://github.com/tansen87/easy-csv")`(沿用现状 URL)。

### 4.2 `HomeView.tsx` 改动

- `if (!inputFile && pipeline.length === 0)` 分支改为 `return <EmptyState ... />`,删除原 210 行 JSX。
- 删除仅供空状态使用的 import:`Play`、`Star`、`Clock`、`File`、`FolderOpen`、`FileUp`(确认非空状态分支不再引用)。
- 其余逻辑(标签栏、进度条、快速浮窗、命令对话框)零改动。

### 4.3 `src/index.css` 新增

- 4 个变量:`--paper` / `--paper-rule` / `--empty-warn` / `--empty-ink`,在 `:root` 与 `.dark` 各一组并在 `@theme inline` 暴露为 `--color-paper` 等 4 项,供 `bg-paper` / `border-paper-rule` / `text-empty-ink` 使用。
- 1 个动画:

```css
@keyframes empty-enter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-empty-enter { animation: empty-enter 0.32s cubic-bezier(0.22, 1, 0.36, 1); }
```

### 4.4 `src/utils/format.ts` 新增

`recentFiles[].openedAt` 是 `formatDateTime` 存的 `YYYY-MM-DD HH:mm:ss`,行内需要 `MM-DD HH:mm`:

```ts
/** `2026-11-06 14:32:00` → `11-06 14:32`;格式不符时原样返回。 */
export function formatShortDateTime(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})/.exec(value);
  return m ? `${m[2]}-${m[3]} ${m[4]}:${m[5]}` : value;
}
```

---

## 5. 状态与边界

| 场景 | 行为 |
|------|------|
| 没有最近文件 | 不渲染「最近文件」区块,左列自然变短,整块仍居中 |
| 最近文件超过 5 条 | 只显示前 5 条;不提供「更多」入口(命令面板 / 文件菜单已有完整列表) |
| 超长文件名 / 路径 | 单行省略号截断,行高不变;不换行撑高 |
| 窗口宽度 < 1024 | 单列:眉标 → 标题 → 说明 → 按钮 → 说明行 → 示例表 → 说明 → 最近文件;示例表宽度 100% |
| 窗口高度不足 | 外层 `overflow-y:auto`,内容不裁切;不做 `26vh` 这类视口高度 |
| 暗色 | 纸面比页面背景暖一档,层深靠表面差 + hairline,不加阴影 |
| 键盘 | Tab 顺序:主按钮 → 次按钮 → 导入链接 → GitHub 链接 → 最近文件各行;全部有可见焦点环 |
| 执行中 / 待确认 | 空状态不显示进度与徽章(该分支本来就只在无输入时出现) |
| 首次引导 | 空状态分支早于 `FirstStepGuide` 返回,引导卡不受影响 |

---

## 6. 测试

新增 `src/__tests__/EmptyState.test.tsx`(约 6 例):

1. 渲染标题、说明、主/次两个按钮(文案来自 i18n,查 key 不查字面);
2. 点主按钮 / 次按钮 / 导入链接 / GitHub 链接分别调用对应回调;
3. 最近文件:渲染行号 `1..n`、最多 5 条、时间走 `formatShortDateTime`;空数组时不渲染整块;
4. 示例表渲染 8 行,第 8 行金额显示 `—`;
5. 管道条渲染 `search` / `dedup` / `groupby` 与结果行数;
6. 不再出现被删掉的旧文案(`欢迎使用` / `推荐 · 30` / `GitHub 点赞` 等)防回归。

`src/__tests__/` 另补 1 例 `formatShortDateTime`(`utils` 纯函数):正常、缺秒、非法输入原样返回。

验证命令:`pnpm typecheck` / `pnpm lint` / `pnpm test`。

---

## 7. 验收清单(unslop)

- [ ] 方向已写(§0.2),每个 pass 都按它执行
- [ ] 所有间距是 4 的倍数,同类元素同尺寸(最近文件行 36、表格行 28 是刻意区分「列表 vs 数据表」)
- [ ] 图标 / 标签 / 数字各自对齐一列(行号列与金额列各自成列)
- [ ] 一支中性灰 + 三个文字层级 + 一个实心主按钮 + 一个墨蓝(只用在结果数字)
- [ ] 无渐变、无发光、无彩色阴影、无彩色边框、无色斑
- [ ] 界面里没有 emoji
- [ ] 一套图标(4 个,16px / 1.5)
- [ ] 字体:400–500 字重、无大写宽字距、无斜体、小字无负字距
- [ ] 无感叹号、短句不带句号、无问候标题、无不可核实承诺(219 / 5 / 第 8 行都来自示例 CSV)
- [ ] 数字等宽、格式统一
- [ ] 嵌套半径成立(14 卡片 / 8 按钮 / 5 胶囊 / 4 keycap)
- [ ] 唯一亮点是真实内容(示例表 + 管道条),不是占位图
- [ ] 首屏是一个整体,没有死空白;窄窗口可滚动
- [ ] 无循环动效、一条缓动曲线、不动 layout 属性
- [ ] 模板检查:把产品名换成别的表格工具,这一屏仍然成立;但把 `search/dedup/groupby` 换成别的命令就不成立了 —— 方向足够具体

---

## 8. 待拍板

| # | 问题 | 建议 | 备选 |
|---|------|------|------|
| 1 | **是否接受引入 `--paper` 等 4 个专用变量** | 接受。只作用于空状态,不动全局 token,回滚成本为零 | 全用现有 `--card`,则「纸面」消失,右侧亮点会弱很多 |
| 2 | **GitHub 入口放右下角还是干脆去掉** | 保留为右下角 12px 文字链接(功能不丢、不抢主操作) | 去掉(理由:应用内引流非核心);或移进帮助菜单 |
| 3 | **示例表 8 行还是 6 行** | 8 行(与「第 8 行金额为空」的说明对应,右列高度也更平衡) | 6 行(更轻,但右列明显矮于左列) |
| 4 | **窄窗口断点 1024** | 1024(与项目其它双栏阈值一致) | 960 / 900 |
| 5 | **是否保留「GitHub 点赞」原文案** | 改成「在 GitHub 上给个星」,更口语、不像按钮 | 沿用 `starOnGitHub` 原文 |

---

## 9. 实施顺序

1. `utils/format.ts` + 单测(无依赖,先落);
2. `index.css`:4 变量 + `empty-enter`;
3. `i18n`:`types.ts` 增删 → `zh/en common` → `zh/en onboarding`;
4. 新建 `EmptyState.tsx`(结构 + 样式 + 示例常量);
5. `HomeView.tsx` 早返回改指向 `EmptyState`,清理 import;
6. `EmptyState.test.tsx`;
7. `pnpm typecheck` / `lint` / `test`,然后本地开亮色 + 暗色各看一次(窄窗口拖到 900px 再看一次);
8. `docs/AI/INDEX.md` 登记 032 与 `EmptyState.tsx`。

---

## 10. 实施记录(2026-11-07)

### 10.1 落地文件

| 文件 | 改动 |
|------|------|
| `src/modules/data-preview/EmptyState.tsx` | **新增**(约 240 行):双列布局、示例表常量、管道条、最近文件、GitHub 链接 |
| `src/modules/data-preview/HomeView.tsx` | 空状态分支 210 行 → 9 行 `<EmptyState />`;删除仅空状态使用的 6 个图标 import 与本地 `RecentFile` 类型;700 → 586 行 |
| `src/index.css` | `:root` / `.dark` 各 4 个变量 + `@theme inline` 4 个映射 + `empty-enter` 动画 |
| `src/utils/format.ts` | 新增 `formatShortDateTime` |
| `src/i18n/translations/types.ts` | 增 7 / 删 8 key |
| `src/i18n/translations/zh|en/common.ts` | 新增 7 条文案;`starOnGitHub` 中文改为「在 GitHub 上给个星」 |
| `src/i18n/translations/zh|en/onboarding.ts` | 删除 `onboardingRecommendedBadge` 与 4 个 `onboardingFlow*` |
| `src/__tests__/EmptyState.test.tsx` | **新增** 6 例 |
| `src/__tests__/format.test.ts` | **新增** 3 例 |

### 10.2 与设计稿的偏差

1. **管道条的箭头用 `→` 字符**,而不是原型里的「细线 + 箭头」CSS 图形 —— 字符与说明行「search 去掉」的表述一致,少两个伪元素、也没有像素对齐问题。
2. **最近文件的 hover 底色只在悬停时出现**,原型截图里首行看似常亮,那是截图时鼠标停在上面的效果。
3. `HomeView.tsx` 的 `tabs` / 进度条 / 快速浮窗 / 命令对话框逻辑**零改动**;空状态分支之外一行没动。
4. 示例表数据与 `src-tauri/samples/easy-csv-sample-sales.csv` 前 8 条数据行逐字一致,注释里写明来源;没有做后端读取。
5. 左右页面边距分三档(`px-6` / `lg:px-10` / `xl:px-14`),因为 1024px 宽时 `928 + 2×56` 会超出可用宽度 16px。
6. **四个入口统一用 `components/ui/Button`**:主操作 `size="lg"`(默认实心),次操作 `variant="outline" size="lg"`,「导入 .xanflow 工作流」与 GitHub 链接用 `variant="link" size="xs"`(`h-auto px-0` 保持文字链接观感),不再手写裸 `<button>` 样式;按钮内不再放图标。

### 10.3 验证

- `pnpm typecheck` → 0 error
- `pnpm lint` → 0 error(79 条 warning 均为存量,`HomeView.tsx` 行数从 700+ 降到 586,未新增 warning)
- `pnpm test` → **52 文件 / 641 例全绿**(新增 9 例)
- 原型已用 headless 浏览器渲染并逐屏核对(亮色 / 暗色 / 改前);**应用内实机观感仍建议本地开一次** (拖到 900px 宽再看一次单列)
