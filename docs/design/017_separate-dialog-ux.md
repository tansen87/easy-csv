# 拆分好/坏行 对话框体验优化(文件信息 / 上次结果 / 分隔符自动检测)— 设计文档

> 状态: 已实现(2026-09-20)
> 日期: 2026-09-20
> 关联: `docs/design/016_separate-good-bad-rows.md`(本功能基线设计:拆分算法 + streaming)、`docs/AI/INDEX.md` → 新增后台命令 / 修改拆分对话框 / 修改国际化文本
> 前置: 016 已实现(含 2026-09-20 的 streaming 大文件方案)
> 实现记录(与初版方案的差异,均已回写本文档):①新增 `CsvProbe.quoting_used`、`DelimiterCandidate.header_fields`;②`SeparateResult` 增加 `elapsed_ms`;③并列时的实际裁决顺序是「主导字段数 → 约定优先级」;④表头/预览一律按**调用方的 `quoting`** 解析(只有检测过程本身可能回退),保证界面显示与拆分结果同源;⑤打开对话框只恢复**上次结果**,不自动回填上次的运行选项(避免「上次开了 streaming 就一直开着」);⑥i18n key 以 §3.5 的最终表为准;⑦**移除扩展名加成**(初版给 `.csv/.tsv/.psv` 各 +6,实测按扩展名加权会压掉正确候选,现只按内容打分)。

---

## 1. 背景与目标

016 把「拆分好/坏行」的能力做完了,但对话框的交互仍停留在「手填参数 + 点按钮」的水平,实际用起来有三处摩擦:

1. **看不到文件长什么样**:选定文件后界面没有任何反馈,不知道第一行有几列、表头是什么,只能先跑一次再靠结果反推。
2. **结果用完即弃**:一旦关闭对话框,`*_good.csv` / `*_bad.csv` 的路径、好/坏行数全部消失(见 §2.1),想对照或去输出目录看看都得重跑一次,也没有「什么时候跑完的」这个信息。
3. **分隔符只能去设置里改**:对话框的分隔符完全跟随全局设置(`settings.defaultDelimiter`),遇到 `;` / `\t` 文件必须先关掉对话框、进设置页改、再回来重开,**上下文被切断**。

本次目标:

| # | 诉求 | 落地位置 |
|---|------|----------|
| 1 | 打开文件时显示第一行的列数(并与检测结果互相印证) | §3.2 |
| 2 | 关闭对话框后重新打开,仍能看到上一次的输出结果与完成时间 | §3.3 |
| 3 | 增加分隔符检测并**自动应用**,顺带提供「设为默认」 | §3.4 |

### 非目标

- 不改动拆分算法、`flexible(true)` 读写与 streaming 流式实现(016 已定稿)。
- 不做编码/BOM 检测——已有独立的 `CsvEncodingDialog`。
- 不为 i18n 引入插值机制(`t` 目前是扁平字符串表,`src/i18n/index.tsx:46`);带数字的文案由组件自行拼接。
- 本次不把分隔符检测推广到应用其它入口(打开文件/数据概况/双文件对比),理由与方案见 §3.4.4。

---

## 2. 现状分析(基于当前代码)

### 2.1 对话框的重入行为:`src/components/dialog/SeparateCSVDialog.tsx`

```ts
// :41-51  状态
const [inputFile, setInputFile] = useState("");
const [delimiter, setDelimiter] = useState(",");
const [quoting, setQuoting] = useState(true);
const [streaming, setStreaming] = useState(false);
const [result, setResult] = useState<SeparateResult | null>(null);   // ← 结果只活在本次打开期间

// :53-56  任何字段变更都会清掉结果
const clearFeedback = useCallback(() => {
  setError(null);
  setResult(null);
}, []);

// :58-70  每次打开都整体复位
useEffect(() => {
  if (isOpen) {
    setInputFile(initialInputFile || "");
    setDelimiter(defaultDelimiter || ",");   // ← 分隔符只来自全局设置
    ...
    setResult(null);                          // ← 结果被清空,这就是诉求 2 的根因
    setError(null);
  }
}, [isOpen, initialInputFile, defaultDelimiter]);
```

两个关键事实:

- 组件本身**不会卸载**(`App.tsx:1714-1720` 始终渲染 `<SeparateCSVDialog isOpen={ui.showSeparateCsv} …/>`,内部 `if (!isOpen) return null`),所以 React state 天然能跨「关闭→重开」存活;真正清空结果的是上面那个 `isOpen` 复位 effect。
- 结果面板在 `:325-352` 渲染 `result.good_path` / `bad_path` / `good_rows` / `bad_rows`,**没有时间字段**,`SeparateResult`(`src-tauri/src/csv.rs:738`)也没有任何时间信息。

