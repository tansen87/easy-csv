# 图表可读性优化(Chart Readability)— 设计文档

> 状态: **P0 + P1 已实现(2026-10-01,文首实施记录)**;P2 增强未做
> 日期: 2026-10-01
> 关联: `src/modules/data-preview/charts/ChartPanel.tsx`(约 1280 行,7 种图) · `src/modules/data-preview/charts/ChartPrimitives.tsx`(新,共享图例与 tooltip) · `src/hooks/charts/processChartData.ts`(纯函数,数据塑形 + 诊断) · `src/hooks/execution/executeBranch.ts`(chart 分支取数) · `src-tauri/src/csv.rs`(`parse_csv_text`) · `src/utils/format.ts`(`formatNumber`) · `src/types/xan.ts` · `src/types/execution.ts`(`TabChartState`) · `src/modules/dialogs/command/forms/chart.tsx`(配置表单) · `src/data/commands/explore.ts` · `docs/AI/INDEX.md`
> 原型: `docs/design/prototypes/029/01-readability.html`、`docs/design/prototypes/029/02-edge-states.html`(独立 HTML,不随文档分发)
> 前置: 无(与 028 的并发改造互不影响)

---

## 0. 实施记录(2026-10-01)

按 §6.1 **A 方案(P0 + P1)全做**、§6.2 选 **推荐项 (a)** 落地;§5.8 拆分未做(§5 的 P2 增强整体未做)。

| 范围 | 状态 | 落地位置 |
|------|------|----------|
| P0-1 CSV 解析 | ✅ | 后端新增 `csv::parse_csv_text`(复用 `csv` crate,`flexible(true)`,`CHART_MAX_ROWS=50000`),注册进 `lib.rs`;`executeBranch` 删除 JS `parseCsvText`,改调该命令 |
| P0-2 截断可见 | ✅ | 命令回传 `truncated`/`total_rows`;`TabChartState.truncated` + 面板琥珀色提示,并写日志 |
| P0-3 非数值不归零 | ✅ | `parseNumericCell` 返回 `null`(千分位 `1,234` 也正确解析);折线 `connectNulls={false}`,面板提示「已跳过 N 行非数值」 |
| P0-4 列不存在 | ✅ | `processChartDataWithIssues` 返回 `column_not_found` + 可用列列表,面板渲染错误卡 |
| P0-5 暗色导出 | ✅ | 导出前把 `text` 填 `#1f2937`、`line` 填深灰,始终输出「白底深字」文档配色 |
| P0-6 隐藏机制统一 | ✅ | 四种图统一为**过滤数据**(删除 `stroke="transparent"` 占位) |
| P0-7 英文漏出 | ✅ | 新增 `chartTypeLine`…`chartTypeHeatmap` 等键;面板标题、直方图轴名、热力图 tooltip、表单标签与类型下拉全部走 i18n |
| P1-1 统一图例 | ✅ | 新增 `ChartPrimitives.tsx` 的 `ChartLegend`;**单系列也渲染**并标注 `(Y 轴)`;热力图给色阶图例;词云给「字号 = 出现频次」 |
| P1-2 排序 | ✅ | `defaultSortFor`:柱/饼/热力图默认降序,折线/散点保持原序;面板提供 降序/升序/原始顺序 三态 |
| P1-3 数值格式 | ✅ | `formatNumber`(auto / integer / decimal1 / decimal2 / percent / compact);轴用 `compact`,`tooltip` 用完整千分位;热力图单元格改用 `integer`(修掉 `12.0`) |
| P1-4 Tooltip 统一 | ✅ | 9 处 recharts tooltip 收敛为共享 `ChartTooltip`(显式文字色 + 值 + 占比);热力图不再自写英文 div |
| P1-5 轴标签 | ✅ | Y 轴未填标签时回退列名;长类目名/多类目自动 `angle=-30` + `preserveStartEnd`;轴刻度走 `compact` |
| P1-6 配色令牌化 | ✅ | `CATEGORY_COLORS` 按索引分配,隐藏系列不再导致其它系列换色;热力图改用 `HEAT_RAMP` 渐变插值 |
| P1-7 词云确定性 | ✅ | 改为自中心向外的**阿基米德螺线**布局(无 `Math.random()`),按估算文字宽高做碰撞检测,长词不再出界 |
| P1-8 空状态 | ✅ | `no_rows` / `column_not_found` / `no_numeric_values` 三类分别给不同文案与下一步 |

