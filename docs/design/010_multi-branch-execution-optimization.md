# 多分支执行优化：从路径枚举到 DAG 调度

> 证据来源（实测，2026-09-06）：
> - `src/hooks/MainMenuHooks.ts` L787-849（`buildExecutionBranches` 路径枚举）、L851-1379（`runNow` 串行分支循环、output 注入、取消与错误归因）、L36（`MAX_OUTPUT_BYTES = 2MB`）
> - `src-tauri/src/pipeline.rs` L47-56（全局取消标志）、L195（`spawn_blocking`）、L313-646（线性子进程链与失败处理）、L654-657（stdout 截断）
> - `src/components/panel/FlowPanel.tsx` L1268+（`onConnect` 无环检测）、`src/components/HomeView.tsx` L691-742（单值分支进度徽标）
>
> 与既有文档分工：006 的 F2（单步调试，复用分支构建）、F5（文件监听重跑，已定不做）、AI 流式/批量队列（feature-and-ui-roadmap.md）不在本文展开。本文只覆盖**多分支的构建、调度、执行与呈现**。

---

## 1. 现状：一条管道是怎么被拆成分支执行的

执行链路（自 `handleExecute` 起）：

```
handleExecute
  ├─ 过滤 output 步骤 → executableSteps；校验必填参数、收集 {{变量}}
  └─ runNow
       ├─ buildExecutionBranches(steps, edges) → PipelineStep[][]   // "分支 = 源→汇完整路径"
       ├─ for (i = 0..branches.length) 串行 await：                  // 一次一条分支
       │    ├─ 特判 batch-from/batch-to、batch-filter、chart → 前端自有执行路径
       │    ├─ 其余分支整体作为一次 execute_xan_pipeline invoke
       │    │    （分支内多步在后端拼成线性子进程管道，中间失败 kill 全链）
       │    └─ step_errors 回写节点、allResults 累积 → 结果预览(F1)/自动存版本
       └─ finally：执行历史摘要、branchProgress 5 秒后隐藏
```

分支构建规则（L787-849）：

| 场景 | 行为 |
|------|------|
| 无边 | 每个步骤自成一条单步分支 |
| 有边 | 从入度为 0 的节点 DFS 到所有汇点，每条完整路径 push 为一个 branch |
| startNodes 为空 | 回退到 `table-node` 出边逐条 DFS |
| 仍无结果 | 退化为每步单分支 |

关键结构事实：

1. **分支 = 路径，不是节点集**。菱形 `A→(B,C)→D` 会产生 `[A,B,D]`、`[A,C,D]` 两条分支，A 和 D 各执行两次。
2. **一次 invoke 只执行一条线性命令链**。分支间的数据传递只能靠"整条路径重跑"实现，没有中间结果复用。
3. **进度是全局单值** `branchProgress { current, total, name, status }`，HomeView 顶部徽标一次只显示一条分支的状态。
4. **取消是全局的**：`CANCELLATION_FLAG: OnceLock<AtomicBool>` 无执行隔离；前端 batch-filter / batch-from 循环不检查取消。

---

## 2. 问题清单

### P0（正确性）

| # | 问题 | 证据 |
|---|------|------|
| 1 | **共享前缀重复执行**：路径枚举的本质缺陷。n 层并行分支时公共前缀重复次数随层数指数增长；大文件下是纯粹浪费 | L809-824 DFS 沿每条出边复制 path |
| 2 | **成环无防护**：画布 `onConnect` 不校验环；`buildExecutionBranches` 的 DFS 无 visited 集合，带环图直接栈溢出，用户只能看到 "Maximum call stack size exceeded" | FlowPanel L1268+；L809-824 |
| 3 | **startNodes 混合场景丢分支**：`targetIds` 取全部边的 target（含 `table-node` 出边）。若 `table-node→S1` 且存在孤立步骤 S2，则 startNodes=[S2]，S1 所在分支被整体跳过（回退分支只在 startNodes 为空时走） | L826-840 |

### P1（语义与体验）

