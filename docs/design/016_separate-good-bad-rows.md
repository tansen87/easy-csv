# CSV 好坏行拆分(Separate Good/Bad Rows)— 设计文档

> 状态: 已实现
> 日期: 2026-09-17
> 关联: `docs/AI/INDEX.md` → Rust 后端 `csv.rs` / 修改菜单(File 菜单子菜单)/ 修改国际化文本
> 参考: `docs/sep.rs`(初版方案,存在缺陷,本文档按经验实测结果重写核心逻辑)
> 验收数据:
>
> ```csv
> age,name,gender
> 1,tom,man
> 2
> 2.1
> 2.3
> 3,jerry
> 4
> ```
> 期望: 除表头外,`1,tom,man`、`2`、`2.1`、`2.3`、`3,jerry`、`4` 全部写入 bad 文件。

---

## 1. 背景与目标

Easy CSV 需要一项工具能力: 把一份 CSV 按「列数是否符合期望」拆成两个文件 —— `good` 文件保留列数正确、可正常解析的行;`bad` 文件保留**所有**异常行(列数不符、引号未闭合等),便于用户回去修复。

`docs/sep.rs` 给出了初版思路,但存在缺陷。本方案在其基础上:

1. **修复核心 bug**: 坏行无法被可靠地、完整地写入 bad 文件(存在坏行被丢弃、或与 good 混淆、或无法对齐原始文本的情况)。
2. **补齐边界行为**: 处理多物理行引号字段、空行/末尾空行、CRLF、未闭合引号、BOM、`expected_columns` 覆盖表头列数等场景。
3. **集成进应用**: 后端 Tauri 命令 + 前端 `File` 菜单子菜单 + 中文/英文 i18n。

### 非目标

- 不做修复坏行的自动「补列」逻辑,只负责拆分。
- 不修改原始输入文件,只生成 `_good` / `_bad` 两个派生文件。

---

## 2. 现状分析与问题定位

### 2.1 `docs/sep.rs` 的初版做法(逐物理行解析)

初版对每条数据行各自新建一个 `csv::Reader`(`flexible(false)`)再取第一条记录:

```rust
let mut parser = ReaderBuilder::new()
  .has_headers(false)
  .delimiter(sep)
  .flexible(false)      // ← 刚性模式
  .quoting(quoting)
  .from_reader(line.as_bytes());
match parser.records().next() { ... }
```

### 2.2 实测定位: 一年轻读者逐行 + 刚性模式的隐患

用 csv 1.4 crate 对验收数据做了隔离实验,结论如下:

| 数据/输入 | 逐行 reader + `flexible(false)` | 共享 reader + `flexible(true)` + 字节偏移 |
|---|---|---|
| 验收数据 5 条坏行 | 全部进入 bad ✅ | 全部进入 bad ✅(字节原文保留) |
| 多物理行引号字段 `2,"hello\nworld"` | ❌ 被 `BufRead::lines()` 按物理 `\n` 拦腰折断,拆成两条坏行 | ✅ 作为**一条** good 记录,原文完整 |
| 末尾空行 / 中间空行 | 空行 → `None` → 写 bad(可接受) | 空行 → `None`,进入 bad |
| 未闭合引号 `"oops\n...` | 解析 Err → 写 bad(原始行会丢) | ✅ 整段原文进入 bad |
| CRLF | 正常 | 正常,原文含 `\r\n` |
| BOM 表头 | 正常 | 正常 |

**根因(核心 bug)**: 逐行 `reader.lines()`(本质是 `BufRead::lines`)按**物理换行**切行,完全不理解 CSV 引号语义——

1. 引号字段里嵌入的换行会被错误地当成两条记录;
2. 更关键的是,`flexible(false)` 的刚性比较以**每条 reader 的「首条记录」**为列数基准,而逐行 reader 的首条记录就是它自己,所以**永远不会触发 `UnequalLengths` 错误**,列数必须靠后续手写 `record.len() == inferred` 兜底。一旦某类行走了 parse-Err 分支,坏行原文就**拿不到**(Err 只带位置信息,不给你可写出的内容),于是坏行被静默丢弃 —— 这正是「第 2、3、4、5 行无法一起写入 bad」的最可能成因。