### 2.2 分隔符只有一个来源:全局设置

- 设置页:`src/components/setting/SettingsTabContent.tsx:176-197`,`Select` 选项为 `,` `;` `\t` `|` `^`(五个单字节分隔符)。
- 持久化:`config.rs:387 set_default_delimiter` → SQLite `app_config`;前端 `src/hooks/useAppSettings.ts:15-25` 读取。
- 对话框仅通过 props 接收:`App.tsx:1718 defaultDelimiter={settings.defaultDelimiter}`。
- 全局改动会触发当前标签页重载数据(`src/hooks/useTabs.ts:185-191`),所以「顺手改一下全局默认」有副作用,不能当作对话框的临时切换手段。

结论:对话框需要一个**自己的分隔符控件**(默认走自动检测),并在用户愿意时再显式写回全局默认。

### 2.3 缺少「文件信息」通道:备选方案对比

| 方案 | 第一行列数 | 分隔符检测 | IPC/IO 成本 | 结论 |
|------|-----------|-----------|-------------|------|
| A. 复用 `read_csv_file(path, delimiter, limit: 0)` | ✅(headers.length) | ❌ | 只读一条记录,很轻 | 检测仍要另想办法;两次 IPC 才能拼出信息 |
| B. 新增 `probe_csv_file`(一次采样返回列数 + 表头 + 检测结果 + 预览) | ✅ | ✅ | 一次 IPC,只读 64 KiB | **采用** |
| C. 前端用 `@tauri-apps/plugin-fs` 读文件再自己解析 | ✅ | ✅ | 需要把整个文件读进 JS 内存 | 大文件直接崩,淘汰 |

方案 B 与 016 的 streaming 思路一致:**只读文件头部固定字节数**,与文件总大小无关。

---

## 3. 方案设计

### 3.1 交互总览

```
┌ 拆分好/坏行 ───────────────────────────────────────────────────────────── ✕ ┐
│ 输入      [D:\data\sales.csv                        ] [打开]                 │
│           ✓ 第一行: 6 列 · 表头 id | name | age | city | qty | amount        │
│           分隔符 [自动检测 ▾]  已识别为「;」(样本 200 条,置信度 高)          │
│                              [设为默认分隔符]                                │
│ 输出目录  [D:\data                                  ] [打开]                 │
│ 期望列数  [留空 = 自动(6)        ]   跳过前 N 行 [0]                         │
│ ☑ 启用引号   ☐ 流式(大文件)                                [开始拆分]        │
│ ──────────────────────────────────────────────────────────────────────────── │
│ ✓ 上次拆分 · 完成于 2026-09-20 08:12:33 · 耗时 0.4s                          │
│   好行 12(6 列) · 坏行 3 · 输入 sales.csv · 分隔符「;」                      │
│   D:\data\sales_good.csv                                                     │
│   D:\data\sales_bad.csv                      [打开路径] [清除记录]           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 需求 1:第一行列数 + 表头预览

**时机**:选定/改变输入文件后 250 ms 防抖触发 `probe_csv_file`;`skiprows`、`quoting`、分隔符模式变化同样触发(它们都会影响「第一行」是哪一行、怎么切分)。

**展示**(输入文件行下方一行小字,不新增区块、不撑高对话框):

- `第一行: N 列`——`N = probe.columns`,即应用 `skiprows` 之后第一条记录的字段数,与拆分时 `expected_columns` 的自动取值**完全同源**(拆分侧 `separate_stream` 的 `expected = 表头列数`,见 `csv.rs:839`)。
- 表头预览:`probe.header` 前 8 个字段,超出以 `…` 收尾,单行省略号截断。
- 与「期望列数」联动:输入框为空时,placeholder 显示 `留空 = 自动(N)`;若用户填了值且 ≠ N,补一条提示 `表头 N 列 ≠ 期望 M 列(good 表头将按 M 列截断/补空列)`——这条提示直接对应 016 §3.5 的边界行为,能省掉一次试错。

**失败与边界**:probe 出错(文件不存在、空文件、`skiprows` 后无记录)时,在这一行位置显示红色小字错误,**不阻塞**「开始拆分」按钮;路径为空则只清空该行。

### 3.3 需求 2:上次结果与完成时间

分两层,一起做:

**L1 会话内(必须)**:把结果从「本次打开的临时状态」改为「最近一次成功运行的结果」。

- 结果区数据来源改为 `lastResult`(由 `useState` 持有),`clearFeedback` 只清 `error`、**不再清结果**(顺带修掉「在路径框里打字结果就消失」的毛病),同时把来源标记翻成 `上次拆分`。
- 面板上加来源标记:本次运行完成 → `已完成`;来自上一次运行或输入已改动 → `上次拆分`(`t.lastResult`)。

**L2 跨重启(推荐,成本约 20 行)**:`localStorage` 持久化,键 `easy-csv-separate-last`(命名对齐既有 `easy-csv-language`、主题键)。

```ts
// 新增 src/utils/separateHistory.ts
const KEY = "easy-csv-separate-last";

