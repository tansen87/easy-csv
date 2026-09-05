# 架构与工程化优化建议

> 基于 `docs/AI/INDEX.md`(2026-09 核对)对 Easy CSV 全量代码现状盘点后的**架构与工程化**优化设计文档。
> 范围刻意与既有两份设计文档互补,不重复:
> - 画布交互/UI 详见 `canvas-ux-optimization.md`
> - 应用级功能扩展详见 `feature-and-ui-roadmap.md`
>
> 本文所有行数、props 数量、测试数据均为 **2026-09-02 实测值**(非 INDEX.md 载明的旧值),
> 每个问题给出:现状证据 → 问题定位 → 方案 → 验收清单。

---

## 1. 现状基线(实测)

| 维度 | 实测数据 | INDEX.md 载明(已漂移) |
|------|---------|----------------------|
| 前端巨型文件 | `App.tsx` 1358 行、`FlowPanel.tsx` 1488 行、`MainMenuHooks.ts` 1355 行、`ChartPanel.tsx` 1334 行、`commands.ts` 4170 行 | 1290 / 1241 / 1299 / — / 4134 |
| 组件 props 数量 | `HomeViewProps` **61 个**、`FlowPanelProps` **44 个** | 未记录 |
| 状态管理 | 无全局状态库/Context,App.tsx 仅 5 个 useState,但经 HomeView → FlowPanel 层层透传 | 未记录 |
| 代码分割 | 全项目 **0 处** `React.lazy` / 动态 import | 未记录 |
| Lint/CI | **无 ESLint 配置、无 lint/typecheck 脚本、无 .github/workflows** | 未记录 |
| 前端测试 | 11 个测试文件(INDEX.md 只列 10 个,漏 `versionDiff.test.ts`) | 10 个 |
| AI 前端服务测试 | `services/ai/context.ts` 924 行(提示词工程核心)**零测试** | 未记录 |
| Rust 测试 | 仅 `csv.rs`、`plugins.rs` 有内联 `#[cfg(test)]`;`pipeline.rs`(658 行核心)、`ai.rs`、`config.rs`、`storage.rs`、`session.rs`、`ai_memory.rs` **均无测试** | 未记录 |
| Rust 代码规模 | csv.rs 1151、pipeline.rs 658、config.rs 468、ai.rs 425、plugins.rs 350,共 3861 行 | 未记录 |
| CSP | `tauri.conf.json` 中 `"csp": null` | 未记录 |
| 错误边界 | 全项目无 React ErrorBoundary | 未记录 |

---

## 2. 问题清单与方案

### A. 前端架构

#### A1. 巨型文件持续膨胀(P0)

**现状**:六个文件超 600 行,其中四个超 1300 行。`FlowPanel.tsx` 内含 20+ 个 handle 回调(切刀三段 handleCutStart/Move/End、右键连线、搜索、复制粘贴、双击等),`MainMenuHooks.ts` 单文件混合文件操作、导入导出、执行引擎(`handleExecute` 单函数 500+ 行)、图表数据处理四类职责。

**问题定位**:
- `MainMenuHooks.ts:586` 的 `handleExecute` 覆盖 DFS 分支构建 + 进程调度 + 日志回填 + 图表后处理,职责过多,任何执行相关改动都要在这个超长函数里操作,回归风险高;
- `FlowPanel.tsx` 的切刀逻辑(start/move/end + 几何计算回调,约 300 行)与连线预览逻辑(约 200 行)本质是独立交互模块,和节点/边管理耦合在同一组件;
- `ChartPanel.tsx` 1334 行含 7 种图表渲染 + 拖拽 + 导出 + 最大化,每种图表可独立成子组件。

**方案**(渐进式,不做一次性大重构):
1. `MainMenuHooks.ts` 按职责拆为 `hooks/execution/`(execute + cancel + buildExecutionBranches)、`hooks/fileIO/`(open/save/import/export)、`hooks/chartProcessing/`(processChartData);`handleExecute` 内部按"构建分支 → 执行 → 回填"拆为可单测的纯函数;
2. `FlowPanel.tsx` 将切刀交互抽为 `panel/hooks/useCutTool.ts`、右键连线抽为 `panel/hooks/useConnectGesture.ts`,组件仅保留装配;
3. `ChartPanel.tsx` 按 ChartType 拆 `panel/charts/`(Line/Scatter/Bar/Histogram/Pie/Wordcloud/Heatmap 各一文件),公共拖拽/导出留在 `ChartPanel`。

