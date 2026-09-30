# 多标签页并发执行(标签页执行会话隔离)— 设计文档

> 状态: **P0 + P1 已实现;P2 已实现 #13(并发上限设置项),未做 #12(全部停止入口)**(2026-09-30)
> 日期: 2026-09-30
>
> ### 实施记录(P2 部分,2026-09-30)
>
> - **#13 并发上限设置项**:配置项 `max_concurrent_runs`(`config.rs` 的 `AppConfig` + `get/set_max_concurrent_runs`;`save_config` 落库,`set` 时 `clamp(1, 16)` 防呆)。前端:`useAppSettings.maxConcurrentRuns`(默认 4)→ `App` 传给 `useExecution({ maxConcurrentRuns })`,`useExecution` 内部 `runLimit = max(1, maxConcurrentRuns)` 取代原常量(常量改名 `DEFAULT_MAX_CONCURRENT_RUNS` 作兜底);设置页「同时执行的标签页数上限」数字输入(1~16,输入时就 clamp),`handleSaveSettings` 里调 `set_max_concurrent_runs` 落库。
> - **#5 溢写隔离(§4.4 遗留项)**:新增 `TempDir` RAII guard(`pipeline.rs`,与 `TempFiles` 并列)+ `sanitize_run_id`;`run_duckdb_chain` 收 `run_id`,在阻塞任务内建 `EasyCsv_duckdb_spill_<pid>_<runId>` 目录并传给 `build_duckdb_chain_sql` 的 `SET temp_directory`,任务结束(含报错/取消)自动 `remove_dir_all`;建目录失败回退系统临时目录。
> - **测试**:后端 179 → **181**(+2:`temp_dir_is_created_and_removed_on_drop`、`sanitize_run_id_keeps_only_safe_characters`);前端 517 → **520**(+3:`SettingsConcurrencyControl.test.tsx` —— 回显 / 上报 / 越界 clamp)。
>
> ### 实施记录(P1,2026-09-30)
>
> - **并发上限 = 4**(`MAX_CONCURRENT_RUNS`,`useExecution.ts`;用户指定):超出进入 **`queued`**(会话留在注册表,标签栏与菜单显示「排队中」);`activeRunsRef: Set<RunId>` + `runQueueRef`(FIFO)+ 一个 drain effect 在注册表每次变化时补位。`RunState` 增 `"queued"`;`isTabExecuting` 把 `queued` 也算「占用中」,所以同一标签页不会重复起跑。**取消排队中的 run = 直接从队列摘除**(不起后端进程、不占用名额)。S6 分支覆盖确认会让 run **交回槽位**(新 dep `releaseRun`),否则一个等确认的 run 会白占一个名额。
> - **日志按标签页**(§5.4):`LogEntry.tabId` + `useLogs.addLog(type, message, tabId?)`;每个 run 的日志统一走 **`RunContext.log`**(`runPipeline` / `executeBranch` / `useBatchFilter` / `useBatchConvert` 全部改用它),因此 `RunPipelineDeps.addLog` 与两个批处理钩子的 `addLog` prop **删除**;`LogPanel` 增「仅当前标签页 / 全部」切换 + 每行的标签页徽标(列级筛选 `activeFilter` 保持不变,两者叠加)。
> - **跨标签页输出冲突**(§7.3):`OverwriteConfirm` 增 `reason: "branches" | "crossTab"` 与 `otherTabName`(仅 crossTab 用);起跑前若另一个**活跃**标签页写同一个 `output` 路径,弹独立的确认文案(不去误用「N 个分支」那条);确认后以 `force` 继续。
> - **菜单行** 补:**排队中**行(徽标 + 取消按钮,点行只切换)+ 标签页名 `title` tooltip(§11)。对话框 FIFO 排队在 P0 已落地,本阶段无改动。
> - **测试**:前端 511 → **516**(+2 `src/__tests__/ExecutionConcurrency.test.tsx`:上限 4 / 排队中可取消;+2 `src/__tests__/LogPanel.test.tsx`:按标签页过滤;+1 `ExecuteMenu` 排队行)。`tsc` 0 错误、`eslint` 0 错误。
> - **未做**:P2(「全部停止」入口 / 并发上限设置项 —— 上限目前是代码常量 4);§9.2 的 T5/T6/T7 仍未单独补断言(并发隔离已由 `ExecutionConcurrency` 部分覆盖)。
>
> ### 实施记录(P0,2026-09-30 — 与设计的偏差与补充)
>
> - **`set_pipeline_cancelled` 直接删除,不是「保留为取消全部」**(§4.3 的倾向被采纳):`lib.rs` 只注册 `cancel_pipeline(run_id)`;入口的 `if cancelled` 提前返回整段删除(新 run 的标志恒为 false)。
> - **进度 pill 的 5s 计时器搬进了注册表**:`App.tsx` 的 `progressHideTimerRef` 删除,`finishRun(runId, state)` 负责「置终态 + 5s 后删会话条目」;`showProgress` 落在 `RunSession` 上。
> - **§9.2 T8 的前提不成立**:`BatchFilterHooks.test.ts` / `BatchConvertHooks.test.ts` / `invoke.test.ts` 是**直接调用 `invoke` 的 payload 快照**测试,**不经过 hooks**,所以加 `runId` 后它们**没有变红**,也**未改动**(它们只记录形状)。真正需要改的既有测试:无。
> - **顺手修了一个与本设计无关的既有类型错误**:`Translations.settingsAutoCheckUpdate` 在 `en/update.ts` 与 `zh/update.ts` 里都缺文案,导致 `pnpm typecheck` 在本次改动前就是红的;补了这两条。
> - **UI 与定稿一致**:`MainMenu` 的「执行」= 标签页菜单(当前标签页置顶 + 小横线、点行即切过去执行、运行中的行只留「取消」+ 分支进度),按钮运行态只加 `data-busy` 与 `.exec-busy::after` 进度线(新增于 `src/index.css`),**不加图标、不改尺寸**;标签栏补运行徽标;进度 pill 右侧补「另有 N 个标签页在运行」弱提示。
> - **测试**:后端 174 → **179**(+5:`cancel_pipeline_is_isolated_per_run` / `a_new_run_starts_uncancelled` / `unregister_run_drops_the_entry` / `run_guard_unbinds_on_drop` / `cancel_unknown_run_is_a_noop`);前端 505 → **511**(+6:`src/__tests__/ExecuteMenu.test.tsx`,覆盖 T9/T10 与三种行状态)。`tsc` 0 错误、`eslint` 0 错误。
> - **仍未做**:§9.2 的 T5/T6/T7(并发结果互不覆盖 / 对话框排队 / 关页取消的断言)只有实现没有测试;P1、P2 全部。
> 关联: `docs/AI/INDEX.md`(§「管道执行(核心)」/「Hooks · hooks/execution/」/「会话持久化」)、`docs/design/010_multi-branch-execution-optimization.md`(分支级执行模型,本设计的基座)、`docs/design/024_parquet-duckdb-file-reading.md`(临时文件唯一名先例)、`docs/design/027_first-run-onboarding.md`(执行完成提示的取舍)
> 前置事实: 后端**本身已能并发**(每次 `invoke` 独立 `spawn_blocking` + 独立子进程;临时文件已用 `EasyCsv_duckdb_{pid}_{counter}` 唯一命名),**唯一挡住并发的是三处全局单例状态**(见 §3)。
> UI 定稿(§5.6): 「执行」按钮改为**标签页菜单** —— 运行中**不加图标、不改结构**、当前标签页置顶 + 小横线、点行即切过去执行、运行中的行只留「取消」。