export interface StoredSeparateResult {
  // 结果
  goodPath: string; badPath: string;
  goodRows: number; badRows: number; expectedColumns: number;
  finishedAt: string;        // ISO 8601,完成后由前端 new Date().toISOString()
  elapsedMs?: number;        // 可选,见下
  // 产生该结果时的输入(供「重跑」与回填)
  inputFile: string; delimiter: string; quoting: boolean;
  skiprows: number; streaming: boolean; expectedColumnsInput: string;
}
export function loadLastSeparateResult(): StoredSeparateResult | null; // 解析失败/超限 → null
export function saveLastSeparateResult(v: StoredSeparateResult): void;
export function clearLastSeparateResult(): void;
```

细节约定:

- **写入时机**:仅在 `invoke("separate_csv")` 成功后写入;失败时保留旧记录不动。
- **完成时间**:前端在 invoke resolve 时取 `new Date()`(ISO 串),展示走既有 `formatDateTime`(`src/utils/format.ts:1`),避免引入新日期库。
- **耗时(可选,推荐)**:`SeparateResult` 增加 `elapsed_ms: u64`(在 `spawn_blocking` 内用 `std::time::Instant` 计时)。它能直观体现 streaming 与否的差异,前端按 `ms < 1000 ? "N ms" : "N.N s"` 展示;TS 侧写成 `elapsed_ms?: number` 以兼容既有测试的 mock。
- **尺寸保护**:单条记录序列化后超过 2 KiB 则不入库(路径异常长时放弃持久化,不报错)。
- **陈旧标记(可选)**:打开时用既有命令 `file_exists`(`storage.rs:291`)检查两个输出路径,任一不存在则在路径旁标 `输出文件已不存在`(`t.lastResultNoOutput`)。
- **打开路径**:结果区 `打开路径` 按钮调用 `reveal_paths([good, bad])`(`storage.rs`),由 `tauri_plugin_opener::reveal_items_in_dir` 在系统文件管理器里定位两份输出文件(Windows 走 `SHOpenFolderAndSelectItems`,一个按钮覆盖两份文件)。后端会跳过已不存在的路径,两份都没了才报错;前端在两份都缺失时把按钮置灰并给出提示。
- **清除**:结果区右下角 `清除记录` 链接,调用 `clearLastSeparateResult()` 并清空展示。
- **输入回填的边界(实现决定)**:打开对话框时只回填**结果**与输入文件(仅当本次没有 `initialInputFile` 时才用上次的),**不**把上次的 `quoting`/`skiprows`/`streaming`/`expectedColumnsInput` 应用到控件——避免「上次为大文件打开过 streaming,之后一直开着」这类隐式遗留;这些字段仍写入记录,供后续「重跑」类功能使用。分隔符也始终从「自动检测」开始(检测不出时才落到全局默认,与旧行为等价)。

### 3.4 需求 3:分隔符检测与自动应用

#### 3.4.1 后端命令 `probe_csv_file`(`src-tauri/src/csv.rs`)

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct DelimiterCandidate {
  pub delimiter: String,    // 以可读形式返回:"," ";" "\t" "|" "^"(便于直接 log/UI 展示)
  pub header_fields: usize, // 首条记录在该候选下的字段数(表头信号)
  pub fields: usize,        // 采样记录中该候选的主导字段数(正文信号)
  pub consistent: bool,     // 主导字段数占比是否 >= 0.9
  pub score: i32,           // 综合得分;-1 = 该候选无法解释样本
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CsvProbe {
  pub path: String,
  pub delimiter: String,               // 实际采用的分隔符
  pub source: String,                  // "detected" | "forced" | "fallback"
  pub confidence: String,              // "high" | "low" | "none"(forced 恒为 high)
  pub columns: usize,                  // 第一行(表头)列数 —— 诉求 1 的核心字段
  pub header: Vec<String>,             // 第一行字段(上限 50,预览用)
  pub sample_rows: Vec<Vec<String>>,   // 后续若干行(默认 3,上限 20)
  pub sampled_records: usize,          // 参与检测的样本记录数(<= 200)
  pub truncated: bool,                 // 采样是否被 64 KiB 上限截断
  pub quoting_used: bool,              // 检测最终采用的引号模式(false = 触发过兜底重试)
  pub candidates: Vec<DelimiterCandidate>,
}

/// `delimiter = None` → 自动检测;`Some` → 强制使用(不做检测)。
/// `fallback_delimiter` 仅在 confidence == "none" 时生效,默认 ","。
#[tauri::command]
pub async fn probe_csv_file(
  path: String,
  delimiter: Option<String>,
  fallback_delimiter: Option<String>,
  skiprows: usize,
  quoting: bool,
  preview_rows: Option<usize>,
) -> Result<CsvProbe, String>
```