**验证**:`cargo test --lib` **188 通过**(新增 7 个 `parse_csv_text` 用例,含引号内逗号、引号内换行、`""` 转义、截断标记、自定义分隔符、无表头合成列名、参差行);前端 `chartReadability.test.ts` **20 通过** + `ChartPanelRender.test.tsx` **11 通过**(服务端渲染,断言单系列图例、中文图表类型、缺列错误卡、数据表视图、截断与跳行提示、词云说明、热力图色阶);**全量前端 41 文件 / 562 用例全绿**;`tsc --noEmit` 0 error;全仓 `eslint` 0 error。新增的渲染断言仍走不依赖 `act` 的 `renderToStaticMarkup`(更贴近纯服务端渲染,无需 DOM 事件),但**并非**为了绕开环境问题——原先的 `React.act is not a function` 已定位为 shell 导出 `NODE_ENV=production` 导致 React 加载 production 构建,现由 `vitest.config.ts` 的 `test.env`(`NODE_ENV=test`)+ `src/test/setup.ts` 守卫修复,详见 `docs/AI/INDEX.md` 的「React.act 陷阱」。

**未做(明确遗留)**:§5 的其余 P2 增强(均值参考线、数据标签、对数轴、可达性、聚合口径、PNG 导出)、§5.8 的 `ChartPanel.tsx` 拆分。§7 验收标准中「暗色导出可读」「长类目名不重叠」等已按实现落地,并已用**真实 Chrome** 复核(见下)。

### 后续增量(2026-10-01)

**数据表滚动条改用共享 `ScrollArea`**:「数据表」视图原先用 `<div className="overflow-auto">`,是浏览器原生滚动条;现改用 `src/components/ui/ScrollArea.tsx`(Radix),与应用其它滚动区一致。

关键实现细节(**易踩坑,勿回退**):

- 表格用 **`min-w-full` 而非 `w-full`**。`w-full` 会把它锁死在容器宽度内,列被压窄后**横向滚动条永不出现**;`min-w-full` 才允许列多时溢出,从而出现横向条。
- **不传 `hideHorizontalScrollbar`**:数据表列数不定,横向滚动是真实需求(该 prop 的注释说明它会让 viewport 切到 `overflow-x: hidden`)。
- 表头保留 `sticky top-0`(ScrollArea 的内容包在 viewport 内,sticky 仍相对 viewport 生效)。

**验证方式(真实浏览器,非仅 jsdom)**:用项目自身的 Vite + Tailwind 把真实 `ChartPanel` 构建成探针页,经 loopback 以系统 Chrome(Playwright 驱动)加载,24 列 × 80 行数据下实测:

| 指标 | 结果 |
|------|------|
| `[data-radix-scroll-area-viewport]` 存在 | ✓ |
| 两个方向滚动条节点 | ✓ vertical + horizontal |
| thumb 实际渲染 | ✓ 7×98px、10×7px,`opacity:1` |
| 纵向/横向可滚动 | ✓ `scrollHeight 2029 > clientHeight 448`;`scrollWidth 1440 > clientWidth 614` |
| 表头 `position` | ✓ `sticky` |
| 原生滚动条已隐藏 | ✓ Radix 注入 `::-webkit-scrollbar` 规则 |
| 像素级确认 | ✓ 垂直 thumb 落在 x=979–985、水平落在 y=629–635(均为 `#e5e5e5`) |

> 注:jsdom 下 Radix 因无法测量布局会**不挂载滚动条节点**,且 Tailwind 工具类需从项目根解析才生成——两处都已在测试与探针配置中相应处理(`src/test/setup.ts` 补 `ResizeObserver` 桩;断言改为校验 viewport 的 `overflow` 与内容包层,而非滚动条节点)。

### 修复:图表空白(2026-10-01,用户报障)

**现象**:对内置示例 `src-tauri/samples/easy-csv-sample-sales.csv`(表头 `日期,地区,品类,金额,数量`),x=地区、y=金额 时**完全没有图像**,连坐标轴都没有。

**根因(本设计引入的回归)**:029 重写渲染层时,把 `renderChart()` 原先外层的 `ResponsiveContainer` 换成了普通 `<div>`,于是 recharts 的 `BarChart` 收到 `width`/`height` 均为 `undefined`。recharts 的 `validateWidthHeight`(`ReactUtils.js`)判据是 `isNumber(width) && width > 0 && isNumber(height) && height > 0`,不满足即 **`render()` 直接 `return null`** —— 一整个图表节点都不产出。因图例是独立渲染的,只断言文本/图例的测试仍然是绿的,回归因此漏到用户手里。

**同时修掉的两处**:

1. `chartWidth`/`chartHeight` 在最大化分支的兜底值是字符串 `"100%"`,同样不是正数 → 同样会整图不渲染。已改为始终返回正数(`containerSize.* || config.* || 600/400`)。
2. `RechartsTooltip` 的 `content` 回调签名错误:recharts 传入的是**整个 props 对象**(`{active, payload, label}`),而实现按位置解构 `(payload, label)`,于是 `payload` 拿到的是 props 对象,`payload.map` 抛 `TypeError: payload.map is not a function` 并把整张图打崩。已改为按 props 解构,并加 `active`/`Array.isArray(payload)` 守卫(普通折线/柱状/散点 + 饼图两处都改了)。