---

## 0. 方案速览(先读这一节)

**一句话问题**: 应用的「执行」这件事目前是**全局单例**——前端一个 `isExecuting: boolean`、后端一个 `CANCELLATION_FLAG: AtomicBool`、外加一批全局进度/结果/图表/对话框状态。于是:某个标签页一开跑,Execute 按钮、`Ctrl+R`、命令面板动作**在所有标签页一起置灰**,直到它跑完才恢复;而任何一次「取消」都会**误杀所有正在跑的标签页**。

**目标**: 每个标签页持有**独立的执行会话(RunSession)**,彼此不打扰——

- tab A 在跑时,切到 tab B 可以照常编辑、照常点「执行」;
- 「取消」只作用于发起它的那个标签页;
- 进度、结果预览、日志、图表、变量对话框都归属到各自的标签页,不互相覆盖。

**核心决策**(每条的依据在正文):

| # | 决策 | 一句话理由 |
|---|------|-----------|
| D1 | 引入 **`runId`(执行会话 id)**,贯穿前后端 | 取消/进度/结果都要一个「这次运行」的身份,标签页 id 不够(同一标签页可先后多次运行) |
| D2 | 后端取消标志从**全局 `AtomicBool`** 改为 **`Registry: HashMap<runId, Arc<AtomicBool>>`** | 这是「取消误伤」的唯一根因:`set_pipeline_cancelled(true)` 目前是进程级开关 |
| D3 | 前端 `isExecuting: boolean` → **`runsByTab: Record<tabId, TabRunState>`**,`isExecuting(tabId)` 由它派生 | 置灰判断必须按当前标签页,而不是「应用里有没有人在跑」 |
| D4 | 进度条 / 结果预览 / 图表 / 变量对话框改为**按 tabId(或 runId)路由** | 否则后跑的标签页会覆盖先跑标签页的产物(`resultPreview` 已是一次半成品隔离) |
| D5 | **同一标签页不可并发**,**不同标签页可并发**;并发上限可配置(建议默认 4) | 同标签页并发没有语义(同一份 pipeline/输出),不同标签页才是本次诉求 |
| D6 | 对话框(变量取值 / 覆盖确认)保留**单可见槽位 + FIFO 排队**,但每条排队项记住自己的 `runId` | 这两个对话框是应用级模态,同一时刻只能显示一个;不能让它被第二个标签页覆盖 |
| D7 | 「执行」按钮改为**标签页菜单**:当前标签页置顶 + 小横线分隔、点行即切过去执行、运行中的行只留「取消」;**运行中不加图标、不改按钮尺寸** | 现状 `⟳ 执行中` 会让按钮结构随状态变化;菜单同时承担「看进度 / 取消 / 跑别的标签页」三件事(§5.6) |

**UI 原型**(独立 HTML,不随文档分发): `docs/design/prototypes/028/01-execute-tab-menu.html`

**状态**: **P0 + P1 已实现**(见文首实施记录;并发上限固定 4);**UI 已定稿**(§5.6 与原型);开放问题 4 个(§10),均有倾向性建议。

---

## 1. 背景与目标

### 1.1 现状(代码事实)

执行链路的控制面全部收在 `src/app/App.tsx` 与 `src/hooks/execution/`:

- **前端全局布尔**: `App.tsx` 的 `const [isExecuting, setIsExecuting] = useState(false)`(`App.tsx:289`),被 `MainMenu`(`isExecuting` 置灰,`MainMenu.tsx:565`)、命令面板 `execute` 动作(`App.tsx:1487`)、`useKeyboardShortcuts`(`Ctrl+R` 守卫,`useKeyboardShortcuts.ts:79-85`)、`HomeView` 的「取消执行」按钮(`HomeView.tsx:783`)、`useAppBootstrap` 的完成系统通知(`useAppBootstrap.ts:130-141`)共同消费。
- **后端全局取消标志**: `pipeline.rs` 的 `static CANCELLATION_FLAG: OnceLock<AtomicBool>`(`pipeline.rs:48-52`),`set_pipeline_cancelled(cancel: bool)`(`pipeline.rs:54-57`)写它;`execute_xan_pipeline` 在入口读它并在已取消时**直接返回取消**(`pipeline.rs:187-197`),其内部所有子进程轮询(`wait_with_cancel`, `pipeline.rs:79-88`)也读**同一个**标志。
- **全局 UI 状态**: `showProgressBar` / `branchProgress`(`useUIState.ts:16-22`)、`logs`(`useLogs.ts`)、`chartConfig` / `chartSeries` / `chartHeaders` / `showChartPanel`(`useUIState.ts:31-34`)都是单例。
- **执行装配**: `useExecution` 持有 `cancelRequestedRef`(前端取消标志,`useExecution.ts:95`)、`pendingRunRef`(待执行快照,`useExecution.ts:158`)、`variablePrompt` / `overwriteConfirm` 两个单槽对话框;`runPipeline` 在入口 `set_pipeline_cancelled(false)`(`runPipeline.ts:124`)、`setIsExecuting(true)`(`runPipeline.ts:101`),在 `finally` 里 `setIsExecuting(false)`(`runPipeline.ts:256`)。
- **批处理钩子**: `useBatchFilter` / `useBatchConvert` 通过 `getCurrentTab()` **运行时读取「当前标签页」**取输入文件(`useBatchFilter.ts:20`、`useBatchConvert.ts`),并共用 `cancelRequestedRef`。
- **已完成的一次局部隔离**: 结果预览已经带 `resultPreviewTabId`,`resultPreview` 只对拥有者标签页渲染(`useExecution.ts:122-149`)——但它是「一个数组 + 一个 tabId」,**第二个标签页一跑就顶掉第一个的**。

