# 045 · 数据血缘面板改版(列清单 + 列路径 + 泳道图)

> 原型: `docs/design/prototypes/045/01-data-lineage.html`(5 帧对照 + 9 条诊断 + 实现要点,可切亮/暗)。
> 入口:「查看 → 数据血缘」;面板挂在 `HomeView` 数据预览右侧 320px,全屏图的浮层覆盖画布区。

## 1. 为什么改

现状 `DataLineagePanel.tsx`(419 行)+ `LineageGraph.tsx`(341 行)的核心问题是**把一个节点图塞进了 320px**:

1. **图在 320px 里不成立**。`LineageGraph` 的列节点 100–220px 宽,一步 5 列就要 525px,`fitView` 缩到 55% 后 10px 的类型字只剩 5.5px;图只占面板上半截,下半截全空。
2. **三块固定占位吃掉 30% 高度**。标题 44 + 搜索 44 + 列列表写死 `h-[120px]`,而列列表把所有步骤出现过的列按 `sort()` 的字面顺序混排(品类 / 地区 / 日期 / 数量 / 金额),看不出哪些列还在结果里。
3. **选中列只做高亮,没有"路径"这件事**。类型里已有 `ColumnLineagePath` 与 `onGetLineageForColumn`,面板却只把它当过滤器用。
4. **四组 tailwind 色当类型色**(`blue-100`/`green-100`/`purple-100`/`amber-100`),高亮色又是 `#3b82f6` 蓝 —— 选中一个文本列与"被选中"完全分不开;暗色主题下这四块浅底会亮成一片。
5. **图标按钮全靠 Tooltip**:头部 5 枚 22px 图标(图形 / 时间线 / 全屏 / 保存 / 关闭)全无 `aria-label`;保存按钮的文案硬编码英文 `Save lineage` / `Saved!`。
6. **「本次改动」只在时间线视图里能看到**,而它才是"哪一步动了什么"的直接答案;默认图形视图完全看不见 `transformations`。
7. **空状态只有一行灰字**「执行后可查看数据血缘」,不解释血缘是什么、什么时候出现、重新执行会覆盖。

## 2. 方向

- **产品**:给处理 CSV 的人的可视化管道工具。这条侧栏只回答一个问题——结果里的这一列,是哪一步造出来的、在哪一步没的。
- **性格**:克制、可核对、像流水账;一次只讲一列。
- **世界**:实验室的样本追踪:编号、竖轨、等宽数字。中性石墨底,颜色只留给被追踪的那一列。
- **两个瞬间**:① 列路径:一条竖轨把步骤串起来,每步一句话 ② 全屏泳道图:被追踪列是全图唯一的实色线。
- **签名**:`01–04` 编号 —— 面板路径里在竖轨左侧,全屏图里在每条步骤竖线上,同一套编号、同一等宽字。

## 3. 结构

```
320px 面板
├─ 头部      数据血缘 · [全屏][⋯][×]        （3 个按钮，全部 aria-label）
├─ 搜索      搜索列名
├─ 列表
│   ├─ 结果中的列    n                        ← 最后一步 outputSchema
│   │   品类            string              4 步 · 第 3 步分组键
│   │   数量合计        number              4 步 · 第 3 步生成
│   │   销售额          number              4 步 · 改名 1 次
│   ├─ 中途被移除    n
│   │   日期            date                03 · 之后不再出现在结果里
│   │   地区            string              03 · 之后不再出现在结果里
│   ├─ 〔选中某列时原地展开的列路径〕
│   │   源数据 / 01..04 / 结果（或 路径到此为止）
│   └─ 本次改动      n                        ← 只在没有选中列时显示
│       01 筛掉空金额          219 → 203 行
└─ 页脚      4 步 · 219 → 5 行        最近一次执行
```

