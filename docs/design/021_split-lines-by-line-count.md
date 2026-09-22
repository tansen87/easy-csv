# 按行拆分(Split by Lines)— 设计文档

> 状态: 已实现(2026-09-22)
> 日期: 2026-09-22
> 上游来源: 外部 `split_lines` 实现(只移植这一个函数;来源文件已删除,语义节选见 §2)
> 关联: `docs/design/016_separate-good-bad-rows.md`(拆分好/坏行,同为文件级切分)、`docs/design/017_separate-dialog-ux.md`(「上次结果」模式)、`docs/design/020_encoding-conversion-history.md`(选项一并回填的先例)、`docs/AI/INDEX.md`
> 前置: 016 / 017 已实现(拆分好/坏行与「上次拆分」记录已在跑)

---

## 1. 背景与目标

上游是一份独立的切分工具实现(来源文件已从仓库删除,§2 保留了移植依据的代码节选),含三个函数:

| 上游函数 | 切分依据 | 是否移植 |
|----------|----------|----------|
| `sequential_split_rows` | CSV **记录**(经 `csv::Reader` 解析)+ 分隔符 | 否 |
| `parallel_split_rows` | CSV 记录 + 文件索引 + rayon 并行 | 否 |
| `split_lines` | **原始文本行** | ✅ 本次移植 |

`split_lines` 的价值在于「不解析」:它按物理行把任意文本文件切成 `N` 行一份,不涉及分隔符、列数、引号,因此对超大文件与半结构化文本(日志、`.txt`、导出中途的坏文件)都能用,且天然常量内存。

本次目标:

| # | 诉求 | 落地位置 |
|---|------|----------|
| 1 | 把 `split_lines` 的能力接进 easy-csv(选文件 → 每个文件行数 → 得到多份输出) | §3.1–§3.3 |
| 2 | 入口放在 **File 菜单 → 拆分好/坏行 的下方** | §3.6 |
| 3 | 新增**无表头**选项(首行按数据行参与拆分,输出不写表头行) | §3.2 / §3.4 |
| 4 | 与同族对话框一致:结果可视、「打开路径」、上次记录 | §3.4 / §3.5 |

### 非目标

- **不移植** `sequential_split_rows` / `parallel_split_rows`(按 CSV 记录切分、rayon 并行、索引文件)。按记录切分与既有的「拆分好/坏行」领域重叠,而并行化需要索引(`xan index`)与 `rayon` 依赖,本期不引入。
- 不做「每份最多 N 字节」等其他切分口径,只按行数。
- 不做实时进度条(与 `separate_csv` / `convert_csv_encoding` 一致:执行中只有按钮态)。
- 不清理上一次运行遗留的多余分片(见 §6)。
- 不把对话框做成分隔符探测型界面:按行拆分与分隔符无关,因此**不做 `probe_csv_file` 探测**,也不提供「跳过前 N 行」「期望列数」「引号」「流式」这些 CSV 语义选项(对照 016/017 的选项集,这里是刻意做减法)。

---

## 2. 上游语义与本次差异

上游 `split_lines`(节选):

```rust
pub async fn split_lines(path: String, size: u32, output_path: &str) -> Result<()> {
  let reader = BufReader::with_capacity(RDR_BUFFER_SIZE, File::open(path)?);
  let mut lines = reader.lines();
  let headers = lines.next().transpose()?;          // 首行 = 表头
  let mut wtr = new_lines_writer(&headers, 0, &output_path)?;
  let mut i = 0; let mut cnt = 1;
  for line in lines {
    let line = line?;
    if i > 0 && i % size == 0 {                     // 满 size 行就换文件
      wtr.flush()?;
      wtr = new_lines_writer(&headers, cnt, &output_path)?;
      cnt += 1;
    }
    writeln!(wtr, "{}", line)?;
    i += 1;
  }
  Ok(wtr.flush()?)
}
```

移植时保留了它的核心语义(首行当表头复制到每一份、每满 `size` 行换文件、常量内存),并做了四处**有意的差异**:

| 维度 | 上游 | 本次实现 | 原因 |
|------|------|----------|------|
| 读取方式 | `BufRead::lines()` → `String` | `read_until(b'\n')` → 原始字节 | `lines()` 要求 UTF-8 且会把 `\r\n` 归一成 `\n`;字节读取对任意编码/内容都成立,并原样保留 `\r\n`。GBK 文件不会被判为「非法 UTF-8」而中断(需要转码时仍可用既有的编码转换) |
| 输出命名 | `{parent}/{stem}.split_{N}.csv`,N 从 0,扩展名强制 `.csv` | `{stem}_part{N}{ext}`,N 从 1,保留输入扩展名 | 与 easy-csv 既有的 `{stem}_good{ext}` / `{stem}_bad{ext}` 同族;`.txt` 输入不该产出 `.csv` 名字 |
| 无表头 | 无此概念(首行永远是表头) | `no_headers` 选项(默认关闭) | 本此诉求 3;许多日志/无表头导出文件没有表头行 |
| 返回值 | 耗时字符串 `"{elapsed:.0}"` | 结构化 `SplitLinesResult` | 前端要展示文件数/总行数/输出路径/耗时 |

另外把上游「永远先建 `file 0`」的细节换成了等价但不产生空文件的写法:**输入非空 ⇒ 至少一份输出**;只有「有表头但零数据行」的输入会产出仅含表头的 `_part1`(见 §3.2)。

---

## 3. 方案

### 3.1 后端命令

`src-tauri/src/csv.rs` 新增 `#[tauri::command] pub async fn split_lines(...)`(与 `separate_csv` 同址,紧邻其后):

```rust
#[tauri::command]
pub async fn split_lines(
  path: String,
  lines_per_file: usize,
  out_dir: Option<String>,
  no_headers: Option<bool>,
) -> Result<SplitLinesResult, String>

#[derive(Debug, Serialize, Deserialize)]
pub struct SplitLinesResult {
  pub output_dir: String,        // 所有分片所在目录(未指定 out_dir 时=输入目录)
  pub output_paths: Vec<String>, // {stem}_part1{ext}, {stem}_part2{ext}, …
  pub file_count: usize,
  pub lines_per_file: usize,     // 回显请求值(前端把它存进「上次记录」)
  pub total_rows: usize,         // 数据行数(表头模式下不含表头)
  pub header_written: bool,      // 首行是否被当作表头复制进每一份
  pub elapsed_ms: u64,           // 只统计切分本身,不含 IPC/渲染
}
```

- 参数命名沿用 Tauri v2 约定:Rust `snake_case` ⇄ 前端 `camelCase`(`lines_per_file` ⇄ `linesPerFile`)。
- 与 `separate_csv` 一样包在 `tokio::task::spawn_blocking` 里,避免阻塞 Tauri 的异步运行时;计时点取闭包内 `Instant::now()`,口径同 016/020。
- `lines_per_file == 0` 直接报错(`Lines per file must be at least 1`),不依赖前端校验。

### 3.2 流式核心 `split_lines_stream`

后端只有一个实现(没有「内存版 / 流式版」双实现),写成泛型以便单测用内存 sink 覆盖同一份逻辑:

```rust
fn split_lines_stream<R, W, F>(
  input: R,                    // R: BufRead
  lines_per_file: usize,
  no_headers: bool,
  mut new_part: F,             // F: FnMut(index) -> Result<W, String>,W: Write
) -> Result<SplitLinesCounts, String>   // { file_count, total_rows }
```

逐行 `read_until(b'\n')` 读、逐行写:只有「当前一份」的 writer 与一行缓冲驻留内存,`total_rows` 可以达到任意大而不涨内存(1 MiB 的 `BufReader`/`BufWriter`)。

分类与写入规则:

| 情形 | 行为 |
|------|------|
| `no_headers = false`(默认) | 首行作为**表头**记住,不计数;每开一份新文件时先写入表头,再写数据行 |
| `no_headers = true` | 首行作为**数据行**:计入 `total_rows`、写入 `_part1`,所有输出都不写表头行 |
| 每份行数 | 每满 `lines_per_file` 行就 flush 当前并开下一份(`index = file_count + 1`) |
| 行尾 | 原样写出(含 `\r\n`);输入**最后一行缺少换行符**时补一个 `\n`,保证每份都是格式完整的文本文件 |
| 空输入 | 报错 `Input file is empty (no lines to split)`,不产出空文件 |
| 仅表头输入 | 产出一份只含表头的 `_part1`(与上游「至少建一个文件」的行为对齐,但对空输入更严格) |

辅助纯函数(都可单测):

```rust
fn split_lines_target(path, out_dir) -> (PathBuf /*dir*/, String /*stem*/, String /*ext*/)
fn split_part_path(dir, stem, ext, index) -> PathBuf   // {stem}_part{index}{ext}
```

`split_lines_to_files` 负责打开文件:按需 `create_dir_all` 输出目录,输入走 `BufReader::with_capacity(1 MiB)`,每个分片走 `File::create` + `BufWriter::with_capacity(1 MiB)`。与 `separate_csv` 的流式路径一致,**直接写正式文件**(不做临时文件 + 改名),因此中途失败会留下已写出的分片,不会自动回滚。