**验收清单**:
- [ ] 单文件 ≤ 800 行(允许 `commands.ts`、`translations.ts` 等数据文件豁免);
- [ ] 拆分后 `handleExecute` 主流程函数 ≤ 100 行,分支构建为独立纯函数;
- [ ] `pnpm test` 全绿,`commands.test.ts`、`layout.test.ts` 无回归;
- [ ] 拆分涉及的交互(执行、取消、切刀、右键连线、图表切换)手工冒烟一遍(中英文 + 亮暗主题)。

#### A2. Props 钻透:HomeView 61 个 props(P0)

**现状**:`HomeViewProps` 61 个字段、`FlowPanelProps` 44 个字段,App.tsx → HomeView → FlowPanel 两层透传,版本控制、血缘、会话、执行四类 props 各自成组。

**问题定位**:
- 每新增一个跨层能力(如血缘列查询)要在 App.tsx 声明 state → 传入 HomeView → 再传 FlowPanel,三处同步修改;
- props 数组无类型约束分组,`versions`/`currentVersionId`/`onSaveVersion`/`onRestoreVersion` 等 11 个版本控制 props 应聚为一个对象;
- 现有 hooks(useTabs/usePipelineState 等)已拆好状态逻辑,缺的是**跨层传递通道**。

**方案**:
1. 引入轻量分组:将版本控制、血缘、执行进度三组 props 收敛为 `VersionControlProps`、`LineageProps`、`ExecutionStatusProps` 三个 interface,App 组装对象一次传入(不引入新依赖,纯类型收敛,第一步即把 61 → ~25);
2. 第二步评估引入 Context(如 `PipelineSessionContext` 聚合 tabs/selectedTabId/管道状态),仅对**真正全局**的会话态使用,避免 Context 滥用导致细粒度更新失效;
3. 不建议引入 zustand 等新状态库:现有 hooks 拆分方向正确,补传递层即可。

**验收清单**:
- [ ] `HomeViewProps` 字段数 ≤ 30,版本/血缘/执行各为单个分组对象;
- [ ] 新增跨层能力时只需在分组 interface 内加字段(以实际改动验证);
- [ ] TypeScript 严格编译零错误。

#### A3. 零代码分割,recharts/dagre 全量进首屏(P1)

**现状**:全项目无 `React.lazy`。依赖表含 `recharts`、`react-markdown + remark-gfm`、`dagre`、`@dnd-kit` 等重依赖,而 `ChartPanel`(1334 行 + recharts)、`HelpDialog`(markdown 渲染)、`DataLineagePanel/LineageGraph`(dagre 布局)均为**按需打开**的面板/对话框。

**问题定位**:首屏(管道编辑器)并不需要图表渲染和 markdown 解析,冷启动白白加载、解析、执行这些 JS。桌面应用虽无网络延迟,但 WebView 初始化时间和内存占用直接受 bundle 体积影响。

**方案**:
1. 对话框/面板级 `React.lazy` + `Suspense`:`ChartPanel`、`HelpDialog`、`DataLineagePanel`、`VersionControlPanel`、`AIPanel`、`CsvDiffDialog`、`CsvEncodingDialog`;
2. `generated/help-docs.ts` 等生成物已较精简(209 行),可不动;
3. 用 `pnpm build` + 构建产物体积对比验证收益。

**验收清单**:
- [ ] 首屏 chunk 不含 recharts / react-markdown;
- [ ] 面板首次打开无可见白屏(配 fallback 骨架);
- [ ] `pnpm build` 成功且首屏 JS 体积下降(记录 before/after 数值)。

### B. 工程化基础设施(P0,低成本高收益)

**现状**:无 ESLint 配置、`package.json` 无 `lint`/`typecheck` 脚本、无 CI(.github/workflows 不存在)。Rust 侧无 clippy/fmt 检查流程。

**问题定位**:
- 11 个测试文件全靠手动 `pnpm test` 运行,无门禁,回归可静默合入;
- 无 ESLint 意味着 `react-hooks/exhaustive-deps` 这类高频错误(现有 hooks 大量 useCallback)无法静态捕获;
- 大量代码靠 `: any` 逃逸(如 `reactFlowInstanceRef?: React.RefObject<any>`)。

**方案**:
1. 添加 `eslint` + `typescript-eslint` + `eslint-plugin-react-hooks`(rules: recommended + exhaustive-deps),`package.json` 增加:
   - `"lint": "eslint src --ext .ts,.tsx"`
   - `"typecheck": "tsc --noEmit"`
2. 建 `.github/workflows/ci.yml`:matrix 跑 `lint` + `typecheck` + `pnpm test`;Rust 侧跑 `cargo fmt --check` + `cargo clippy -- -D warnings` + `cargo test`(本机无 cargo 环境时先只上前端三件套,Rust 任务在装好工具链的 runner 上启用);
3. 消除存量 `: any`(当前量很小:MainMenuHooks.ts 仅 1 处,`RefObject<any>` 若干)。