### 1.2 目标

| # | 诉求 | 落地 |
|---|------|------|
| 1 | tab A 跑的时候,tab B 可以照常编辑并「执行」 | §5(前端状态按标签页) |
| 2 | 「取消」只停发起它的标签页 | §4(后端 per-run 取消) |
| 3 | 各标签页的进度/结果/日志/图表不互相覆盖 | §5.4 |
| 4 | 运行中切换标签页、关闭标签页都有确定行为 | §6 |
| 5 | 并发不把机器打死(可配置上限) | §7 |

### 1.3 非目标(明确不做)

- **不做「同一标签页内并发」**:同一份 pipeline、同一个输出路径,并发没有意义,按钮直接置灰并给一句提示。
- **不做执行队列的跨标签页调度 UI**(P0 不做「排队中」面板;P1 视并发上限落地)。
- **不改分支执行模型**:分支拆分、`buildExecutionBranches`、批处理/图表分支判定(`executeBranch.ts`)全部保持现状,本次只改「谁来持有这次运行的会话」。
- **不改 xan 子进程管道实现**(`pipeline.rs` 的 `pipeline_seq` / 多命令流水线 / duckdb 串联)——它已经是每次调用独立的,§4.5 只做复核。
- **不持久化运行状态**:运行态是内存态,会话快照(`useSession` / `session.rs`)**不写** `runsByTab`(§6.3)。

---

## 2. 术语与模型

### 2.1 RunSession(执行会话)

一次「点执行 → 全部结束」的过程 = 一个 RunSession。

```
type RunId = string;              // 前端生成,如 `${tabId}-${Date.now()}-${rand}`

interface RunSession {
  runId: RunId;
  tabId: string;                  // 归属标签页(稳定,不随用户切页变化)
  state: "preparing"              // 变量取值 / 覆盖确认等待中
       | "queued"                 // 已达并发上限,排队(P1)
       | "running"
       | "done" | "error" | "cancelled";
  branchProgress: BranchProgressState | null;
  startedAt: number;
  // 运行期依赖快照(见 §5.2):一旦开跑,不再回头看「当前标签页」
  snapshot: {
    tab: PipelineTab;             // pending.currentTab 的等价物
    inputFile: string;
    delimiter: string;            // 在开跑瞬间定死(现状是运行期动态读,见 §3 注 3)
    edges: PipelineEdge[];
    outputPath: string;
    executableSteps: PipelineStep[];
  };
}
```

### 2.2 状态机

```
                    ┌───────────────┐
  点执行 ──► preparing ──(有未赋值变量/覆盖确认)──► 用户确认 ──┐
             │  (无等待项)                                      │
             ▼                                                  ▼
          queued ──(有空闲额度)──► running ──► done / error / cancelled
                                 ▲
                    取消(仅本 runId)┘
```

- `preparing` 期间**不占用并发额度**(还没起子进程),但要在标签页上显示「待确认」。
- `running → cancelled` 只能由**本 runId 的取消**触发。
- 结束(`done/error/cancelled`)后从 `runsByTab` 移出,靠 §5.5 的短暂延迟决定进度条何时消失(现状 5s,`runPipeline.ts:294-297`)。

---

## 3. 现状梳理:三处全局单例

| # | 位置 | 当前语义 | 为何阻碍并发 | 改法 |
|---|------|---------|-------------|------|
| 1 | `pipeline.rs` `CANCELLATION_FLAG` | 进程级取消开关 | 取消 A 会 kill B;且 `execute_xan_pipeline` 入口会**因别人取消过而拒绝启动** | §4:per-run `Arc<AtomicBool>` |
| 2 | `App.tsx` `isExecuting` | 应用级布尔 | 所有标签页的 Execute/`Ctrl+R`/面板动作一起置灰;取消按钮出现在所有标签页 | §5:按 tabId 派生 |
| 3 | `useUIState` 的 `branchProgress`/`showProgressBar`、`useLogs` 的 `logs`、chart 三兄弟 | 应用级单例 | 后跑的标签页覆盖先跑的进度与图表;日志交错无归属 | §5.4:按 tabId(runId)路由 |
| 4 | `useExecution` 的 `pendingRunRef` / `variablePrompt` / `overwriteConfirm` | 单槽 | 第二个标签页点执行会**顶掉**第一个待确认的会话 | §5.5:按 runId 排队 |
| 5 | `useBatchFilter`/`useBatchConvert` 的 `getCurrentTab()` | 运行时读当前标签页 | 运行中切页 → 批处理拿到**别的标签页**的输入文件/分隔符 | §5.2:改为读会话快照 |
| 6 | `runPipeline` 入口 `set_pipeline_cancelled(false)` | 每次开跑重置全局取消 | 「取消 A 后立刻开 B」会把 A 的取消**擦掉**,A 继续跑 | §4:取消标志随 run 生命周期,不再被别的 run 重置 |

> 注: 第 4 项与第 6 项是**当前就可能踩到的隐性 bug**(单标签页下也会发生:取消后快速重跑),并发化会把它放大成常态问题,故一并列为必修。

---

## 4. 后端改造:从全局取消到 per-run 取消

### 4.1 取消注册表

`pipeline.rs` 用一个进程内注册表替换单例标志:

```rust
static RUN_FLAGS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();

fn run_flags() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> { /* get_or_init */ }

/// 开跑时登记,返回本次运行专用的标志
pub(crate) fn register_run(run_id: &str) -> Arc<AtomicBool> {
  let flag = Arc::new(AtomicBool::new(false));
  run_flags().lock().unwrap().insert(run_id.to_string(), Arc::clone(&flag));
  flag
}

/// 运行结束(成功/失败/取消/panic 收尾)注销,防泄漏
pub(crate) fn unregister_run(run_id: &str) {
  run_flags().lock().unwrap().remove(run_id);
}

#[tauri::command]
pub fn cancel_pipeline(run_id: String) {
  if let Some(flag) = run_flags().lock().unwrap().get(&run_id) {
    flag.store(true, Ordering::SeqCst);
  }
}
```

### 4.2 签名变更

| 命令 | 现在 | 改为 | 说明 |
|------|------|------|------|
| `execute_xan_pipeline` | `(commands, input_file, input_table, default_delimiter, max_output_bytes)` | 增 `run_id: String` | 入口用 `let cancel_flag: Arc<AtomicBool> = register_run(&run_id);`,并把 `cancel_flag` **按值/按 `Arc`** 传进 `run_duckdb_chain` / `run_duckdb_pipeline`（`&'static AtomicBool` → `Arc<AtomicBool>`）。结束（含所有 `?` 提前返回）用 RAII 守卫 `RunGuard` 注销。 |
| `set_pipeline_cancelled` | `(cancel: bool)` | **保留但语义收窄**（见下） | 兼容外呼；或直接删除，视 §10 Q3 |
| `cancel_pipeline`（新增） | — | `(run_id: String)` | 前端「取消」改调这个 |

**清理不能靠「正常路径都记得注销」** —— 用 RAII：

```rust
struct RunGuard(String);
impl Drop for RunGuard { fn drop(&mut self) { unregister_run(&self.0); } }
```

在 `execute_xan_pipeline` 里 `let _guard = RunGuard(run_id.clone());`，任何提前返回/取消/panic 都会注销。

### 4.3 关于 `set_pipeline_cancelled` 的取舍

现状 `runPipeline` 每次开跑都 `set_pipeline_cancelled(false)`（`runPipeline.ts:124`）——在全局单例下，这是唯一的「重新武装」方式，但同时会擦掉别的运行。改成 per-run 后：

- **`execute_xan_pipeline` 不再需要入口的 `if cancelled` 提前返回**（新 run 的标志恒为 `false` → 删掉 `pipeline.rs:189-197` 这段）。
- **前端不再调用 `set_pipeline_cancelled(false)`**（`runPipeline.ts:124` 删除）。
- 建议**保留 `set_pipeline_cancelled` 命令但改为「取消所有正在运行的 run」**（遍历注册表逐个 `store(true)`），作为「全部停止」的兜底入口（P1 可在托盘/菜单暴露），并在文档里写明语义变化；**不保留**「全局置回 false」的能力（那正是 bug 源）。倾向：**P0 直接删除该命令**，减少歧义（开放问题 Q3）。

### 4.4 并发安全复核（后端）

| 关注点 | 现状 | 结论 |
|--------|------|------|
| 子进程 | 每次 `execute_xan_pipeline` 独立 `Command::spawn` | ✅ 天然隔离 |
| `spawn_blocking` | tokio 阻塞线程池，默认上限 512 | ✅ 并发几个 pipeline 无压力；但**注意**：`pipeline_seq`/多命令流水线内部会 `thread::spawn` 若干 I/O 线程，标签页多时线程数线性增长，见 §7 |
| 临时文件 | `TEMP_FILE_COUNTER` 原子自增，名字含 `pid`+序号（`pipeline.rs:837-851`） | ✅ 已为并发设计，文件名不会撞 |
| `load_config()` | 每次执行读一次配置 | ✅ 只读 |
| DuckDB 串联脚本 | `build_duckdb_chain_sql` 用 `std::env::temp_dir()` + **固定**表名 `_easycsv_step_N`（`tabular.rs:487-533`） | ✅ **已复核(2026-09-30)**:`CREATE TEMP TABLE` 是**连接级**对象,而每个 run 都是独立的 `duckdb -c` 子进程 → 固定名不会跨 run 冲突,**无需加 `run_id` 后缀**。唯一共享的是 `temp_directory`(溢写目录),DuckDB 自行唯一化文件名;**P2 已做**:`run_duckdb_chain` 为每个 run 建独立溢写目录(`TempDir::create("EasyCsv_duckdb_spill_<pid>_<runId>")`)并写进脚本的 `SET temp_directory`,进程结束后由 RAII 删除;建目录失败时回退系统临时目录,不阻塞执行 |
| 输出文件 | 由前端 `output` 参数决定 | ✅ **已处理(P1)**:起跑前检测其他活跃标签页写同一路径并弹确认(`reason: "crossTab"`),见 §7.3 |

---

## 5. 前端改造:执行状态按标签页隔离

### 5.1 新状态模型

把 `App.tsx` 的 `isExecuting` 替换为一张按标签页索引的表（建议落在一个 `useExecutionRegistry()` 里，`App.tsx` 只消费）：

```ts
const [runs, setRuns] = useState<Record<string /*tabId*/, RunSession>>({});
const runsByRunId = useRef<Map<RunId, RunSession>>(new Map());

const isTabExecuting = (tabId: string) =>
  runs[tabId]?.state === "running" || runs[tabId]?.state === "preparing";

const anyExecuting = Object.values(runs).some(
  (r) => r.state === "running" || r.state === "queued",
);
```

| 消费点 | 现在 | 改为 |
|--------|------|------|
| `MainMenu` 的「执行」按钮（`MainMenu.tsx:562-581`） | 全局布尔置灰;运行中变 `⟳ 执行中`(结构变化) | 改为**标签页菜单**(§5.6):菜单行按状态给「分支 x/y + 取消」/「待确认」;**按钮不再置灰、运行中不改结构** |
| 命令面板 `execute` 动作（`App.tsx:1487`） | 全局 | `isTabExecuting(selectedTabId)` |
| `Ctrl+R`（`useKeyboardShortcuts.ts:79-85`） | 全局 | `isTabExecuting(selectedTabId)` |
| `HomeView` 取消按钮（`HomeView.tsx:783`） | 全局 | 仅当前标签页在跑时显示，取消目标是当前标签页的 runId（§5.3） |
| 完成系统通知（`useAppBootstrap.ts:130-141`） | 由全局布尔下降沿触发 | 改为**按 run 结束事件**触发，文案带标签页名（§5.3） |