### 3.3 输出位置与命名

- 默认与输入同目录;`out_dir` 给定(非空)时写入该目录,目录不存在则创建。
- 分片名 `{stem}_part{N}{ext}`,`N` 从 **1** 开始;扩展名取自输入(`.csv` `/ .txt` 保持),无扩展名则无后缀。
- 不追加 CSV 专用的 `.csv` 后缀 —— 这条路径**不解析 CSV**。

示例:`/data/logs/app.log`,每个文件 1000 行,共 2500 数据行 ⇒

```
/data/logs/app_part1.log   # 表头 + 1000 行
/data/logs/app_part2.log   # 表头 + 1000 行
/data/logs/app_part3.log   # 表头 +  500 行
```

### 3.4 前端对话框 `src/modules/dialogs/file/SplitLinesDialog.tsx`

选项刻意只有三项(+ 文件选择):

| 控件 | 默认 | 说明 |
|------|------|------|
| 输入文件 | 调用方传入的当前标签页文件,否则空 | 复用 `t.inputFile` / `t.open` |
| 输出目录 | 空(=与输入同目录) | placeholder 复用 `t.outputPathLeaveEmpty` |
| 每个文件行数 | `100000` | 数字输入;非正整数时按钮报错并**不发请求** |
| 无表头 | 关闭 | checkbox,语义由 §3.2 与结果区(「已复制表头」/「无表头」)体现 |

结果区(与 016/017/020 同构):

```
✓ 已完成 / 上次按行拆分 · 完成时间 2026-09-22 19:12:33 · 耗时 420 ms
文件数: 3 · 总行数: 2500 · 每个文件行数: 1000 · 已复制表头
/data/logs
/data/logs/app_part1.log
/data/logs/app_part2.log
/data/logs/app_part3.log
[打开路径] [清除记录]
```

- **结果 = 一个 `lastResult` 状态**(兼作本次运行结果)+ `isStaleResult`(编辑任一选项即置 true,标题从「已完成」变「上次按行拆分」)+ `clearFeedback()`(只清 error,不清结果)。`isOpen` 复位 effect 里只重置状态,不隐藏记录。
- **路径只列前 5 个**(`MAX_SAMPLE_PATHS`):分片数量无上界,全量渲染既没必要也会撑爆下方的持久化体积上限;`fileCount` 承担完整数量信息。
- 「打开路径」对**输出目录**调用既有的 `reveal_paths`(`paths: [outputDir]`)—— 一个目录无论多少分片都指得到,不像拆分好/坏行那样要传两个文件。
- 失效提示:打开对话框时 `file_exists(outputDir)`,为 `false` 时追加琥珀色「输出文件已不存在」并置灰「打开路径」;查询失败按未知处理(不降级成「已删除」)。

### 3.5 上次记录 `src/utils/splitLinesHistory.ts`

镜像 `separateHistory.ts`(017)/ `encodingHistory.ts`(020):localStorage key `easy-csv-split-lines-last`、类型守卫、2048 字节上限、`try/catch` 静默降级、load/save/clear 三件套。

```ts
export interface StoredSplitLinesResult {
  outputDir: string;      // 结果:分片目录(「打开路径」与失效判断都用它)
  samplePaths: string[];  // 结果:前 5 个分片路径,仅用于展示
  fileCount: number;      // 结果
  totalRows: number;      // 结果
  headerWritten: boolean; // 结果
  finishedAt: string;     // 结果:ISO 8601
  elapsedMs?: number;     // 结果:后端耗时
  inputFile: string;      // 选项
  outDirInput: string;    // 选项(原始输入框内容,空 = 与输入同目录)
  linesPerFile: number;   // 选项
  noHeaders: boolean;     // 选项
}
```

与另外两份记录的**有意差异**:

1. 结果里**存目录而不是全部分片路径**。分片数量无上界,存全量会轻易越过 2048 字节上限,届时整条记录被静默丢弃 —— 「什么都没记住」比「记住目录 + 前 5 个」更差。目录一定能「打开路径」,这是更有用的不变式。
2. 类型守卫对**所有选项字段都是必填**(同 020):这些值会被直接回填进表单,部分加载会把 `undefined` 写进 UI。