### 2.3 修复方向

改用**单一的共享 Reader + `flexible(true)`**,并在输出端用**共享的 `flexible(true)` csv Writer 重新序列化**好/坏行:

- `flexible(true)` 读端: 列数错误**不会**上升为 parse 错误,坏行得以保留(刚性模式的 `UnequalLengths` 会在读到字段时把坏行走成 parse-Err 而丢掉原始内容 —— 这正是「坏行无法写入 bad」的根因);
- 输出端**同样要 `flexible(true)`**: 初版实现漏了这一点,导致 Writer 把超过/不足列数的坏行再次弹成 `UnequalFields` 错误(`found record with N fields, but the previous record has M fields`),坏行仍写不进去 —— 这其实是同一个「刚性」陷阱的第二个出口;
- 多物理行引号字段由 csv 解析器正确处理(不会像 `BufRead::lines()` 那样按 `\n` 拦腰折断);
- 不依赖 `Reader::position()` 做字节切片(实验发现 CRLF 下 `Position::byte` 会落在 `\r\n` 中间、丢失最后一个 `\n`),从根本上规避了该缺陷。

> 实测对照: 初版 `separate_csv_inner` 曾尝试用 `position()` 字节切片保留原文,CRLF 输入会丢换行;后改为 re-serialization,坏行 100% 写入,输出规范化为 LF。

---

## 3. 方案设计

### 3.1 后端核心: `separate_csv`(写入 `src-tauri/src/csv.rs`)

```rust
#[tauri::command]
pub async fn separate_csv(
  path: String,
  delimiter: String,        // 参考 read_csv_file,按字节分隔
  quoting: bool,
  expected_columns: String, // "": 自动(等于表头列数);正整数: 覆盖
  skiprows: usize,          // 表头前要跳过的记录数
  out_dir: Option<String>,  // 输出目录,默认与输入同目录
) -> Result<SeparateResult, String>
```

算法:

1. `std::fs::read` 一次性读入内存缓冲 `buf`;空文件 → 报错。
2. 用 `csv::ReaderBuilder::new().has_headers(false).flexible(true).delimiter(sep).quoting(quoting)` 包一个共享 Reader(基于 `Cursor<&[u8]>`)。`flexible(true)` 保证列数不符不会变成 parse 错误。
3. 先 `skiprows` 次 `read_byte_record` 丢弃表头前的杂散记录;若中途耗尽 → 报错。
4. 读**第一条合法记录作为表头**;`expected = expected_columns>0 ? 覆盖值 : 表头列数`。
5. 创建两个**共享 `flexible(true)` 的 csv Writer**(关键: 不设 flexible 会让坏行回写时报 `UnequalFields`)。表头写入两个文件首行:
   - good 表头: 对齐到 `expected` 列(不足补空列、超出截断),保证 good 文件列数自洽;
   - bad 表头: 保留原表头(原列数)。
6. 逐条 `read_byte_record` 循环,统一经 Writer **重新序列化**:
   - `rec.len() == expected` → 写入 good,`good_rows += 1`;
   - 否则 → 写入 bad,`bad_rows += 1`;
   - `Ok(false)` → EOF,结束;
   - `Err(_)` → 无法取得可用字段,仅 `bad_rows += 1`(实际罕见;未闭合引号会被 csv 吸收为单条记录而非 Err)。
7. 返回 `SeparateResult { good_path, bad_path, good_rows, bad_rows, expected_columns }`。

要点:

- 读端与写端**都必须 `flexible(true)`**,这是修复坏行丢失的核心(刚性的读端/写端各有一个会把坏行弹走的出口)。
- 输出用重新序列化(规范化为 LF、必要处加引号),**不保留输入换行风格**;换取的是对 CRLF / 多物理行 / 空行等所有边界的稳定处理。
- 文件 I/O 为 CPU/磁盘密集,整个算法包在 `tokio::task::spawn_blocking` 里,与 `diff_csv_files` 一致。