| # | 问题 | 证据 |
|---|------|------|
| 4 | **多入边节点语义模糊**：D 有两条入边时被当作两条独立路径的成员各执行一次，每次只吃到单条前驱链的数据；真正的"汇聚"只能靠显式 join/cat 命令，UI 无任何提示 | 同 P0-1 |
| 5 | **output 互相覆盖**：`outputPath` 注入到每个分支的最后一步，多分支写同一文件，后写覆盖先写，静默丢数据；且注入条件含 `!pipelineFailed`——某分支失败后，其余成功分支静默不写文件 | L1172-1182 |
| 6 | **分支串行**：互不依赖的分支逐个 await，总耗时 = 各分支之和；后端 `spawn_blocking` 本可并发 | L915 |
| 7 | **失败策略固定**：分支失败标记 `pipelineFailed` 后继续跑完剩余分支；共享前缀失败时下游分支仍会重复跑注定失败的前缀 | L1247-1254 |
| 8 | **批量循环不响应取消**：`executeBatchFilter*` / `executeBatchConvert` 的前端循环不检查取消标志，点取消后批量循环照跑到底 | BatchFilterHooks/BatchConvertHooks 全文无 cancel 检查 |

### P2（工程化）

| # | 问题 |
|---|------|
| 9 | branchProgress 单值，无法表达并行/排队/跳过；无每步耗时统计 |
| 10 | 分支间无中间结果缓存，重复执行无法复用；跨执行也无法增量续跑 |
| 11 | 取消标志全局共享，若未来放开多标签并行执行会互相误杀 |

---

## 3. 方案

### S1. 图校验与环检测（P0，止血）

1. **连接时拦截**：`FlowPanel.onConnect` 在加边前做 DFS 检测"target → source 是否可达"，成环则拒绝并 toast 提示（双语），与现有 `resolveHandles` 方向约束同一层实现；
2. **执行前防御**：`buildExecutionBranches` 内加 visited 集合，检测到环返回显式错误 `"检测到环: S1 → S2 → S1"`（列出环节点 id），runNow 捕获后在日志与 toast 中给出可读信息，并将成环节点标红（复用 step.error 通道）；
3. **导入兜底**：导入 `.xanflow` 后执行同样走 2 的校验，旧文件带环不至于崩；
4. **顺手修 startNodes 丢分支**：targetIds 改为只统计"source 是可执行 step"的边，`table-node` 出边的 target 不再计入入度——混合场景下 `table-node→S1` 与孤立 S2 都会成为起点。

> 实现落点：`FlowPanel.tsx` onConnect + `MainMenuHooks.ts` buildExecutionBranches。建议把分支构建/环检测抽到 `src/utils/branching.ts` 纯函数模块，配 vitest 用例（环、菱形、混合起点、无边）。

### S2. 共享前缀执行（P1，阶段一：保持"分支=路径"语义，只消除重复计算）

把 branches 按步骤序列构建**前缀树（trie）**，公共前缀只执行一次，输出物化为临时文件，后续分支从文件续跑：

1. **构建**：`branches` → trie，节点 = step id，边 = 顺序关系；树上每个"分叉点"之前的路径只跑一次；
2. **物化**：前缀管道执行时，最后一步 stdout 直接落盘，不走前端。需要后端小改动：`execute_xan_pipeline` 新增可选参数 `output_file: Option<String>`——有值时把 last child 的 stdout 写入该文件（复用现有 stdout_thread，写文件而非拼 String），绕开 2MB 截断（中间结果可能远大于预览上限）；
3. **续跑**：分叉后的子分支以 `node-<stepId>.csv` 为 `inputFile` 调用现有执行路径，分隔符/无表头沿 run 上下文透传；
4. **临时目录**：`{系统临时目录}/easy-csv/run-<ts>/`，执行结束（含失败/取消）后统一清理；保留最近 1 次 run 目录供失败排查（可选）；
5. **保守边界**：含 batch-from/batch-to、batch-filter、chart 的分支**不参与共享**，按现状整条执行（特判逻辑已复杂，避免首期耦合）；单链管道（绝大多数用例）自动退化为现状行为，零回归；
6. **缓存命中（可选，二期）**：临时文件键 = 输入文件 mtime + 前缀步骤参数 hash，命中则跳过执行——这是将来"改下游只重跑下游"增量执行的地基，与 F5（不做）不冲突，属于执行内缓存而非文件监听。

> 收益量化：菱形结构下 A 从 2 次降为 1 次；k 层并行分支的公共前缀从 O(k!) 级路径重复降为 1 次。