**验证**(不只 jsdom,含真实 Chrome):

| 层次 | 结果 |
|------|------|
| 纯函数 | 示例文件 5 列表头正确、219 行;`地区 vs 金额` → 1 个系列、无 issue、`droppedRows=4`(该文件有 4 行 `金额` 为空) |
| jsdom 交互渲染 | `.recharts-wrapper` / `.recharts-surface` 存在;`.recharts-bar-rectangle` > 0 |
| **负向验证** | 临时移除 `ResponsiveContainer` 后,**4 条新断言全部失败**(`expected null to be truthy`)——证明断言确实能抓住该 bug,而非空转 |
| 真实 Chrome | `hasWrapper: true`、`wrapperSize: 600×400`、`barCount: 219`、首个柱 `h=305px`;7 种图(线/散点/柱/直方/饼/热力/词云)在真实文件上均能渲染 |
| 全量 | 前端 42 文件 / 577 用例全绿;`cargo test --lib` 188 通过;`tsc`、`eslint`、`check:index` 均 0 error |

**新增回归测试**:`src/__tests__/ChartPanelRender.test.tsx` 增加「actually draws a chart」用例组(5 种 recharts 图各断言 `.recharts-surface`/`.recharts-wrapper` 存在);新增 `src/__tests__/SampleFileChart.test.tsx` 直接以该示例文件(经 Vite `?raw` 导入)驱动端到端断言(表头、塑形结果、柱体数量、7 种图不崩)。**要点**:今后断言图表不能只看文本/图例,必须断言渲染面(`.recharts-surface`)存在——否则「图例在、图没了」这类回归测不出来。

### 遗留:未按 x 值聚合(§5.6 P2)

修好后示例文件能出图,但 x=地区 时是**219 根约 1px 宽的柱子**(该文件 219 行、仅 6 个地区),观感接近条形码而非常规柱状图。**这是既有行为**(029 之前同样不聚合),非本次回归;`processChartData` 仅对 `pie` 做了同名类目合并。彻底解决需要「按 x 分组聚合」的语义选项(求和/计数/均值),属 §5.6,需与 §3.3 的空值处理一并设计,故仍列为待办。

**当前可用替代**:在 chart 步骤前加一个聚合步骤(见 `docs/AI/INDEX.md` 的 aggregate 分类命令),把数据先压成「每个地区一行」,再画图即得 6 根常规柱。

### 后续增量:图例单行滚动 + 分类筛选(2026-10-01,用户提的需求)

**问题**:带 `category` 列时,每个取值生成一个图例色块,而图例行是 `flex-wrap` —— 分类一多就折成好几行,把固定高度面板里的图表区(`flex-1`)压扁。

**两项改动**:

1. **图例改横向 ScrollArea**(`ChartLegend`):色块行改为 `flex-nowrap` 并包进共享 `ScrollArea`,分类再多也只占一行、横向滚动。注意两点 —— ① 色块必须 `whitespace-nowrap` + 行容器 `w-max min-w-full`(Radix 内容包层是 `min-width:100%`,这样条目少时下划线仍铺满、条目多时才出现横向滚动);② 不传 `hideHorizontalScrollbar`,横向滚动是真实需求。

2. **分类多选筛选下拉**(`CategoryFilter`,新增于 `ChartPrimitives.tsx`):放在「图表 / 数据表」同一行**最右**(与「排序」同组,排序在前、筛选最后;「排序」用共享 `Select` 组件而非原生 `<select>`,与全应用一致)。含 **全选 / 取消全选**,驱动与图例色块**同一个** `hiddenSeries` 集合,两者天然同步。触发按钮带实时计数 `筛选 shown/total`。仅在 `series.length > 1` 时出现(单系列没有可筛对象);heatmap / 词云是单系列,自动不出现。

**配套修正**:「取消全选」后若图与图例一起消失,用户就没有任何恢复手段 —— 所以图例与工具栏的门控用 `canInteract`(`hasRows && !issue`),只有**绘图区**用 `hasContent`(`canInteract && !allSeriesHidden`);全部隐藏时绘图区改为提示「全部分类已隐藏 + 如何恢复」。

**验证**:新增 5 条交互用例(图例单行 12 分类不折行、`筛选 n/m` 计数、取消全选 → 提示、全选 → 恢复、复选框与图例同步);另以 14 分类 × 3 行数据在**真实 Chrome** 实测 —— 图例行高 20px(单行)、图例总高 29px、图表区仍 600×400 未被挤压、下拉含 14 个复选框且全选/取消全选均生效、取消全选后计数变 `0/14`、无页面错误。