实现要点:

- 采样:`BufReader::take(64 KiB + 1)` 读入头部(多读 1 字节用于判断是否截断);若被截断,**裁到最后一个换行**并丢弃该条可能不完整的记录(引号字段跨截断点时同理)。
- 先按 `skiprows` 丢弃前置记录,再开始计数(前置杂行本就不可信)。
- 列数/预览与拆分同源:同一个 `csv::ReaderBuilder::new().has_headers(false).flexible(true).quoting(quoting)` 且**用的是调用方的 `quoting`**,保证「probe 说 6 列」与「拆分按 6 列判定」不会出现不一致(只有检测过程本身在找不到候选时才会以 `quoting_used = false` 重跑一遍,见 §3.4.2)。
- 强制模式(`delimiter = Some`)不做检测,`candidates` 为空、`confidence = "high"`。
- 纯函数 `detect_delimiter` / `score_delimiters` 做主逻辑,命令只负责读文件,单测直接测纯函数;同步体 `probe_csv_sync` 与命令分离,便于在无 async runtime 的单测里调用。

#### 3.4.2 检测算法:表头优先 + 正文一致度 + 约定优先级

候选集合与设置页保持一致:`{',', ';', '\t', '|', '^'}`(暂不含空格:纯文本文件误判率高,见 §6)。

对每个候选 `d`:

```text
header_fields = 首条记录(应用 skiprows 后)的字段数
counts        = 采样记录字段数直方图(忽略空记录)
body_mode     = 直方图中除 1 之外出现次数最多的字段数(没有则 1)
body_ratio    = count(body_mode) / sampled_records

若 header_fields == 1 且 body_mode == 1 → 该候选不成立(得分 -1,视为无解释力)
score = 60 * [header_fields > 1]                  // 表头是最可靠的信号(见下方脏文件用例)
      + (30 * body_ratio) as i32                  // 正文一致度
      + min(body_mode, 20)                        // 列数微加成,拉开同分候选
      + priority(d)                               // ','=5 '\t'=4 ';'=3 '|'=2 '^'=1(对齐设置页顺序)

置信度:
  无可成立候选            → confidence = "none",delimiter = fallback_delimiter,source = "fallback"
  唯一最高分,且 header_fields > 1 → source = "detected",confidence = "high"
  唯一最高分,但只有正文信号        → "low"(提示用户复核)
  并列最高分                        → "low"
```

> **只看内容,不看文件名**:`score` 里**没有**扩展名(或任何路径信息)的权重。`a.csv` 用分号、`b.tsv` 用逗号都是常态,按扩展名加权反而会把正确结果压下去(初版曾给 `.csv→','`、`.tsv→'\t'`、`.psv→'|'` 各 +6,已按实测反馈移除)。

两个关键设计点:

1. **表头权重(60)刻意高于正文一致度(30)的总和**。本工具的输入天然是**脏文件**——016 的验收数据 `age,name,gender` + `1,tom,man` / `2` / `2.1` / `2.3` / `3,jerry` / `4`,用 `,` 切出来的字段数是 `{3:2, 1:4, 2:1}`,主导字段数就是 1,正文一致度完全不可用;但表头 3 列是 `,` 独有的解释。只要表头能解释,就该采信表头。
2. **`quoting` 兜底**:若在 `quoting = true` 下无可成立候选,用 `quoting = false` 再算一遍(两次都是 64 KiB 级解析,微秒量级),应对「文件本身不用引号、字段里裸出现分隔符」的情况;此时返回的 `quoting_used = false`,前端给出琥珀色提示建议关闭「启用引号」。**注意**:表头/预览仍按调用方的 `quoting` 解析,以免界面与拆分结果脱节。
3. **并列裁决**:分数完全相同时依次比较「主导字段数(`body_mode`)→ 约定优先级」,即更丰富的切分优先(单行 `a,b;c;d;e` 会判为 `;`)。此类输入本身歧义,`confidence` 固定为 `low`。