**回填策略**:打开时回填 `linesPerFile` / `outDirInput` / `noHeaders`(与 020 一致,「同样的行数再拆一次」是重复操作),输入文件优先级为 **调用方传入的当前文件 > 记录里的 `inputFile`**。注意这与 017 的「选项一律复位」不同:016/017 的选项(分隔符/期望列数/引号)更偏「这一份文件的属性」,而「每个文件多少行」是用户习惯,值得记住;两种做法都在项目内存续,选择依据是选项的语义归属。

### 3.6 入口接线

| 位置 | 改动 |
|------|------|
| `src/components/menu/MainMenu.tsx` | File 菜单在「拆分好/坏行」按钮**下方**新增「按行拆分」按钮(`onOpenSplitLines`) |
| `src/hooks/useUIState.ts` | 新增 `showSplitLines` / `splitLinesInitialInput` |
| `src/app/App.tsx` | 菜单回调(带入当前标签页文件)、命令面板动作 `split-lines`(+ 英文别名映射 `actionEnKey`)、渲染 `<SplitLinesDialog>` |
| `src-tauri/src/lib.rs` | 注册 `csv::split_lines` |

命令面板里两项的措辞也自然区分:`separate-good-bad` 描述沿用 `t.separateNoResult`,`split-lines` 描述用 `t.linesPerFileHint`。

### 3.7 i18n

新增 11 个 key(`i18n/translations/types.ts` + `{en,zh}/dialog.ts`,同一顺序):

`splitLines`、`linesPerFile`、`linesPerFileHint`、`splitLinesStart`、`splitting`、`splitLinesLastResult`、`splitLinesFileCount`、`splitLinesTotalRows`、`splitLinesHeaderCopied`、`splitLinesNoResult`、`splitLinesInvalidLinesPerFile`。

复用既有 key:`inputFile`、`open`、`outputDir`、`outputPathLeaveEmpty`、`noHeaders`、`finishedAt`、`elapsed`、`separateCompleteNow`(本次运行的成功标题)、`openPath`、`clearRecord`、`lastResultNoOutput`、`separateSelectFile`(未选文件时的报错文案,语义完全一致)。

> `t.lastResult`(zh「上次拆分」)按 020 的约定属于「拆分好/坏行」,不复用;按行拆分另开 `splitLinesLastResult`(zh「上次按行拆分」)。
> 同理不复用 `t.separateStart`/`t.separating`:同一个对话框里两个名字不同的功能共用按钮文案会让测试与用户都难以区分。

### 3.8 边界与失败行为汇总

| 场景 | 行为 |
|------|------|
| 未选输入文件 | 报错 `separateSelectFile`,不发请求 |
| 每个文件行数为空 / `0` / 非整数 | 报错 `splitLinesInvalidLinesPerFile`,不发请求 |
| 输入为空文件 | 后端报错 `Input file is empty (no lines to split)`,不产出任何分片 |
| 输入只有表头 | 产出 `_part1`,仅含表头,`total_rows = 0` |
| 行数 ≥ 数据行数 | 产出唯一一份 `_part1`(=一次原样复制;见 §6) |
| `lines_per_file == 0` 直接调后端 | 后端报错 `Lines per file must be at least 1` |
| 最后一行缺少换行符 | 写出时补 `\n`,该行仍算一行 |
| 输出目录不存在 | 自动创建(`out_dir` 也支持),创建失败则报错 |
| 输出目录里已有同名分片 | 直接覆盖同名文件,**不清理**多余分片 |
| 中途写入失败(磁盘满等) | 已写出的分片保留,界面显示后端错误 |
| 记录存在但 localStorage 被清 / 字段不符 / 体积超限 | 等价于无记录,不报错 |
| 记录里的输出目录被删 | 显示「输出文件已不存在」,「打开路径」置灰 |

---

## 4. 影响面

| 文件 | 改动 |
|------|------|
| `src-tauri/src/csv.rs` | 新增 `SplitLinesResult` / `SplitLinesCounts` / `split_lines_target` / `split_part_path` / `split_lines_stream` / `split_lines_to_files` / `split_lines` 命令 + 12 个单测;`use std::io` 增加 `BufRead` |
| `src-tauri/src/lib.rs` | 注册 `csv::split_lines` |
| `src/utils/splitLinesHistory.ts` | 新增:`easy-csv-split-lines-last` 的读写/清除 + 严格类型守卫 |
| `src/modules/dialogs/file/SplitLinesDialog.tsx` | 新增:输入/输出目录/每份行数/无表头 + 结果区(文件数、总行数、耗时、目录、前 5 个分片、打开路径、清除记录、失效提示) |
| `src/components/menu/MainMenu.tsx` | File 菜单「拆分好/坏行」下方新增「按行拆分」 |
| `src/hooks/useUIState.ts` | `showSplitLines` / `splitLinesInitialInput` |
| `src/app/App.tsx` | 命令面板动作 `split-lines` + 英文别名 + 菜单回调 + 渲染对话框 |
| `src/i18n/translations/types.ts` · `{en,zh}/dialog.ts` | 新增 11 个 key |
| `src/__tests__/splitLinesHistory.test.ts` | 新增 6 个用例 |
| `src/__tests__/SplitLinesDialog.test.tsx` | 新增 9 个用例 |
| `docs/AI/INDEX.md` | 登记本设计文档、后端命令、前端文件、测试,并补速查行 |