---


## 1. 背景与目标

chart 分支今天已经能画 7 种图(line / scatter / bar / histogram / pie / wordcloud / heatmap),**能力不缺,缺的是"自解释"**:不看配置表单,用户无法知道每根柱子代表哪一列、数值到底多大、谁排第一。

但比"不够好看"更严重的是:存在几处**"看起来对、其实是错的"**路径 —— 图会理直气壮地画错,而且不报错。所以本次把诉求分三层,优先级按此排序:

| 层 | 目标 | 性质 |
|----|------|------|
| **P0 正确性** | 不画出会误导人的图 | 修 bug,不涉及新设计 |
| **P1 可读性** | 一眼看懂:图例 / 排序 / 数值格式 / tooltip / 轴标签 | 本次主体 |
| **P2 增强** | 图-表切换、参考线、词云确定性、可达性 | 可选 |

### 非目标

- **不换图表库**(继续 recharts),不做图表配置器(拖拽改图)。
- 不新增图表类型(不做 boxplot / sankey / 组合双轴)。
- 不做整图位图渲染管线(导出仍走 SVG,只修背景色问题)。
- 不改管道模型:`chart` 仍是分支终点命令,不变成可串联的管道节点。

---

## 2. 现状核对(代码事实)

以下均为 2026-10-01 读取源码确认的现状,非推测。

### 2.1 取数链路

| 环节 | 现状 | 位置 |
|------|------|------|
| 分支识别 | `branchSteps.findIndex(s => s.command.id === "chart") >= 0` | `executeBranch.ts:168` |
| 配置构造 | 把 `chartStep.parameters` 映射为 `ChartConfig`,width/height 兜底 600×400、bins 兜底 10 | `executeBranch.ts:280-292` |
| 取数(有前置步骤) | `invoke("execute_xan_pipeline")`,**只取 stdout** | `executeBranch.ts:321-332` |
| 取数(无前置步骤) | 直接 `readFile` 原始输入文件 | `executeBranch.ts:334-340` |
| **CSV 解析** | **`text.trim().split("\n")` + `line.split(delimiter)`**,只剥首尾成对引号 | `executeBranch.ts:299-312` |
| 数据塑形 | `processChartData(headers, data, config)`,纯函数、无 IO | `processChartData.ts:7` |
| 渲染派发 | `setTabChart(tabId, …)` + `setShowChartPanel(true)`;图表按标签页隔离 | `executeBranch.ts:346-351` |
| 输出上限 | `MAX_OUTPUT_BYTES = 2 * 1024 * 1024`(2 MB) | `runPipelineDeps.ts:20` |

**关键差异**:打开文件走的是 Rust `csv` crate(`src-tauri/src/csv.rs` 的 `read_csv_sync`,引号/换行/转义都正确);只有 **chart 分支绕过了它**,自己在 JS 里 split。这导致"同一个文件,预览表是对的,图表是错的"。

### 2.2 渲染能力盘点

| 能力 | 现状 | 位置 |
|------|------|------|
| 图例 | **只有多系列时**才渲染一排可点击色块;单系列无图例;饼图另写一套;热力图/词云无图例 | `ChartPanel.tsx:1363-1398`(多系列)、`1151-1191`(饼图) |
| 排序 | **完全没有**。按输入行顺序原样输出 | `processChartData.ts` 全文无排序 |
| 数值格式 | **没有**。`parseFloat` 后直接交给 recharts,无千分位/小数位/单位/百分比 | `processChartData.ts:189,217` |
| Tooltip | 用 recharts 默认实现,只传 `contentStyle={backgroundColor,borderColor}`;**未设 `color`**、无 `formatter`/`labelFormatter` | `ChartPanel.tsx` 共 **9 处**(`330`/`386`/`442`/`500`/`567`/`620`/`685`/`1107`/`1218`);热力图(`:900-929`)另手写一个 tooltip div,词云**完全没有** tooltip |
| 轴标签 | X 轴 `position:"bottom", offset:0`;Y 轴 `angle:-90, position:"insideLeft"`;margin 四周统一 20 | `ChartPanel.tsx:279`、`300-328` |
| 长类目名 | 不旋转、不换行、不省略、不抽样(无 `angle`/`interval`/`tickFormatter`) | `XAxis` 各处 |
| 参考线/标注 | 无均值线、目标线、极值标注 | — |
| 图-表切换 | 无。图看不出结论时用户无处可去 | — |
| 配色 | 饼图固定 8 色、词云固定 18 色彩虹,**与主题无关、不随暗色调整** | `ChartPanel.tsx:1027-1036`、`699-718` |
| 导出 | 仅 SVG;插入 `fill="white"` 的底矩形 | `ChartPanel.tsx:114-151`、`127-134` |
| 隐藏系列 | 线/柱用 `stroke="transparent"` 留在 DOM;饼图是过滤掉;热力图灰底 + `opacity:.3`。三种机制并存 | `343-345`、`457-458`、`998-1006` |