算法验证用例(直接作为单测清单):

| 采样输入 | 期望 delimiter | 期望 confidence | 说明 |
|----------|----------------|-----------------|------|
| `age,name,gender` + `1,tom,man`/`2`/`2.1`/`2.3`/`3,jerry`/`4` | `,` | high | 016 验收脏数据,靠表头 3 列决出(`consistent = false`) |
| `a\tb\tc` + `1\t2\t3` | `\t` | high | TSV |
| `a;b;c` + `1;2;3` | `;` | high | 分号 |
| `a\|b\|c` + `1\|2\|3` | `\|` | high | 竖线 |
| `a^b^c` + `1^2^3` | `^` | high | 脱字符 |
| `a,b` + `1,"x,y"` + `2,"p,q"` | `,` | high | 引号内分隔符不计入(quoting=true) |
| `a,b;c;d;e`(单行) | `;` | low | 两候选都解释表头、总分并列 → 字段数多的赢 |
| `name` + `Alice` + `Bob` | fallback(默认 `,`) | none | 单列文件不可判定 → 沿用设置值 |
| `name` + `1,5` + `2,3`(单列但值含逗号) | `,` | low | 仅正文信号 → 标 low,靠「第一行 1 列」提示复核 |
| 首行前 2 行是注释垃圾 + `a;b` …(skiprows=2) | `;` | high | 前置记录不参与统计 |
| `"a;b` + `1;2` + `3;4`(未闭合引号) | `;` | high | quoting=true 下无候选 → 回退 quoting=false,`quoting_used = false` |
| `a\|b;c` + `1\|2;3`(文件名 `.csv` / `.psv` / `.tsv` 都一样) | `;` | high | **扩展名不参与打分**,同一内容得到同一结果 |
| 超 64 KiB 且末条被截断 | 与未截断一致 | high | 丢弃末条不完整记录,`truncated = true` |

#### 3.4.3 前端应用策略

- **默认即自动**:对话框内新增 `分隔符` 控件(`src/components/ui/select.tsx`,与设置页同一组选项),第一项为 `自动检测`(`t.delimiterAuto`),**打开对话框时默认选中「自动检测」**。
  - 控件显示的是**用户的选择**(「自动检测」或某个具体分隔符),检测结果以旁注呈现:`已识别为「;」· 42 · 置信度高`;`low` 时整行转琥珀色且文案含「请复核」。
  - 选中自动检测 → 用 probe 返回的 `delimiter`;`confidence == "none"` 时 probe 已回退到 `fallback_delimiter`(即 `settings.defaultDelimiter`),旁注显示 `未能识别分隔符,已使用默认值「,」`。
  - 用户显式选择某个分隔符 → 该模式下 probe 走 `delimiter: Some(x)`(只取列数/预览),且**生效分隔符直接取用户选择**(`effectiveDelimiter = delimiterMode`),天然不会被后续 probe 覆盖,无需额外的 `delimiterTouched` 标记(实现阶段简化为 `delimiterMode !== "auto"` 即锁定)。
- **一键设为默认**:控件右侧 `设为默认分隔符`(`t.setAsDefaultDelimiter`)链接按钮,调用既有 `set_default_delimiter` 并回传 `onDefaultDelimiterChange` 让 App 的 `settings` 状态同步;生效分隔符与当前默认相同时按钮置灰。用它替代「去设置页改」的割裂路径,同时用 `title` 提示该副作用(会让当前标签页按新分隔符重载,`useTabs.ts:185-191`)。
- **复用而非复制**:抽 `src/hooks/useCsvProbe.ts`(输入:路径 + 分隔符模式 + `fallbackDelimiter`/`skiprows`/`quoting`/`previewRows`;输出 `{probe, error, isProbing}`),内置 250 ms 防抖 + 递增请求序号丢弃过期响应;路径变化立即清空上一个文件的数字。后续 `CsvDiffDialog` 等可直接复用。