> `anyExecuting` 只用于**全局弱提示**（例如标题栏/进度条角落显示「另有 N 个标签页在运行」），**不**用于置灰。

### 5.2 `useExecution` 重构:会话快照取代闭包与「当前标签页」

现状 `runPipeline(pending, ...)` 已经通过 `pending.currentTab` 快照了标签页（`runPipeline.ts:31-38`），方向是对的；要补齐三处**运行期回头看当前标签页**：

1. `resolveRunDelimiter()`（`useExecution.ts:100-103`）读 `getCurrentTab()` → 改为**开跑瞬间**把 `delimiter` 写进 `RunSession.snapshot.delimiter`，执行期全部读快照。
2. `useBatchFilter` / `useBatchConvert` 的 `getCurrentTab()`（`useBatchFilter.ts:20`）→ 传入本次 run 的**快照**（`{ inputFile, defaultDelimiter }`），不再是「当前」。
3. `cancelRequestedRef`（`useExecution.ts:95`，全局前端取消标志）→ 改为**每个 run 一个 `AbortController`/`Set<runId>`**，批处理循环通过 `isCancelRequested(runId)` 查询。

`setTabs` 更新时的 `tab.id === selectedTabId`（`runPipeline.ts:130,222` 等）→ 改为 `tab.id === session.tabId`（**必须**，否则运行中切页会把错误写到别的标签页）。

### 5.3 取消语义

```
取消(当前标签页) ──► cancelRun(runId):
  1) 标记本 run 的 AbortController(批处理循环在下一迭代边界退出)
  2) invoke("cancel_pipeline", { runId })     ← 只取消后端这一个 run
  3) 不改动其它 tabId 的任何状态
```

- `handleCancelExecution`（`useExecution.ts:357-367`）从「全局 `set_pipeline_cancelled(true)`」改为「`cancelRun(当前标签页的 runId)`」。
- 通知：run 结束时发系统通知**带标签页名**（「标签页『销售数据』执行完成」），由 run 结束事件驱动，而不是 `isExecuting` 的全局下降沿——否则并发下会漏报/多报。

### 5.4 归属隔离:进度 / 结果 / 日志 / 图表

| 产物 | 现状 | 改为 |
|------|------|------|
| 进度条 `showProgressBar` + `branchProgress`（`useUIState.ts:16-22`，渲染于 `HomeView.tsx:731`） | 单例 | `progressByTab: Record<tabId, { branch, hideTimer }>`；**只渲染当前标签页的**；顶部另给 `anyExecuting` 弱提示（「另有 2 个标签页在运行」） |
| 结果预览 `resultPreview`（`useExecution.ts:122-149`） | 一个数组 + 一个 tabId | `resultPreviewByTab: Record<tabId, ResultPreview[]>`；`HomeView` 取 `resultPreviewByTab[selectedTabId] ?? []`（现有 `resultPreviewTabId` 逻辑升级为 Map） |
| 日志 `logs`（`useLogs.ts`） | 全局扁平流 | 保留单一时间流（日志面板是全局浮动件），但 `LogEntry` 加 **`tabId?: string`**；面板加「仅看当前标签页 / 全部」切换（P0 可只加标签徽标，不做过滤） |
| 图表 `chartConfig/series/headers/showChartPanel`（`useUIState.ts:31-34`） | 单例 | `chartsByTab: Record<tabId, ChartState>`；图表面板显示当前标签页的图，`showChartPanel` 保持全局可见性开关 |
| 变量面板 / 血缘 / 版本 | 已按 tabId 索引或与运行无关 | 不动 |

> **回归红线**:结果预览与图表的「切换标签页即切产物」行为必须保持（这是 2026-09-30 刚修过的 `resultPreviewTabId` 的意图），本次是把它从「1 个槽」扩成「N 个槽」，**不得退回全局**。

### 5.5 两个单槽对话框:排队而不覆盖

`variablePrompt` / `overwriteConfirm` 是**应用级模态**，同一时刻只能显示一个。改为：

```ts
// 可见槽位仍是 1 个,但待确认队列按 runId 排队
const [promptQueue, setPromptQueue] = useState<RunId[]>([]);
const [activePrompt, setActivePrompt] = useState<
  { runId: RunId; kind: "variables"; data: VariablePrompt }
  | { runId: RunId; kind: "overwrite"; data: OverwriteConfirm }
  | null
>(null);
```

- 第二个标签页触发需要确认的执行时，**不覆盖**第一个，而是 `promptQueue.push(runId)`；用户处理完当前项后，从队列取下一个。
- 每条排队项的确认/取消都带 `runId`，写回对应 run（`pendingRuns: Map<RunId, PendingRun>` 取代单槽 `pendingRunRef`，`useExecution.ts:158`）。
- 标签页上显示「待确认」状态（`state === "preparing"`），避免用户切走后忘记还有排队项。

### 5.6 UI 定稿:「执行」按钮 → 标签页菜单

**原型**: `docs/design/prototypes/028/01-execute-tab-menu.html`(整窗,含菜单展开态与标签栏徽标)。

#### 5.6.1 运行中不加图标、不改结构

| | 现状 | 改为 |
|---|------|------|
| 空闲 | `执行` | `执行` |
| 运行中 | `⟳ 执行中`(多一个图标、多一个字 → 按钮变宽) | `执行` —— **文字与尺寸完全不变** |