---

## 3. P0 — 正确性:会画出"看起来对、其实是错的"图

这一层不是审美问题:**图会撒谎,而且不报错**。建议先修这一层,再谈好看。

### 3.1 chart 分支自己在 JS 里切 CSV(最严重)

| 项 | 内容 |
|----|------|
| 位置 | `executeBranch.ts:299-312` — `text.trim().split("\n")` + `line.split(delimiter)`,只做 `replace(/^"\|"$/g, "")` |
| 问题 | **引号语义全丢**:`"Smith, John",42` 被切成 3 个字段;引号内换行直接断成两行;转义引号 `""` 不变回一个引号 |
| 后果 | 数据行错位 → 列对不上 → 图序列张冠李戴。**且与预览表不一致**(预览走 Rust `csv` crate,是对的) |
| 建议 | chart 分支改为复用后端读取(如 `read_tabular_file` / 让 `execute_xan_pipeline` 回传结构化结果),**不要在 JS 里再实现一遍 CSV 解析**。这是 P0 的根因型修复 |

### 3.2 超过 2 MB 的输出被静默截断

| 项 | 内容 |
|----|------|
| 位置 | `executeBranch.ts:326` 传 `maxOutputBytes: MAX_OUTPUT_BYTES`,`runPipelineDeps.ts:20` 为 `2 * 1024 * 1024` |
| 问题 | 前置步骤输出超限时拿到的是**被截断的 CSV**,解析仍"成功",图照画 |
| 后果 | 图缺一大截数据、统计量(均值/求和/极值)全偏,却没有任何提示 |
| 建议 | 返回体带 `truncated` 标记 → 面板顶部显示"数据超过 2 MB,图表仅基于前 N 行";或改分块聚合 |

### 3.3 非数值单元格静默变成 `0`

| 项 | 内容 |
|----|------|
| 位置 | `processChartData.ts:217`(基础系列)、`:189`(按 category 分组) — `parseFloat(row[yIndex]) \|\| 0` |
| 问题 | 空串、`N/A`、`-`、带千分位的 `1,234` 全部 → `0`,与"真的 0"无法区分 |
| 后果 | 折线图出现**跌到 0 的假谷**;柱状图长出一个不存在的 0 值柱;散点图在 y=0 堆一行点 |
| 建议 | `parseFloat` 得 `NaN` 时写 `null`(而非 0),交给 recharts 留空(`connectNulls=false`);被丢弃的行数在面板内提示"N 行非数值已跳过" |

### 3.4 x 列名写错 → 空白图,零提示

| 项 | 内容 |
|----|------|
| 位置 | `processChartData.ts:12-13` — `if (xIndex === -1) return []` |
| 问题 | 返回空数组后,面板照常打开:标题正常、坐标轴空着,和"数据为空"长得一模一样 |
| 后果 | 用户以为文件没数据,实际只是列名拼错 |
| 建议 | 返回结构化结果(如 `{error:"column_not_found", available:[...]}`),面板内明确写"找不到列 `xxx`;可用列:…" |

### 3.5 暗色主题导出的 SVG 几乎不可见

| 项 | 内容 |
|----|------|
| 位置 | `ChartPanel.tsx:127-134` 固定插入 `fill="white"` 底矩形;而 `textColor` 在暗色为 `#e5e7eb`(`:97`) |
| 问题 | 暗色下导出 = **白底 + 近白字**,文字/轴线基本消失 |
| 建议 | 导出走"文档模式":白底 + 深色字 + 深色网格(与当前界面主题解耦);或提供"白底/跟随主题"选项。顺带可加 PNG 导出 |

### 3.6 隐藏系列存在三套并行的实现

| 位置 | 机制 | 问题 |
|------|------|------|
| `343-345`、`457-458` | `stroke="transparent"`,元素**仍在 DOM** | 仍参与布局/动画,`activeDot` 只是被换掉;语义上是"看不见但还在" |
| `998-1006` | 热力图:灰底 `#e5e7eb` + `opacity:0.3` | 同时改底色又改透明度,"隐藏"被表达两遍 |
| 饼图 | 直接从数据里过滤掉 | 唯一正确的做法 |
| 建议 | 统一为**从数据过滤**(不渲染),并保留稳定的颜色索引,避免隐藏后其它系列换色 |

