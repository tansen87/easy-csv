# 打开文件的分隔符自动检测(工作流输入节点)— 设计文档

> 状态: 已实现(2026-09-20)
> 日期: 2026-09-20
> 更新: 2026-09-20 追加 **§3.9 自动检测总开关 + 设置页 ⇄ 输入节点双向同步**,并把 §3.4.3 的「每标签页锁定」改为「全局单一状态」(见 §3.4.3 v2 与 §3.9)
> 关联: `docs/design/017_separate-dialog-ux.md`(§3.4.4 明确把「打开文件整体受益」列为后续项,本文档即其落地)、`docs/design/016_separate-good-bad-rows.md`、`docs/AI/INDEX.md`
> 前置: 017 已实现 —— `probe_csv_file` 后端命令 + `detect_delimiter*` 纯函数 + `useCsvProbe` 前端 hook + `delimiterAuto` / `detectedDelimiter` 等 i18n key 均已存在
> 范围: **仅限「把文件打开进工作流」这条路径**(文件菜单打开 / 新标签打开 / 拖拽 / 最近文件 / 会话恢复)+ 设置页的分隔符控件。拆分对话框、编码转换、双文件对比、数据概况面板未动(见 §6)
> 一句话: 让「打开文件」复用拆分对话框已有的分隔符检测能力,并让**预览与执行使用同一个分隔符**(现在这两处都硬绑全局设置)
> 实现记录(与初版方案的差异,均已回写本文档):①`CsvData` 增加 4 个字段并**向后兼容**(`delimiter` 由 `String` 改 `Option<String>`,`CsvDiffDialog` 传字符串仍可反序列化为 `Some`);②`read_csv_file` 改用 `spawn_blocking`(与 `probe_csv_file` 一致),逻辑抽到同步体 `read_csv_sync` + `resolve_read_delimiter` 便于单测;③i18n 只新增 3 个 key(其余复用 017 已有的 6 个);④`MainMenuHooks` 除 4 处 `execute_xan_pipeline` 外,还同步改了导出脚本的 duckdb `-separator`、导出 `.xanflow` 载荷、2 处 CSV 预览解析和 **Batch Filter / Batch Convert** 的 `defaultDelimiter` prop;⑤**总开关做成了一个 6 项下拉**而非「复选框 + 下拉」(§3.9),因此取消了初版的「每标签页锁定」(`setTabDelimiter` 已删除);⑥新增 Rust 用例 8 条、前端用例 23 条(4 个新测试文件 + 2 条改写);⑦设置页的 `defaultDelimiter`/`onDefaultDelimiterChange` 两个 props 已被 `delimiterMode`/`onDelimiterModeChange` 取代(拆分对话框仍保留前者,语义不受影响)

---

## 1. 背景与目标

017 给「拆分好/坏行」对话框加上了分隔符自动检测:打开对话框即识别文件真实分隔符,并能覆盖全局设置.但**应用的主路径 —— 打开文件进工作流 —— 仍然只认全局设置里的那一个分隔符**.

后果是三条连锁反应:

1. 用 `;` / `\t` 的文件打开后,输入节点显示成一整列(表头后面全是同一列),用户以为文件坏了;
2. 即便用户去设置里把默认分隔符改成 `;`,预览正常了,**执行仍然拿全局值**——因为执行侧的分隔符来自 `settings.defaultDelimiter` 而不是标签页的解析结果(§2.4),于是「所见」与「所跑」可能不一致;
3. 017 提出的「打开文件时先 probe」这条后续项一直没有落地,导致同一份文件在拆分对话框里能识别、在工作流里却识别不了,能力割裂.

### 本次目标

| # | 诉求 | 落地位置 |
|---|------|----------|
| 1 | 打开文件时自动检测分隔符,预览用检测结果读 | §3.3 后端 + §3.4 前端 |
| 2 | 检测结果贯穿执行:管道第一步的 `-d` 用同一个值 | §3.5 |
| 3 | 检测结果**可见、可覆盖**,且与设置页的分隔符控件**双向同步**(一个值、两处显示) | §3.4 / §3.9 |
| 4 | 检测不出时回退全局默认,既有行为零变化 | §3.3 / §3.8 |

### 非目标

- 不新增检测算法:复用 `score_delimiters` / `detect_delimiter_with_fallback`(`csv.rs:1267` / `:1368`),候选集合仍是 `, ; \t | ^` 五个单字节.
- 不改拆分对话框(017 已定稿),也不改 `separate_csv` 的读写逻辑.
- 不做编码 / BOM 检测 —— 已有独立的 `CsvEncodingDialog`.
- 本次**不**顺手改 `CsvDiffDialog` / `CsvEncodingDialog` / `DataProfilePanel` 的分隔符来源(理由见 §6),它们仍用全局默认.
- 不为 i18n 引入插值机制(`t` 是扁平字符串表,`src/i18n/index.tsx`),带数字/分隔符的文案由组件拼接.

---

## 2. 现状分析(基于当前代码)

### 2.1 打开文件的落点只有一个:`useTabs.loadCsvData`

所有「打开文件」的入口最终都汇到 `src/hooks/useTabs.ts:99` 的 `loadCsvData(tabId, filePath, customDelimiter?)`:

| 入口 | 位置 | 调用形态 |
|------|------|----------|
| 文件 > 打开 | `MainMenuHooks.ts:427` → `:440` | `loadCsvData(selectedTabId, file)` |
| 文件 > 在新标签打开 | `MainMenuHooks.ts:444` → `:458` | `loadCsvData(newTabId, file)` |
| 拖拽打开 | `App.tsx:601` | `loadCsvData(selectedTabId, filePath)` |
| 最近文件(含命令面板) | `App.tsx:1021` | `loadCsvData(selectedTabId, filePath)` |
| 导入 `.xanflow` 管道 | `App.tsx:504` / `MainMenuHooks.ts:817` | `loadCsvData(id, inputFile, pipelineData.defaultDelimiter)` |
| 应用管道模板 | `App.tsx:793` | `loadCsvData(id, inputFile, snapshot.defaultDelimiter)` |

这意味着**改动可以收敛到 `loadCsvData` 一处**,六个入口自动受益;而带 `customDelimiter` 的后两个入口天然表达「文件里已经写死了分隔符」(§3.6 会把它当 forced 处理).

### 2.2 分隔符目前只有一个来源:全局设置