---

## 5. 测试计划(已落地)

### 后端(`cargo test --lib split_lines`,12 例)

- 每满 N 行换文件 + 表头复制到每一份(`split_lines_writes_every_n_rows_and_copies_the_header`);
- `no_headers` 下首行按数据行计数(`split_lines_no_headers_treats_the_first_line_as_data`);
- 每份恰好 N 行 / 数据不足时只有一份 / 仅表头输入仍产出一份;
- `\r\n` 保真 + 末行缺换行符补 `\n`;
- 退化输入:空文件与 `lines_per_file = 0` 各自报错;
- 用 16 字节容量的 `BufReader` 强制跨缓冲边界读取,断言行数与前缀拼回原文件内容;
- `split_part_path` 命名(带/不带扩展名)与 `split_lines_target`(默认同目录 / `out_dir` 覆盖);
- 真实文件路径:默认目录与 `out_dir` + `no_headers` 两种组合的落盘内容断言。

### 前端(`vitest`,15 例)

- `splitLinesHistory.test.ts`(6 例):往返、无记录、坏 JSON / 缺选项字段 / 字段类型不符、`samplePaths` 非字符串、超长跳过、清除。
- `SplitLinesDialog.test.tsx`(9 例):默认无表头关闭 + 每份 100000 行 + `invoke` 形状;勾选无表头后传 `noHeaders: true` 并落库;行数与输出目录透传;未选文件与非法行数的拦截(不发请求);打开时回填选项(且调用方文件优先);成功后落库并展示文件数/总行数/耗时/分片路径;编辑选项后记录仍展示(标题转为「上次按行拆分」);清除记录;`reveal_paths(['outputDir'])`;输出目录失效时置灰提示。
- 回归:`npx vitest run` 全量 26 个文件 / 383 例通过;`npx tsc --noEmit`、`npx eslint src --ext .ts,.tsx` 无新增问题(`SplitLinesDialog.tsx` 404 行触发既有的 `max-lines` **警告**,与 `MAX 400` 的边界仅差 4 行,规则保持 `warn`)。

---

## 6. 已知限制

- **不清理历史分片**:上一轮拆成 10 份、这一轮拆成 3 份后,`_part4…_part10` 会留在原地。自动删除同名前缀文件的风险远大于收益(用户可能把别的结果放在同一目录),因此只覆盖本轮写出的文件;需要时由用户手工清理。
- **数据行数 ≤ 每份行数时仍会产出 `_part1`**(等价于一次原样复制,连表头都照抄),不会「什么都不做」。这与上游行为一致,也让「先设行数再拆」的重复操作有稳定输出。
- **行 = 物理行**:字段内嵌换行(`"a\nb"`)会被切断,跨物理行的 CSV 记录因此可能被拆到两个分片。这正是「不解析」的代价 —— 需要按记录正确切分时应使用「拆分好/坏行」或将文件先规范化(016 的 reader 会把内嵌换行视为同一记录)。
- **不做编码检测/转换**:按字节复制,不做 UTF-8 校验也不转码。GBK 等编码的文件不会被破坏,但分片仍是原编码;要转码请先用「编码转换」。
- **无进度反馈**:大文件拆分期间只有按钮的「拆分中...」状态,无法取消(与 `separate_csv` 一致;后者依赖执行管道的取消机制,本命令是独立的一次性文件操作)。
- **`samplePaths` 只留前 5 个**:记录里只展示前 5 个分片路径,完整清单需要点「打开路径」去目录里看。
- 分片命名固定为 `_part{N}`:**不做重名检查**,若目标目录已有同名文件会被直接覆盖。
- 完成时间取前端本地时钟,不做时区归一(与 016/017/020 一致)。
- 上限校验只在「数字输入框」层面:行数上没有「最小 1 行之外」的约束,输入 `1` 会让每一行都成为一个文件(大文件下会产生海量小文件) —— 后端不做拦截,仅在界面上保持 `min=1`。
