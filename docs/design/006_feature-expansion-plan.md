# 功能扩展设计（以管道执行体验为核心）

> 基于 `docs/AI/INDEX.md`(2026-09 核对)与代码实测,识别 Easy CSV 可新增的功能方向。
> 与既有文档分工:
>
> - 画布交互 → `canvas-ux-optimization.md`
>
> - 架构与工程化 → `architecture-engineering-optimization.md`
>
> - `feature-and-ui-roadmap.md` 已列出的方向(AI 流式输出、图表报表、批量队列、快捷键面板、空状态、主题清理)**不在本文重复展开**;其中该文档仅在优先级行提及但无方案的"中间结果预览、管道模板"两项,本文补充完整设计。
>
> 每个功能给出:现状核对(实测证据)→ 价值 → 方案 → 验收清单。

***

## 1. 现状核对(实测)

| 能力       | 现状                                                                           | 证据                                                                       |
| -------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 执行结果展示   | `ExecutionResult` 仅 `output: String`(整段 stdout),进入 `LogPanel` 纯文本日志;无结构化表格预览 | `pipeline.rs:37-45`、`LogPanel.tsx`(仅文本渲染)、全项目无 ResultTable/resultPreview |
| 单步/部分执行  | 不存在;只能整条管道执行                                                                 | 无 `handleStepRun`/`executeSingle` 相关代码                                   |
| 管道参数化    | 不存在;所有参数硬编码在步骤里                                                              | `types/xan.ts` 无 variable/parametrize 概念                                 |
| 管道模板     | 不存在;仅有"导入/导出管道 JSON"                                                         | 无 template 相关代码                                                          |
| 文件变化自动重跑 | 不存在                                                                          | 无 watch/FsWatch/onFileChange                                             |
| 执行日志持久化  | `useLogs` 纯内存 `useState`,重启即失                                                | `useLogs.ts`(全文 26 行,无 save/load)                                        |
| 导出脚本     | 已支持 `.sh`/`.ps1`(含用法注释)                                                      | `MainMenuHooks.ts:335-374`                                               |
| 多文件输出    | `to` 命令已支持 html/json/jsonl/md/ndjson/npy/txt/xlsx                            | `commands.ts:3315-3326`                                                  |

***

## 2. 功能清单

### F1. 执行结果表格预览(P0)

**现状**:执行成功后,用户在浮动日志面板里看一整段 CSV 文本,列宽错乱、无表头高亮、不可复制单列,超过一定行数还可能卡顿。想看结果通常还得手动加 `output` 步骤写文件再打开。

**价值**:管道编辑器的核心闭环是"搭 → 跑 → 看结果 → 调",结果展示是最高频路径,当前体验最薄弱。

**方案**(已落地为「画布结果节点」形态,而非单独结果面板):

1. 新增 `ResultTableNode`(画布节点,样式对齐 `TableNode`/输入数据表格):执行成功后把成功分支的 `output` 解析为 headers + rows,以**只读表格节点**追加到画布右侧(`getLayoutedElements` 之后注入 `resultTableNode`),不影响既有节点;
2. 解析:`utils/csv.ts` 的 `parseCsvString`(带引号处理);前端每节点行数上限 500,超限标 `truncated` 并提示用 `output`/`to` 步骤导出完整数据;
3. 截断保护:`execute_xan_pipeline` 新增可选 `max_output_bytes`(前端传 2MB),Rust 出口按字节截断(字符边界安全),防止超大 stdout 拖垮 WebView;
4. 结果节点标题栏提供:复制为 CSV、复制为 Markdown 表格、关闭(X);多分支管道按分支各出一个节点(以分支步骤链命名),同一次执行失败/取消不生成节点,新一次执行清除旧结果;
5. 数据链路:`MainMenuHooks` 新增 `resultPreview` 状态(每成功分支一条)→ App → HomeView → FlowPanel 注入节点,流水线数据变化时节点保留(可单独关闭)。

**验收清单**:

- [x] 执行成功后画布右侧出现只读结果表格节点(表头 + 行数上限提示);

- [x] 10MB 级 stdout 不卡顿(2MB 截断 + 500 行解析上限生效);

- [x] 复制 CSV / 复制 Markdown 可用;

- [x] 失败/取消时不出现节点,新一次执行清除旧结果,与现有日志行为一致;