- 运行中只做两件事,且都**不占布局**:① 文字/底色由主色转中性灰;② 按钮底部一条 **2px 不定进度线**(`::after` 伪元素 + 绝对定位,不新增 DOM、不产生位移)。
- 去掉 `▾` 下拉箭头(定稿):按钮只有「执行」两字。
- **按钮不再置灰** —— 它变成菜单触发器后,运行中照样可点开(去取消、去跑别的标签页)。`Ctrl+R` 与命令面板 `execute` 仍按「当前标签页」判断(§5.1)。
- **与 File / Edit / View / Help 同属菜单栏**(2026-09-30 补齐):任一菜单打开后,鼠标移到别的菜单按钮会**直接切过去**(既有 `hoverMenu`/`toggleMenu` 行为),「执行」同样参与 —— 悬停「执行」切到标签页菜单并收起当前菜单,悬停其它菜单按钮则收起执行菜单;点击才真正展开/收起。
- **五个子菜单尺寸/形状/hover 全对齐**(2026-09-30):面板统一 `w-[180px] p-1 rounded-lg`;21 个菜单项统一 `h-8 px-3 rounded-lg`(此前执行行 `py-2` ≈ 37px、主菜单项 `py-1.5` ≈ 30px 且无圆角,视图菜单是 `rounded-md`);hover 统一 **`hover:bg-accent/60`**(去掉主菜单原来的 `hover:text-foreground` 文字变亮,改成和执行行一致的「只变底色、文字不动」)。菜单行的取消按钮用短文案「取消」(`cancelShort`),标签页名上限 96px 超出截断 + tooltip。
- **删掉 027「置灰的执行」解释 tooltip**(2026-09-30 用户要求,回退 027 §4.2 的这一条):按钮不再包 `Tooltip`,随之清理已无引用的 i18n(`onboardingExecuteNeedsStep` / `onboardingExecuteHint`,以及从未被使用的 `runStateRunning`),并去掉只为 tooltip 服务的 `pointer-events-none`(禁用态恢复 `cursor-not-allowed`)。

#### 5.6.2 菜单结构

```
┌──────────────────────────────────┐
│ A 销售数据      分支 2/3   [取消] │  ← 当前标签页,永远置顶
├──────────────────────────────────┤  ← 小横线分隔
│ B 库存          分支 1/1   [取消] │  ← 其余标签页,顺序同标签栏
│ C 客户              待确认        │
└──────────────────────────────────┘
```

| 行状态 | 行右侧 | 点整行 |
|--------|--------|--------|
| 运行中 | `分支 x/y` + 「取消」 | 切过去(看它) |
| 待确认(`preparing`) | `待确认` 徽标 | 切过去处理对话框 |
| 空闲 / 完成 / 失败 | 无(hover 才浮出一行淡提示) | **切过去并开始执行** |

- **行内不设「执行」按钮**(定稿):点整行即执行,避免在窄菜单里再放一个按钮。
- **唯一保留的按钮是「取消」**,且只取消该行对应标签页的那个 runId(§5.3)。
- **进度只显示「分支 x/y」**(定稿):不显示步骤名、不显示百分比。
- **不做「全部取消」**(定稿):多个标签页同时在跑时逐个停。

#### 5.6.3 与状态模型的关系

- 菜单是 `runsByTab` 的**唯一视图**:置顶行 = `runs[selectedTabId]`,其余行 = 其它 `runs[tabId]`(无条目即空闲)。
- 「点行即执行」= ① `setSelectedTabId(tabId)` ② `handleExecute()`。两步都走现有入口,**不新增执行路径**。
- 「同一标签页不可并发」由菜单自然表达:运行中的行**没有**执行入口(只有取消),因此不需要靠置灰。
- 菜单顺序由「当前标签页 + 标签栏顺序」的**纯函数**派生(可单测,见 §9.2 T9)。

---

## 6. 标签页生命周期

### 6.1 运行中切换标签页

- 允许。切页**不**取消任何运行（这是与现状最大的行为差异）。
- 切到别的标签页时：进度条/结果/图表立即切到该标签页自己的产物（§5.4）；该标签页若无运行则不显示进度条。
- 运行结束的标签页即使不被选中，也要：更新它自己的 `resultPreviewByTab`、写 `step.error` 到**它自己的** pipeline、发完成通知。

### 6.2 运行中关闭标签页

| 场景 | 行为 |
|------|------|
| 关闭**正在运行**的标签页 | 先 `cancelRun(该 tabId 的 runId)` → 后端 kill 子进程 → 再移除标签页；**不弹**额外确认（关闭本身就是强意图），但给一条 Toast「已取消『tab 名』的执行」 |
| 关闭**正在 `preparing`** 的标签页 | 从 `promptQueue` / `pendingRuns` 摘除，静默关闭 |
| 关闭**空闲**标签页 | 现状不变 |

> 现状 `removeTab` 没有任何执行态处理；并发化后**必须**加上，否则会留下无人认领的 `RunSession` 与后台子进程。

### 6.3 会话保存 / 恢复

- `useSession` / `session.rs` **不写**执行态：`runsByTab`、进度、待确认队列全部是内存态。
- 恢复时所有标签页都是空闲态；重启应用不会「继续跑」。
- `stripStepCommand` / `serializeTabSnapshot`（`utils/session.ts`）无需改动（`step.error` 已被吃掉/不持久化，保持现状）。

---

## 7. 并发度与资源

### 7.1 子进程与线程

- 每次 pipeline 执行 = N 个 xan/duckdb 子进程 + 若干 I/O 线程（`pipeline.rs` 的 pipe/stderr 线程）。
- 纯 xan 多命令流水线是**并发子进程**（同时启动、管道串联），单次运行就有多条管道，故「标签页并发数」需要上限，否则标签页一多数十上百个进程。
- **已实现(P1 + P2)**: 默认 **4**,超出进入 `queued`,有空闲额度时自动启动;**上限可在设置页「同时执行的标签页数上限」修改**(1~16,配置项 `max_concurrent_runs`,前端 `useExecution({ maxConcurrentRuns })`,后端 `set_max_concurrent_runs` 落库时再 clamp 一次)。

### 7.2 内存

- 大文件场景内存 = 各运行**峰值之和**。026/025 的实测（`cat rows` 131 MB 输入峰值 8.5 MB；单 sheet 读取峰值 308 MB）是在**单运行**前提下的数字；4 路并发最坏情况≈ 4×单运行峰值。
- 建议：并发上限默认取「保守」值（4），并在设置页给一句说明；**不做**内存探测自动降级（过度工程）。

### 7.3 输出文件冲突