#### 3.4.4 与应用其余部分的协同(后续可选项,本次不做)

更进一步的做法是让「打开文件」整体受益:设置页分隔符增加 `自动检测` 选项,`useTabs.loadCsvData`(`src/hooks/useTabs.ts:155`)在读取前先 probe 一次,或在「当前默认分隔符切出单列」时回退到检测结果。

本次不做的原因:它要同时改设置页语义、`useTabs`、`DataProfilePanel`(`App.tsx:1732` 传的就是 `settings.defaultDelimiter`)、`CsvDiffDialog` 等多处,并需要定义「用户显式设过分隔符」的优先级规则;而诉求 3 的痛点(**拆分对话框被迫去设置页改**)在 §3.4.3 已经解决。建议作为独立文档(018)推进。

> **后续(2026-09-20)**:已按此建议落地 → `docs/design/018_open-file-delimiter-detection.md`(已实现)。打开文件走 `read_csv_file` 自动检测 + 标签页 `delimiterMode`(auto/锁定)+ 输入节点分隔符徽标,执行侧改用标签页解析值;`DataProfilePanel` / `CsvDiffDialog` / `CsvEncodingDialog` 仍用全局默认(列为 018 §6 的已知限制)。

#### 3.4.5 风险与取舍

| 风险 | 缓解 |
|------|------|
| 检测误判(尤其单列文件含分隔符、两候选并列) | 置信度分级 + 第一行列数/表头预览即时可见 + 用户一键覆盖 + `设为默认` 幂等;误判最坏结果只是拆错,输出文件可重新生成 |
| 额外 IPC 与磁盘读 | 固定 64 KiB 采样 + 250 ms 防抖 + 请求序号丢弃过期响应;与文件大小无关 |
| 自动应用违背用户预期 | 「自动检测」在 UI 上显式可见(下拉框里看得出来),用户手选即锁定;不静默修改全局设置 |
| localStorage 存路径 | 仅本机、上限 2 KiB、提供 `清除记录`;不上报任何数据 |

### 3.5 翻译 key(`src/i18n/translations.ts`,en/zh + 类型声明同步)

以下为**最终实现**新增的 20 个 key(全部在 `SeparateGoodBad` 段落内):

| key | en | zh |
|-----|----|----|
| `delimiter` | Delimiter | 分隔符 |
| `delimiterAuto` | Auto-detect | 自动检测 |
| `detectedDelimiter` | Detected | 已识别为 |
| `detectConfidenceHigh` | high confidence | 置信度高 |
| `detectConfidenceLow` | low confidence, please verify | 置信度低,请复核 |
| `detectFailed` | No delimiter detected; using the default | 未能识别分隔符,已使用默认值 |
| `detectQuotingHint` | Only detected without quote parsing — consider turning quoting off | 仅在未启用引号解析时识别成功,建议关闭「启用引号」 |
| `setAsDefaultDelimiter` | Set as default | 设为默认 |
| `firstRowColumns` | First row | 第一行 |
| `headerPreview` | Header | 表头 |
| `probeFailed` | Failed to read file info | 读取文件信息失败 |
| `probeLoading` | Reading file info... | 读取文件信息中... |
| `lastResult` | Last run | 上次拆分 |
| `separateCompleteNow` | Completed | 已完成 |
| `finishedAt` | Finished at | 完成时间 |
| `elapsed` | Took | 耗时 |
| `openPath` | Open path | 打开路径 |
| `clearRecord` | Clear record | 清除记录 |
| `lastResultNoOutput` | Output file no longer exists | 输出文件已不存在 |

复用既有 key:`t.expectedColumns` / `t.expectedColumnsHint`(placeholder 与不匹配提示都基于它拼接)、`t.skiprows`、`t.quoting`、`t.streaming`、`t.outputDir`、`t.columns`、`t.copy` / `t.copied`、`t.open`、`t.separateStart`、`t.separating`、`t.separateComplete`、`t.separateNoResult`、`t.goodRows`、`t.badRows`、`t.separateSelectFile`、`t.inputFile`。

> i18n 是扁平字符串表(无插值),带数字的文案一律由组件拼接:
> - 第一行列数:`✓ {t.firstRowColumns}: {probe.columns}`
> - 期望列数 placeholder:`{t.expectedColumnsHint} · {probe.columns}`
> - 不匹配提示:`{t.expectedColumns} {用户值} ≠ {probe.columns}`
> - 完成时间/耗时:`{t.finishedAt} {formatDateTime(…)} · {t.elapsed} {formatElapsed(…)}`