- [x] 暗色/亮色主题下表格样式正常(仅用主题变量,无硬编码色值)。

### F2. 单步调试:运行此步骤 / 运行到此步骤(P0)

**现状**:调参时只能整条管道重跑。上游 10 步都对,只想验证第 11 步的 `filter` 表达式,也要全量执行。

**价值**:调试效率的核心抓手;与 F1 联动后,"运行到此步骤 → 看结果"就是完整的调试闭环。

**方案**:

1. `PipelineStepNode` 悬浮操作区(已有悬浮按钮基建)增加 ▶ 按钮,右键菜单同步加"运行到此步骤";
2. 复用 `buildExecutionBranches` 的 DFS 结果,截取"输入节点 → … → 目标步骤"子链构建参数,`execute_xan_pipeline` 本身支持任意命令序列,后端**零改动**;
3. 执行期间目标步骤节点显示 running 态(依赖 canvas-ux 3.1 的节点状态,可先行用高亮描边过渡);
4. 结果直接进 F1 的画布结果预览节点;
5. 快捷键:选中节点后 `Ctrl+Enter` 运行选中步骤(先查 `KeyboardShortcuts.ts` 冲突表)。

**验收清单**:

- [ ] 任意步骤可"运行到此步骤",结果与整管道执行到该步一致(用固定 CSV 对拍);

- [ ] 分支管道中只执行目标步骤所在分支;

- [ ] 执行中可取消,行为与整管道一致;

- [ ] 选中未连接输入的步骤运行时给出明确错误提示(双语)。

### F3. 管道参数化:变量与运行时输入(P1)

**现状**:所有参数值写死在步骤里。同一管道换个文件、换个列名、换个阈值,只能改步骤或复制整条管道。

**价值**:让管道从"一次性手工品"变成"可复用的加工函数",是模板(F4)与批量复用的前置。

**方案**(集代码实测的落地设计,2026-09 补充):

> 前提核对:命令表单均为**自定义组件**(`commands/*.tsx`),每个参数是裸 `<input>`,无法低成本全局注入提示;执行的分发有多个分支(`batch-filter`/`chart`/常规管道),且 `serializeStepParams` 与 `handleSavePipeline` 各自序列化。据此定稿:

1. **语法与识别**:参数值支持 `{{变量名}}` 占位,识别正则 `/\{\{\s*([A-Za-z_]\w*)\s*\}\}/g`;变量名为字母/数字/下划线。
2. **隐式声明 + 自动检测**:用户只需在参数里写 `{{name}}` 即视为声明(无需单独建变量步骤),系统扫描整条管道收集引用到的变量并推断类型(string/number/path)。新增纯逻辑 `utils/params.ts`:

   - `collectVariablesFromPipeline(steps, existing)` → 合并「检测到的引用」与「面板声明的默认值/类型」;

   - `inferVariableType(default)` → path(含 `/` `\` 或扩展名 like `.csv`) / number(`isFinite`) / string;

   - `resolveStepPlaceholders(steps, values)` → **深克隆**解析后的步骤(不写回 tab,保持占位符原样存留)。
3. **变量面板**:右侧抽屉(与版本/血缘面板同构图,`HomeView` 右侧 `w-80` 悬浮层),集中展示当前管道已检测/声明的全部变量,支持编辑默认值与类型;底部可手动新增变量。
4. **执行门控(单一收口点)**:`MainMenuHooks.handleExecute` 校验通过后、分发到各分支**之前**,对 `executableSteps` 统一扫描引用变量:

   - 取「本次运行值」= **已声明默认值**(`PipelineTab.variables[].defaultValue`)——声明默认值是唯一数据源(`runVariableValues` 覆盖逻辑已移除,避免「面板改了不生效」);确认弹窗填写的值会**写回**声明默认值,实现弹窗与面板双向同步;

   - 存在未赋值(值为空)的变量 → 弹出一次性 `VariableValuesDialog`(默认值可改,批量填完再执行);

   - 全部已赋值 → 跳过对话框,直接解析执行;

   - 解析后的深克隆步骤供给后端命令序列、`batch-filter`、`chart` 等所有分支使用,**存储中的占位符不变**。
5. **序列化 roundtrip**:`StoredPipelineStep.parameters` 原样保留占位符字符串,旧 JSON 导入不受影响(占位符只是普通字符串);`PipelineVariable[]` 挂在 `PipelineTab.variables`,并随 `utils/session.ts` 的 tab 快照与版本快照(`usePipelineVersions.saveVersion/restoreVersion`)一起存取,默认值即变量的当前值。
6. **导出脚本位置参数**:`handleSavePipeline` 按首次出现顺序收集管道引用变量,`.ps1` 翻译为 `$args[0]`/`$args[1]`…,`.sh` 翻译为 `$1`/`$2`…,Usage 注释同步标注(如 `# Usage: ./script.sh [input.csv] [var=name] [var=limit]`),已有 `$INPUT` 位置参数优先占 `$1`、其余变量依次后移。
7. **表单** **`{{`** **提示(全量命令表单)**:通过 `CommandFormWrapper` 的**事件委托**(input/focusout 委托 + 定位 tooltip)统一注入提示,覆盖全部 `commands/*.tsx` 命令表单(含 `MultiValueInput` 的值输入),无需逐个改动裸 `<input>`;独立的列操作对话框(`FilterDialog` 文本值 / `ReplaceDialog` 替换值 / `SplitDialog` 自定义分隔符、连接符)用共享 `<VariableHint>` 组件接入。提示在输入含 `{{` 时显示,失焦隐藏。
8. **范围限定**:第一期仅参数值级变量,不做表达式级(即 `{{var}}` 只出现在参数输入框,不进入 moonblade 表达式),避免与表达式语法冲突。

**验收清单**:

- [x] 含 `{{var}}` 的管道保存/恢复/版本控制 roundtrip 无损;

- [ ] 执行时未赋值变量弹出收集对话框,默认值可改;

- [ ] 导出脚本后用位置参数运行成功(Windows PowerShell + bash 各验一次);

- [ ] 不含变量的管道行为与现状完全一致(回归)。

**落地状态**:数据模型 `PipelineVariable` + `PipelineTab.variables/runVariableValues` 已定稿并接入序列化;`utils/params.ts` 已落地;执行门控/变量收集对话框/右侧变量面板/导出位置参数翻译已接线;`{{` 提示已通过 `CommandFormWrapper` 事件委托全量覆盖命令表单,并在列操作对话框用 `<VariableHint>` 接入。

### F4. 管道模板库(P1)

**现状**:roadmap 优先级行提及但无方案。现状只能整管道导入导出 JSON,无"保存为模板 → 新标签页套用"的链路,常用管道(如"去空行 → 按列去重 → 排序导出 xlsx")每次重搭。

**价值**:降低重复劳动,也是新用户上手素材。

**方案**:

1. 存储复用 `storage.rs` 的 SQLite 模式(新增 `pipeline_templates` 表:id/name/description/snapshot/tags/created\_time),与版本控制(`PipelineVersion`)的快照序列化复用 `utils/session.ts`;
2. 入口两个:

   - 主菜单"另存为模板"(当前管道 → 模板,含变量声明后与 F3 天然联动);

   - 空画布/命令面板"从模板新建"(`CommandPalette` 已有 action 体系,加模板分组);
3. 模板管理对话框:重命名、删除、导出/导入 `.ecsv-template.json`(与现有管道 JSON 导入导出共用对话框);
4. 内置 3\~5 个官方模板(去重清洗、分组统计、编码转换+导出),随 `resources/` 分发,只读展示;
5. 新命令:`save_pipeline_template`/`load_pipeline_templates`/`delete_pipeline_template`(后端模式与 `save_pipeline_versions` 一致)。

**验收清单**:

- [ ] 保存 → 套用 → 执行,结果与原管道一致;

- [ ] 模板跨会话持久(重启后仍在);

- [ ] 模板导出/导入文件可互通;

- [ ] 命令面板可搜索模板并一键新建标签页;

- [ ] 全部 UI 文案中英双语。

### F5. 输入文件监听 + 手动/自动重跑(P2)

**现状**:输入 CSV 更新后必须手动重新执行;若管道是"看板"性质(如监控某导出文件),体验断裂。Tauri 已引入 `plugin-fs`,具备 watch 基础。

**价值**:面向"持续监控/清洗"场景,把工具从"跑一次"升级为"跟着数据走"。

**方案**:

1. 画布顶部加监听开关(默认关):开启后经 Tauri fs watch 输入文件,变化(防抖 500ms)后:

   - 默认弹 toast "输入已变化,重新执行?"(点击执行);

   - 设置里可选"自动重跑"(需执行历史 ≤ N 秒内无失败才自动,失败自动停);
2. 结果预览(F1)与日志联动刷新;表格预览显示"最近一次执行时间 + 数据 mtime";
3. 安全边界:自动重跑仅限单文件输入管道;执行中又变化则排队最后一次;应用失焦/最小化到托盘时暂停自动重跑(避免后台风暴);
4. 复用 `load_profile_cache` 已有的 mtime 判断思路。

**验收清单**:

- [ ] 输入文件保存后 1 秒内出现提示/自动执行;

- [ ] 连续多次快速保存只触发一次执行(防抖有效);

- [ ] 执行失败自动停止监听并明确提示;

- [ ] 托盘最小化状态下不触发自动重跑。

### F6. 执行历史与日志持久化(P2)

**现状**:`useLogs` 纯内存,重启全丢;无法回答"上次跑这个管道是什么时候、改了什么、结果多少行"。版本控制只存管道结构,不存执行记录。

**价值**:为结果追溯和"改了哪步导致失败"提供依据,与版本控制形成"结构历史 + 执行历史"互补。

**方案**:

1. SQLite 新表 `execution_history`(id/tab\_id/pipeline\_snapshot\_hash/version\_id/status/duration/rows/output\_summary/started\_at),每次执行成功后写入,LRU 保留最近 200 条(参照 profile 缓存上限模式);
2. 不存完整 stdout(体积风险),只存统计摘要(行数/列数/字节数/前几行预览);
3. 入口:日志面板头部加"历史"按钮 → 弹窗列表(时间/状态/耗时/关联版本),点击查看摘要;
4. 与 F3/F4 联动:模板套用后历史自动归属新 tab。

**验收清单**:

- [ ] 重启后可查看最近执行记录(≤200 条);

- [ ] 记录关联版本号(若执行时管道已保存版本);

- [ ] 数据库体积可控(单条记录 < 10KB);

- [ ] 清除历史入口进设置页"学习数据管理"同区块。

***

## 3. 与既有 roadmap 的边界

| roadmap 提及      | 处理                                  |
| --------------- | ----------------------------------- |
| 中间结果预览(P1 行内提及) | 本文 F1+F2 覆盖(结果面板 + 运行到此步骤即天然获得中间结果) |
| 管道模板(P1 行内提及)   | 本文 F4 补全方案                          |
| 批量执行/队列         | roadmap 2.3,不重复;F3 参数化是其前置          |
| AI 流式输出         | roadmap 2.1,不重复                     |
| 数据校验/schema 推断  | roadmap P2,不重复                      |

***

## 4. 优先级与依赖

| 优先级    | 功能        | 依赖                          |
| ------ | --------- | --------------------------- |
| **P0** | F1 结果表格预览 | 无;建议先做,后续功能都向它输出            |
| **P0** | F2 单步调试运行 | F1(结果展示);后端零改动              |
| **P1** | F3 管道参数化  | 无硬依赖;序列化需回归测试               |
| **P1** | F4 模板库    | F3(模板含变量更有价值,但可先无变量落地)      |
| **P2** | F5 文件监听重跑 | F1(结果刷新);Tauri fs watch     |
| **P2** | F6 执行历史   | 无;建议与 F4 同批(同是 SQLite 新表模式) |

**建议批次**:

1. 第一批:F1(含 Rust 端截断保护)→ F2,打通"跑 → 看"闭环;
2. 第二批:F3 → F4,管道从手工品变资产;
3. 第三批:F5、F6,视前两批反馈排期。

***

## 5. 通用约束(沿用项目约定)

1. 所有 UI 走 i18n 双语(`i18n/translations.ts`),颜色用主题变量;
2. 新快捷键(`Ctrl+Enter` 等)先查 `KeyboardShortcuts.ts` 冲突表;
3. 结构变更走 `onStepsChange`/`onEdgesChange` 保证撤销栈一致;F3 变量赋值属运行时输入,不入撤销栈;
4. 新增 Tauri 命令同步更新 `lib.rs` 的 `invoke_handler` 注册与 INDEX.md 命令清单;
5. 新增纯逻辑(占位符解析、stdout → CsvData 解析、历史摘要计算)进 `utils/` 并补 `src/__tests__/` 用例,与 `versionDiff.test.ts` 规范一致。