### 3.7 硬编码英文文案(中文界面下漏出)

| 位置 | 文案 |
|------|------|
| `927` | 热力图 tooltip 的 `Count: `(自写 div,完全没走 i18n) |
| `690`、`677` | 直方图 `name="Count"` 与 Y 轴 `value: "Count"` |
| `1304`、`262` | 面板标题回退值 `${t.chart}: ${config.chartType}` → 直接显示 `line`/`bar` 等英文标识 |
| `chart.tsx` 全文 | 表单标签与占位符:`chart-type`、`x column *`、`Select chart type...` 等,无一走 i18n;类型选项也是 `line`/`histogram` 这类原始标识 |

> 这一条直接影响"更容易让人理解":**用户看到的是 `histogram`,而不是"直方图(看分布)"**。

### P0 汇总

| # | 问题 | 用户可感知的后果 | 规模 |
|---|------|------------------|------|
| 3.1 | JS 手写 CSV 解析 | 列错位、图与表不一致 | 中(改取数路径) |
| 3.2 | 2 MB 静默截断 | 图缺数据、统计量偏 | 小 |
| 3.3 | 非数值 → 0 | 假谷/假零值 | 小 |
| 3.4 | 列不存在 → 空白图 | 误判"没数据" | 小 |
| 3.5 | 暗色导出白底浅字 | 导出图不可读 | 小 |
| 3.6 | 隐藏系列三套机制 | 行为不一致 | 小 |
| 3.7 | 英文文案漏出 | 中文界面混英文 | 小(量大但机械) |

---

## 4. P1 — 可读性:让图自己说明白

### 4.1 统一图例(本次的核心)

现状最刺眼的一点:**单系列图表上,屏幕上没有任何地方写"Y 轴画的是哪一列"**。recharts 的 `Legend` 从未被 import(顶部 import 清单可证),现有的"图例"是手写的,且只覆盖两种情形:

| 图表 | 现有图例 | 缺什么 |
|------|----------|--------|
| line/scatter/bar 多系列 | 顶部一排可点击色块(`1363-1398`) | 单系列时**不渲染**;位置在图上却在图表外,视觉上像工具条 |
| pie 单系列 | 图上方的色块按钮(`1151-1191`) | 与上面那套样式不同 |
| heatmap | **无** | 色阶代表什么,完全没说明 |
| wordcloud | **无** | 字号代表什么,没说明 |

**目标**:抽一个统一的 `ChartLegend` 组件,从此三处共用,承载:

1. 系列名 + 色块 + 点击显隐(现能力保留);
2. **单系列时也显示**,内容为"Y: 列名"(把"这图画的是什么"写出来);
3. 热力图:渲染一条**色阶图例**(低→高 + 数值两端);
4. 词云:一行说明"字号 = 出现频次";
5. 系列多时自动换行,不挤压绘图区。

### 4.2 排序(投入最小、收益最大)

现状 `processChartData.ts` **全文没有任何排序**,完全按输入行顺序出图。

| 图表 | 默认 | 可切换 |
|------|------|--------|
| bar / pie / heatmap 类目轴 | **按值降序** | 降序 / 升序 / 原始顺序 三态 |
| line | **保持原始顺序** | 同上(折线语义常是时间序列,不能默认打乱) |
| histogram | 按分箱区间升序(天然有序) | — |

理由:类目图最常被问的第一句话是"谁最大",今天的答案是"你自己去数"。

### 4.3 数值格式统一

现状 `parseFloat` 之后直接交给 recharts:没有千分位、没有小数位控制、没有单位,`1234567.891` 就长这样。

**目标**:一个 `formatNumber` 工具(`src/utils/format.ts` 已有 `formatBytes`/`formatElapsed` 先例,同族放置),轴刻度、tooltip、数据标签、热力图单元格**共用**:

- 大数缩写:`1.2k` / `3.4M`(轴刻度用),tooltip 给完整值;
- 千分位;
- 按量级自动定小数位(`12.5` 而不是 `12.500000001`);
- 百分比场景输出 `xx.x%`。

**新增配置项**:数值格式 = 自动 / 整数 / 1 位小数 / 2 位小数 / 百分比 / 自定义后缀。

> 顺带修一个现有小 bug:热力图单元格固定 `toFixed(1)`(`1014`),整数计数会显示成 `12.0`。

### 4.4 Tooltip 统一

现状:**9 处**各自传 `contentStyle`(行号见 §2.2),**只覆盖背景色与边框色,没设文字颜色** → 暗色 tooltip 下沿用 recharts 面向浅色底的默认字色,对比度不足;热力图又是自写 div(`:900-929`,且硬编码英文),词云则完全没有 tooltip。