**验收清单**:
- [ ] `pnpm lint` / `pnpm typecheck` 本地零报错后可作为门禁;
- [ ] CI 在 PR 上强制执行,红灯阻断合并;
- [ ] `src/` 下 `: any` 计数为 0(或仅剩注释豁免)。

### C. 测试盲区(P1)

**现状与问题定位**:

| 模块 | 规模 | 测试现状 | 风险 |
|------|------|---------|------|
| `services/ai/context.ts` | 924 行 | **零测试** | 意图路由、RAG 检索、模糊匹配、纠正规则加权全是纯函数,是最适合单测的代码,却完全裸奔;AI 功能每次调整都在赌 |
| `services/ai/api.ts` | `parseJSONBlock` 多行 JSON 解析 | 零测试 | 解析容错直接决定 AI 生成命令能否落地 |
| `hooks/MainMenuHooks.ts` | 1355 行 | 仅 `invoke.test.ts` 覆盖 App.tsx 层模式 | `buildExecutionBranches`(DFS 分支构建)纯逻辑无验证 |
| `src-tauri/src/pipeline.rs` | 658 行核心 | **零测试** | 管道执行、进程管理、取消轮询是应用最核心路径 |
| `src-tauri/src/config.rs` | 468 行 | 零测试 | API Key 加密存储(AES-256-GCM)逻辑无回归保障 |

**方案**(按 ROI 排序):
1. **AI 服务纯函数测试**(成本最低):`context.test.ts` 覆盖 `INTENT_ROUTES` 命中、`fuzzyMatch` 边界(空串/大小写/编辑距离阈值)、`detectClarificationNeed`、纠正规则加权排序;`api.test.ts` 覆盖 `parseJSONBlock` 的合法/截断/嵌套/多块 JSON;
2. **`buildExecutionBranches` 抽纯函数后单测**:线性管道、分支管道、环状输入(异常防御)三类用例;
3. **pipeline.rs 关键单测**:CLI 参数构建(`PipelineCommand` → argv,与前端 `commands.test.ts` 呼应形成双端契约)、`wait_with_cancel` 取消路径(可用短命令 + 提前置取消标志验证);
4. **config.rs**:AES 加密 roundtrip(save→load→delete)、per-provider key 隔离(不同 provider 不互相覆盖)。

**验收清单**:
- [ ] `context.test.ts` ≥ 20 用例、`api.test.ts` ≥ 10 用例;
- [ ] `pipeline.rs` 参数构建与取消各有测试;
- [ ] `config.rs` 加密 roundtrip 测试通过;
- [ ] CI 中全部测试纳入门禁。

### D. 后端 Rust 模块(P2)

**现状**:8 模块划分合理(INDEX.md 结构清晰),`csv.rs` 1151 行偏大但职责内聚(读/概况/对比/转码),已有内联测试。

**问题定位**:
1. `pipeline.rs` 的取消机制是**全局 AtomicBool**(单管道假设):若未来支持批量执行(feature-roadmap 2.3),全局标志无法区分取消哪个管道;
2. 持久化分散在 4 个 SQLite 文件(config.db / ai_memory.db / session.db / plugins.db)+ storage.rs 的文件式存储(版本/血缘/缓存),连接管理与迁移逻辑各写各的,`ensure_column` 这类迁移工具已出现于 config.rs,可复用;
3. `execute_xan_pipeline` 错误处理把 xan 的 stderr 原样返回,建议保留退出码 + 结构化错误(阶段、命令、stderr),便于前端节点状态标记(与 canvas-ux 3.1 节点状态联动)。

**方案**:暂缓大改,仅做两点:
1. 取消标志从全局单例改为 `HashMap<execution_id, AtomicBool>` 或至少预留接口(为管道级批量执行铺路);
2. 抽公共 `db.rs`(连接获取 + `ensure_column` 迁移工具),四模块复用。

**验收清单**:
- [ ] 取消机制支持按执行实例取消,现有单管道行为不变;
- [ ] 4 个 SQLite 模块统一走 `db.rs` 获取连接;
- [ ] `cargo test` 全绿。

### E. 安全与健壮性(P1)

**现状**:
- `tauri.conf.json` `"csp": null`(CSP 关闭);
- 全项目无 React ErrorBoundary:任一面板渲染抛错 = 白屏整个应用;
- Tauri 命令 50 个全部经 `invoke_handler` 暴露给前端,capabilities 未按最小权限细分。