```ts
// src/hooks/useTabs.ts:155-163
const delimiter = customDelimiter || defaultDelimiter;   // ← 全局设置兜底
const data = await invoke<{ headers: string[]; rows: string[][] }>(
  "read_csv_file",
  { filePath, delimiter, limit: 31 },
);
```

- 全局值来自 `SettingsTabContent.tsx:181-193`(五个单字节选项)→ `set_default_delimiter`(`config.rs:387`)→ `useAppSettings.ts:9`.
- `defaultDelimiter` 由 `App.tsx:108` 注入 `useTabs`.

### 2.3 `read_csv_file` 不接受「自动」

```rust
// src-tauri/src/csv.rs:41-51
pub async fn read_csv_file(file_path: String, delimiter: String, limit: Option<usize>) -> Result<CsvData, String> {
  let file = File::open(&file_path)...;
  let mut rdr = csv::ReaderBuilder::new()
    .delimiter(delimiter.as_bytes()[0])   // ← 空串会 panic;且无自动能力
    .from_reader(BufReader::new(file));
```

后端**已有**检测能力(`probe_csv_file`),但那是为拆分对话框准备的独立命令,`read_csv_file` 完全没有接上.

### 2.4 执行侧用的是全局分隔符,而不是标签页的

```
App.tsx:688  defaultDelimiter: settings.defaultDelimiter
        │
        ▼
MainMenuHooks 的 4 处 invoke("execute_xan_pipeline", { defaultDelimiter, ... })
   :1126(批量前步骤) · :1206(批量前步骤,另一分支) · :1306(主执行) · :1917(另存中间结果)
        │
        ▼
pipeline.rs:258-263   仅给管道「第一步」加 -d <defaultDelimiter>
```

而标签页上其实**已经存了**自己的分隔符:

```ts
// src/hooks/useTabs.ts:164-177
setTabs(prev => prev.map(tab => tab.id === tabId
  ? { ...tab, data: data.rows, defaultDelimiter: delimiter, headers: data.headers, inputFile: filePath, ... }
  : tab));
```

`PipelineTab.defaultDelimiter`(`src/types/xan.ts:121`)被写入、被 `utils/session.ts:61/88` 持久化、被导出/导入管道携带,但**内存里没有任何地方读取它来做读取或执行**.这是本次要修的第二个点:**让标签页的分隔符真正生效**.

### 2.5 一个会「冲掉」解析结果的副作用

```ts
// src/hooks/useTabs.ts:186-191  —— 全局分隔符变化 or 切换标签页都会重读当前标签
useEffect(() => {
  const currentTab = tabs.find(t => t.id === selectedTabId);
  if (currentTab?.inputFile && isCsvFile(currentTab.inputFile)) {
    loadCsvData(selectedTabId, currentTab.inputFile, defaultDelimiter);  // ← 无条件用全局值
  }
}, [defaultDelimiter, selectedTabId]);
```

两个后果:

- 只要用户改了全局默认,当前标签的分隔符就被全局值顶掉(对「手选过」的标签也一样);
- 切换标签页会重新 `read_csv_file` 一次(这也是会话恢复后能重新出数的原因,不能简单删掉).

引入自动检测后,这个 effect 必须区分「自动模式」与「已锁定模式」,否则用户手选的分隔符会在切换标签时被检测结果覆盖(§3.4.3).

### 2.6 可复用的既有资产

| 资产 | 位置 | 复用方式 |
|------|------|----------|
| `read_head_sample`(只读 64 KiB + 截断处理) | `csv.rs:1188` | 同模块内直接调用,新增零 IO 成本 |
| `detect_delimiter_with_fallback`(含 quoting 兜底) | `csv.rs:1368` | 检测主逻辑 |
| `CsvProbe` / `DelimiterCandidate` | `csv.rs:1142` / `:1130` | 结果表达可参照 |
| `PROBE_SAMPLE_BYTES`(64 KiB)/ `PROBE_SAMPLE_RECORDS`(200) | `csv.rs:1117` / `:1120` | 采样参数沿用 |
| `useCsvProbe`(防抖 + 序号守卫) | `src/hooks/useCsvProbe.ts` | 若选方案 A(前端两步)时复用;方案 B 不需要 |
| i18n `delimiterAuto` / `detectedDelimiter` / `detectConfidence*` / `detectFailed` | `translations.ts:939-947` / `:1526-1533` | 直接复用,仅补少量新 key |

**结论**:需要做三件事 ——(a) 让「读预览」也能自动;(b) 把检测结果变成**标签页状态**;(c) 让执行读这个状态,而不是全局设置.

---

## 3. 方案设计

### 3.1 数据流总览

```
  文件>打开 / 新标签打开 / 拖拽 / 最近文件 / 会话恢复
                    │  （导入管道、应用模板：自带 defaultDelimiter）
                    ▼
        useTabs.loadCsvData(tabId, path, forcedDelimiter?)
                    │
                    │  forcedDelimiter 为空 → 自动检测（delimiter: null）
                    │  forcedDelimiter 有值 → 强制使用（source = forced）
                    ▼
      invoke("read_csv_file", { filePath, delimiter, fallbackDelimiter, limit })
                    │      ▲
                    │      └─ 后端：读 64 KiB → detect_delimiter_with_fallback
                    │               → 用解出的分隔符读表头 + 前 31 行
                    ▼
   CsvData { headers, rows, delimiter, delimiter_source, delimiter_confidence, columns }
                    │
                    ▼
   tab.{ data, headers, defaultDelimiter=解析值, delimiterSource, delimiterConfidence, delimiterMode }
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
  输入节点徽标(可见/可覆盖)    execute_xan_pipeline 的 defaultDelimiter
  「自动检测 | , ; \t | ^」      → pipeline.rs 第一步 -d
```

### 3.2 方案选型:扩 `read_csv_file`(方案 B)

| 方案 | 做法 | IPC/IO | 一致性 | 改动面 | 结论 |
|------|------|--------|--------|--------|------|
| A. 前端两步 | 先 `probe_csv_file` 拿分隔符,再 `read_csv_file` | 2 次 IPC,2 次读文件头 | 两次调用之间文件可能被改动 | 前端 `useTabs` 内串两次 await;后端零改动 | 备选 |
| **B. 扩 `read_csv_file`** | 增加 `delimiter: Option<String>` + `fallbackDelimiter`,返回值带上解析出的分隔符与来源 | **1 次 IPC**,检测复用已读入的头部缓冲 | 预览与「报告的分隔符」**同源**,天然一致 | 后端 +1 参数/+4 返回字段;前端 +1 组状态 | **采用** |
| C. 新增 `read_csv_file_auto` 命令 | 与 B 等价但复制一份签名 | 1 次 | 同 B | 多一个命令,`CsvDiffDialog` 仍走旧命令,两条路要各自维护 | 淘汰 |