### S3. DAG 拓扑调度（远期，阶段二：语义升级）

S2 是路径模型的修补；完整方案是**节点只执行一次**的 DAG 调度：

1. **调度器**：拓扑排序（Kahn），入度归零即就绪，就绪节点入队执行（与 S4 并行天然契合）；每节点输出物化到 per-node 临时文件（复用 S2 的 `output_file` 机制）；
2. **多入边语义**（关键设计决策）：
   - 默认：图校验时报错，提示"多输入请使用 join/cat/merge 命令显式汇聚"（与 xan 的显式多输入哲学一致）；
   - 可选设置："按边序合并"= 多条入边来源文件按边顺序拼接（等价 cat），供不想写 join 的轻量场景；
3. **join 类命令引用前驱输出**：参数占位 `{{input:N}}` 在调度时替换为第 N 条入边来源的临时文件路径——复用 F3 变量解析框架（`resolveStepPlaceholders`），只是注入方从运行时对话框变为调度器；
4. **对 F2 的影响**：单步调试"运行到此步骤"在 DAG 模型下改为"执行其全部前驱 + 本节点"，语义更自然，比现在的"截取子链"更准确。

S3 影响 F2 与画布交互语义，建议在 S2 稳定一个版本后单独立项评审，本文只锁定方向。

### S4. 分支并行执行（P1，依赖 S2）

1. **并行域**：前缀树上同一分叉点的兄弟分支互不依赖，可 `Promise.all` 并行；实现用受限并发（`p-limit` 模式），默认 `min(4, 分支数)`，设置项可调；
2. **后端就绪**：`execute_xan_pipeline` 已是 async + `spawn_blocking`，并发 invoke 天然支持，无需后端改动；
3. **日志**：并发后日志交错，每条分支日志加 `[branch 2/4]` 前缀，LogPanel 可按分支过滤（P2 可选）；
4. **进度**：`branchProgress` 从单值扩展为 `{ items: { name, status: pending | running | completed | error | skipped }[] }`，徽标显示"N/M 运行中 + 错误数"，悬浮列出各分支状态；`BatchFilterHooks`/`BatchConvertHooks` 复用同一结构（它们本就在借用这个单值）。

### S5. 失败策略可配置（P1，依赖 S2）

1. **设置项** `executionFailureStrategy: continue | stop`，默认 `continue`（= 现状，回归零感知）；
2. **stop（fail-fast）**：分支失败后剩余分支标 skipped 不执行；
3. **前缀树联动**（S2 后自然获得）：前缀节点失败 → 其全部下游分支标 skipped，不再重复跑注定失败的前缀；
4. **output 注入条件修正**：去掉 `!pipelineFailed`（现状是"某分支失败后，其余成功分支静默不写文件"，比覆盖更糟）；策略为 continue 时成功分支照常写。

### S6. 输出写入语义（P0 警告 + P1 占位符）

1. **警告（P0）**：`branches.length > 1` 且 `outputPath` 非空时，执行前弹确认："3 条分支将先后写入同一文件，后写会覆盖先写，是否继续？"（双语）；batch 分支不受影响；
2. **占位符（P1）**：output 步骤的 path 支持 `{branch}`（分支序号）与 `{branchName}`（别名串，做文件名安全化），如 `out-{branch}.csv` → `out-1.csv`、`out-2.csv`；解析复用 F3 占位符替换函数，冲突字符（`{{` vs `{`）在文档与 placeholder 文案中说明；
3. 单分支管道行为完全不变。

### S7. 取消隔离与批量循环响应（P2）

1. **批量循环响应取消（P0 级体验，实现极简）**：前端 `runNow` 持有一个 `cancelRequestedRef`，`handleCancel` 置位；`BatchFilterHooks`/`BatchConvertHooks` 的循环每轮检查 ref，置位则 break 并记 cancelled——纯前端改动，不碰后端；
2. **执行隔离（P2）**：`execute_xan_pipeline` / `set_pipeline_cancelled` 增加可选 `executionId`，后端标志改为 `Mutex<HashMap<String, AtomicBool>>`；未传 id 时沿用全局标志（向后兼容）。在 S4 并行落地前优先级不高，避免过度设计。