### 3.6 边界与失败行为汇总

| 场景 | 行为 |
|------|------|
| 路径为空 | 不 probe,信息行清空,`开始拆分` 报「请选择输入文件」 |
| 文件不存在 / 无权限 | 信息行显示 `读取文件信息失败: …`(红字),不阻塞按钮;点拆分由后端给出最终错误 |
| 空文件 | probe 返回与拆分一致的错误(`Input file is empty (missing header)`) |
| `skiprows` 超过记录数 | 提示 `跳过后已无记录`(对应 `separate_stream` 的同名错误) |
| 单列文件 | confidence = none → 用默认分隔符,显示 `未能识别分隔符…` |
| 超大文件 | 只读 64 KiB,信息行几乎瞬时出现;拆分是否走 streaming 与检测无关 |
| 采样被截断 | 丢弃末条不完整记录,`truncated = true` 仅用于诊断展示 |
| 用户手选分隔符后再改文件 | 保持手选值(`delimiterMode` 非 `auto` 即锁定),仅刷新列数/预览 |
| 上次结果的输出文件被手工删除 | 标 `输出文件已不存在`(需 `file_exists`);仍剩一份时可正常打开路径,两份都没了则按钮置灰 |
| localStorage 写入失败(隐私模式等) | 静默降级为仅会话内可见(`try/catch`) |

---

## 4. 影响面

| 文件 | 改动 |
|------|------|
| `src-tauri/src/csv.rs` | 新增 `CsvProbe` / `DelimiterCandidate` / `probe_csv_file` + 纯函数 `score_delimiters`/`detect_delimiter`/`detect_delimiter_with_fallback`/`parse_sample`/`read_head_sample` + 14 个单元测试;`SeparateResult` 增加 `elapsed_ms` |
| `src-tauri/src/lib.rs` | 注册 `csv::probe_csv_file` 与 `storage::reveal_paths`(命令数 54 → 56) |
| `src-tauri/src/storage.rs` | 新增 `reveal_paths`:过滤掉已不存在的路径后交给 `tauri_plugin_opener::reveal_items_in_dir` 在文件管理器中定位(复用已注册的 `tauri-plugin-opener`,无需新增 JS 依赖或 capability) |
| `src/components/dialog/SeparateCSVDialog.tsx` | 分隔符 `Select`(默认自动检测) + 检测结果旁注 + `设为默认` + 第一行列数/表头预览行 + 期望列数联动 + 上次结果区(完成时间/耗时/打开路径/清除记录/输出文件失效提示) + `clearFeedback` 不再清结果 |
| `src/hooks/useCsvProbe.ts` | 新增:防抖 + 序号守卫的探测 hook |
| `src/utils/separateHistory.ts` | 新增:`easy-csv-separate-last` 读写/清除 + `formatElapsed` / `delimiterLabel` |
| `src/App.tsx` | 传 `onDefaultDelimiterChange={settings.setDefaultDelimiter}` 保持全局设置状态同步 |
| `src/i18n/translations.ts` | 新增 §3.5 的 20 个 key(en/zh + 类型声明) |
| `src/__tests__/SeparateCSVDialog.test.tsx` | 扩充到 14 个用例:探测调用与列数/表头、自动应用、手选锁定、检测失败提示、探测报错不阻塞、设为默认、上次结果恢复/持久化/清除 |
| `src/__tests__/separateHistory.test.ts` | 新增 7 个用例:往返、缺省、坏 JSON/字段类型不符、超长跳过、清除、耗时与分隔符格式化 |
| `docs/AI/INDEX.md` | 新增 `probe_csv_file` 命令说明与 `SeparateCSVDialog` 职责;更正 `lib.rs` 行「注册全部 50 个命令」为 55;补「修改拆分好/坏行」速查行 |
| `docs/design/016_separate-good-bad-rows.md` | 头部补一条指向本文件的「后续」交叉引用 |

---

## 5. 测试计划(已落地)

### 后端(`src-tauri/src/csv.rs`,纯函数优先)—— 14 个新用例,`cargo test --lib` 51 passed