选 B 的关键理由:**「用什么分隔符读出来的" 与 "报告给用户的分隔符」必须是同一个决策**.方案 A 里 probe 与 read 是两次独立决策,一旦文件在两次调用之间被改写(或被替换),界面显示的检测结果与表格内容就会脱节;方案 B 把决策与读取放进同一次调用,结构上消除这种可能.

### 3.3 后端:`read_csv_file` 扩展(`src-tauri/src/csv.rs`)

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct CsvData {
  pub headers: Vec<String>,
  pub rows: Vec<Vec<String>>,
  /// 实际用于解析的分隔符(单字节)
  pub delimiter: String,
  /// "detected" | "forced" | "fallback" | "global"
  pub delimiter_source: String,
  /// "high" | "low" | "none"(forced 恒为 high)
  pub delimiter_confidence: String,
  /// 表头列数,供界面展示与「无表头」提示
  pub columns: usize,
}

#[tauri::command]
pub async fn read_csv_file(
  file_path: String,
  delimiter: Option<String>,          // None / 空串 → 自动检测;Some → 强制
  fallback_delimiter: Option<String>, // 检测不出时使用,缺省 ","
  limit: Option<usize>,
) -> Result<CsvData, String>
```

实现要点(伪代码):

```text
1. 读头部样本(复用 read_head_sample,64 KiB):
     (sample, _truncated) = read_head_sample(path)?
     sample 为空 → 保持既有语义(csv 解析报 "Failed to read headers")

2. 解析分隔符决策:
     forced = delimiter.filter(非空).map(first_byte)
     match forced {
       Some(d) → (d, "forced", "high")
       None    → (detect_delimiter_with_fallback(sample, quoting=true, skiprows=0)
                  → Some(d)  → (d, "detected", confidence)
                  → None      → (fallback | ',', "fallback", "none"))
     }

3. 用决策出的 delimiter 打开文件、读表头与 limit 行(逻辑与现状一致)
4. 返回 CsvData{ headers, rows, delimiter, delimiter_source, delimiter_confidence, columns: headers.len() }
```

细节约定:

- **`delimiter` 参数从 `String` 变 `Option<String>` 是向后兼容的**:`CsvDiffDialog.tsx:93-97` 传的是字符串,serde 会正常反序列化成 `Some("…")`;`useTabs.ts:156` 改为传 `null` 即进入自动.
- **顺手修掉 `csv.rs:50` 的 panic 隐患**:现有代码 `delimiter.as_bytes()[0]` 在空串时越界.改为「空/缺失 → 自动检测」,并在最终取值处兜底 `,`.
- **检测成本可忽略**:多读的 64 KiB 与 5 个候选 × 200 条记录的解析都是微秒~毫秒级;`read_csv_file` 本身已按 `limit` 提前 break,大文件不会因此变慢.
- **不做进程外缓存**:检测便宜且要跟文件内容走,按路径缓存反而会在文件被外部修改后给出过期结果.
- **可选(阶段 2)**:把 `quoting_used` 一并从检测结果里取出来,预览也用 `quoting(false)` 读一遍 —— 应对「文件不用引号、字段里裸出现分隔符」(`017 §3.4.2` 的 quoting 兜底场景).本次先不接,原因是它会让预览的引号语义随检测结果漂移,需要先明确交互(§6 已知限制).
- **`probe_csv_file` 保持不变**:拆分对话框继续用它,两条路径共享同一组纯函数即可,不需要互相调用.

### 3.4 前端:标签页状态、模式与重载规则

#### 3.4.1 新增标签页字段(`src/types/xan.ts`)

```ts
export interface PipelineTab {
  // …既有字段…
  /** 解析后的分隔符;沿用既有字段名,兼容 session/管道导入导出 */
  defaultDelimiter?: string;
  /** 本次解析结果的可信度 / 来源 */
  delimiterSource?: "detected" | "forced" | "fallback" | "global";
  delimiterConfidence?: "high" | "low" | "none";
  /** "auto" = 每次读文件都重新检测;具体分隔符 = 锁定值,不再检测 */
  delimiterMode?: "auto" | string;
}
```

`delimiterMode` 是这次的**核心新状态**:它把 017 §3.4.3 的「手选即锁定」约定搬到工作流侧,并由它决定 §2.5 那个 effect 的行为.

#### 3.4.2 `loadCsvData` 的三种来源

```ts
// 读取时决定分隔符:一次性覆盖 > 全局模式 > 兜底
loadCsvData(tabId, filePath, forcedDelimiter?):
  explicit = forcedDelimiter?.trim() ? forcedDelimiter : undefined   // 导入管道 / 模板
  locked   = explicit ?? (autoDetectDelimiter ? undefined : defaultDelimiter)
  发 { delimiter: locked ?? null, fallbackDelimiter: defaultDelimiter }
  拿到 CsvData 后写回 tab:
    data / headers / inputFile(既有)
    defaultDelimiter      = data.delimiter       // 解析值(不是全局值)
    delimiterSource       = data.delimiter_source
    delimiterConfidence   = data.delimiter_confidence
    delimiterMode         = locked ?? "auto"