### 3.1a 分类规则: 坏行向前归并(默认、固定)

单一固定规则: 后续连续列数不足的行,把紧邻的上一合法行一并拉入 bad。

算法: 维护「待定合法行 `pending_good`」与「坏行缓冲 `bad_buf`」:
- 读到**合法行**(列数==期望)若 `pending_good` 已有值,则它因被后续合法行隔开而确认为 good(先落盘),清空 `bad_buf` 落盘为 bad,再把当前合法行设为新的 `pending_good`;
- 读到**非合法行**时,把 `pending_good` 拉入 `bad_buf`,并追加当前行,持续累积;
- EOF: 落盘残余的 `pending_good`(good)与 `bad_buf`(bad)。

对用户示例(期望 3 列):
`1,tom,man`(合法)后紧跟 `2/2.1/2.3/3,jerry/4` 全部非合法 → `1,tom,man` 被连同拉入 bad,**整份数据进 bad**,仅表头留在 good。
更精密的例子: `X(3)、Y(1)、Z(1)、D(3)、E(3)` → `X、Y、Z` 一起进 bad,`D、E` 各自为 good。

### 3.2 命令注册

`src-tauri/src/lib.rs` 的 `invoke_handler()` 追加 `csv::separate_csv`(并更新 `docs/AI/INDEX.md` 中后台命令/模块职责小节)。

### 3.3 前端交互(File 菜单子菜单)

- 在 `src/components/menu/MainMenu.tsx` 的 **文件下拉菜单** 中,`CSV 对比` / `CSV 编码转换` 之间新增一个分隔与按钮 `t.separateGoodBad`(图标沿用 `FileCode` 或 `Split`),点击触发 `onOpenSeparateCsv`。
- 新增对话框 `src/components/dialog/SeparateCSVDialog.tsx`,字段:
  - 输入文件(默认取当前标签页 `inputFile`,可浏览);
  - 输出目录(可选,默认输入同目录)→ 命名单: `<basename>_good.csv` / `<basename>_bad.csv`;
  - 分隔符(默认取 `settings.defaultDelimiter`);
  - 期望列数(留空 = 自动);
  - 引号模式(复选框);
  - 跳过前 N 行(数字,默认 0);
  - 「开始拆分」→ `invoke("separate_csv", ...)` → 展示 good/bad 路径与行数。
- 状态与接线:
  - `useUIState.ts` 增加 `showSeparateCsv` / `separateCsvInitialInput`。
  - `App.tsx` 增加 `onOpenSeparateCsv` 处理器(注入当前标签页 inputFile)、渲染 `<SeparateCSVDialog/>`,并(可选)在全局命令面板 `CommandPalette` 的 Actions 组加入 `separate-good-bad` 条目(与 csv-diff/csv-encoding 保持一致),同时补充英文别名 `actionEnKry` 映射。

### 3.4 翻译 key(`src/i18n/translations.ts`)

| key | en | zh |
|-----|----|----|
| `separateGoodBad` | Separate Good/Bad Rows | 拆分好/坏行 |
| `inputFile` | (复用) Input | (复用) 输入 |
| `outputDir` | Output folder | 输出目录 |
| `expectedColumns` | Expected columns (blank = auto) | 期望列数(留空自动) |
| `skiprows` | Skip first N rows | 跳过前 N 行 |
| `quoting` | Enable quoting | 启用引号 |
| `separateStart` | Separate | 开始拆分 |
| `separating` | Separating... | 拆分中... |
| `separateNoResult` | Pick a CSV file and click Separate… | 选择 CSV 文件后点击开始拆分… |
| `goodRows` | good rows | 好行数 |
| `badRows` | bad rows | 坏行数 |
| `separateSelectFile` | Please select an input file | 请选择输入文件 |

### 3.5 边界行为汇总(文档性质)