全屏(`LineageFullscreen`)覆盖画布区(`fixed top-10`,标题栏与菜单仍可用),头部是「数据血缘 · 4 步 · 219 → 5 行 + 搜索 + 导出血缘 + 关闭(Esc)」,主体是泳道图。

**泳道图**:列是泳道、步骤是竖线;只有发生变化的列在竖线上留节点(改类型 / 生成 / 改名 / 移除),其余列只穿过竖线。行数只写在竖线下方,变过的用正文色。被追踪列 2px 品牌色 + 芯片同色描边,其余 1px 灰线。点按任意列名或泳道切换追踪;搜索命中的泳道保持亮,其余压到 28%。

## 4. 数据与推导(不新增存储结构)

输入仍然只有 `StepLineage[]`(执行时按步骤跑出来的 schema 快照),推导集中在 `panels/lib/columnLineage.ts`:

| 函数 | 作用 |
|---|---|
| `diffStep(step)` | 单步的增 / 删 / 改类型 / 改名。改名优先读 `ColumnSchema.previousName`,老数据没有这个字段时退回「同来源、同类型、不是聚合列」的启发式配对 |
| `buildColumnTrace(lineage, name)` | 从结果列沿 `sourceColumnName` / 改名链回溯到源列,再正向走一遍,给出每步的 `kind`(`kept`/`cast`/`derived`/`renamed`/`removed`) |
| `summarizeColumns(lineage)` | 结果 = 最后一步 `outputSchema`;移除 = 第一步 `inputSchema` 里**轨迹没活到最后**的列(改名 / 聚合成新列的不算移除,所以「金额 → 金额合计 → 销售额」不会既出现在结果又出现在移除) |
| `summarizeSteps(lineage)` | 「本次改动」四行:步骤号、别名、行数变化 / 变化摘要 |
| `buildLanes(lineage)` | 泳道图数据:每个源列一条,外加管道中途凭空生成、没有来源的列 |

### 为了让路径成立,数据层补了三处(唯一的逻辑改动)

1. **`rename` 保留 `previousName`**:`computeOutputSchema` 的 rename 分支给输出列写 `previousName: col.name`(后续步骤会自然丢掉,所以它只描述一跳)。没有它,改名只能靠"删一列 + 加一列"猜。
2. **`groupby` / `agg` 解析出真正的输出列**:之前走 `default` 分支 = 输出列等于输入列,于是"按品类汇总之后日期/地区还在",移除分组永远是空的。现在从 `expression` 里读 `... as 别名`(`utils/lineageSchema.ts`),输出 = 分组键 + `keep` + 聚合列(带 `sourceColumnName` 与 `expression`)。**拿不到任何别名就返回空数组并退回旧行为**,避免把 schema 猜错。
3. **`map` / `transform` / `window` 的 `expression` 与来源列**:从表达式里找第一个真实存在的输入列,生成的列因此能接回上游。

`ColumnSchema` 新增两个可选字段:`expression`(生成列的定义)与 `previousName`(改名的一跳)。`StepLineage` 新增可选 `alias`(用户给步骤起的名字,界面优先显示它,`commandName` 退成等宽小字)。

## 5. i18n

新增:`lineageFullscreen` / `lineageMore` / `lineageClose` / `lineageExportJson` / `lineageGroupResult` / `lineageGroupRemoved` / `lineageGroupChanges` / `lineageStepsUnit` / `lineageRowsUnit` / `lineageColumnsUnit` / `lineageLatestRun` / `lineageSourceNode` / `lineageResultNode` / `lineageSourceColumn` / `lineageResultColumn` / `lineageKept` / `lineageCast` / `lineageDerived` / `lineageRenamed` / `lineageRemoved` / `lineageGroupKey` / `lineageRemovedHint` / `lineagePathEnd` / `lineagePathEndHint` / `lineageViewInGraph` / `lineageStepGeneratedAt` / `lineageStepGroupKeyAt` / `lineageRenamedTimes` / `lineageCastTimes` / `lineageEmptyTitle` / `lineageEmptyDesc` / `lineageEmptyOverwrite` / `lineageEmptyWait` / `lineageNoMatchTitle` / `lineageNoMatchDesc` / `lineageClearSearch` / `lineageTracedLane` / `lineageOtherLane` / `lineageRemovedHere` / `lineageGraphHint`。