```

#### 3.4.3 重载规则(修 §2.5)—— v2:全局单一状态

> 初版按「每个标签页各自的 `delimiterMode`」实现;后续按用户反馈改为**全局单一状态**(设置页总开关 ⇄ 输入节点徽标是同一个值,见 §3.9),下表已是 v2 规则。

| 触发 | 行为 |
|------|------|
| 设置页 / 输入节点改变模式(`自动检测` 或某个分隔符) | 两处改的是**同一个状态**;`useTabs` 的重载 effect 随之重读当前标签:auto → 重新检测;锁定 → 直接按该分隔符读 |
| 切换标签页 | 按**当前全局模式**重读(不再有「每个标签各自锁定」的分支,重载与不重载的判定只有一条) |
| 文件被外部修改 | 下次重载(切标签 / 重新打开)时自动跟上 |
| 用户点「自动检测」 | `autoDetectDelimiter = true`,当前标签立即以 `delimiter: null` 重读 |
| 用户选某个分隔符 | `autoDetectDelimiter = false` + `defaultDelimiter = <选中值>`,当前标签立即以该值重读,`delimiterSource = "forced"` |
| 导入 `.xanflow` / 应用模板 | 携带的分隔符作为**本次读取**的一次性覆盖生效;之后的任何重载都回到全局模式 |

> 这条规则顺带修掉了两个既有小毛病:①用户手选/导入的分隔符会在切换标签时被全局值顶掉;②改全局设置时手选的标签也会被顶掉。现在两处永远一致,不存在「谁顶掉谁」。

**取舍(已与用户确认)**:代价是**不再有「单标签页锁定」**。用户在任一入口选了具体分隔符,所有标签页都按它读(检测随之关闭);要回到「每个文件各自识别」,把两处任意一个切回「自动检测」即可。这换来了「设置页与输入节点永远显示同一个值」这一可预测性。

#### 3.4.4 噪音控制

**实现说明**:首版计划里还有一条 toast,实际只保留 `addLog("info", …)`(与文件打开路径上其它提示一致:`useTabs` 里非 CSV 提示、读失败提示都是日志)。文案为英文硬编码(该文件既有日志均如此):

```
Auto-detected delimiter ";" for sales.csv
```

- 检测结果 **≠ 全局默认** → 打开时写一条 info 日志(附 `delimiterLabel` 转义后的分隔符与文件名),不弹 toast;
- 检测结果 **= 全局默认** → 完全静默(绝大多数文件走这条路,不该有打扰);
- `confidence === "low"` → 徽标圆点转琥珀色 + `title` 含 `t.detectConfidenceLow`;
- `source === "fallback"` → 徽标显示全局默认值 + `title` 含 `t.detectFailed`,圆点也为琥珀色。

### 3.5 执行一致性(核心修复)

`src/hooks/MainMenuHooks.ts` 里 4 处 `execute_xan_pipeline` 调用改为读**当前标签页的解析值**:

```ts
// helper 放在 MainMenuHooks 内部(getCurrentTab 之后)
const resolveRunDelimiter = useCallback(
  () => getCurrentTab()?.defaultDelimiter || defaultDelimiter,
  [getCurrentTab, defaultDelimiter],
);

// 4 处调用点(批量前步骤 ×2、主执行、另存中间结果)
await invoke("execute_xan_pipeline", { commands, inputFile, defaultDelimiter: resolveRunDelimiter(), ... });
```

这样 `pipeline.rs:258-263` 给第一步加的 `-d` 就与预览同源,「所见即所跑」成立。注意 `getCurrentTab()` 已在同一 hook 内可用(`useTabs` 透传),无需新增依赖。

**实现时一并改了(超出原方案的「可选」范围)**,因为它们同样「作用于当前打开的文件」,不改就会留下同类不一致:

- `BatchFilterHooks` / `BatchConvertHooks` 的 `defaultDelimiter` prop 改为 `resolveRunDelimiter()`;
- 导出 `.xanflow` 载荷的 `defaultDelimiter`(:735)改为 `resolveRunDelimiter()`,使「导出→导入」重放出同一读取;
- 导出 `.sh/.ps1` 脚本时 duckdb 步骤的 `-separator` 改为 `exportDelimiter = resolveRunDelimiter() || ","`;
- `handleExecute` 内 2 处「解析 pre-batch 输出 / 原始文件生成预览」的 `defaultDelimiter || ","` 也一并改为 `resolveRunDelimiter() || ","`。

### 3.6 各入口的最终行为(scope 边界)

| 入口 | 本次行为 | 备注 |
|------|----------|------|
| 文件 > 打开 / 新标签打开 / 拖拽 / 最近文件 | **自动检测** | 六个入口共用 `loadCsvData` |
| 导入 `.xanflow` | 用文件里携带的 `defaultDelimiter` 完成**本次**读取(`source = forced`),不重新检测 | 导出侧写的就是当时解析值,重放结果稳定;之后的任何重载回到全局模式(§3.4.3) |
| 应用管道模板 | 同上 | `PipelineTemplate.snapshot.defaultDelimiter` |
| 会话恢复 | 若持久化了 `delimiterMode: "auto"` → 重新检测;否则按持久化值锁定 | 老会话缺 `delimiterMode` → 视为锁定(向后兼容,行为与现状一致) |
| 拆分好/坏行对话框 | 不变 | 017 已独立处理 |
| CSV 对比 / 编码转换 / 数据概况 | 不变,仍用全局默认 | 见 §6 已知限制 |
| 非 CSV 文件(`.xlsx` / `.json` / `.parquet`) | 不检测,走既有「请用 from 命令转换」提示 | `isCsvFile`(`useTabs.ts:12`)判断不变 |

### 3.7 界面:输入节点上的分隔符徽标(方案对比)

| 方案 | 位置 | 优点 | 缺点 |
|------|------|------|------|
| A. 仅提示(不改 UI) | 打开时 toast + 日志 | 成本最低 | 检测错了无从修正,只能回设置页改全局 |
| **B. 输入节点徽标 + 下拉** | `TableNode.tsx:193-231` 表头行 | 就在「看得见数据」的地方,一眼可见 + 一键覆盖;与拆分对话框体验对齐 | 节点表头已较拥挤(重命名 Select + rows/cols 文案 + 保存/删除),需精简 |
| C. 顶部工具栏 / 状态栏 | `MainMenu.tsx` | 不挤节点 | 与输入数据的关联弱,多标签时不易判断是哪个文件 |

**采用 B**,最终实现是一个**点击展开的紧凑徽标**(节点表头已经有重命名 Select + rows/cols 文案 + 保存/删除,常驻一个下拉会挤掉重命名框):

```text
┌ ●Input Data ─ [列重命名 ▾] ────────────────────────── [ ; ●] ─ 5 rows × 3 cols ─ ✓ ─ ✕ ┐
                                                        ↑ 徽标:分隔符 + 来源圆点(锁定夹锁图标)
   点击徽标 → 原位换成 [自动检测 ▾] 下拉,选完即收起并重载
