# 033 · 管道画布(FlowPanel)重新设计 — 设计文档

> 状态: **部分实现(2026-11-07)** —— 画布搜索 / 多选浮条 / 右键模式(左侧) / 按键 HUD / 输入表页脚 / 结果表 / 选中色 / 框选 / 标签页已落地;步骤节点结构、连线、画布点阵与布局常量待做(见 §13)
> 日期: 2026-11-07
> 关联: `src/modules/pipeline/FlowPanel.tsx` · `pipeline/nodes/*` · `pipeline/overlays/*` · `pipeline/CoordinateGrid.tsx` · `pipeline/lib/layout.ts` · `pipeline/hooks/usePipelineLayout.ts` · `src/index.css` · `src/modules/data-preview/HomeView.tsx` · `src/i18n/translations/{types,zh,en}`
> 原型: `docs/design/prototypes/033/01-flow-panel.html`(独立 HTML,浏览器直接打开,不随文档分发;含「改造前 / 改造后 · 亮色 / 改造后 · 暗色 / 状态与细节」)
> 方法: [unslop](https://x.com/heydamir)(Damir Sokolovsky, CC BY 4.0)

---

## 0. 结论速览

### 0.1 一句话诊断

这一屏的问题不是「不好看」,而是**画布在模仿制图软件、节点在模仿仪表盘卡片,而真正的内容资产(输入表)被当成一个小控件塞在节点头部**。于是管道看起来像一堆悬浮的彩色卡片,不像「表格在工作台上排队」。

### 0.2 设计方向(五行)

| 项 | 结论 |
|----|------|
| **Product** | 把表格操作串成一条可视化管道,一键执行并导出;给需要清洗、汇整表格但不想写命令行的人 |
| **Character** | 安静、精确、手上有工具(`calm, exact, workbench`) |
| **World** | 制图桌 / 账本工作台 —— 纸片、索引号、铅笔细线、裁刀。中性色偏暖,强调色用墨蓝(沿用设计 032 的纸面与墨蓝) |
| **Moments** | ① 输入表是一张暖白账本纸:行号、只有横线、金额右对齐;② 步骤是一条带索引号的纸片链,参数像铅笔批注一样一行行列出 |
| **Signature** | **索引号**:输入表行号 `1…5`、步骤 `01/02/03`、状态栏 `03 步` 用同一支 10.5–11px 等宽灰字。只此一个,不复用到别处 |

> 一屏只有两处「墨蓝」:选中步骤的 2px 索引线,以及结果/连线端点;其余是同一支暖中性灰。琥珀只做待确认/截断,红只做错误,绿只做「已保存 / 分隔符已检测」。

### 0.3 改动清单

| # | 现状 | 改为 |
|---|------|------|
| 1 | 50/200px 坐标轴网格 + 主次线与坐标数字(`CoordinateGrid.tsx`) | **22px 点阵**(React Flow 自带 `Background`),没有坐标轴、没有数字 |
| 2 | 输入表标题写死 `Input Data`,绿色渐变图标底 | `输入数据` + 真实文件名;图标降为 14px 灰线图标 |
| 3 | 表头里塞一个全宽「查询表头以修改」下拉 + 右上「几行几列」 | 下拉保留;行×列移到页脚右侧,页脚左侧放文件名 |
| 4 | 输入表每格都有竖线与横线,行高 26 | 账本表:行号列 + 只有横线 + 表头 30 / 行 28 |
| 5 | 步骤节点 220px,参数是 9px 的键值胶囊 | 264px 纸片,左侧索引号,参数是 11px 等宽键值行(最多两行) |
| 6 | 选中 = 绿色环 + 阴影;错误 = 红底发光块;高亮 = `animate-pulse-once` | 选中 = 纸面底色 + 2px 墨蓝索引线;错误 = 红细边框 + 红参数行;高亮 = 静态墨蓝细线,不脉冲 |
| 7 | 悬停浮出两个 20px 方形按钮 | 悬停只出现一个 16px 铅笔;点击卡片打开参数(现状不变) |
| 8 | 输入边流动虚线;连线预览三段渐变 + 8px 圆点 | 1.25px 细线 + 6px 小箭头;预览 = 1.5px 墨蓝线 + 4px 端点,目标节点换细边框 |
| 9 | 右键模式 = 右侧一个隐藏小圆点,靠近才展开 | **常驻 26px 竖条**:划线 / 菜单两段,选中段墨蓝底,两段都有 Tooltip |
| 10 | `Input Data` / `5 rows x 5 cols` / `3 steps` / `duplicate column:` / `Alias` 写死英文 | 全部进入 i18n;状态栏用 `03 步` |

---

## 1. 审计:现状里的 AI 味

按 unslop `signs.md` 的分类逐条对照,证据来自当前代码。

### 1.1 表面与颜色

| 标志 | 位置 | 问题 | 修法 |
|------|------|------|------|
| 制图软件式网格 | `CoordinateGrid.tsx:4-7` 常量、`:50-195` 主次线 + 轴刻度 + 数字 | 50px 次线 / 200px 主线 / 贯穿原点的 X-Y 轴 + 数字标签。它不是「管道画布」,更像 CAD 或地图编辑器 | 换成 22px 点阵;删掉轴与数字 |
| 输入节点渐变图标底 | `TableNode.tsx:223-227` `bg-gradient-to-br from-green-500/25 to-green-500/10` | 24px 方块 + 绿色渐变,典型的「AI 应用图标」做法;绿色还暗示「成功」 | 14px 中性灰 `Table` 线图标,不加底 |
| 结果节点渐变图标底 | `ResultTableNode.tsx:101-108` 靛蓝渐变 | 与输入节点用两种颜色区分,但它们不是两种语义 | 同一个灰线 `Table` 图标,靠标题区分 |
| 绿色选中 | `PipelineStepNode.tsx:283` `border-emerald-700/80 ring-2 ring-emerald-700/30` | 绿色在别处表示「已保存 / 成功」,这里表示「选中」,语义冲突 | 纸面底色 + 墨蓝边框 + 墨蓝 9% ring(输入表同色) |
| 红底错误块 | `PipelineStepNode.tsx:265-272` `bg-red-500/10 border-red-500/40` | 整个块涂红,像告警卡 | 红细边框 + 红参数行;不加底色 |
| 脉冲高亮 | `PipelineStepNode.tsx:285` `animate-pulse-once`;`index.css:390-402` | 用 `rgba(var(--primary), .4)` 包 `oklch` 颜色,**这行 CSS 实际无效**,高亮可能根本没出现;即使出现也是无意义的循环脉冲 | 静态墨蓝细线,搜索关闭即消失 |
| 彩色选区 | `index.css:255-263` 绿色 10% 底 + 绿 60% 边框 | 框选也用了绿色 | 墨蓝 8% 底 + 墨蓝 40% 细边框 |
| 切割多段发光 | `CutVisualization.tsx:61-102` 三组渐变 + 三个 `feGaussianBlur`;`index.css:284-388` 渐变光晕 | 裁刀是功能,但表现像科幻光剑 | 保留刀线 + 小菱形刀尖,删掉渐变与 glow |

### 1.2 字体与排版

| 标志 | 位置 | 问题 | 修法 |
|------|------|------|------|
| 9px 参数胶囊 | `PipelineStepNode.tsx:175` `text-[9px]`、`:185`、`:200`、`:267` | 一屏 5 种字号(9/9.5/10/11/12),9px 在 220px 卡片里密密麻麻 | 最低 10.5(仅 keycap/索引),正文 11–13 |
| 700 字重 | `PipelineStepNode.tsx:171` `font-semibold text-xs`;`TableNode.tsx:227` `font-semibold text-sm` | 层级靠字重堆,卡片标题 12px 却比输入表 14px 还「重」 | 400/500 为主;标题 13/500 |
| 大写宽字距 | `TableNode.tsx:245-246` `uppercase tracking-wide` | 格式徽标被当成装饰性大写标签 | 保留 `CSV` 这个缩写本身,不做 `text-transform: uppercase` |
| 10px 英文计数 | `ResultTableNode.tsx:106-108`;`FlowPanel.tsx:930-934` | `5 rows x 5 cols`、`3 steps` 是写死英文,中文界面里露馅 | 全部 i18n;等宽数字 |
| 视口高度 | `SearchOverlay.tsx:124` `h-[16vh]` | 结果列表随窗口高矮变化,小窗口挤、大窗口空 | 最多 5 行 × 32px |

### 1.3 图标

| 标志 | 位置 | 问题 | 修法 |
|------|------|------|------|
| 图标自带颜色 | `TableNode.tsx:225` 绿、`ResultTableNode.tsx:103` 靛蓝 | 图标自己着色,不跟随文字层级 | 统一 `--muted-foreground` 灰 |
| 图标当装饰 | 两个 24px 渐变图标底 | 图标不解释任何东西,只是「卡片顶部必须有个图标」 | 14px 线图标,不加底 |
| 悬停按钮跳出卡片 | `PipelineStepNode.tsx:213-234` 两个 20px 方形按钮 | 图标盒浮在卡片右上角,鼠标一过就多出两个白方块 | 只保留 14px 铅笔,放在标题行内 |
| 图标尺寸不统一 | 20px / 2.5px 图标、16px 文件图标、13px 搜索图标 | 同一画布四种尺寸 | 14px / 1.5 为主;索引与 keycap 用文字 |

### 1.4 文案

| 标志 | 位置 | 问题 | 修法 |
|------|------|------|------|
| 写死英文 | `TableNode.tsx:227` `Input Data`;`:285-287` `5 rows x {n} cols`;`FlowPanel.tsx:932-934` `step/steps`;`:377` `duplicate column:`;`PipelineStepNode.tsx:157` `Alias` | 中文界面里混着英文;而且 `5 rows` 会被误读成文件只有 5 行 | 全部 i18n:`Input Data`(待办)/ `5 行 × 5 列` / `03 步` / `重复列` / `别名`;文件名进页脚 |
| 计数含义不清 | `TableNode.tsx:286` `5 rows x 5 cols` | 只显示前 5 行,却写成「5 行」;行数是渲染行不是文件行 | 页脚右侧标为 `5 行 × 5 列`,明确是表格渲染尺寸,不宣称文件总行数 |
| 结果复制按钮 | `ResultTableNode.tsx:110-144` `CSV` / `MD` 两个 6px 宽按钮 | 纯文字没有 Tooltip,新用户不知道是复制 | 保留文字,加 `复制为 CSV` / `复制为 Markdown` |
| 促销式状态 | `FlowPanel.tsx:938-944` 绿点 / 琥珀点 | 语义没问题,但点太大、与 HUD 挤在一起 | 5px 点,状态栏与 HUD 分开 12px |

### 1.5 组件 / 布局 / 动效

| 标志 | 位置 | 问题 | 修法 |
|------|------|------|------|
| 节点尺寸与布局常量不一致 | `layout.ts:385-386` `COLUMN_WIDTH=220`、`ROW_HEIGHT=75`;`:320-323` 估算 240×90;实际 `PipelineStepNode.tsx:281` `w-[220px]`,内容高度约 38–88 | 横向 220 宽 + 220 列宽 = **零间距**;dagre 的 `ranksep:50` 从未用于无坐标步骤 | 统一 264 宽;水平 64 / 垂直 24;见 §6 |
| 首帧落点从 y=75 起 | `layout.ts:390-418` `occupiedPositions` 先把所有 `{0,0}` 节点记为已占用,`findFirstAvailablePosition` 从 `0-0` 跳过 → 第一步拿 `0-1` | 新管道第一步不落在输入表右侧,而是落在输入表右边缘、下移 75px;输入边近乎零长度 | 首步固定 `table.x + table.width + 64`,`y = table.y` |
| 结果节点宽度随列数跳 | `usePipelineLayout.ts:183` 声明 `width: 520`;`ResultTableNode.tsx:160-163` 表格宽 `headers.length * 100` | 2 列结果实际约 200 宽,节点却按 520 参与布局;多结果竖排 `fallbackY += 260`(`usePipelineLayout.ts:166`)小于节点真实高 | 固定 520 宽,表内横向滚动;结果间距 452 |
| 全属性过渡 | `PipelineStepNode.tsx:281` `transition-all duration-200 hover:shadow-lg`;`TableNode.tsx:160` `transition-all` | 悬停同时动颜色、阴影、边框 | 只 `transition-colors 120ms` |
| 缩放悬停 | `FlowPanel.tsx:875` `hover:scale-x-110` | 一个 6px 圆点悬停放大,是装饰 | 删除;改为常驻竖条 |
| 弹入缩放 | `index.css:409-421` `node-enter` `translateY(-6px) scale(.96)` | 新节点从上方缩进来,像通知卡 | 160ms 透明度 + 2px 位移,不缩放 |
| 隐藏的交互 | `FlowPanel.tsx:832-878` 右侧小圆点 + 靠近才展开 | 用户不知道「右键有第二种模式」;展开还有 `animate-in zoom-in-95` | 常驻 26px 竖条 + Tooltip |
| 阴影层级过重 | `FlowPanel.tsx:742` `shadow-lg`;`SearchOverlay.tsx:106` `shadow-lg`;`TableNode.tsx:163` `shadow-lg` | 画布上每个浮层都在浮 | 亮色 `0 1px 2px`;浮层 `0 4px 12px`;暗色不用阴影,靠表面差 + 细线 |

> 结论:按 unslop 分类属于**偏重**的一屏(颜色、字体、图标、文案、布局都有多个标志),但内容资产是真实的(示例 CSV、真实命令、真实结果),所以做完整九轮,而不是换皮。

---

## 2. 方案

### 2.1 布局

```
┌ 画布(22px 点阵,无坐标轴) ─────────────────────────────────────┐
│  ┌ Input Data · 查询表头以修改  CSV , ┐                        │
│  │ 日期    地区  品类        金额   数量 │                      │
│  │ 1  2026-07-01 西南 服饰  14447.65  5 │                      │
│  │ …                                   │                      │
│  │ 5  2026-07-02 东北 家电  12199.54  2 │                      │
│  └ easy-csv-sample-sales.csv    5 行 × 5 列 ┘                   │
│                     ↘                                          │
│                     ┌ 01 去掉空金额        search ┐            │
│                     │    select  金额 · non-empty │            │
│                     └────────────────────────────┘            │
│                     ┌ 02 去重              dedup ┐             │
│                     └────────────────────────────┘             │
│                     ┌ 03 按地区汇总        groupby ┐           │
│                     │    columns     地区            │           │
│                     │    expression  sum(col("金额"))│           │
│                     └────────────────────────────┘             │
│ 03 步 · 已保存 · 12 分钟前                                      │
└────────────────────────────────────────────────────────────────┘
```

- 画布仍是 React Flow 的自由画布:可拖拽、缩放、框选、右键划线/菜单。布局只约束**首次落点**,已保存的 `step.position` / `inputPosition` 一律优先。
- 输入表 `520 × 240`(40 标题 + 30 表头 + 5×28 行 + 30 页脚);步骤 `264` 宽,高度随参数行数变化(默认约 38、一行参数约 58、两行参数约 78);结果表固定 `520 × 400`,截断时 `520 × 426`。
- 首次落点:输入表默认 `(-520, 0)`;第一步 `(input.x + 520 + 64, input.y)`;后续同列向下 = **当前节点高度 + 24**,跨列向右 `288`。分支节点不自动连线(与设计 027 红线一致)。
- 画布浮层:搜索顶部居中 12;多选浮条顶部居中 12;右键模式条**左侧居中** 16;状态栏左下 16/12;HUD 在状态栏上方 44。
- 窗口宽度不设断点:画布本身可平移缩放;浮层宽度固定 360,不依赖视口单位。

### 2.2 间距(第 1 个 pass)

| 位置 | 值 |
|------|-----|
| 步骤:索引栏宽 | 34 |
| 步骤:内容区左右 / 上 / 下内边距 | 10 / 8 / 10 |
| 步骤:标题行高 | 18 |
| 步骤:参数行高 / 行间距 | 16 / 2 |
| 步骤:标题 → 参数 | 5 |
| 步骤宽度 | 264 |
| 步骤之间垂直间距 | 24 |
| 输入表 → 第一步水平间距 | 64 |
| 输入表:标题栏 / 表头 / 行 / 页脚 | 40 / 30 / 28 / 28 |
| 输入表:左右内边距 / 行号列 | 12 / 32 |
| 结果表:标题栏 / 表头 / 行 / 截断条 | 40 / 30 / 28 / 26 |
| 搜索:宽 / 标题栏 / 结果行 / 最大结果数 | 360 / 36 / 32 / 5 |
| 多选浮条:高 / 内边距 / 按钮 | 34 / 4 / 26 |
| 模式条:按钮 / 内边距 / 段间距 | 26 / 3 / 2 |
| 状态栏:左下边距 / 行高 | 16 / 12 / 12 |
| 画布点阵 | 22 / 1 |

> 18、30、26 是 2px 步进(控件内部微调),其余均为 4 的倍数。

### 2.3 颜色(第 2 个 pass)

只新增 **6 个画布专用变量**,进入 `src/index.css` 的 `:root` / `.dark`,不改全局栅格:

| 变量 | 亮色 | 暗色 | 用途 |
|------|------|------|------|
| `--canvas-dot` | `oklch(0.20 0.01 80 / 10%)` | `oklch(0.96 0.005 85 / 8%)` | 22px 点阵 |
| `--canvas-line` | `oklch(0.20 0.01 80 / 26%)` | `oklch(0.96 0.005 85 / 26%)` | 连线、分隔线 |
| `--canvas-line-strong` | `oklch(0.20 0.01 80 / 52%)` | `oklch(0.96 0.005 85 / 46%)` | 选中边框、箭头 |
| `--canvas-ink` | `var(--empty-ink)`(0.42 0.055 250) | `var(--empty-ink)`(0.78 0.045 245) | 选中索引线、结果数字、连线端点 |
| `--canvas-ink-soft` | `oklch(0.42 0.055 250 / 9%)` | `oklch(0.78 0.045 245 / 12%)` | 搜索命中、模式条选中段、表行 hover |
| `--canvas-ok` | `oklch(0.52 0.09 150)` | `oklch(0.74 0.10 150)` | 已保存 / 分隔符已检测的小点 |

- `--flow-line-color` 改为等于 `--canvas-line-strong`,React Flow 的边与箭头直接用这个值。现有亮色 `oklch(76.049% 0.00454 16.209)` 过浅,在纸面背景上几乎看不见。
- 复用:`--empty-warn`(待确认 / 截断)、`--destructive`(错误)、`--paper`(输入表 / 选中步骤)、`--paper-rule`(账本横线)。
- 禁止:任何渐变、渐变文字、彩色阴影、发光、彩色边框、色斑。唯一的「色」是墨蓝与三种语义点。
- 暗色层深只靠 `--card` / `--paper` 与背景的一档表面差 + 细线,不用阴影。
- 对比度:墨蓝索引线作为图形元素不承担文字;墨蓝结果数字用 `--canvas-ink` 在 `--paper` 上达到 4.5:1(亮色)/ 暗色同值。

### 2.4 图标(第 3 个 pass)

lucide,一个尺寸 **14px / stroke 1.5**,取文字色(通常是 `--muted-foreground`),固定在 22/26px 的方块里,与文字间距 8:

| 位置 | 图标 |
|------|------|
| 输入表 | **无标题图标** |
| 结果表标题 | `Table` |
| 输入表 / 结果表关闭 | `X` |
| 步骤悬停 | `Pencil` |
| 模式条 | `Scissors` / `MousePointerClick` |
| 搜索结果 | `Table` / `ListTree`(沿用) |
| 多选浮条 | `Copy` / `Trash2` |
| 搜索框 | `Search` |

删除:每个节点右上角的 `Settings` 与 `Edit3` 方形按钮;所有渐变图标底;状态栏图标;大写小标题前的图标。

### 2.5 文案(第 4 个 pass)

| 位置 | 中文 | English |
|------|------|---------|
| 输入表标题 | `Input Data`(中文 i18n 待办) | `Input data` |
| 输入表文件 | 真实文件名(basename,页脚左侧,超长省略) | 同 |
| 输入表页脚 | `5 行 × 5 列`(页脚右侧) | `5 rows × 5 cols` |
| 输入表列选择 | `查询表头以修改`(沿用 `headerRename`) | `Search the header to modify` |
| 改名待保存 | 页脚右侧:`列名已修改` + `保存为 rename 步骤`;同时隐藏文件名与行×列 | `Columns changed` + `Save as rename step`; file name and rows×cols hidden |
| 重复列 | `重复列:地区(2)` | `Duplicate columns: region (2)` |
| 步骤别名占位 | `别名` | `Alias` |
| 结果表计数 | `5 行 × 2 列` | `5 rows × 2 cols` |
| 结果表复制 | `复制为 CSV` / `复制为 Markdown`(Tooltip) | `Copy as CSV` / `Copy as Markdown` |
| 状态栏 | `03 步` · `已保存` · `12 分钟前` | `03 steps` · `Saved` · `12 min ago` |
| 模式条 Tooltip | `右键: 划线` / `右键: 菜单`(沿用) | 同 |
| 搜索 | `在工作流中搜索`(沿用) | 同 |

规则:无感叹号、短句不带句号、无「欢迎 / 开始使用」、无不可核实的时长与数量。数字一律等宽;`03` 的两位补零是索引签名,`1…5` 是数据行号,两者刻意不同。

### 2.6 字体(第 5 个 pass)

| 用途 | 规格 |
|------|------|
| 步骤别名 | 13 / 18,500,`--foreground` |
| 命令名 / 参数键值 / 文件名 / 计数 / 金额 | 11 / 16,400,JetBrains Mono |
| 步骤索引 | 11 / 16,500,`--fg3`(选中转 `--canvas-ink`) |
| 输入表标题 | 13 / 18,500 |
| 表头 | 11 / 16,500,`--fg3` |
| 表格单元格 | 12 / 16,400,`--fg2` |
| 行号 | 10.5 / 16,400,JetBrains Mono |
| 结果标题 | 13 / 18,500 |
| 状态栏 / 搜索 | 11 / 13 |
| Keycap | 10.5 / 20,JetBrains Mono |
| 模式条 / 图标 | 14px stroke 1.5 |

不出现 600 以上字重;不做大写宽字距;小字不做负字距;数字统一 `tabular-nums`。

### 2.7 细节(第 6 个 pass)

- 圆角:步骤 / 输入表 / 结果表 12;搜索 / 多选条 / 模式条 9;按钮 5–6;内部胶囊 4。嵌套半径 = 12 − 8/10 ≥ 4。
- 阴影:亮色 `0 1px 2px rgba(0,0,0,.05)`;浮层 `0 4px 12px rgba(0,0,0,.07)`;暗色 `none`。
- 选中:纸面底 + `inset 2px 0 0 var(--canvas-ink)` + `--canvas-line-strong` 边框。不用外环。
- 错误:边框 `color-mix(in oklab, var(--destructive) 55%, var(--border))`;错误文字 11px 等宽红,最多 2 行,`title` 含全文。
- 待删除:虚线琥珀边框,不加 shadow/glow。
- 高亮:静态 `--canvas-ink-soft` 底 + 1px 墨蓝细线,搜索关闭时移除;不脉冲。
- 输入表 / 结果表:`thead` 吸顶;只有横线;最后一行去底线;表头无底色;数字列右对齐。
- 行 hover:墨蓝 5% 底(亮色)/ 墨蓝 6%(暗色),`transition-colors 120ms`。
- 焦点环:`focus-visible:ring-2 ring-[var(--canvas-ink)]/40 ring-offset-2`。
- 搜索命中 `<mark>`:墨蓝 22% 底,不加粗。
- 画布框选:墨蓝 8% 底 + 1px 墨蓝 40% 细边框,圆角 2。
- 模式条 active:墨蓝 9% 底 + 墨蓝图标;inactive 灰图标;hover 只换底色。
- 所有按钮禁用 `transition-all` / `hover:scale`。

### 2.8 视觉(第 7 个 pass)

- 唯一「亮」的地方是两张**真实的表**:输入表(账本纸)与结果表。它们使用真实示例数据、真实字段、真实数值;不生成任何图片。
- 步骤节点是安静的纸片,选中时换成纸面;它们不抢输入表的位置。
- 连线是铅笔线,不是「数据流光线」。只有右键连线手势期间,源端点出现 4px 墨蓝点、目标节点换细边框——因为此刻需要解释「会连到哪」。
- 裁刀保留功能性动画:1.5px 墨蓝刀线 + 4px 菱形刀尖,切割片段仍下落;删除三段渐变与 glow。
- FirstStepGuide(首次引导卡)不在本次范围,但它目前是蓝色系;实施后另开一稿对齐(见 §10-Q8)。

### 2.9 动效(第 8 个 pass)

- 节点入场:160ms,`opacity 0→1` + `translateY(-2px)→0`,不缩放、不逐卡错峰。
- 悬停:`transition-colors 120ms`;选中立即生效。
- 搜索:150ms 淡入 + 4px 上移;结果切换立即。
- 多选浮条:120ms 淡入;关闭立即。
- 连线预览:跟手,不做过渡;松手后立即成边。
- 裁刀:刀线 220ms;片段下落 500ms(沿用手感,但去掉光晕)。
- 一条缓动:`cubic-bezier(.22,1,.36,1)`;禁止 `animate-pulse` / `animate-ping` / 呼吸 / 漂浮 / 视差 / `transition-all`。
- `prefers-reduced-motion: reduce` 时关闭节点入场与搜索位移。

---

## 3. 组件规格

### 3.1 步骤节点 `PipelineStepNode.tsx`

```
┌ 34 ┬────────────────────────────────────────────┐
│ 01 │ 去掉空金额                        search   │   18
│    │ select  金额 · non-empty                   │   16
└────┴────────────────────────────────────────────┘
```

- 结构:外层 `264px` 卡片 → 34px 索引栏(右侧 1px 分隔线)→ 内容区。索引栏垂直居中,索引 `01` 等宽 11/500。
- 标题行:别名 13/500,超长省略;命令名 11 等宽灰,右对齐;悬停时在命令名右侧出现 14px 铅笔,点击进入内联输入。
- 参数行:`Object.entries(activeParams)`,布尔值只显示键名,字符串/数字显示 `键 值`,数组显示 `键 值 · +N files`(沿用现有转换);**每个值最多 1 行**,超长省略并加 `title` 全文。参数超过 2 行时节点高度增长(不做折叠,不隐藏信息)。
- 点击卡片 = 打开参数(`onStepClick`,现状);删除“齿轮”按钮;铅笔只负责别名。
- 别名编辑:输入框替换标题,高度 24,`Enter` 保存 / `Esc` 取消 / 失焦保存;不再用绿色方块按钮。
- 状态:

| 状态 | 表现 |
|------|------|
| 默认 | `--card` 底 + 1px `--border` |
| 选中 | `--paper` 底 + 墨蓝边框 + 墨蓝 9% ring(`bg-paper border-[var(--canvas-ink)] ring-2 ring-[var(--canvas-ink-soft)]`) |
| 错误 | 红细边框 + 红参数行(最多 2 行),不加底色 |
| 待删除 | 虚线琥珀边框,索引转琥珀 |
| 搜索高亮 | 墨蓝 9% 底 + 1px 墨蓝线,静态 |
| 切割中 | 沿用 `cutParts` 片段与下落动画,只简化颜色 |

### 3.2 输入表 `TableNode.tsx`

- 宽 520,`--paper` 底,12 圆角,只有横线。
- 标题栏 40:**去掉左上图标**;`Input Data`(中文 i18n 仍在待办)+ 现有的列选择 `Select`(**保留,不删除**)+ `CSV` / `PARQUET` / `DUCKDB · table` 徽标 + 分隔符按钮(`<delim> + 5px 状态点`)+ 关闭。**去掉右上的「几行几列」**。
- 表头 30 / 行 28:行号列 32px(右对齐、10.5 等宽灰);日期、地区、品类左对齐;数字列右对齐 + 11.5 等宽;表头 sticky。
- 数字列识别(仅用于对齐,不改值):预览行中该列所有非空单元格都能被 `Number()` 解析 → 右对齐;混合列保持左对齐。抽成纯函数 `numericColumnFlags(headers, rows)` 并单测。
- 页脚 28(`h-7`):**左 = 文件名**(basename,单行省略,`title` 全文);**右 = `{rows} 行 × {cols} 列`**(11 等宽,`rows` 取实际渲染的 5 行,`cols` 取表头数)。
- 改名待保存:**文件名与行×列同时隐藏**,页脚右侧改为 `列名已修改`(11px 琥珀)+ `保存为 rename 步骤` 按钮(高 24,点击走现有 `onSave`)。只有真正提交了列名修改才进入该状态,仅打开编辑不算。
- 选中:**墨蓝边框 + 墨蓝 9% ring**(`border-[var(--canvas-ink)] ring-2 ring-[var(--canvas-ink-soft)]`),与步骤节点同一套选中色;不再使用主色/绿色选中。
- 拖拽:**标题栏与页脚同为拖拽把手**(`dragHandle: ".table-node-header, .table-node-footer"`);页脚 `cursor-grab / active:cursor-grabbing`,保存按钮带 `nodrag`,不会误触发拖动。
- 连续改名:**切换列之前先提交上一列的编辑**(`commitEdit`);否则上一列的输入框被 unmount,改名会丢失。双击当前正在编辑的单元格也不再重置输入内容。
- 重复表头:表头下方 28px 琥珀细条 `重复列: 地区(2)`,不再用 `bg-orange-50 / text-orange-600`。
- 非 CSV 输入:不显示分隔符,只显示格式徽标;`DUCKDB` 徽标带表名 Tooltip(沿用现状)。
- 关闭按钮:14px `X`,hover 红文字;点击仍走 `onTableDelete`。

### 3.3 结果表 `ResultTableNode.tsx`

- **固定 520 × 400**,截断时高度 **426**(多出 26px 提示条);解决「列数少时节点缩成 200」与高度随内容跳动的问题。列数 ≤ 5 时列宽均分 520;> 5 时每列 100、表内横向滚动。
- 标题栏 40:**无左上图标**;结果别名(来自 `label`)+ `5 行 × 2 列`(11 等宽、`tabular-nums`)+ `CSV` / `MD` **纯文字入口**(10.5 等宽,无按钮底,仅 hover 变色;`aria-label` 为「复制 CSV / 复制 MD」)+ 关闭。
- 截断提示条 **26**:琥珀底 10% + 琥珀文字 + 11 等宽;位于节点标题下方、表格表头之上;文案沿用 `resultTruncated`,超长省略并带 `title`。
- 表头 30 / 行 28:吸顶;只有横线;数字列用同一个 `numericColumnFlags` 右对齐。
- 滚动区在固定高度中 `flex-1`(无截断 360,有截断 360),行虚拟化保持;行高常量 28 与设计一致。
- 复制入口不变成图标按钮;保持文字,避免在窄表头里堆图标。

### 3.4 连线与手势

- 边:1.25px `--canvas-line`;箭头 6px;不再 `animated`.
- 选中节点相邻的边:1.25px `--canvas-line-strong`.
- 连线预览:1.5px `--canvas-ink`,箭头 5px,源端点 4px 墨蓝实心圆;目标节点 `--canvas-ink` 1px 边框;不再使用线性渐变与 8px 大圆点。
- 切割:刀线 1.5px `--canvas-ink`;刀尖 4px 菱形;删除 `cutGlowGrad` / `cutDiamondGrad` / `cutSoftGlow` / `cutBladeGlow`;切割片段与 `clip-path` 几何保持不变。
- 框选:`selection` 墨蓝 8% 底 + 墨蓝 40% 1px 边框。

### 3.5 画布浮层

| 浮层 | 规格 |
|------|------|
| 搜索 | 360×可变(最大 36 + 5×32 = 196),顶部居中 12;标题栏 36;ESC keycap;结果行 32;结果图标 13;命中 `<mark>` 墨蓝 22%;阴影 `0 4px 12px`;打开时隐藏多选浮条 |
| 多选浮条 | 顶部居中 12,高 34;计数 11 等宽 + 复制 + 删除;删除红文字;按钮 26 |
| 右键模式条 | **左侧居中** 16,26×26 两段,3px 内边距,2px 段间距;active 墨蓝底;Tooltip 在右侧 |
| 状态栏 | 左下 16/12,11px;`03 步` + `已保存` + `12 分钟前`;数字 11 等宽;点 5px;分隔线 1×11 |
| HUD | 状态栏上方 44,左 16;keycap 20px;与状态栏同一套字体与细线 |
| 循环拒绝 | 顶部居中 12,高 32;红细边框 + 红文字;不再用 `bg-destructive/90` 实心红条 |
| 画布菜单 | 不改(共享 `CanvasContextMenu`) |

### 3.6 标签页与框选

- 标签页 active:`bg-canvas-ink-soft` + `text-canvas-ink` + 40% 墨蓝边框;inactive 保持中性,仅 hover 换底色。
- 每个标签页都有 `X`(包括只有 1 个标签页时),hover 时出现;关闭**最后一个**标签页 = 重置为一个空白 `Tab1` 并选中它,不留下 0 个标签页。
- 框选 `.react-flow__selection`:墨蓝 8% 底 + 墨蓝 40% 1.5px 边框,不再用绿色。

---

## 4. 文案与 i18n 变更

### 4.1 新增 key

| key | zh | en |
|-----|----|----|
| `inputRowsCols` | `{rows} 行 × {cols} 列` | `{rows} rows × {cols} cols` |
| `renamePending` | `列名已修改` | `Columns changed` |
| `saveRenameStep` | `保存为 rename 步骤` | `Save as rename step` |
| `inputData` | `输入数据` | `Input data` |
| `stepsCount` | `{n} 步` | `{n} steps` |
| `duplicateColumns` | `重复列: {list}` | `Duplicate columns: {list}` |
| `aliasPlaceholder` | `别名` | `Alias` |
| `copyAsCsv` | `复制为 CSV` | `Copy as CSV` |
| `copyAsMarkdown` | `复制为 Markdown` | `Copy as Markdown` |

**已落地**:`inputRowsCols` / `renamePending` / `saveRenameStep`(输入表页脚)。`inputData` 及以下为后续批次;`{n}` 的两位补零在组件里完成(`String(n).padStart(2, "0")`),不写进文案。

### 4.2 修改 / 保留

- `headerRename`(现为 `查询表头以修改`)保留作为列选择控件的占位;若需要更准确,改为 `选择要重命名的列`(文案变更需同步 `types.ts`)。
- `rightClickCutMode` / `rightClickMenuMode` 保留,用作模式条 Tooltip。
- `resultTruncated` / `searchFlow` / `saved` / `unsaved` / `justNow` / `minutesAgo` / `hoursAgo` / `daysAgo` 保留。
- `copy` / `copied` 保留;新增 `copyAsCsv` / `copyAsMarkdown` 只用于结果表 Tooltip。

### 4.3 写死文案清单(必须移除)

| 位置 | 现状 |
|------|------|
| `TableNode.tsx:227` | `Input Data`(标题 i18n 待办) |
| `TableNode.tsx:362-368` | `duplicate column: ...` |
| `PipelineStepNode.tsx:157` | `Alias` |
| `FlowPanel.tsx:932-934` | `step` / `steps` |
| `ResultTableNode.tsx:106-108` | `{totalRows} rows x {headers.length} cols` |
| `ResultTableNode.tsx:118/132` | `CSV` / `MD` 无 Tooltip |

> `CSV` / `MD` 是格式名,保留字面量;需要的是可访问名与 Tooltip。

---

## 5. 实现清单

| 文件 | 改动 |
|------|------|
| `src/index.css` | 6 个画布变量 + `@theme inline` 映射;`--flow-line-color` 改为 `--canvas-line-strong`;框选改墨蓝;删除 `pulse-once`;`node-enter` 改 2px 位移;删除切割 glow 关键帧中的渐变光晕(保留下落) |
| `pipeline/CoordinateGrid.tsx` | **删除**;改用 React Flow `Background`(`variant="dots", gap={22}, size={1}, color="var(--canvas-dot)"`) |
| `pipeline/FlowPanel.tsx` | 移除 `modeBarHovered` 与靠近右缘展开逻辑,改为常驻模式条;状态栏 i18n;循环提示改细线;多选浮条样式;`SearchOverlay` 宽度/层级;HUD 位置 |
| `pipeline/nodes/PipelineStepNode.tsx` | 新结构(索引栏 + 标题行 + 参数行);删除浮动按钮 / 齿轮;别名内联编辑;状态样式;去 `transition-all` |
| `pipeline/nodes/TableNode.tsx` | **去掉左上图标与右上「行×列」**;标题栏 `Select` 保留;新增页脚(左=文件名,右=`{rows} 行 × {cols} 列`);改名待保存时隐藏二者、右侧显示 `列名已修改` + `保存为 rename 步骤`;行号列;横线表;数字列对齐;重复列 i18n;去渐变/`h-41`/全网格 |
| `pipeline/nodes/ResultTableNode.tsx` | **固定 520 × 400 / 截断 426**;去掉左上图标;标题栏 40;行数 11 等宽 `tabular-nums`;CSV/MD 纯文字入口;截断条 26 位于表头之上;表头/行保持 |
| `pipeline/overlays/SearchOverlay.tsx` | 360 宽;最大 5×32;去 `h-[16vh]` 与 `shadow-lg`;ESC keycap;命中底色 |
| `pipeline/overlays/ConnectionVisualization.tsx` | 去渐变;1.5px 墨蓝 + 4px 端点 + 5px 箭头 |
| `pipeline/overlays/CutVisualization.tsx` | 去三层渐变与 glow;1.5px 刀线 + 4px 菱形 |
| `pipeline/overlays/KeyIndicatorOverlay.tsx` | keycap 20px;位置改 `bottom-44 left-16`;样式走变量 |
| `pipeline/lib/layout.ts` | 常量与首次落点(§6);节点宽 264 / 高按参数行估算;输入表 520×240;结果节点固定 520 × 426;去掉输入边 `animated` |
| `pipeline/hooks/usePipelineLayout.ts` | 传 `fileName`;结果节点 `height: 426`、`fallbackY` 改 450(426 + 24);节点 `data` 增 `fileName` |
| `src/modules/data-preview/HomeView.tsx` | 把 `inputFile` 的 basename 传给 `FlowPanel` → `TableNode`(不新增后端命令) |
| `src/i18n/translations/types.ts` + `zh/en/pipeline.ts` | 按 §4.1 增删(本批已落地 3 个) |
| `src/utils/csv.ts` | `numericColumnFlags(headers, rows)`(纯函数,仅用于对齐) |
| `src/__tests__/` | 见 §8 |

### 5.1 `fileName` 的取值

`HomeView` 已有 `inputFile`(完整路径)。新增 `fileName = basename(inputFile)`(兼容 `/` 与 `\`),传给 `FlowPanel` 的 `inputFileName` 属性,再由 `usePipelineLayout` 写进 `tableNode.data.fileName`。没有 `inputFile` 时显示 `—`。不改后端、不改会话快照。

### 5.2 数字列识别(可选但建议)

```ts
/** 预览行中该列所有非空单元格都能被 Number() 解析 → true。空值忽略;全空列返回 false。 */
export function numericColumnFlags(headers: string[], rows: string[][]): boolean[]
```

只用于 `text-align: right` + `tabular-nums`,不改单元格值、不做千分位格式化。验证:示例 CSV 的 `金额` / `数量` 为 true,`日期` / `地区` / `品类` 为 false;混合列 false。

---

## 6. 布局常数订正(与画布视觉同批落地)

| 常量 | 现状 | 改为 | 理由 |
|------|------|------|------|
| 步骤宽度 | 实际 `w-[220px]`(`PipelineStepNode.tsx:281`),dagre 记 240 | **264** | 264 能放下 `expression` 一行;与索引栏、13px 别名协调 |
| 列宽 `COLUMN_WIDTH` | 220(`layout.ts:385`) | **288**(264 + 24) | 现状 220 = 节点宽,水平零间距 |
| 行高 `ROW_HEIGHT` | 75(`layout.ts:386`) | **按节点高度 + 24** | 参数 1–2 行的节点高 58–78,75 会重叠 |
| 节点高度估算 | 90(`layout.ts:320-323`) | 38(无参数)/ 58(1 行)/ 78(2 行)/ +32(错误) | 与真实 DOM 高度一致 |
| 输入表尺寸估算 | 520×260(`layout.ts:293`) | **520×240** | 40 + 30 + 5×28 + 30 |
| 输入表默认位置 | `(-500, 0)`(`layout.ts:425`) | **(-520, 0)** | 宽度 520,右边落在世界原点 |
| 首步默认位置 | `occupiedPositions` 先占 `0-0`,首步拿 `0-1`(`layout.ts:390-418`) | **`table.x + 520 + 64, table.y`** | 修复「贴边 + 下移 75」的首帧 |
| 结果节点宽度 | 声明 520(`usePipelineLayout.ts:183`),实际 `headers.length * 100`(`ResultTableNode.tsx:160`) | **固定 520** | 列数少时不再缩成 200 |
| 结果节点高度 | 声明 220(`usePipelineLayout.ts:184`) | **426**(截断)/ **400**(无截断) | 固定宽高,竖向排布可预测 |
| 结果节点竖排间距 | `fallbackY += 260`(`usePipelineLayout.ts:166`) | **450**(426 + 24) | 多结果不再重叠 |

> 已保存的 `step.position` / `inputPosition` 优先,以上只影响尚未拖拽的首次落点与自动补位。`findFirstAvailablePosition` 的 5 行/列上限保留,但列宽改为 288、行步改为**按节点高度 + 24 累加**(默认 38+24=62,一行参数 58+24=82,两行参数 78+24=102),并把「当前节点自身位置」从 `occupiedPositions` 排除。

---

## 7. 状态与边界

| 场景 | 行为 |
|------|------|
| 无输入文件、只有步骤 | 画布仍显示步骤;状态栏 `03 步`;输入节点不渲染 |
| 有输入、无步骤 | 输入表 + `00 步`;首次引导卡由 `FirstStepGuide` 负责(不在本次范围) |
| 文件名超长 | 标题栏单行省略,`title` 全文;不撑宽节点 |
| 列数很多 | 输入表 / 结果表内部横向滚动,表头吸顶;不撑宽卡片 |
| 重复列名 | 表头下方 28px 琥珀条,列出 `名称(次数)`;不阻塞编辑 |
| 改名待保存 | 页脚显示 `列名已修改` + `保存为 rename 步骤`;保存后清空提示(与现状 `handleSaveRenames` 一致) |
| 步骤参数超长 | 每行省略 + `title`;超过 2 行时节点增高,不折叠 |
| 步骤错误 | 红细边框 + 2 行红字;完整错误在 `title`;不遮住标题 |
| 多选 | 顶部浮条显示计数、复制、删除;搜索打开时隐藏浮条(选择状态保留) |
| 右键划线 / 菜单 | 常驻模式条两段;切换后 Tooltip 不变;不恢复「靠近才展开」 |
| 搜索 | 最多 5 条 × 32;键盘 ↑↓/Enter/Esc;命中 `<mark>`;无结果显示 `未找到` 弱提示 |
| 循环连线 | 顶部 32px 红细线提示,3s 后消失;不再实心红条 |
| 暗色 | 表面差 + 细线;无阴影、无发光;墨蓝提亮 |
| 窄窗口 | 画布可平移缩放;浮层固定宽度不随视口缩放;状态栏与 HUD 不重叠 |
| 键盘焦点 | 搜索框、模式条、多选按钮、页脚入口有可见焦点环;画布节点保持点击语义,不新增焦点陷阱 |
| 关闭标签页 | 每个标签页都有 `X`(含单标签页);关闭最后一个 = 重置为一个空白 `Tab1` 并选中,不留下 0 个标签页 |
| 执行中 | 不改执行菜单 / 进度 / 结果注入;只把边线颜色与选中态统一 |

---

## 8. 测试

新增:

1. `src/__tests__/PipelineStepNode.test.tsx`(约 6 例):索引号、别名与命令名、参数键值行、布尔参数只显示键名、选中 class / 错误文字、铅笔按钮触发编辑。
2. `src/__tests__/TableNode.test.tsx`(约 7 例):文件名渲染与省略、页脚 `5 行 × 5 列`、行号 1–5、重复列提示、改名待保存时文件名/行×列隐藏且右侧出现保存按钮、保存回调、数字列右对齐。
3. `src/__tests__/ResultTableNode.test.tsx`(约 5 例):固定 520 × 400 / 426、无左上图标、`{rows} 行 × {cols} 列` 等宽、26px 截断条、CSV/MD 复制回调。
4. `src/__tests__/numericColumns.test.ts`(3 例):全数字 / 混合 / 全空。
5. `src/__tests__/canvasLayout.test.ts`(或并入现有 `layout.test.ts`,约 5 例):首步落在输入右侧 64、步骤垂直间距 24、264 宽、输入边不再 `animated`、结果 fallback 450。
6. `src/__tests__/SearchOverlay.test.tsx`(约 4 例):最多 5 条、32px 行、ESC、命中 `<mark>`。

需同步更新:

- `layout.test.ts` 里对 `COLUMN_WIDTH` / `ROW_HEIGHT` / 默认位置的断言(如有)。
- `ExecuteMenu.test.tsx` / `QuickActionDialog.test.tsx` 不应受影响;若因 `FlowPanel` 结构调整导致测试选择器变化,只改外层容器选择器,不改行为断言。

验证命令:`pnpm typecheck` / `pnpm lint` / `pnpm test`;再本地开亮色 + 暗色各看一次,重点看:首帧落点、选中/错误/待删除、5 条搜索结果、右键模式条。

---

## 9. 验收清单(unslop)

- [ ] 方向已写(§0.2),每个 pass 都按它执行
- [ ] 所有间距在 4px 栅格上,同类元素同尺寸(30/26/18 为控件内部 2px 微调)
- [ ] 图标 / 标签 / 数字各自对齐一列(索引栏、行号列、金额右对齐)
- [ ] 一支暖中性灰 + 三个文字层级 + 一个墨蓝 + 三个语义色(绿/琥珀/红)
- [ ] 无渐变、无发光、无彩色阴影、无彩色边框、无色斑
- [ ] 界面里没有 emoji
- [ ] 一套图标(14px / 1.5),不再有渐变图标底
- [ ] 字体 400–500,无大写宽字距,无斜体,小字无负字距
- [ ] 无感叹号、短句不带句号、无不可核实承诺;中文界面无写死英文
- [ ] 数字等宽、格式统一(`03 步` / `5 行 × 5 列` / `5 行 × 2 列`)
- [ ] 嵌套半径成立(12 / 9 / 6 / 4)
- [ ] 唯一亮点是真实内容(输入表 + 结果表),不是装饰图
- [ ] 首屏是完整的工作台,画布不靠视口高度撑开
- [ ] 无循环动效、一条缓动、不动 layout 属性
- [ ] 模板检查:把产品名换成别的 CSV 工具,`search → dedup → groupby` 与账本纸面仍然只属于这个产品;若只换名字也成立,就再加产品专属细节

---

## 10. 待拍板

| # | 问题 | 建议 | 备选 |
|---|------|------|------|
| 1 | **数字列右对齐**是否值得引入 `numericColumnFlags` 启发式 | 接受:只影响对齐,不改值,3 个测试 | 不做:全部左对齐,账本感会弱一半 |
| 2 | **重命名入口** | 已定:保留标题栏现有的列选择下拉;文件名与行×列让到页脚 | 页脚 `重命名列` 文字入口(原方案,已不采用) |
| 3 | **模式条常驻**还是继续自动隐藏 | 已定:常驻**左侧**居中(成本 32px,收益是可发现) | 自动隐藏,但改用 40px 可见把手;或放帮助菜单 |
| 4 | **步骤宽度 264 / 240** | 264(参数 expression 能放下一行) | 240(画布更密,参数需更多省略) |
| 5 | **删除节点齿轮按钮** | 接受:点击卡片打开参数,铅笔改别名 | 保留齿轮 + 铅笔两个 14px 图标 |
| 6 | **结果节点固定 520 × 400 / 426** | 已定:列少时不再缩成窄条,高度可预测 | 按列数自适应,但布局宽度/高度需同步动态 |
| 7 | **切割动画简化** | 接受:保留刀线与下落,去掉 glow/渐变 | 完全去掉动画,只留线条 |
| 8 | **FirstStepGuide 的蓝色** | 本次不改,另开一稿对齐纸面/墨蓝 | 本稿一起改(会扩大范围) |

---

## 11. 实施顺序

1. `src/index.css`:6 个变量 + `--flow-line-color` + 框选 + `node-enter` + 删除 pulse/glow;
2. `src/i18n/translations`:11 个 key + 写死英文清理(先 typecheck);
3. `src/utils/csv.ts`:`numericColumnFlags` + 单测;
4. `layout.ts` + `usePipelineLayout.ts`:常量、首步、结果宽度/间距、`fileName`;
5. `PipelineStepNode` → `TableNode` → `ResultTableNode`;
6. `CoordinateGrid` 删除 → `Background`;`FlowPanel` 模式条/状态栏/多选/循环提示;
7. `SearchOverlay` / `ConnectionVisualization` / `CutVisualization` / `KeyIndicatorOverlay`;
8. 新测试 + 现有测试修正;`pnpm typecheck` / `lint` / `test`;
9. 本地亮色 / 暗色各看一次(3 步、1 个错误、5 条搜索、右键两种模式);
10. `docs/AI/INDEX.md` 登记 033 与 `numericColumnFlags`。

---

## 12. 非目标

- 不改右键连线/切割的**手势逻辑**、画布平移/缩放/框选行为、节点拖拽与已保存坐标。
- 不改执行引擎、结果注入、并发与取消;不新增边上的执行动画。
- 不重做顶部菜单栏、标签栏、命令面板、日志面板、首次引导卡(它们保持现状,见 §10-Q8)。
- 不新增小地图、缩放按钮、自动布局按钮、每步成功徽标、节点内嵌运行按钮。
- 不生成图片;画布的「视觉」来自真实表格与纸片节点。

---

## 13. 实施记录

### 13.1 第一批(2026-11-07):画布浮层

| 文件 | 落地内容 |
|------|----------|
| `src/index.css` | `:root` / `.dark` 各 6 个画布变量(`--canvas-dot` / `--canvas-line` / `--canvas-line-strong` / `--canvas-ink` / `--canvas-ink-soft` / `--canvas-ok`)+ `@theme inline` 映射;不改动全局 token |
| `pipeline/overlays/SearchOverlay.tsx` | 360px 宽、36px 标题栏、结果行 32px、视口最多 5 行(160px)后滚动;ESC 改为 keycap;命中色墨蓝 22%;去掉 `h-[16vh]` 与 `shadow-lg`;键盘活动项自动滚入视野 |
| `pipeline/FlowPanel.tsx` | 右键模式由「隐藏圆点 + 靠近展开」改为**常驻 26px 竖条(左侧居中)**;多选浮条改为 34px 细线卡片(计数 + 复制 + 删除,使用共享 `Button`);搜索打开时隐藏多选浮条;删除 `modeBarHovered` 状态与鼠标靠近逻辑 |
| `pipeline/overlays/KeyIndicatorOverlay.tsx` | keycap 20px / 10.5 等宽 / 细线;位置 `bottom-11 left-4`(状态栏上方);Shift `x2` 改用墨蓝 soft;去掉 `shadow-sm` |

### 13.2 第二批(2026-11-07):输入表页脚

| 文件 | 落地内容 |
|------|----------|
| `pipeline/nodes/TableNode.tsx` | 去掉左上渐变图标与右上 `5 rows x`;新增 28px 页脚:左=文件名(basename,省略 + `title`),右=`{rows} 行 × {cols} 列`;只有**真正提交列名修改**后才进入待保存状态(仅打开编辑不算);待保存时隐藏文件名与行×列,右侧显示 `列名已修改` + `保存为 rename 步骤`;页脚 `cursor-grab`,保存按钮 `nodrag`;删除标题栏绿色保存按钮与 `Table`/`Check` import |
| `pipeline/lib/layout.ts` | 输入节点 `dragHandle` 从 `.table-node-header` 扩展为 `.table-node-header, .table-node-footer`,页脚也能拖动节点 |
| `pipeline/FlowPanel.tsx` / `pipeline/hooks/usePipelineLayout.ts` | 新增 `inputFileName` 传递链;布局阶段写入 `tableNode.data.fileName` |
| `src/modules/data-preview/HomeView.tsx` | 从 `inputFile` 取 basename(`split(/[/\\]/).pop()`)并传入 `FlowPanel` |
| `src/i18n/translations/{types,zh,en}` | 新增 `inputRowsCols` / `renamePending` / `saveRenameStep` |

> 同日修复:修改一列后直接切换另一列,上一列的编辑会随输入框 unmount 丢弃(表现为「每次只能改一个列名」)。`handleHeaderSelect` / `handleStartEdit` 现在先调用 `commitEdit(editingCol, editValue)`,提交上一列后再进入下一列;双击当前正在编辑的单元格会直接返回,不重置输入。

### 13.3 第三批(2026-11-07):结果表

| 文件 | 落地内容 |
|------|----------|
| `pipeline/nodes/ResultTableNode.tsx` | 去掉左上靛蓝渐变图标;固定 `w-[520px]`,高度 **400**(截断时 **426**);标题栏 40;行数改 `font-mono tabular-nums` 并使用 `inputRowsCols`;CSV/MD 改为纯文字入口(无按钮底,`aria-label`);截断提示条 **26** 放在表头之上;列数 ≤ 5 均分 520,> 5 每列 100 横向滚动 |
| `pipeline/hooks/usePipelineLayout.ts` | 结果节点高度 220 → **426**;`fallbackY` 260 → **450**(426 + 24);宽度保持 520 |

### 13.4 第四批(2026-11-07):选中色、框选与标签页

| 文件 | 落地内容 |
|------|----------|
| `pipeline/nodes/TableNode.tsx` / `PipelineStepNode.tsx` | 选中从主色/绿色改为**墨蓝边框 + 墨蓝 9% ring**;步骤选中保留 `bg-paper`,错误步骤仍为红色 |
| `src/index.css` | `.react-flow__selection` 从绿色改为墨蓝 8% 底 + 墨蓝 40% 1.5px 边框 |
| `modules/data-preview/HomeView.tsx` | 标签页 active 改为 `bg-canvas-ink-soft` + `text-canvas-ink` + 40% 墨蓝边框;移除 `tabs.length > 1` 条件,单标签页也显示 `X` |
| `hooks/useTabs.ts` | 关闭最后一个标签页时重置为一个空白 `Tab1` 并选中,避免 0 标签页导致依赖 `getCurrentTab()` 的代码失效 |

### 13.5 验证

- `pnpm typecheck` → 0 error
- `pnpm lint` → 0 error(79 条 warning 均为存量,未新增)
- `pnpm build` → 通过;已确认 `.bg-canvas-ink-soft` / `.border-canvas-line` / `.text-canvas-ink` / `focus-within:border-canvas-line-strong` / `mark` 的 `color-mix` 均进入产物 CSS
- `pnpm test` → **52 文件 / 641 例全绿**(输入表 / 结果表 / 选中色 / 标签页改动未影响现有断言)
- `pnpm check:index` → 178 条路径全部存在

### 13.6 尚未落地(下一批)

- 画布点阵与 `CoordinateGrid` 移除;
- 输入表剩余项(行号列、横线表、数字列对齐、重复列 i18n、标题 `Input Data` 的 i18n);
- 步骤节点(索引栏 / 参数行 / 状态);
- 连线、框选、循环提示、状态栏 i18n;
- 布局常量订正(§6)。