| 场景 | 行为 | 说明 |
|------|------|------|
| 空文件 | 报错 | 无表头可读,返回错误 |
| skips 行后无记录 | 报错 | 无表头 |
| 列数 ≠ expected | 进 bad | 核心拆分规则 |
| 列数 == expected | 进 good | 含多物理行引号字段(不拆断) |
| 未闭合引号 | 被 csv 吸收为单条记录进 bad | 不丢行 |
| 空行 / 末尾空行 | csv 视为非记录,跳过 | 不进 good 也不进 bad |
| CRLF | 归一为 LF 输出 | 重新序列化,判定正确 |
| 坏行向前归并(有坏行) | 后续连续坏行把紧邻上一合法行一并拉入 bad | 固定规则 |
| BOM 表头 | 正常 | csv crate 自动剥离 BOM |
| expected 覆盖 > 表头列数 | good 表头补空列 | 保证 good 文件列数自洽 |
| expected 覆盖 < 表头列数 | good 表头截断 | 同上 |
| 分隔符 | 单字节(与 `read_csv_file` 一致) | csv crate 限制 |

---

## 4. 影响面

| 文件 | 改动 |
|------|------|
| `src-tauri/src/csv.rs` | 新增 `SeparateResult`、`separate_csv`(spawn_blocking)+ 核心纯函数 + 单元测试 |
| `src-tauri/src/lib.rs` | 注册 `csv::separate_csv` |
| `src/i18n/translations.ts` | 新增 `Separate` 相关 key(en/zh) |
| `src/hooks/useUIState.ts` | 新增 `showSeparateCsv` / `separateCsvInitialInput` |
| `src/components/dialog/SeparateCSVDialog.tsx` | 新增对话框(参照 CsvEncodingDialog 结构) |
| `src/components/menu/MainMenu.tsx` | File 下拉新增「拆分好/坏行」子菜单项 |
| `src/App.tsx` | `onOpenSeparateCsv` 处理器 + 渲染对话框 + CommandPalette 条目(含英文别名映射) |
| `docs/AI/INDEX.md` | 补充后台命令/模块说明 |

---

## 5. 测试计划

### 后端(Rust 单元测试,`src-tauri/src/csv.rs`)

1. 验收数据: 5 条坏行全部进入 bad,`1,tom,man` 与表头进入 good。
2. 多物理行引号字段: 作为单条 good 记录。
3. 未闭合引号: 被 csv 吸收为单条坏记录进 bad。
4. 空行: csv 视为非记录,跳过(不进 bad)。
5. CRLF: 行数与 good/bad 判定正确,输出规范化为 LF。
6. `expected_columns` 覆盖: 按覆盖值分类,good 表头列数自洽(补空列或截断)。
7. 坏行向前归并(固定): 后续连续坏行把紧邻的上一合法行一并拉入 bad;其后隔开的独立合法行保持 good。

### 前端

- 更新 `docs/AI/INDEX.md`;可选新增 `src/__tests__/SeparateCSVDialog.test.tsx` 验证 `invoke("separate_csv")` 参数形态。
- 静态检查: `npx tsc --noEmit`;现有 vitest 回归保持全绿。

## 6. 已知限制

- `skiprows` 按**记录**计(而非物理行),与 csv 语义一致;若杂散行本身含未闭合引号,跳过逻辑会按引号合并到 EOF 之外的部分,属 csv 正常行为。
- 输出采用**重新序列化(规范化)**: 换行统一为 LF、仅必要字段加引号,**不逐字节保留输入原文**;可读性好且对 CRLF/多物理行等边界稳定,代价是坏行的精确原字符(如自定义引号风格)会被归一。若未来需字节级保留,可改回字节切片方案并额外修复 CRLF 的 `Position` 偏差。
- 全文件一次读入内存(`std::fs::read`),目标是中等规模清洗场景;超大文件可后续改为 `BufReader + File::try_clone()` 双句柄按记录 seek,本方案不引入该复杂度。