**目标**:抽一个共享 tooltip 组件,所有图表共用:

1. 标题 = 类目名;
2. 每行 = 色块 + 系列名 + **格式化后的值**;
3. 补充**占比**(类目图/饼图);
4. 暗色/亮色两套文字颜色都显式指定;
5. 词云也能 hover 出词频。

### 4.5 轴标签与长类目名

| 项 | 现状 | 目标 |
|----|------|------|
| X 轴长类目名 | 不旋转、不换行、不省略、不抽样 → 直接重叠成一坨 | 名字长或类目多时自动斜排(约 -30°)或抽样(`interval="preserveStartEnd"`),并显示完整 tooltip |
| Y 轴标签 | 仅在用户手填 `y-label` 时才出现 | 未填时**用列名兜底**显示 |
| 边距 | 四周统一 `20`(`:279`),Y 轴刻度位数多时被裁 | 左侧按刻度最宽值动态估算宽度 |
| 数值轴 | 无单位、无千分位 | 与 §4.3 共用格式化 |

### 4.6 配色令牌化

现状:`pieColors` 8 色(`1027-1036`)、`wordColors` 18 色彩虹(`699-718`)**写死在组件里**,与主题无关、不随暗色调整;隐藏态硬编码 `#9ca3af`。

**目标**:一套语义色板(亮/暗各一组),**分类色按固定顺序分配**,保证同一类目跨刷新、跨隐藏操作颜色稳定(今天隐藏一个系列会导致颜色重新分配,认知负担很大)。

### 4.7 词云确定性 + 不重叠

| 问题 | 位置 | 说明 |
|------|------|------|
| 每次渲染重排 | `732-735` `getRandomAngle()`、`763-765` `Math.random()` 定位 | 布局在 render 中现算(`789` `const words = layoutWords()`),**任何状态变化(切主题、点显隐)整个词云重新洗牌** |
| 重叠检测粗糙 | `767-774` | 判据是"横距 < 60px 且纵距 < 字号";50 次没找到位置就**直接放弃**(`763-774`),允许重叠 |
| 长词溢出 | `764` | x 上限 `containerWidth - 100`,未按词宽计算,长词会出界 |

**目标**:改为**确定性布局**(同一份数据每次结果一致),改进碰撞检测,长词按实际宽高约束,并给"字号=频次"的说明。

### 4.8 空状态与错误状态统一

现状不一致:饼图给 `t.noData`(`1235`)、词云给 `t.noData`(`725`)、热力图给 `t.noData`(`832`),而 **line/bar/scatter 什么都不给** —— 空坐标轴。配合 §3.4,用户无法区分三种"空":

1. 真的没数据;
2. 列名不存在;
3. 数据全是缺失值。

**目标**:统一的空/错状态卡,写清**原因**与**下一步**(如"检查 x 列名,可用列:…")。

---

## 5. P2 — 增强(可选,看是否要做)

| # | 项 | 说明 | 我的建议 |
|---|----|------|----------|
| 5.1 | **图-表切换** | 面板内加「图表 / 数据表」两态:表显示聚合后的数值(类目 + 计数/求和),带排序与复制 CSV。解决"图看不出结论时无处可去" | **已实现**(表体用共享 `ScrollArea`,见 §0 实施记录) |
| 5.2 | 参考线 / 标注 | 均值线、目标线、最大值标注(recharts `ReferenceLine`) | 推荐做「均值线」一项,够用且便宜 |
| 5.3 | 数据标签 | 柱状/饼图直接标数值,免 hover | 类目少时开,类目多时自动关 |
| 5.4 | 对数轴 | 量级跨度大时(如 1 ~ 100 万)线性轴把小数全压成一条线 | 低成本高价值 |
| 5.5 | 可达性 | 图内信息对屏幕阅读器不可见;键盘无法操作图例 | 给图例加 `role`/`aria-pressed`,给图表容器加 `role="img"` + 文字摘要 |
| 5.6 | 聚合口径 | 今天柱状图按"行数"计数(计数语义),用户可能想要"求和/均值" | 需与 §3.3 一起设计,不要只加选项不修空值 |
| 5.7 | PNG 导出 | 现仅 SVG | 与 §3.5 一起做 |
| 5.8 | 拆分 `ChartPanel.tsx` | 1404 行、7 种图 + 拖拽 + 导出 + 热力图全部在一个文件;与 019「巨型文件拆分」同族问题 | 若做 §4 的共享组件,顺势拆成 `charts/{Legend,Tooltip,Heatmap,WordCloud,PieChart}.tsx`,避免在 1404 行里继续加功能 |

---

## 6. 待你决策的事项

请逐项选择;未勾选的项我不会动。

### 6.1 范围