- 两个标签页写同一个 `output` 路径 → 后写覆盖先写。现状的 S6 覆盖确认（`runPipeline.ts:95-99`）只拦**单次运行内的多分支**，不拦跨标签页。
- **建议**: P0 不拦（用户自担）；P1 在启动一个 run 时检查「是否有其他 run 的 `outputPath` 相同」，命中则复用现有覆盖确认对话框语义提示「另一个标签页正在写同一文件」。列入开放问题 Q2。

---

## 8. 实施分期

### P0(最小可用,消除「全局不可用」)

1. 后端：`RUN_FLAGS` 注册表 + `cancel_pipeline(run_id)` + `execute_xan_pipeline` 增 `run_id` + `RunGuard` 注销;删掉入口 `if cancelled` 提前返回;`set_pipeline_cancelled(false)` 调用点删除。
2. 前端：`runsByTab` 状态;`isExecuting(tabId)` 派生;命令面板 `execute` / `Ctrl+R` / 取消按钮改按当前标签页;`handleCancelExecution` 改 `cancelRun(runId)`。
3. 前端：`runPipeline` 的 `setTabs` 全部改 `session.tabId`;`resolveRunDelimiter` 改读会话快照;批处理钩子改读快照;`cancelRequestedRef` 改 per-run。
4. 前端：进度条 + 结果预览改按 tabId（Map）;图表改按 tabId。
5. **UI(§5.6,已定稿)**:`MainMenu` 的「执行」改为**标签页菜单** —— 当前标签页置顶 + 小横线分隔、点行即切过去执行、运行中的行只给「分支 x/y」+「取消」;运行态**不加图标、不改按钮尺寸**(仅转中性色 + 底部伪元素进度线);标签栏补运行徽标;画布进度 pill 下补「另有 N 个标签页在运行」弱提示。原型:`docs/design/prototypes/028/01-execute-tab-menu.html`。
6. 标签页关闭时 `cancelRun`。

### P1(收敛与体验 —— **已实现 2026-09-30**,并发上限固定 4)

7. 并发上限 + `queued` 状态。
8. 日志加 `tabId` + 面板「仅当前标签页」过滤。
9. 对话框 FIFO 排队（若 P0 取「排队但单槽」的简化实现，这里补齐「待确认」徽标与自动推进）。
10. 跨标签页输出文件冲突提示。
11. 菜单行的 hover 提示（「点击执行」）与标签页名过长截断 + tooltip。

### P2(可选 —— **已实现 13,未做 12**)

12. 「全部停止」入口（菜单/托盘）。**未做**。
13. 并发上限设置项（设置页）。**已实现 2026-09-30**: 设置页「同时执行的标签页数上限」数字输入(1~16,默认 4),配置项 `max_concurrent_runs`(config.rs + `get/set_max_concurrent_runs`),`useAppSettings.maxConcurrentRuns` → `useExecution({ maxConcurrentRuns })`。

---

## 9. 回归红线与测试

### 9.1 红线

1. **单标签页行为零变化**:布局、日志、结果、进度 5s 消失、自动存版本、执行历史记录(`saveExecutionHistory`)、血缘追踪(`trackLineage`)全部保持。
2. **分支模型不动**:`buildExecutionBranches` / 批处理判定 / 图表分支 / duckdb 串联一行不改,本设计只在外面套一层会话。
3. **结果预览不得退回全局**:「切换标签页即切产物」必须保持。
4. **取消不得跨标签页**:为这条写一个明确的测试(§9.2 T2)。
5. **临时文件命名不改**(`EasyCsv_duckdb_{pid}_{counter}`)——它已是并发安全的,不要顺手改。
6. **执行历史 / 会话快照结构不改**(`PipelineTab` 不新增需要持久化的执行态字段)。

### 9.2 测试

| # | 类型 | 用例 |
|---|------|------|
| T1 | 后端单测 | `register_run`/`unregister_run` 后注册表为空;`cancel_pipeline(a)` 不影响 `b` 的标志;`RunGuard` 在提前返回路径也注销 |
| T2 | 后端单测 | 两个 run 并发:取消 A 后 A 的子进程被 kill、B 正常产出(可用 `sleep` 型假命令或 mock) |
| T3 | 前端单测 | `isTabExecuting(tabId)` 仅对被运行标签页为真;`Ctrl+R` / 命令面板「执行」按当前标签页生效(不再全局置灰) |
| T4 | 前端单测 | `runPipeline` 在运行中切页后,`step.error` / `resultPreview` 仍写到发起标签页(`session.tabId`) |
| T5 | 前端单测 | 两个标签页各自 `resultPreviewByTab` 互不覆盖;切页取到各自产物 |
| T6 | 前端单测 | 第二个标签页触发变量取值时不覆盖第一个,处理完第一个后自动推进第二个 |
| T7 | 前端单测 | 关闭正在运行的标签页 → 调 `cancel_pipeline(该 runId)` 且不调其它 runId |
| T8 | 回归 | 现有 `commands.test.ts` / `invoke.test.ts` / `BatchFilterHooks.test.ts` / `BatchConvertHooks.test.ts` 全绿(注意:invoke 形状新增 `runId`,这些用例需同步更新 `expect(...toHaveBeenCalledWith)` 的 payload) |
| T9 | 前端单测 | 菜单顺序纯函数:当前标签页恒为第一行、其后紧跟分隔线;切换当前标签页后重排;点非当前行 = `setSelectedTabId` + `handleExecute`;运行中的行只渲染「分支 x/y + 取消」、**不渲染任何执行入口**;「取消」只对**该行** runId 调 `cancel_pipeline` |
| T10 | 前端单测 | 「执行」按钮在 空闲/运行中 两种状态下 **DOM 结构一致**(运行态只加 `data-busy` 与伪元素进度线,不新增图标节点) —— 用结构断言锁住「运行中不加图标」这条定稿 |

> `invoke.test.ts` 与两个 Batch* 测试断言了 `execute_xan_pipeline` 的完整 payload 形状(`BatchFilterHooks.test.ts:108` 等),**加 `runId` 一定会红**,必须在同一提交里更新它们——这是本次唯一的「既有测试必改」项。
> T10 是 UI 定稿的**防回退**断言:一旦有人为了好看又往「执行」按钮里塞一个 spinner 图标,它会直接红。