```

- **徽标**(`button`):等宽字体显示分隔符本身(`delimiterLabel`:`\t` 显示为 `\t`),尾部一个 6px 圆点表示来源/置信度 —— 绿 = detected & high,琥珀 = detected & low 或 fallback,灰 = 已锁定;锁定时圆点前多一个 `Lock` 图标;
- **`title`** 承载完整说明:`本文件分隔符: ; · 已识别为 · 置信度高`(锁定/兜底时改为省略「已识别为」,分别显示「已锁定」「未能识别分隔符,已使用默认值」);
- **展开后的控件**:与设置页**完全同一个组件** —— `src/components/ui/DelimiterModeSelect.tsx`(6 项:`t.delimiterAuto` + `, ; \t | ^`);值取**全局模式**(`App` 传入),选择后立刻收起徽标并回调 `onDelimiterChange`(即 `App.onDelimiterModeChange`,与设置页走同一条路径);
- 未读文件(或非 CSV 文件)时 `delimiter === undefined` → **不渲染徽标**;
- `TableNodeData` 增加 `delimiter` / `delimiterMode` / `delimiterSource` / `delimiterConfidence` / `onDelimiterChange`;**注入点在 `FlowPanel` 的布局 effect 里**(`withPosition.type === "tableNode"` 时合并这几个字段),而不是改 `getLayoutedElements` 的签名 —— 这样 `panel/utils/layout.ts` 与 `layout.test.ts` 完全不用动;回调走 `onDelimiterChangeRef`,与同文件其它回调一致;
- 链路:`App.tsx`(`onDelimiterModeChange` → 改全局两个设置 + 即时落库)→ `HomeView`(`delimiterMode` / `onDelimiterChange`)→ `FlowPanel` → `TableNode`;设置页走 `SettingsDialog` → `SettingsTabContent` → 同一个 `DelimiterModeSelect`。

**可选增强(未做)**:`MainMenu` 文件菜单加一项「重新检测分隔符」—— 任一入口切回「自动检测」已等价覆盖,故不加。

### 3.8 边界与失败行为汇总

| 场景 | 行为 |
|------|------|
| 空文件 | 与现状一致:读表头失败 → `Failed to read headers`(检测返回 none,不影响) |
| 单列文件(检测不出) | `source = fallback` → 用全局默认;徽标提示「未能识别分隔符…」 |
| 检测结果与全局默认不同 | 自动采用检测值 + 一次 info 日志/提示,并**不修改全局设置** |
| 检测结果与全局默认相同 | 静默;徽标正常显示 |
| 脏文件(016 验收数据:`age,name,gender` + `1,tom,man` / `2` / `2.1` …) | 靠表头 3 列判出 `,`,`confidence = high`(`017 §3.4.2` 已单测覆盖) |
| 表头/正文都是单列 | `none` → 全局默认,行为与今天完全一致 |
| 预览遇到列数不齐的行 | 既有行为不变:`read_csv_file` 用默认(刚性)reader,坏行会报 `Failed to read row` → 走 `addLog("error")`;检测不改变这一点(可选增强见 §6) |
| 用户选了某个分隔符后切换文件 | 所有标签页都按该分隔符读(全局模式);把任一入口切回「自动检测」即恢复逐文件识别 |
| 导入管道 / 应用模板 | 用携带值(forced)完成**本次**读取,不检测;其后重载回到全局模式 |
| 老会话恢复(无 `delimiterMode`) | 按全局模式读,与 `delimiterMode` 无关(该字段现在只是「上次是怎么读的」记录) |
| 切换标签页 | 按当前全局模式读(auto → 检测;锁定 → 直接用该分隔符) |
| 非 CSV 文件 | 不检测,走既有提示分支 |

### 3.9 设置项:自动检测总开关 + 与输入节点双向同步(**已实现**)

> 实现状态(2026-09-20 追加):按用户要求落地,并且**在形态上做了简化** —— 不是「复选框 + 分隔符下拉」两个控件,而是**一个 6 项下拉**,把总开关做成了下拉的第一项。理由见下方「为什么不做成两个控件」。

**形态**:设置页的「分隔符」控件与输入节点徽标展开的控件是**同一个组件** `src/components/ui/DelimiterModeSelect.tsx`:

```text
分隔符  [自动检测 ▾]        ← 总开关:开 = 打开文件时逐文件识别
        [Comma (,)  ]
        [Semicolon (;) ]
        [Tab (\t)   ]
        [Pipe (|)   ]
        [Caret (^)  ]       ← 选任一项 = 关闭检测,所有文件都按它读