| 选项 | 内容 | 影响 |
|------|------|------|
| **A(推荐)** | P0 全做 + P1 全做 | 修掉会撒谎的图,并把"自解释"补齐。改动集中在 ChartPanel + processChartData + 取数路径 |
| B | 只做 P0 | 最小改动、最快落地,但"看不懂"的问题仍在 |
| C | P0 + P1 + P2 全做 | 最完整,但含拆分重构,工期与回归面显著变大 |

### 6.2 三个需要你拍板的技术选择

1. **§3.1 怎么修**(影响面最大)
   - **(a) 推荐**:新增一个后端命令(如 `read_chart_source`),复用 Rust `csv` crate 正确解析后回传 `headers + rows`。**根治**,且让"预览"和"图表"从此同源。
   - (b) 前端只调 `read_tabular_file` 复用既有读取(改动更小,但要把"前置步骤输出"也变成文件或内存表,链路更长)。
   - (c) 仍在 JS 里修 split(实现一个最小引号状态机)。**不推荐**:等于把 CSV 解析实现两份,今天的问题就是这个决定的延续。

2. **§4.2 默认排序**是否按我提议的「类目图默认降序、折线图保持原序」?还是**全部保持原序**,只提供切换按钮?

3. **§5.8 拆分**是否本次一起做?拆了更干净,但会让本次 diff 变大、回归面变宽。

### 6.3 我建议**不做**的

- 不换图表库(见 §1 非目标)。
- 不做图表配置器 / 双轴组合图 / 桑基图 —— 收益低于成本。
- 不把 `chart` 改成可串联的管道节点(会动管道模型与执行器,属于另一个设计)。

---

## 7. 验收标准(基于可观测行为,不含实现细节)

| # | 验收点 | 判定方式 |
|---|--------|----------|
| 1 | 含逗号的引号字段不再导致列错位 | 用 `"Smith, John",42` 这类数据出图,与预览表数值一致 |
| 2 | 图与预览表的数值口径一致 | 同一文件,预览表看到的数值 = 图中数值 |
| 3 | 非数值单元格不再画成 0 | 含 `N/A`/空值的数据:折线断开而非归零,并有"N 行已跳过"提示 |
| 4 | x 列名写错有明确报错 | 填一个不存在的列名:面板显示"找不到列 xxx" + 可用列列表 |
| 5 | 超 2 MB 有截断提示 | 大文件出图时,面板顶部出现截断说明 |
| 6 | 单系列图表也能看出画的是哪一列 | 单系列 line/bar:面板上可见"Y: 列名" |
| 7 | 热力图色阶有图例 | 热力图旁可见"低 → 高"色阶条与数值端点 |
| 8 | 词云说明字号含义,且重复渲染不洗牌 | 切主题/点显隐后,词的相对位置与大小稳定 |
| 9 | 大数值可读 | `1234567.891` 在轴上显示为 `1.2M`,tooltip 显示完整值 |
| 10 | 暗色模式导出的文件可读 | 暗色下导出 SVG,文字与轴线清晰可见 |
| 11 | 长类目名不重叠 | 20 个长中文类目:文字斜排或抽样,无重叠 |
| 12 | 隐藏系列行为一致 | line/bar/pie/heatmap 四种图,点图例都是"隐藏=不渲染",且颜色不重排 |
| 13 | 空状态能区分原因 | 「无数据」「列不存在」「全是空值」三种情况提示不同 |
| 14 | 中文界面无英文漏出 | 中文下检查:tooltip、直方图轴名、表单标签、图表类型下拉均为中文 |

---

## 8. 实施顺序建议(若选 A)

1. **§3 正确性**(先修会撒谎的图,单独可验证、可回滚);
2. **§4.3 + §4.4**(格式化与 tooltip,是 §4 其余项的地基);
3. **§4.1 图例**(核心可读性);
4. **§4.2 / §4.5 / §4.8**(排序、轴、空状态);
5. **§4.6 / §4.7**(配色、词云);
6. (若选 C)§5 增强与拆分。

每一步都保持"改完即可单独验收",不攒大改动一次性合入。

---

## 9. 原型说明

`docs/design/prototypes/029/`:

| 文件 | 内容 |
|------|------|
| `01-readability.html` | 主原型:**改造前 / 改造后并排对照**,覆盖柱状图(排序+图例+数值格式)、单系列"Y: 列名"、热力图色阶图例、词云说明、统一 tooltip、明暗两套配色 |
| `02-edge-states.html` | 边界状态:**引号列错位(P0)**、非数值归零 vs 断线、列名不存在、2 MB 截断、空数据、暗色导出对比 |

原型为独立 HTML(不随文档分发),仅用于确认视觉与交互方向;确认后再动代码。