占位符沿用本项目的 `.replace("{count}", …)` 约定。删除:`dagView` / `columnLineage` / `inputColumns` / `outputColumns` / `lineageTransformations` / `lineageForColumn` / `noLineageData`(`timelineView` 保留,版本控制面板还在用)。

## 6. 实施记录(2026-11-07)

**新增**:`panels/lib/columnLineage.ts`(推导层)、`panels/LineageColumnPath.tsx`(列路径)、`panels/LineageColumnRow.tsx`(分组标题 + 列行)、`panels/LineageFullscreen.tsx`(全屏外壳)、`utils/lineageSchema.ts`(聚合表达式解析)。
**重写**:`panels/DataLineagePanel.tsx`(419 → 366 行)、`panels/LineageGraph.tsx`(ReactFlow 节点图 → 泳道图 SVG)。
**改动**:`hooks/useDataLineage.ts`(groupby/agg/map/transform/window 的 schema + alias)、`types/xan.ts`(`expression` / `previousName` / `alias`)、`i18n/translations/{types,zh,en}`、`modules/data-preview/HomeView.tsx` 与 `app/App.tsx`(删掉已无用的 `onGetLineageForColumn` 传参)。

**测试**:新增 `ColumnLineage.test.ts`(21 例,覆盖 diff / 路径 / 分组 / 泳道 / 聚合解析)与 `DataLineagePanel.test.tsx`(13 例,覆盖分组、路径展开收起、移除路径、空态、搜索无匹配、⋯ 导出、关闭)。全量 59 文件 / 712 例通过,`tsc` 0 error,`eslint` 0 error(新文件无新增 warning)。

**交互**:点击行 = 展开 / 收起路径;`Esc` 收起路径或退出全屏;`↑↓` 在列之间移动焦点;`Enter` / 空格由原生 button 处理。打开路径时「本次改动」让位,收起后回来。

### 与原型不一致处

1. 面板里没有"源文件名"(原型写 `sales_2026_q3.csv`)。`StepLineage` 不带文件名,源节点改叫「源数据」,仍写明源列与类型。
2. 页脚没有时间(原型写 `14:32`)。`StepLineage` 没有执行时间戳,右侧改成「最近一次执行」。
3. 步骤标题优先显示 `alias`,没有别名才显示 `commandName`;有别名时命令名退成后面的等宽小字(原型是「名称 + 命令」两段,这一点一致)。
4. 全屏头部保留搜索框,但作用是"压暗不匹配的泳道"而不是过滤 —— 过滤会让竖线上出现没有泳道经过的空步骤。

## 7. 未做 / 开放问题

- **类型名沿用 raw 值**(`string` / `number` / `date`),没有翻译成「文本 / 数字 / 日期」:列名本身可能就叫「日期」,翻译后「日期 · 日期」会撞车。等确定改成 `text` / `num` 这类缩写再统一。
- **搜索只匹配当前列名**,不匹配历史名字(搜「金额」找不到已改名为「销售额」的列)。要么在元信息里补「原名」,要么搜索时一并匹配 `sourceName`。
- **多分支管道**:`StepLineage[]` 是 DFS 顺序,同一层并行分支的步骤会交错,泳道图在这种管道上只能保证"每列一条线",不保证竖线严格对应执行顺序。
- **`ColumnSchema` 仍是启发式**:`computeOutputSchema` 只覆盖了常见命令(select / drop / rename / map / transform / window / groupby / agg / separate / enum / pivot / transpose / flatten …),`join` / `merge` 仍按"列不变"处理。