```

**状态与持久化**(沿用 `no_headers` 的既有模式):

```rust
// src-tauri/src/config.rs —— 与 no_headers 完全同构
pub auto_detect_delimiter: Option<bool>,   // 默认 Some(true)
#[tauri::command] pub async fn get_auto_detect_delimiter() -> Option<bool>
#[tauri::command] pub async fn set_auto_detect_delimiter(enabled: bool) -> Result<(), String>
```

- `default_delimiter` **保持不变**:永远是具体分隔符(检测关闭时使用,也是检测失败时的兜底),所以 `DataProfilePanel` / `CsvDiffDialog` / 拆分对话框等既有消费者零改动(它们不会收到 `"auto"` 这种非分隔符值)。
- 两个设置 ⇄ 一个界面值的换算只写在 `src/utils/delimiterMode.ts` 里:`delimiterModeFromSettings(autoDetect, delimiter)` 与 `settingsPatchForMode(mode)`。**这是「两处不会漂移」的结构保证**。

**双向同步**:两处控件都通过 `App.tsx` 的同一个 `onDelimiterModeChange` 改同一个状态:

```ts
// App.tsx
const delimiterMode = delimiterModeFromSettings(settings.autoDetectDelimiter, settings.defaultDelimiter);
const onDelimiterModeChange = (mode) => {
  const patch = settingsPatchForMode(mode);            // auto → { autoDetectDelimiter: true }
  if (patch.delimiter !== undefined) settings.setDefaultDelimiter(patch.delimiter);
  settings.setAutoDetectDelimiter(patch.autoDetectDelimiter);
  invoke("set_auto_detect_delimiter", { enabled: patch.autoDetectDelimiter });  // 即时落库
  if (patch.delimiter !== undefined) invoke("set_default_delimiter", { delimiter: patch.delimiter });
};
```

- 输入节点徽标选 `;` → 状态变「锁定 `;`」→ 设置页的控件立刻显示 `Semicolon (;)` ✔
- 设置页选「自动检测」→ 状态变 auto → 输入节点徽标的控件立刻显示 `Auto-detect`,且当前标签以 `delimiter: null` 重读 ✔
- **即时落库**:这两个字段一旦改动会立刻重读当前标签并影响后续打开,所以不等设置页的 Save 按钮,直接 `invoke` 持久化(设置页 Save 仍会再写一次,幂等)。

**为什么不做成「复选框 + 下拉」两个控件**:那样会出现两个真值来源 —— 在输入节点选 `;` 时到底该不该关掉全局检测?设置页改动下拉时又该不该动复选框?两处控件很容易表达出不同的组合。合并成一个 6 项下拉后,**「一个值、两处显示」天然成立**,也正好对应「总开关」的语义:自动检测 = 开,选具体分隔符 = 关。

**代价(接受)**:选具体分隔符时无法再单独保留一个「自定义兜底分隔符」——因为检测已关闭,兜底值本身不再有意义(检测失败只会发生在开启检测时,此时兜底固定为先前存储的 `default_delimiter`,默认 `,`)。

### 3.10 两个取舍的最终结论

| 取舍 | 最终采用 | 说明 |
|------|----------|------|
| 检测时机 | **由总开关决定** | 开(默认)= 每次打开都检测;关闭 = 一律按所选分隔符读。曾考虑「只在全局分隔符切出单列时才检测」,因漏掉 `a;b,c`(全局值也切出多列、只是切错了)而放弃 |
| 引用一致性 | **本期不接 `quoting_used`** | 预览与检测可能对「含裸分隔符的脏文件」判断不同;留在 §6/§8 作为后续可选 |

### 3.11 i18n key(`src/i18n/translations.ts`,en/zh + 类型声明三处同步)

复用既有(017 已加,无需新增):`delimiterAuto` / `detectedDelimiter` / `detectConfidenceHigh` / `detectConfidenceLow` / `detectFailed`,以及设置页的 `csvDelimiter` / `selectDelimiter`。

**实际新增 3 个**:

| key | en | zh |
|-----|----|----|
| `delimiterForThisFile` | Delimiter for this file | 本文件分隔符 |
| `delimiterModeLocked` | Locked | 已锁定 |

未采用的 3 个及原因:`delimiterDetectedForFile`(徽标改用既有 `detectedDelimiter` 拼接)、`delimiterModeAuto`(直接复用 `delimiterAuto`)、`reDetectDelimiter` / `autoDetectDelimiter`(总开关做成了下拉第一项,复用 `delimiterAuto`,未做文件菜单项)。

> `t` 无插值:徽标的 `title` 由组件拼接 —— `${t.delimiterForThisFile}: ${分隔符} · ${t.detectedDelimiter} · ${置信度}`(锁定/兜底时省略「已识别为」)。

### 3.12 风险与取舍

| 风险 | 缓解 |
|------|------|
| 检测误判(单列文件含分隔符、两候选并列) | 置信度分级 + 徽标一键覆盖 + 设置总开关;误判最坏只是显示错,用户改一下分隔符即恢复 |
| 误把全局模式从 auto 改成具体分隔符(检测随之关闭) | 两处控件都显式显示当前模式(下拉里看得见 `Auto-detect`),锁定时徽标带锁图标;改回 `自动检测` 即恢复 |
| 每次打开多读 64 KiB | 与文件大小无关;`read_csv_file` 本就要开文件,合并在同一次调用内;关闭检测后连这 64 KiB 也不读 |
| 执行侧改动影响既有流程 | `resolveRunDelimiter()` 在标签页无解析值时回落到全局默认,老会话/老管道行为不变;由 §5 的用例锁住 |
| 徽标挤压节点表头 | 常驻态是紧凑按钮(分隔符 + 圆点/锁),完整文案放 `title`;展开时才占用 150px 的下拉宽 |

---

## 4. 影响面(实际改动)

| 文件 | 改动 |
|------|------|
| `src-tauri/src/csv.rs` | `CsvData` 增加 `delimiter` / `delimiter_source` / `delimiter_confidence` / `columns`;`read_csv_file` 的 `delimiter` 改 `Option<String>` 并新增 `fallback_delimiter`,内部新增 `resolve_read_delimiter`(强制 → 检测 → 兜底)与同步体 `read_csv_sync`,复用 `read_head_sample` + `detect_delimiter_with_fallback`;命令体改走 `spawn_blocking`;修掉空分隔符 `as_bytes()[0]` 的 panic;新增 8 条单测 |
| `src/hooks/useTabs.ts` | `loadCsvData(tabId, path, forcedDelimiter?)`:第三参 = 一次性覆盖(导入/模板);否则按**全局模式**决定(autoDetectDelimiter ? 检测 : 锁定 `defaultDelimiter`)。写回 `defaultDelimiter`(解析值)/`delimiterSource`/`delimiterConfidence`/`delimiterMode`;重载 effect 依赖 `[defaultDelimiter, autoDetectDelimiter, selectedTabId]`(§3.4.3);检测值 ≠ 全局默认时写一条 info 日志 |
| `src-tauri/src/config.rs` / `lib.rs` | 新增 `AppConfig.auto_detect_delimiter`(默认 `true`)+ `get/set_auto_detect_delimiter` 两个命令并注册(命令数 56 → 58) |
| `src/hooks/useAppSettings.ts` | 新增 `autoDetectDelimiter` 状态 + `loadAutoDetectDelimiter()`(并入 `loadAll`) |
| `src/components/ui/DelimiterModeSelect.tsx`(新增) | **设置页与输入节点徽标共用的分隔符控件**(6 项:自动检测 + 5 个分隔符),这是「两处永远一致」的结构保证 |
| `src/utils/delimiterMode.ts`(新增) | `delimiterModeFromSettings` / `settingsPatchForMode`:设置形态 ⇄ 界面单一值的唯一换算处 |
| `src/components/setting/SettingsTabContent.tsx` | 分隔符区块改用 `DelimiterModeSelect`(`delimiterMode` / `onDelimiterModeChange`),新增 `t.delimiterModeDesc` 说明;「恢复默认」同时把模式复位为 auto |
| `src/components/setting/SettingsDialog.tsx` | props 由 `defaultDelimiter`/`onDefaultDelimiterChange` 换成 `delimiterMode`/`onDelimiterModeChange`,透传给内容面板 |
| `src/hooks/MainMenuHooks.ts` | 新增 `resolveRunDelimiter()`;4 处 `execute_xan_pipeline`、导出 `.xanflow` 载荷、导出脚本 duckdb `-separator`、2 处 CSV 预览解析、`BatchFilterHooks`/`BatchConvertHooks` 的 `defaultDelimiter` prop 全部改用当前标签解析值(§3.5) |
| `src/types/xan.ts` | 新增 `DelimiterSource` / `DelimiterMode` / `CsvReadResult`;`PipelineTab` 增加 `delimiterSource` / `delimiterConfidence` / `delimiterMode` |
| `src/utils/session.ts` | 快照序列化/反序列化带上上述三个字段;老会话(无 `delimiterMode`)按持久化的 `defaultDelimiter` 锁定,保持原行为 |
| `src/components/panel/nodes/TableNode.tsx` | `TableNodeData` 增加分隔符字段与 `onDelimiterChange`;表头行新增「分隔符徽标 → 点击展开 Select」;`useLanguage()` 提到组件顶部 |
| `src/components/panel/FlowPanel.tsx` | props 增加分隔符字段;在布局 effect 内把分隔符状态合并进 `tableNode` 的 data(不改 `layout.ts` 签名);新增 `onDelimiterChangeRef`;effect deps 增加 4 个分隔符字段 |
| `src/components/HomeView.tsx` | props 与 `FlowPanel` 透传新增的 5 个分隔符属性 |
| `src/App.tsx` | 新增 `onDelimiterChange`(`useCallback` → `tabsHook.setTabDelimiter(selectedTabId, mode)`),把当前标签的分隔符状态与回调传给 `HomeView` |
| `src/i18n/translations.ts` | 新增 §3.11 的 2 个 key(`delimiterForThisFile` / `delimiterModeLocked`,en/zh + 类型声明共 3 处) |
| `src/__tests__/invoke.test.ts` | `read_csv_file` 2 条用例改为新参数形态(自动检测 / 强制值) |
| `src/__tests__/useTabsDelimiter.test.ts`(新增) | 6 条用例(§5) |
| `src/__tests__/TableNodeDelimiter.test.tsx`(新增) | 5 条用例(§5) |
| `docs/AI/INDEX.md` | `csv.rs` 模块行、`read_csv_file`(模块详情 + 命令表)说明补自动检测;设计文档表补 016/017/018 行(并修掉一行缺失的表格竖线);`useTabs.ts`/`MainMenuHooks.ts`/`TableNode.tsx` 职责行补充;测试文件表补 2 个新文件;速查表补「修改打开文件的分隔符检测」 |
| `docs/design/017_separate-dialog-ux.md` | §3.4.4「本次不做」的后续项标注已由 018 落地 |
| 未改 | `panel/utils/layout.ts` 与 `layout.test.ts`(徽标数据在 FlowPanel 侧合并);其余入口(数据概况 / CSV 对比 / 编码转换)按 §6 仍用全局默认 |

---

## 5. 测试计划(已落地)

### 后端(`src-tauri/src/csv.rs`,**8 条新用例**,`cargo test --lib` **59 passed**)

1. `read_csv_auto_detects_the_delimiter`:`delimiter = None` + `;` 文件 → `delimiter == ";"`、`source == "detected"`、`confidence == "high"`、`columns == 3`、表头/首行内容正确。
2. `read_csv_forced_delimiter_skips_detection`:逗号内容 + `Some(";")` → `source == "forced"`,**不被样本改判**(`columns == 1`、`headers == ["a,b"]`)。
3. `read_csv_empty_delimiter_falls_back_to_detection`:`Some("")` 视同自动且**不 panic**(回归 `csv.rs` 原 `as_bytes()[0]` 越界隐患)。
4. `read_csv_falls_back_when_detection_is_inconclusive`:单列文件 → `source == "fallback"`、`confidence == "none"`,显式 `fallback` 生效;不传时等于 `,`。
5. `read_csv_delimiter_matches_probe_csv_file`:`,` / `;` / `\t` / 单列四种文件,`read_csv_sync` 与 `probe_csv_sync` 的 `delimiter` 与 `columns` **完全一致**(两条路径同源)。
6. `read_csv_rejects_ragged_rows`:列数不齐 → `Failed to read row`(把 §6 的刚性预览限制**固化为用例**,将来改 `flexible(true)` 时会显式失败)。
7. `read_csv_honours_the_row_limit`:`limit: 0` 只取表头、`limit: 2` 取 2 行、不传时默认上限——保护 `CsvDiffDialog` 的既有调用。
8. `read_csv_reports_a_missing_file`:错误文案与既有 `Failed to open` 一致。

### 前端(`vitest`,**23 条新用例 / 4 个新文件 + 2 个改写**,全量 **319 passed / 22 files**)

- `invoke.test.ts`(2 条改写):自动路径断言 `read_csv_file` 收到 `{ filePath, delimiter: null, fallbackDelimiter: ",", limit: 31 }`;强制路径收到具体分隔符。
- `useTabsDelimiter.test.ts`(6 条,`renderHook` + mock 后端按「forced > detected > fallback」回答案):
  1. 自动检测开启 → 发 `delimiter: null`;写回 `defaultDelimiter = ";"`、`delimiterMode = "auto"`、`delimiterSource = "detected"`;且**检测值 ≠ 全局默认时**写一条 info 日志;
  2. 检测值 = 全局默认 → 不写该日志;
  3. 自动检测关闭 → 一律发 `delimiter: "|"`(配置值),`delimiterSource = "forced"`,**不发 `null`**;
  4. 模式变化(等价于在设置页或徽标上改)→ 当前标签立即重读:锁 `|` 时发 `"|"`,切回 auto 时发 `null`;
  5. 导入管道传入的分隔符 → 本次读取用它;
  6. 非 CSV 文件 → 不触发 `read_csv_file`,走既有提示。
- `delimiterMode.test.ts`(新增 6 条):`delimiterModeFromSettings`(开关开 → `auto`;开时忽略具体值;关 → 具体值;空值兜底 `,`)与 `settingsPatchForMode`(`auto` 只开开关、具体值关开关并写入)+ **六种模式的往返一致性**(这条锁住「设置页与输入节点不会漂移」)。
- `SettingsDelimiterControl.test.tsx`(新增 6 条,渲染真实 `SettingsTabContent`):开关开时显示 `Auto-detect`、关时显示 `Semicolon (;)`;下拉恰好是 6 项且顺序固定;选 `Pipe (|)` / 选 `Auto-detect` 回调值正确;「恢复默认」把模式复位为 `auto`。
- `TableNodeDelimiter.test.tsx`(5 条,`ReactFlowProvider` + `LanguageProvider` 包裹):未读文件不渲染徽标;渲染分隔符与 `title`(含「已识别为 · 置信度高」);fallback 显示「未能识别分隔符…」、锁定显示「已锁定」;点击徽标展开共用的分隔符控件并回调 `"|"`;可回到 `"auto"`。
- 回归:`npx tsc --noEmit` 干净;`cargo test --lib` 59 passed;既有用例全绿(合计 319)。

### 手工验收

1. 准备 `a;b;c` 的 `;` 文件、保持默认「自动检测」:打开 → 表格 3 列、徽标显示 `;` 且为绿点,`hover` 显示「本文件分隔符: ; · 已识别为 · 置信度高」;
2. 同文件挂一个 `filter` 步骤执行 → 日志中的命令带 `-d ;`,结果正确(修 §2.4);
3. **正向同步**:在输入节点徽标里选 `,` → 表格退回 1 列;打开设置页 → 分隔符一栏显示 `Semicolon` 之外的值即 `Comma (,)`;
4. **反向同步**:在设置页选「自动检测」→ 关闭设置页 → 徽标控件显示 `Auto-detect`,且表格回到 3 列;
5. 关闭检测(选 `;`)后重启应用 → 设置里仍是 `Semicolon (;)`(即时落库生效);
6. 拖拽 / 最近文件 / 新标签打开同样文件 → 各入口结果一致。

---

## 6. 已知限制

- **其它入口仍用全局分隔符**:`DataProfilePanel`(`App.tsx` 传 `settings.defaultDelimiter`)、`CsvDiffDialog`、`CsvEncodingDialog`、`BatchConvertHooks` 均未接入检测.这会造成「表格预览是 `;`、数据概况按 `,` 统计」的视觉不一致;若接受范围扩张,建议作为下一份文档(019)统一处理.
- **没有单标签页锁定**(§3.4.3 v2 的取舍):分隔符是全局状态,任一处选了具体分隔符,所有标签页都按它读。要「每个文件各自识别」,把任一入口切回「自动检测」。
- 「自动检测」开启时无法单独指定「检测失败时的兜底分隔符」——兜底值固定在最近一次存储的 `default_delimiter`(默认 `,`)。因检测失败只发生在文件近似单列时,兜底值本身几乎不影响结果。
- 检测只看**前 64 KiB / 前 200 条记录**(`017 §6`).文件前部与后部分隔符不一致时,只反映前部.
- 「无表头」设置(`noHeaders`)对检测无影响:检测始终把第一条记录当表头信号(与 `016` / `017` 的语义一致);若将来做「无表头 + 自动检测」,判定规则需要重新设计.
- 检测候选固定为 `, ; \t | ^`,不含空格、`\x1f` 等(理由见 `017 §6`).
- **预览的刚性解析**:`read_csv_file` 用默认(非 flexible)reader,列数不齐的行会让整次读预览报错.016/017 侧的拆分是 `flexible(true)` 的,所以「拆分能处理、预览打不开」这个组合仍存在;如需要,可在本命令上加 `flexible(true)`(会显示参差行,需同步调整列宽逻辑)——本期不做.
- `quoting_used` 未接入预览(§3.10),「字段里裸出现分隔符」的文件可能出现检测说 `;`、预览按引号解析的差异;此时徽标的置信度提示与手动覆盖是兜底手段.
- 分隔符检测**不使用文件名/扩展名**(`017 §3.4.2` 的刻意取舍),所以 `.tsv` 里放逗号文件时按内容判定.

---

## 7. 实施顺序(已完成)

1. ✅ **后端**:`read_csv_file` 扩展(`Option<String>` + `fallback_delimiter` + 4 个返回字段)+ `resolve_read_delimiter`/`read_csv_sync` 复用检测纯函数 + 8 条单测;`cargo test --lib` **59 passed**。
2. ✅ **前端数据流**:`useTabs` 的全局模式解析/重载规则 + `types/xan.ts` + `utils/session.ts` 持久化 + `MainMenuHooks` 执行侧改用标签解析值;补 `invoke.test.ts` 与 `useTabsDelimiter.test.ts`。
3. ✅ **界面**:`TableNode` 徽标 + 点击展开共用控件 + `FlowPanel` 数据合并 + `HomeView`/`App.tsx` 接线 + i18n;新增 `TableNodeDelimiter.test.tsx`。
4. ✅ **设置项**:`AppConfig.auto_detect_delimiter` + `get/set_auto_detect_delimiter`(命令数 56 → 58)+ `useAppSettings` + 设置页改用共用控件 + **与输入节点双向同步**(`utils/delimiterMode.ts` 负责换算,`App.onDelimiterModeChange` 负责即时落库);新增 `delimiterMode.test.ts`、`SettingsDelimiterControl.test.tsx`。
5. ✅ **文档**:更新 `docs/AI/INDEX.md`(`csv.rs`/`read_csv_file`/config 命令/`useTabs`/`MainMenuHooks`/`TableNode`/设置页职责行、设计文档表、测试文件表、速查行 ×2)与 `017 §3.4.4` 的后续引用。

验证结果:`cargo test --lib` **59 passed**;`npx tsc --noEmit` 无错;`npx vitest run` **319 passed / 22 files**。

## 8. 后续可选项(未做,按需再提)

| 项 | 说明 |
|----|------|
| 统一其它入口 | §6:让 `DataProfilePanel` / `CsvDiffDialog` / `CsvEncodingDialog` 也吃同一份解析值(建议作为 019) |
| 预览容忍参差行 | 给 `read_csv_file` 加 `flexible(true)` + 列宽逻辑适配,与 016 的拆分语义对齐 |
| `quoting_used` 接入预览 | §3.10 |
| 文件菜单「重新检测分隔符」 | 徽标/设置页的「自动检测」已等价覆盖,故未做 |
| 扩展候选分隔符 | 空格 / `\x1f` 等(`017 §6` 的既有取舍) |