---

## 10. 开放问题

| # | 问题 | 倾向 |
|---|------|------|
| Q1 | 并发上限? | **已定案:P1 落地为 4**(`MAX_CONCURRENT_RUNS` 常量,`useExecution.ts`);「可在设置里改」仍属 P2 |
| Q2 | 跨标签页输出文件冲突是否拦截? | **已定案:P1 已拦** —— 起跑前检测其他活跃标签页的同一 `output` 路径,复用覆盖确认(`reason: "crossTab"` + `otherTabName`,独立文案) |
| Q3 | `set_pipeline_cancelled` 保留还是删除? | **P0 已删除**,减少「全局取消」这个概念 |
| Q4 | 日志是否按标签页过滤? | **已定案:P1 已落地** —— `LogEntry.tabId` + 面板「仅当前标签页 / 全部」切换 + 每行徽标 |

---

## 11. 附录:涉及文件清单

**后端(`src-tauri/src/`)**

| 文件 | 改动 |
|------|------|
| `pipeline.rs` | `RUN_FLAGS` 注册表、`register_run`/`unregister_run`/`RunGuard`、`cancel_pipeline` 新命令、删 `set_pipeline_cancelled`(或改语义)、`execute_xan_pipeline` 增 `run_id`、删入口取消提前返回、`Arc<AtomicBool>` 贯通 `run_duckdb_chain`/`run_duckdb_pipeline`/`pipeline_seq`;**P2**: `TempDir` RAII 溢写目录 guard + `sanitize_run_id`,`run_duckdb_chain` 收 `run_id` 并使用独立 `temp_directory` |
| `config.rs` | **P2**: `AppConfig.max_concurrent_runs`(读写/落库)+ `get_max_concurrent_runs`/`set_max_concurrent_runs`(落库前 `clamp(1, 16)`) |
| `lib.rs` | `invoke_handler` 注册 `cancel_pipeline`、注销 `set_pipeline_cancelled`(若删) |
| `tabular.rs` | 无需改动。**§4.4 的复核已完成(2026-09-30)**:串联脚本的临时表名虽是固定 `_easycsv_step_N`,但 `TEMP TABLE` 属连接级、每个 run 独立子进程,故并发安全 |

**前端(`src/`)**

| 文件 | 改动 |
|------|------|
| `app/App.tsx` | `isExecuting` → `runsByTab`;命令面板 `execute` 动作改按当前标签页;`useAppBootstrap` 通知改事件驱动;取消回调改 `cancelRun` |
| `hooks/execution/useExecution.ts` | 会话注册表;`pendingRuns: Map<RunId, PendingRun>`;`cancelRun(runId)`;per-run 取消;快照 delimiter;**P2**: `maxConcurrentRuns` prop(默认 4)→ `runLimit` |
| `hooks/useAppSettings.ts` · `components/setting/SettingsTabContent.tsx` · `SettingsDialog.tsx` · `ipc` 装配 | **P2**: `maxConcurrentRuns` 状态/加载/保存 + 设置页数字输入(1~16) + `handleSaveSettings` 调 `set_max_concurrent_runs` |
| `hooks/execution/runPipeline.ts` | 删 `set_pipeline_cancelled(false)`;`setIsExecuting` → 会话状态更新;`setTabs` 全改 `session.tabId`;进度/结果写回按 tabId |
| `hooks/execution/runPipelineDeps.ts` | deps 增加 `runId` / `session`;`setIsExecuting` 换成 `updateRun(runId, patch)` |
| `hooks/execution/executeBranch.ts` | `invoke("execute_xan_pipeline", { ..., runId })`;批处理/图表分支读会话快照而非 `currentTab` 动态值 |
| `hooks/useBatchFilter.ts` / `hooks/useBatchConvert.ts` | `getCurrentTab()` → 会话快照;`isCancelRequested` → 按 runId;invoke 增 `runId` |
| `hooks/execution/useSaveIntermediate.ts` | invoke 增 `runId`(或显式走一个「无会话」路径) |
| `hooks/useUIState.ts` | `branchProgress`/`showProgressBar` → `progressByTab`;chart 三兄弟 → `chartsByTab` |
| `hooks/useLogs.ts` | `LogEntry` 加 `tabId` |
| `hooks/useKeyboardShortcuts.ts` | `Ctrl+R` 守卫改按当前标签页 |
| `hooks/useAppBootstrap.ts` | 完成通知改由 run 结束事件驱动 |
| `components/menu/MainMenu.tsx` | 「执行」改为**标签页菜单**(§5.6):当前标签页置顶 + 小横线、点行执行、运行中的行给「分支 x/y」+「取消」;运行态不加图标、不改尺寸(仅 `data-busy` + 伪元素进度线);去掉 `▾` |
| `modules/data-preview/HomeView.tsx` | 进度条/取消按钮/结果预览按当前标签页;标签栏补运行徽标;可选:全局弱提示 |
| `i18n/translations/{en,zh}/common.ts`(或 `pipeline.ts`) | 菜单新文案:`运行中` / `待确认` / `完成` / `失败` / `分支` / `取消` / `另有 N 个标签页在运行` |
| `types/execution.ts` | `RunSession` / `RunId` / `PromptQueue` 类型 |
| `types/xan.ts` | `LogEntry.tabId?`(不加持久化执行态字段) |
| `__tests__/invoke.test.ts`、`BatchFilterHooks.test.ts`、`BatchConvertHooks.test.ts` | `execute_xan_pipeline` payload 断言补 `runId` |
| `__tests__/` 新增 | T3–T7、T9、T10 用例 |

**文档**

| 文件 | 改动 |
|------|------|
| `docs/AI/INDEX.md` | 登记本设计(§「设计文档」表新增 028 行,**已随本稿完成**);实现落地后再同步「快速索引」的「修改管道执行取消」行为 per-run 说明 |
| `docs/design/prototypes/028/01-execute-tab-menu.html` | **已随本稿产出**:整窗原型(工具栏「执行」运行态 + 标签页菜单展开 + 标签栏运行徽标 + 「另有 1 个标签页在运行」弱提示)。UI 定稿见 §5.6;菜单宽 **240px**(2026-09-30 收窄) |