1. §3.4.2 验证表 13 条用例全覆盖(`,` / `;` / `\t` / `|` / `^` / 脏文件 / 引号内分隔符 / 单列 / 并列 / 仅正文信号 / 跳过前置记录 / quoting 兜底 / 扩展名无关 / 截断样本)。
2. `probe_csv_sync` 的列数与预览:同一份文件在 probe 与 `separate_csv_inner` 下取的 `expected_columns` 一致(016 验收数据断言 3 列、`header` 为 `age,name,gender`)。
3. `delimiter = Some(";")` 强制模式不触发检测(`source == "forced"`、候选为空)。
4. `confidence == "none"` 时 `delimiter == fallback_delimiter` 且 `source == "fallback"`(显式传入与默认 `,` 两种)。
5. `skiprows` 后无记录 / 空文件 / 不存在文件的错误文案与 `separate_csv` 保持一致。
6. >64 KiB 样本:`truncated == true`、`sampled_records == 200`、列数不受末条截断影响。

### 前端(`vitest`)—— 14 + 7 个新用例,全量 296 passed / 18 files

- `SeparateCSVDialog.test.tsx`:
  - 选文件后调用 `probe_csv_file`(`delimiter: null`、`fallbackDelimiter: ","`),渲染 `First row: 6` 与表头预览、期望列数 placeholder 带列数;
  - probe 返回 `;` → 控件保持 `Auto-detect`、旁注显示 `Detected「;」`,点击 `Separate` 时 `delimiter: ";"`;
  - 手选 `Comma (,)` 后再次触发 probe,**不**被覆盖为 `;`;
  - `source == "fallback"` 显示 `No delimiter detected…`;probe 抛错显示 `Failed to read file info` 且拆分按钮仍可用;
  - 检测分隔符 ≠ 全局默认时 `Set as default` 可点,点击后调用 `set_default_delimiter` 并回调 `onDefaultDelimiterChange`;
  - 预置 localStorage → 打开即显示 `Last run` / `Finished at` / 两个输出路径;成功一次后写入 localStorage、显示 `Completed` 与 `Took 420 ms`,编辑选项**不清空**结果;`Clear record` 清空记录;`Open path` 调用 `reveal_paths(['/tmp/prev_good.csv','/tmp/prev_bad.csv'])`,两份输出都缺失时按钮置灰并显示失效提示。
- `separateHistory.test.ts`:往返、无记录、坏 JSON / 字段类型不符、超长跳过、清除、`formatElapsed` / `delimiterLabel`。
- 回归:既有 streaming 三例与既有用例全绿;`npx tsc --noEmit` 无错。
- 回归:现有 3 条 streaming 用例与既有 275 条全绿;`npx tsc --noEmit` 无错。

---

## 6. 已知限制

- 分隔符候选固定为设置页那一组 `, ; \t | ^`,不支持任意字符(空格、`\x1f` 等)。空格作为候选在纯文本/自然语言文件上误判率过高,故默认排除;若后续需要,按文件内容特征(而非扩展名)扩展候选或提供手动输入。
- 检测**完全不使用文件扩展名**(见 §3.4.2 说明)。因此「文件名给了正确线索但内容样本有歧义」的场景不会得到额外帮助,只能靠置信度提示 + 用户一键覆盖;这是刻意的取舍:`a.csv` 里放分号文件太常见了。
- 检测只看**前 64 KiB / 前 200 条记录**。表头在采样窗口之外、或文件前部与后部分隔符不一致(同一文件混用分隔符)时,检测结果可能只反映前部。
- 采样被截断时按「丢最后一条」处理,极端情况下(单行超 64 KiB)会没有任何完整记录可供统计 → 判定为 `none` 并回退默认分隔符。
- 「第一行列数」始终等于**表头列数**(本对话框没有 `noHeaders` 选项,与 016 的拆分语义一致);若将来引入「无表头」模式,该文案需要相应改为「第一条记录列数」。
- 完成时间取自前端本地时钟,不做时区/精度归一;系统时间被修改时会失真。
- 上次结果只保留**最近一条**(不做历史列表);输出文件被删除只做存在性提示,不自动清理记录。

---

## 7. 实施顺序(已完成)

1. ✅ **后端**:`probe_csv_file` + `detect_delimiter` 系列纯函数 + 14 个单测(含 `SeparateResult.elapsed_ms`)。
2. ✅ **前端探测**:`useCsvProbe` + 分隔符控件 + 第一行列数/表头预览 + `设为默认`。
3. ✅ **前端记忆**:上次结果持久化 + 完成时间/耗时 + 复制/清除 + i18n + 测试 + 文档(`INDEX.md`、016 交叉引用)。

验证结果:`cargo test --lib` **51 passed**;`npx tsc --noEmit` 无错;`npx vitest run` **294 passed / 18 files**。