### S8. 节点级进度与耗时（P2）

1. **节点状态**：独立的 `executionStates: Record<stepId, { status, durationMs }>`（不写入 step 对象，避免高频 setTabs 抖动）；`PipelineStepNode` 读取着色：pending 灰 / running 蓝脉冲（复用现有切割动画的呼吸样式体系）/ completed 绿 / error 红（现有 error 通道）/ skipped 黄半透明；
2. **耗时**：分支完成时记录每步 durationMs，执行历史 entry 的 outputSummary 增加每分支耗时字段；
3. UI 遵循主题变量，不硬编码色值；文案双语。

---

## 4. 实施阶段与依赖

| 阶段 | 内容 | 依赖 | 风险 |
|------|------|------|------|
| Phase 1 正确性止血 | S1（环检测 + startNodes 修复）、S6 警告、S7-1（批量循环响应取消） | 无 | 低；全部为防御性改动 |
| Phase 2 共享前缀 | S2（trie + 后端 `output_file`）、S5 失败策略、S8 节点状态 | Phase 1 | 中；临时文件生命周期与清理需测试覆盖 |
| Phase 3 并行 | S4 并行 + 进度结构扩展 | Phase 2 | 中；日志交错与进度 UI 改造 |
| Phase 4 语义升级 | S3 DAG 调度 + `{{input:N}}` + 多入边语义 | Phase 2 稳定后单独立项 | 高；影响 F2 与画布交互语义 |

回归底线：**单链管道（无边或单链）在每一阶段的行为与现状完全一致**；旧 `.xanflow` / 会话快照恢复后可正常执行。

---

## 5. 与既有规划的边界

- F2 单步调试（006）：Phase 4 前维持"截取子链"实现，S3 落地后升级为"前驱 + 本节点"，届时同步修订 006；
- F5 文件监听重跑（006，已定不做）：S2 的缓存命中是执行内优化，不引入文件监听；
- AI 流式/批量队列（feature-and-ui-roadmap.md）：不涉及；
- 执行历史（F6 已实现）：S8 只扩展 outputSummary 字段，不改表结构。

---

## 6. 验收清单

1. 菱形管道 `A→(B,C)→D` 执行：日志中 A 只出现一次；两条分支各产生一份结果预览；
2. 画布试图连成环被拒绝并出现双语提示；手工构造含环 `.xanflow` 导入后执行，报错列出环节点链（如 `S1 → S2 → S1`）而非栈溢出；
3. `table-node→S1` 与孤立步骤 S2 混合时，S1、S2 均被执行（修复前 S1 丢失）；
4. 多分支 + 单一 output 路径：执行前出现覆盖确认；使用 `out-{branch}.csv` 时生成多份文件；
5. 前缀中间结果 > 2MB 时，续跑分支拿到的数据完整（验证 `output_file` 落盘路径，不受预览截断影响）；
6. 执行中点取消：批量 filter / batch-from 循环在当前文件完成后停止，进度徽标与日志标记 cancelled；
7. 3 条互不依赖分支并行执行：总耗时 ≈ 最慢分支；进度可见各分支独立状态；日志带分支前缀可区分；
8. 失败策略 stop：分支 2 失败后分支 3 显示 skipped 不执行；策略 continue 时成功分支仍写输出（验证 S5-4 修正）；
9. 单链管道行为与升级前逐项一致（命令行、日志、结果预览、自动存版本、执行历史）；旧会话快照恢复回归通过；
10. `buildExecutionBranches` 抽为纯函数模块后，vitest 覆盖：无环校验、菱形 trie 构建、混合起点、无边退化四类用例；
11. 新增 UI 文案中英文完整；节点状态着色使用主题变量。

---

## 7. 通用约束（沿用项目约定）

- 双语 i18n：所有新增文案进 `translations.ts`，无硬编码；
- 主题变量：节点状态色、进度徽标一律用 CSS 变量，适配 dark mode；
- 新增快捷键前先查 `KeyboardShortcuts.ts` 冲突（本文方案未引入新快捷键）;
- 后端改动仅 `pipeline.rs` 的 `output_file` 参数与取消隔离（Phase 4 前），保持 `ExecutionResult` 结构兼容；
- 本文档落地后登记进 `docs/AI/INDEX.md` 的设计文档表。