**方案**:
1. 配置 CSP 起步版(允许 self + Tauri IPC 协议,`style-src 'unsafe-inline'` 视 shadcn/内联样式需要保留,逐步收紧),用 DevTools console 逐页验证无 CSP 违规;
2. 在 App 根 + FlowPanel/ChartPanel/AIPanel 三个复杂面板外层加轻量 ErrorBoundary(复用现有 `ConfirmDialog` 风格出错误提示 + "重载"按钮),防止单面板崩溃拖死全局;
3. 按 `capabilities/` 拆分权限:对话框面板仅需 dialog+fs 读,主窗口再授予完整权限(参考 Tauri v2 capability 按窗口细分)。

**验收清单**:
- [ ] CSP 非 null 且应用全功能回归通过(打开/执行/导出/AI/托盘);
- [ ] 人为在某面板抛错,应用主界面仍可用并显示可恢复错误提示;
- [ ] capabilities 按窗口/面板拆分后各功能权限正常。

### F. 文档一致性(P1,低成本)

**现状**:`docs/AI/INDEX.md` 是 AI 辅助开发的入口索引,但已出现数据漂移,会误导修改定位:
- 行数过期:`App.tsx` 1290→1358、`FlowPanel.tsx` 1241→1488、`commands.ts` 4134→4170、`MainMenuHooks.ts` 1299→1355、`translations.ts` 860→824、`CommandList.tsx` 454→540;
- 测试文件漏录:`src/__tests__/versionDiff.test.ts` 存在但 INDEX.md 测试清单(10 个文件)未收录;
- roadmap 文档写"移除了 Ctrl+D(CSV 差异)",但 INDEX.md 仍标注 `CSV 对比 (Ctrl+D)`,两处互相矛盾,需以 `KeyboardShortcuts.ts` 实际注册为准统一。

**方案**:
1. 短期:人工修正 INDEX.md 的行数、测试清单、快捷键描述,并在文首注明"行数为 2026-09 快照,以实际代码为准";
2. 中期:行数类易变信息从 INDEX.md 中**移除**(索引文档不应承载会漂移的度量),保留职责与修改入口;或写脚本 `scripts/check-index.ts` 在 CI 里校验关键路径存在性(不校验行数);
3. 快捷键以 `KeyboardShortcuts.ts` 为唯一事实源,INDEX.md/README 只链接不复制。

**验收清单**:
- [ ] INDEX.md 测试清单收录全部 11 个文件;
- [ ] 行数标注加上快照日期或移除;
- [ ] Ctrl+D 描述与 `KeyboardShortcuts.ts` 实际注册一致,README 同步。

---

## 3. 实施优先级总览

| 优先级 | 项 | 理由 |
|--------|-----|------|
| **P0** | B 工程化基础设施(ESLint/typecheck/CI) | 一次性低成本投入,为后续所有重构提供安全网 |
| **P0** | F 文档一致性修正 | 纯文档改动,防误导 |
| **P0** | A1 巨型文件拆分(先 MainMenuHooks) | 执行引擎是最核心路径,拆出可测纯函数后 C 项才有落点 |
| **P1** | C 测试补齐(AI 服务纯函数先行) | AI 是迭代最频繁的模块,纯函数测试成本最低 |
| **P1** | A2 Props 分组收敛 | 与 A1 拆分同批做,避免两次全局改名 |
| **P1** | E 安全与健壮性(CSP/ErrorBoundary) | 桌面应用分发前必备 |
| **P1** | A3 代码分割 | 性能收益,依赖 A1 拆出独立面板组件后更顺手 |
| **P2** | D Rust 后端(取消机制/公共 db.rs) | 为 roadmap 中"管道级批量执行"铺路,暂不阻塞 |

**建议批次**:
1. **第一批(1~2 天)**:B + F —— 建好门禁再动代码;
2. **第二批(3~5 天)**:A1(MainMenuHooks + FlowPanel 拆分)+ A2(props 分组)+ C1(AI 纯函数测试);
3. **第三批(2~3 天)**:E(CSP + ErrorBoundary)+ A3(懒加载)+ C2/C3(执行分支与 Rust 测试);
4. **第四批(视排期)**:D。

---

## 4. 通用约束(沿用项目既有约定)

1. 所有 UI 改动走 i18n 双语、主题变量而非硬编码色值;
2. 新快捷键先查 `KeyboardShortcuts.ts` 冲突表;
3. 画布结构变更统一走 `onStepsChange`/`onEdgesChange` 保证撤销栈一致;
4. 几何/算法逻辑进 `layout.ts`/`cutGeometry.ts` 并补 `layout.test.ts` 用例;
5. 每批改动完成后运行 `pnpm test` + `pnpm lint` + `pnpm typecheck` 全绿再合入。
