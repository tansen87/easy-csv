# Parquet / DuckDB 文件读取 — 设计文档

> 状态: **已实现(2026-09-28)**。§4.4.1 的三个 PoC 验证项(PIVOT 子查询 / temp_directory 溢写 / 报错行号口径)与 §4.4.2 的 `COPY` 失败行为需要真实 `duckdb.exe` 环境复核,未随本次实现交付
> 日期: 2026-09-28
> 关联: `docs/design/011_duckdb-plugin.md`(DuckDB 作为可选 CLI 插件)、`docs/design/018_open-file-delimiter-detection.md`(打开文件的分隔符检测)、`docs/AI/INDEX.md`
> 前置: DuckDB CLI 插件已接入(命令 id `duckdb`,`plugins.rs` 已 seed,`pipeline.rs` 已有「含 duckdb 步骤即切顺序物化引擎」的实现)

---

## 1. 背景与现状

DuckDB 已经是本项目的一等公民,但**只以 CSV 为输入**。三条链路逐一核对:

| 链路 | 现状 | 位置 |
|------|------|------|
| 打开文件(标签页输入) | `isCsvFile` 只认 `csv`/`txt`/`tsv`;其它扩展名只设 `inputFile` 并打一条 info 日志,**不读数据** | `src/hooks/useTabs.ts:13-16`、`:149-168` |
| 预览读取 | 只有 `read_csv_file`(csv crate 解析文本),后端**零** parquet/arrow/duckdb 读取代码 | `src-tauri/src/csv.rs:144-161` |
| 管道执行(纯 xan) | 把 `input_file` 的**字节流**喂给首命令 stdin(或作为 `sort/dedup/shuffle/from` 的位置参数),并注入 `-d <delimiter>` / `--no-headers` | `src-tauri/src/pipeline.rs:229-263`、`:277-374` |
| 管道执行(含 duckdb 步骤) | 整条管道切到 `pipeline_seq` 顺序物化引擎;每个 duckdb 步骤的上游结果先落成**临时 CSV**,再用 `read_csv_auto('<tmp>', header = true)` 暴露成虚拟关系 `input` | `src-tauri/src/pipeline.rs:775-815`、`:860-1070` |

结论:输入侧的一切都建立在「输入文件是 CSV 文本」这个前提上。把 `.parquet` 直接丢进去,首命令要么把二进制当 CSV 解析、要么 `read_csv_auto` 报错。

同时另有两处现状值得记一笔:

- 文件对话框的 filter **已经列了 Parquet**(`src/hooks/fileIO/useFileOpen.ts:8`),但选中后走的是「非 CSV,请用 from 命令」分支 —— 已经是「能选不能用」的状态。
- 用户今天已经可以在 duckdb 步骤的 SQL 里手写 `read_parquet('D:/x.parquet')`,但这不是「输入文件」:`input` 关系仍然只指向上游 CSV,且 `.duckdb` 数据库文件因为要选表,手写起来更别扭。

---

## 2. 目标与非目标

目标:

| # | 诉求 | 落地位置 |
|---|------|----------|
| 1 | `.parquet` 文件可作为标签页输入:能预览、能成为管道输入 | §4.2 / §4.3 |
| 2 | `.duckdb`(数据库文件)可作为标签页输入,并能选择读哪张表 | §4.1 / §4.2 |
| 3 | 非 CSV 输入对**纯 xan 管道**与**含 duckdb 步骤的管道**都成立 | §4.3 |
| 4 | **CSV 路径行为零变化**(契约、分隔符检测、会话、脚本导出均不动) | §4.3 / §6 |
| 5 | **多个 duckdb SQL 步骤可串联执行**:全链 duckdb 时单进程串联、零交接文件;混合链跨进程才用 parquet 交接 | §4.4 |

非目标:

- **不引入 Rust `arrow`/`parquet`/`duckdb` crate**,不把 DuckDB 打进安装包。理由见 §3(与 011「不打包、按需插件」的原则一致)。
- 不把 `xlsx`/`json`/`ndjson` 等也做成「输入文件」。它们继续走 `xan from` 命令 / batch-from 对话框(018 已明确:非 CSV 不做分隔符检测)。
- **不做输出侧的格式扩展**:管道结果仍以 CSV 文本回传/写文件。要把结果写成 parquet,用户在 duckdb 步骤的 SQL 里用 `COPY ... TO 'x.parquet' (FORMAT PARQUET)` 自行完成。
- 不做 parquet/duckdb 的 schema 展示与类型化预览:预览仍是字符串网格(与 CSV 预览同构)。
- 不做 duckdb 文件的建表/改表/写回(全程只读)。
- 不改 `read_csv_file` 的签名与返回契约(它还有 CSV 对比等其它调用方)。

---

## 3. 方案对比与决策

| 方案 | 读取实现 | 优点 | 代价 | 结论 |
|------|----------|------|------|------|
| A. Rust 原生解析 | `parquet` crate 读 parquet + `duckdb` crate 读 `.duckdb` | 不依赖插件、速度快、进程内 | `parquet`/`arrow` 是重量级依赖;**`.duckdb` 存储格式没有纯 Rust 读取器**,`duckdb` crate 会把整个 DuckDB C++ 编进二进制(编译时间与体积双爆);与 011「不打包 DuckDB」原则冲突 | ❌ 否决 |
| B. 一律走 DuckDB CLI 物化 | 任何非 CSV 输入先用 duckdb CLI 导出成临时 CSV,再走现有全部逻辑 | 改动最小、规则单一 | 对大 parquet 等于多写一份同体积临时文件;parquet 的类型(DECIMAL/TIMESTAMP)经 CSV 文本往返会退化 | ⚠️ 作为退路保留 |
| **C. 按需物化(推荐)** | 首个消费步骤是 duckdb → **原生直读**原始文件(零转换);否则先物化一次成 CSV | 保留类型保真;避免「只跑一个 duckdb 步骤」时的无谓全量拷贝;xan 步骤必然要 CSV,物化在该场景本来就是必需的 | 多一个「首步是不是 duckdb」的判定分支 | ✅ 采纳 |

方案 C 的规则一句话:

> **能不用 CSV 中间层就不用**:管道的第一步如果是 duckdb 步骤,就把原始 parquet/`.duckdb` 直接交给它的 `input` 视图;否则(第一步是 xan 命令、或整条管道没有 duckdb)先物化一次成 CSV,之后全部按今天的逻辑跑。
>
> **全链都是 duckdb 步骤时,连交接文件都不要**:整条链拼成一个 SQL 脚本,在一个 duckdb 进程里跑完,数据从头到尾不离开 DuckDB(§4.4.1)。只有 xan 步骤混在链中、必须跨进程传递时,才在 duckdb→duckdb 的邻接边界上用 parquet 临时文件交接(§4.4.2)。**xan 步骤不会被禁止出现在 duckdb 之后** —— 它在哪,哪里就落一次 CSV(xan 只吃 CSV)。

---

## 4. 设计

### 4.1 输入格式识别(新模块 `src-tauri/src/tabular.rs`)

新增模块承载「非 CSV 表格格式」的一切,`csv.rs` 保持纯 CSV。

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputFormat { Csv, Parquet, Duckdb }

/// 按扩展名判定输入格式(大小写不敏感)。
/// 只识别 `parquet` / `duckdb` / `ddb` / `db`;其余一律 `Csv` —— 
/// 与现状一致(后端不新增失败面)。
pub fn detect_input_format(path: &str) -> InputFormat;

/// `Read` / `Write` 都需要的源描述。只描述「数据从哪来」,不涉及 SQL。
#[derive(Debug, Clone)]
pub enum SourceRef {
  Csv(PathBuf),                                       // 今天的 `current_input`
  Parquet(PathBuf),
  Duckdb { path: PathBuf, table: String },            // table 为「表名」或「schema.表名」
}
```

扩展名决策:

| 扩展名 | 判定 | 说明 |
|--------|------|------|
| `parquet` | Parquet | — |
| `duckdb` | Duckdb | `.db` 存在歧义(可能是 SQLite)。DuckDB 会明确报 `not a valid DuckDB database file`,比现状的「请用 from 命令」更有信息量;`.sqlite`/`.sqlite3` **不识别**(DuckDB 需额外扩展才能读 SQLite,不在本期范围) |
| `csv` / `txt` / `tsv` / 其它 | Csv | 完全维持现状 |

⚠️ 前端负责「能不能打开」(未知扩展名沿用现状提示),后端负责「按什么格式读」(未知一律当 CSV)。两者不对称是**有意**的:后端多识别一种格式就会多一条失败路径,而前端多拦一次只是少一次提示。

DuckDB 可执行文件的获取复用插件机制,并给出可读的错误:

```rust
fn duckdb_executable() -> Result<PathBuf, String> {
  plugins::resolve_plugin_executable("duckdb")
    .ok_or_else(|| "DuckDB plugin is required to read .parquet / .duckdb files. \
                    Install it under Settings → Plugins.".to_string())
}
```

SQL 片段的安全拼接(全部纯函数,可单测):

```rust
fn quote_literal(s: &str) -> String;   // ' -> ''   用于路径字面量
fn quote_ident(s: &str) -> String;     // " -> ""   用于表名/列名
fn path_literal(p: &Path) -> String;   // 反斜杠归一为 `/`,再 quote_literal(沿用 pipeline.rs:794 的做法)
```

### 4.2 `.duckdb` 表列举与选表

`.duckdb` 是数据库而不是表,必须让用户选表。新增命令:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct DuckdbTableInfo { pub schema: String, pub name: String, pub kind: String }

/// 只读挂载后列出用户表/视图;`main` 之外的 schema 也一并返回。
#[tauri::command]
pub async fn list_duckdb_tables(path: String) -> Result<Vec<DuckdbTableInfo>, String>;
```

实现(一次进程调用,`-csv -noheader` 输出、csv crate 解析,不引入 JSON 解析依赖):

```text
duckdb -csv -noheader -bail -c "ATTACH '<path>' AS src (READ_ONLY);
  SELECT table_schema, table_name, table_type FROM information_schema.tables
   WHERE table_catalog = 'src'
     AND table_schema NOT IN ('information_schema','pg_catalog')
   ORDER BY table_schema, table_name;"
```

- **不把 `.duckdb` 路径作为位置参数传**(那样 DuckDB 可能创建/独占打开文件);统一 `ATTACH ... (READ_ONLY)`,连接本身在内存里。
- `SourceRef::Duckdb.table` 在 `main` schema 下拼 `"表名"`,否则拼 `"schema"."表名"`。
- 前端策略:0 张表 → 报错;1 张表 → 自动选中(不打扰用户);多张 → 弹轻量选择对话框(§4.5)。

### 4.3 预览读取 `read_tabular_file`

新增命令,返回 `TabularData`(是 `CsvData` 的超集):

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct TabularData {
  pub headers: Vec<String>,
  pub rows: Vec<Vec<String>>,
  pub columns: usize,
  /// "csv" | "parquet" | "duckdb"
  pub format: String,
  /// 仅 `format == "csv"` 时有意义(非 CSV 为 None)。
  pub delimiter: Option<String>,
  pub delimiter_source: Option<String>,
  pub delimiter_confidence: Option<String>,
  /// 仅 duckdb 输入时有值,用于「所见即所跑」地回显选中的表。
  pub source_table: Option<String>,
}

#[tauri::command]
pub async fn read_tabular_file(
  file_path: String,
  table: Option<String>,             // duckdb 输入必填
  delimiter: Option<String>,
  fallback_delimiter: Option<String>,
  limit: Option<usize>,              // 默认 51,前端传 31
) -> Result<TabularData, String>;
```

分派:

| 输入 | 实现 |
|------|------|
| CSV | 直接复用 `csv.rs::read_csv_sync`,字段一一对应,`format = "csv"`。**不复制解析逻辑** |
| Parquet / Duckdb | `duckdb -csv -bail -c "SELECT * FROM <relation> LIMIT <limit>"` 拿 stdout,用 `csv::ReaderBuilder::new().delimiter(b',').flexible(true)` 解析出 headers + rows;`format` 为对应值,`delimiter*` 为 `None` |

`<relation>`:parquet → `read_parquet('<path>')`;duckdb → `ATTACH '<path>' AS src (READ_ONLY); … FROM src.<quoted table>`。

要点:

- **有界读取**:`LIMIT` 保证预览是常量内存,不受文件大小影响。
- **表名/路径必须转义**(`quote_ident`/`quote_literal`),否则 `my"table`、`O'Brien` 这类名字会拼出语法错误甚至注入。
- 预览的列名来自 parquet schema / 数据库表定义,**比 CSV 往返更准**。
- 进程启动开销:duckdb.exe 约 50 MB,冷启动约百毫秒量级 —— 只在「打开文件」这一次发生,可接受;不做缓存(文件可能被外部改写)。

### 4.4 管道执行:按需物化

`execute_xan_pipeline` 增加一个参数(前端 `inputTable`):

```rust
#[tauri::command]
pub async fn execute_xan_pipeline(
  commands: Vec<PipelineCommand>,
  input_file: String,
  input_table: Option<String>,     // 新增:duckdb 输入时由前端选中并回传
  default_delimiter: String,
  max_output_bytes: Option<usize>,
) -> Result<ExecutionResult, String>;
```

入口分派(在现有 `has_duckdb` 判定之前):

```text
format          = detect_input_format(&input_file)
all_duckdb      = !commands.is_empty() && commands.iter().all(is_duckdb)
first_is_duckdb = commands.first().map(is_duckdb).unwrap_or(false)

if all_duckdb:
    → run_duckdb_chain:整条链单进程串联(§4.4.1),任何输入格式都适用,
      不产生任何交接文件
      · duckdb 输入但 input_table 为空 → 直接报错(要求前端选表)
      · 含 csv 输入的全 duckdb 链也从「逐进程 + 中间 CSV」升级为单进程(有意的行为改进)
else if first_is_duckdb:
    → SourceRef::原生(parquet | duckdb{ table })走 pipeline_seq(混合链,§4.4.2)
      · duckdb 输入但 input_table 为空 → 直接报错
else if format != Csv:
    → materialize_input_to_csv():用 duckdb 导出一份临时 CSV,
      input_file 换成该临时文件,再走今天的两条路径(纯 xan 并发路径或 pipeline_seq)
else:
    → 完全维持今天的两条路径
```

`pipeline_seq` 的改动局限在一处:`current_input: PathBuf` → `current_input: SourceRef`。

- 步 0:`SourceRef::原生`(仅按需直读时)否则 `SourceRef::Csv(input_file)`。
- 每步非末尾步骤结束后:`current_input = SourceRef::Csv(下一个临时 CSV)`(与今天一致)。
- xan 的「要文件路径而非 stdin」命令(`sort`/`dedup`/`shuffle`/`from`)只在**步 0** 可能拿到原生非 CSV —— 而按上面的规则,步 0 是这类命令时一定已经物化成 CSV 了,所以 `needs_file_path` 分支不用动。

`build_duckdb_args` 的改动:参数由 `&Path` 换成 `&SourceRef`,前导 SQL 由新函数生成:

```rust
fn source_view_sql(src: &SourceRef) -> String {
  match src {
    SourceRef::Csv(p)        => format!("CREATE VIEW input AS SELECT * FROM read_csv_auto('{}', header = true);", path_literal(p)),
    SourceRef::Parquet(p)    => format!("CREATE VIEW input AS SELECT * FROM read_parquet('{}');",              path_literal(p)),
    SourceRef::Duckdb{path, table} => format!(
      "ATTACH '{}' AS src (READ_ONLY); CREATE VIEW input AS SELECT * FROM src.{};",
      path_literal(path), qualified_ident(table)),
  }
}
```

其余不变:仍然只在 `sql.references_input()` 为真时前插(`references_input()` 的实现与测试不受影响),仍然 `-csv` + `-separator <default_delimiter>` + `-bail`。

#### 4.4.1 全链 duckdb:单进程 SQL 串联(首选)

先回答「为什么还要从 duckdb 交接为 parquet」:**不需要 —— 那只是混合链的权宜之计**。交接文件存在的唯一原因是**跨进程边界**(今天的引擎里每个 duckdb 步骤是独立子进程,上游结果必须经磁盘才能到下游)。只要**整条管道的每一步都是 duckdb 步骤**,就把链拼成一个 SQL 脚本、在**一个 duckdb 进程**里跑完:数据从头到尾不离开 DuckDB,零交接文件:

```sql
-- 0) 源视图(SourceRef 决定形态:csv → read_csv_auto;parquet → read_parquet;duckdb → ATTACH)
CREATE VIEW input AS SELECT * FROM read_parquet('C:/data/src.parquet');

-- 1..k-1) 每个中间步:先物化成临时表,再把 input 指过去
CREATE TEMP TABLE _step_1 AS ( <sql_1 去尾部 ;> );
CREATE OR REPLACE VIEW input AS SELECT * FROM _step_1;
CREATE TEMP TABLE _step_2 AS ( <sql_2> );
CREATE OR REPLACE VIEW input AS SELECT * FROM _step_2;
DROP TABLE _step_1;                 -- 旧中间表立即释放,任意时刻至多 1–2 份中间结果驻留
…

-- k) 最后一步:SQL 原样执行,结果由 -csv 输出
<sql_k>
```

两个关键取舍的理由:

- **为什么中间步要落临时表,而不是直接 `CREATE OR REPLACE VIEW input AS ( <sql> )`?** 后者是新定义在创建时引用旧的 `input`(自引用),行为取决于 DuckDB 的视图绑定时机,是歧义坑;先把 `sql_i` 求值成临时表 `_step_i`(此刻 `input` 仍指向正确上游),再把 `input` 指向**另一个名字**,每条 SQL 都在与逐步执行完全相同的 catalog 状态下求值,不依赖绑定时机。
- **取消/错误归因怎么办(逐进程方案原以为只有它做得到)?**
  - 取消:kill 这一个进程 = 取消整条链。UI 可见行为与今天「kill 当前步骤并中止后续」等价 —— 两者都不会再跑后面的步骤。
  - 错误归因:脚本由我们生成,**每条语句的起始行号是已知的**;把 DuckDB 报错里的 `LINE n` 映射回所属步骤,照常写进 `step_errors`(映射是纯函数,可单测)。若实测发现行号是「语句内相对行号」,退化为按语句序号定位(PoC ③)。

执行形态与接线:

```text
duckdb -csv -separator <sep> -bail -c "SET temp_directory='<临时目录>'; <整条链脚本>"
```

- stdout 只有最后一步的结果 → 现有的「最后一步 `output` 参数写文件」「结果面板/预览」逻辑**全部不变**。
- 内存:中间结果是 TEMP 表,超内存按 `temp_directory` 溢写磁盘(显式 `SET`,不赌默认值);进程结束由 DuckDB 清理,我们不留任何文件。
- 进程开销:整条链 **1 次**启动(逐进程方案是 N 次,每次约百毫秒)。

```rust
/// 全链 duckdb 的单进程脚本。返回 (SQL 文本, 每条语句起始行号 → 步骤 id 的映射)。
fn build_duckdb_chain_sql(
  commands: &[PipelineCommand],
  source: &SourceRef,
  default_delimiter: &str,
) -> Result<(String, Vec<(usize, String)>), String>;
```

约束与 PoC:

| 项 | 内容 |
|----|------|
| 约束 | 每个**非最后**步骤的 SQL 必须是单条查询语句(`CREATE TEMP TABLE … AS ( … )` 的要求):剥掉尾部 `;` 后仍含 `;` → 报错 `A chained duckdb step must be a single query (found multiple statements). Split it into separate steps or place it last.`;`INSERT`/`UPDATE`/DDL 等「无结果集」语句做中间步同样被拒。**最后一步不受限**,原样执行(与今天语义一致) |
| PoC ① | `CREATE TEMP TABLE t AS ( PIVOT input ON … )` —— PIVOT/UNPIVOT 能否出现在子查询位置 |
| PoC ② | `SET temp_directory` 后超内存溢写是否生效 |
| PoC ③ | 报错里的 `LINE n` 指向整段脚本还是语句内相对行(决定行号映射的口径) |

用户 SQL 的写法约定(实现补充,2026-09-28):

| 场景 | 写法 |
|------|------|
| 通用 | `SELECT * FROM input …` —— `input` 永远指向「当前这一步的上游」 |
| 直接引用 `.duckdb` 库内的表 | `SELECT * FROM src.t1 …` —— 源库固定 ATTACH 为 `src`(READ_ONLY),主连接是内存库,裸表名 `t1` **不可见** |
| 多步串联 | 第 2 步起 `input` = 上一步结果;最后一步的结果即管道输出 |

实现注意:`run_duckdb_chain` spawn duckdb 时必须 `stdout(Stdio::piped())` + `stderr(Stdio::piped())` —— `wait_with_cancel` 依赖这两个管道,漏掉会报 `Failed to get stdout handle`。

#### 4.4.2 混合链:跨进程才交接(parquet)

只要链里混着 xan 步骤,duckdb 步骤之间就必须跨进程传递,交接物按**邻接关系**选择:

| 相邻边界 | 交接物 |
|----------|--------|
| duckdb → duckdb | `COPY ( <sql> ) TO '<tmp>.parquet' (FORMAT PARQUET);`,**不走 stdout**;下游 `input` 视图 = `read_parquet('<tmp>.parquet')`(由 `SourceRef::Parquet` + `source_view_sql` 自然生成);类型(DECIMAL/TIMESTAMP)不经历 CSV 文本往返而退化 |
| duckdb → xan,或 duckdb 是最后一步 | 照旧 `-csv` 输出到 stdout(最后一步的 `output` 参数写文件、结果面板、预览全部不变) |
| xan → duckdb | 上游临时 CSV → `read_csv_auto`(今天的机制) |

```rust
/// 混合链中 duckdb 步骤的 argv。`next_is_duckdb` 决定结果交出去的方式。
fn build_duckdb_args(
  cmd: &PipelineCommand,
  source: &SourceRef,
  default_delimiter: &str,
  next_is_duckdb: bool,
  next_temp: Option<&Path>,   // next_is_duckdb 时必填
) -> Vec<String>;
```

- `next_is_duckdb == false` → 与今天逐字节一致:`-csv -separator <sep> -bail -c "<preamble><sql>"`。
- `next_is_duckdb == true` → `-bail -c "<preamble>COPY ( <sql> ) TO '<next_temp>' (FORMAT PARQUET);"`(`<sql>` 同样剥掉尾部 `;` 并拒绝多语句,文案与 §4.4.1 相同)。
- 临时文件由 `make_temp_parquet()` 生成(`EasyCsv_duckdb_{pid}_{n}.parquet`),登记进 `TempFiles` 守卫统一清理。

```text
[duckdb A] ─COPY→ tmp1.parquet ─read_parquet→ [duckdb B] ─-csv stdout→ tmp2.csv ─→ [xan filter] ─→ …
```

对 `pipeline_seq` 的实际接线只有两处:`next_temp` 的生成改用 `make_temp_parquet()` 并把下游 `SourceRef` 记为 `Parquet(tmp)`;`feed_stdin` 对 duckdb 本来就是 false,不动。

> PoC 验证项(随 §7 集成测试一起做):① `COPY ( SELECT … ) TO 'x.parquet' (FORMAT PARQUET)` 在 `-c` 参数内可用;② `COPY ( PIVOT input ON … ) TO …` —— PIVOT/UNPIVOT 能否出现在子查询位置;③ COPY 失败时进程退出码非零且 stderr 完整(供 `step_errors` 归因)。

物化函数(方案 C 的「否则」分支):

```rust
/// 把非 CSV 输入导出成临时 CSV,供纯 xan / xan-优先 的管道消费。
fn materialize_input_to_csv(
  src: &SourceRef,
  no_headers: bool,        // 配置里的无表头开关:为真时加 `-noheader`
  default_delimiter: &str, // 空 → ",",与 build_duckdb_args 同规则
  cancel: &AtomicBool,
) -> Result<PathBuf, String>
```

- 命令行形如:`duckdb -csv -c "SELECT * FROM <relation>" -separator <sep> -bail [-noheader]`。
- stdout **直接流式写入**临时文件(`wait_with_cancel_to_file`),不做内存缓冲 —— 与 duckdb 步骤的物化路径同构。
- 关键不变量:**导出用的 `-separator` 必须等于 `default_delimiter`**。因为下游步 0 的 xan 命令会以 `-d <default_delimiter>` 打开它(i == 0 的分隔符注入逻辑完全没改),两边必须一致。
- 失败时把 DuckDB 的 stderr 原文透传(错误归因最直接),并把临时文件删掉。

### 4.5 临时文件与取消

- 复用现有 `make_temp_csv()`(`EasyCsv_duckdb_{pid}_{n}.csv`),不新造命名规则。
- 物化产生的临时文件的清理**必须覆盖所有提前返回路径**(取消、报错、`?` 传播)。建议引入一个 RAII 守卫:

```rust
#[derive(Default)]
struct TempFiles(Vec<PathBuf>);
impl TempFiles { fn push(&mut self, p: PathBuf); }
impl Drop for TempFiles { fn drop(&mut self) { /* remove_file 逐个忽略错误 */ } }
```

  `pipeline_seq` 内部已有的 `temp_files: Vec<PathBuf>` 保持原样;入口处的物化文件由 `TempFiles` 守卫负责,两者互不重叠。
- **取消**:物化阶段同样走 `wait_with_cancel_to_file`,即「取消按钮在非 CSV 输入的物化期间也有效」,取消后按现有语义返回 `cancelled: true`。

### 4.6 前端接线(必要但次要)

| 位置 | 改动 |
|------|------|
| `src/utils/fileFormat.ts`(**新增**) | `TabularFormat = "csv" \| "parquet" \| "duckdb"`、`detectTabularFormat(path)`、`isCsvFile(path)`(把 `useTabs.ts:13` 的私有函数提上来,成为唯一真相) |
| `src/hooks/fileIO/useFileOpen.ts` | filter 增加 `{ name: "DuckDB", extensions: ["duckdb", "ddb", "db"] }`;Parquet 条目保留 |
| `src/hooks/useTabs.ts` | `loadCsvData` 改为 `read_tabular_file` 单一入口:`format === null` → 现状的 info 日志分支;`csv` → 与今天逐字段等价;`parquet`/`duckdb` → 读预览并写入 `inputFormat`/`sourceTable`。**分隔符重读 effect(`:221-225`)必须限制在 `format === "csv"`** |
| `src/hooks/useTabs.ts`(选表) | `loadCsvData` 新增注入式回调 `requestTableSelection(path, tables) => Promise<string \| null>`(由 App 层实现为打开选表对话框),保持 hook 纯净可测。0 表报错、1 表自动选、多表回调 |
| `src/modules/dialogs/file/DuckdbTableDialog.tsx`(**新增**) | 轻量选表对话框:列 `schema.table` + 类型(BASE TABLE / VIEW) |
| `src/types/xan.ts` | 新增 `TabularFormat`、`TabularReadResult`(delimiter 三件套可为空);`PipelineTab` 增加 `inputFormat?: TabularFormat`、`sourceTable?: string` |
| `src/utils/session.ts` | `TabSnapshot` + 序列化/反序列化补 `inputFormat`/`sourceTable`(可选字段,旧会话不受影响) |
| `src/hooks/execution/executeBranch.ts` | `invoke("execute_xan_pipeline", { …, inputTable: tab?.sourceTable ?? null })` |
| `src/modules/pipeline/nodes/TableNode.tsx` | `format !== "csv"` 时不渲染分隔符徽标(`DelimiterModeSelect`),改渲染只读徽标:`PARQUET` / `DUCKDB · <table>` |
| `src/hooks/fileIO/pipelineScript.ts` | **不改**。导出脚本里非 CSV 输入没有等价物,补一条注释说明「需自行前置 `duckdb -c "SELECT * FROM read_parquet(...)"`」(与现有 duckdb 步骤注释同址) |
| i18n | 新增:`duckdbSelectTable`、`duckdbNoTables`、`duckdbTableHint`、`duckdbPluginRequired`、`inputFormatParquet`、`inputFormatDuckdb`(中英同序) |

App 层拖拽打开(`useAppBootstrap.ts:101-127`)、最近文件、导入会话都汇入 `loadCsvData`,所以自动获得新格式支持,无需单独改。

### 4.7 数据流总览

```text
                           ┌─ csv ──────────────► 今天原样
打开 .parquet / .duckdb ──►│
                           └─ parquet/duckdb ───► read_tabular_file(LIMIT n)
                                                        │  预览网格 + 只读格式徽标
                                                        ▼
                                                   tab.inputFormat / tab.sourceTable
                                                        │
执行管道 ───────────────────────────────────────────────┘
   ├─ 全链都是 duckdb ──► 单进程 SQL 串联(临时表 + 重定义 input)──► 零交接文件(§4.4.1)
   ├─ 混合链且步0 = duckdb ──► SourceRef::原生 ──► read_parquet / ATTACH src.table → CREATE VIEW input
   │        ├─ duckdb→duckdb 边界 ──► COPY (sql) TO tmp.parquet ──► 下一步 read_parquet(tmp)
   │        └─ duckdb→xan 边界 ────► -csv stdout ──► 临时 CSV ──► xan
   └─ 混合链且步0 = xan、非 CSV 输入 ──► materialize_input_to_csv() ──► 临时 CSV ──► 今天的两条路径(并流 / pipeline_seq)
```

---

## 5. 影响面

| 文件 | 改动 |
|------|------|
| `src-tauri/src/tabular.rs` | **新增**:`InputFormat` / `SourceRef` / `detect_input_format` / `duckdb_executable` / `quote_literal` / `quote_ident` / `path_literal` / `qualified_ident` / `list_duckdb_tables` / `read_tabular_file` / `materialize_input_to_csv` / `source_view_sql` + 单测 |
| `src-tauri/src/pipeline.rs` | `execute_xan_pipeline` 增 `input_table` 参数与入口分派;**新增 `run_duckdb_chain` / `build_duckdb_chain_sql`(全链 duckdb 的单进程串联,含行号→步骤映射)**;`pipeline_seq` 的 `current_input` 改 `SourceRef`;`build_duckdb_args` 改签名并调用 `source_view_sql`,**并按「下一步是否为 duckdb」分派 `COPY → tmp.parquet` 交接**(新增 `make_temp_parquet()`);新增 `TempFiles` 守卫 |
| `src-tauri/src/lib.rs` | `pub mod tabular;` + 注册 `tabular::list_duckdb_tables`、`tabular::read_tabular_file` |
| `src-tauri/src/plugins.rs` | 无需改(`duckdb` 已 seed)。可选:`check_plugins` 的版本参数做 per-plugin 映射(011 §4.2 提到的 `-version`) |
| `src-tauri/src/csv.rs` | 仅需把 `read_csv_sync` 提升为 `pub(crate)` 供 `tabular.rs` 复用;其余不动 |
| 前端 | 见 §4.6 表格(1 个新 util、1 个新对话框、6 个既有文件、i18n) |
| `docs/AI/INDEX.md` | 实现后登记:设计文档、新命令、`tabular.rs` 模块、前端文件、测试与速查行 |
| `src/__tests__/` | 新增 `fileFormat.test.ts`;扩展 `useTabsDelimiter.test.ts` |

---

## 6. 边界与失败行为

| 场景 | 行为 |
|------|------|
| 未安装 duckdb 插件 | 打开 `.parquet`/`.duckdb` 时明确报错:提示到「设置 → 插件」安装(§4.1 的 `duckdb_executable`)。**前端把失败经注入式 `onOpenError` 回调弹成 toast**(欢迎页才会让位,否则只有日志、界面无反馈);后端消息含 "DuckDB plugin is required" 时由 App 映射为本地化的 `duckdbPluginRequired` 文案 |
| `.duckdb` 有多张表、未选表 | 前端弹选表对话框;后端 `input_table` 为空直接报错,不做「随便挑一张」的猜测 |
| `.duckdb` 一张表都没有 | 前端报错 `duckdbNoTables`,不发预览请求 |
| `.duckdb` 被其它进程独占 | DuckDB 的锁错误原文透传(建议文案里提示关闭占用进程)。只读挂载**不能**绕过 DuckDB 的文件锁 |
| 文件扩展名伪装(改名的 parquet / SQLite 改名成 `.duckdb`) | DuckDB 的解析错误原文透传,不做事后纠正 |
| 路径含单引号 / 表名含双引号 | `quote_literal` / `quote_ident` 转义后拼接(纯函数,有单测) |
| Windows 反斜杠路径 | 归一为 `/` 后放入单引号字面量(沿用 `pipeline.rs:794` 的既有做法) |
| 配置为「无表头」 | 物化时加 `-noheader`(与 `--no-headers` 语义一致);原生直读路径不影响 duckdb 步骤(它本就不接收该标志) |
| `default_delimiter` 为空 | 物化用 `,`,与 `build_duckdb_args` 同规则 |
| 大 parquet + 第一步是 xan 命令 | 会写出一份等体积临时 CSV,需要磁盘空间;这是「xan 只吃 CSV」的必然代价,文档中明示 |
| 大 parquet + 单步 duckdb | 原生直读,无临时文件,无类型退化 |
| 单进程链的非最后一步 / 混合链中间 duckdb 步的 SQL 含多条语句 | 报错 `A chained duckdb step must be a single query (found multiple statements). Split it into separate steps or place it last.`,不发进程 |
| 单进程链的非最后一步 / 混合链中间 duckdb 步的 SQL 是 `INSERT` / DDL 等非查询 | 同上被拒(`CREATE TEMP TABLE … AS` / `COPY ( … )` 包装要求查询);建议放到链尾(链尾原样执行,与今天语义一致) |
| 单进程链中某步出错 | DuckDB 报错里的行号映射回所属步骤,写入 `step_errors`(纯函数可单测;行号口径见 PoC ③) |
| 混合链 duckdb→duckdb 边界的中间产物 | parquet 临时文件,类型不退化;由 `TempFiles` 守卫统一清理。全链 duckdb 的单进程串联没有此产物 |
| 执行中取消 | 物化阶段与管道阶段都响应取消(kill 子进程) |
| 物化失败 / 管道中途失败 / 提前返回 | 临时文件(CSV 与 parquet)由 `TempFiles` 守卫在 drop 时清理 |
| CSV 输入 | 代码路径、返回结构、分隔符检测、会话快照全部不变(回归红线) |

---

## 7. 测试计划

后端(`cargo test`):

- 纯函数:`detect_input_format`(大小写、`a.CSV`、`x.parquet`、`x.duckdb`/`.ddb`/`.db`、未知扩展名 → Csv、无扩展名);`quote_literal`(`O'Brien`)/`quote_ident`(`my"col`)/`path_literal`(反斜杠归一)/`qualified_ident`(main 与非 main schema);`source_view_sql` 三种形态的完整 SQL 文本断言。
- 单进程串联(`build_duckdb_chain_sql`):生成的脚本逐行断言 —— 源视图、`CREATE TEMP TABLE _step_N AS ( … )`、`CREATE OR REPLACE VIEW input AS SELECT * FROM _step_N`、`DROP TABLE` 的顺序与命名、最后一步 SQL 原样收尾;尾部 `;` 与空白被剥掉;非最后一步含多条语句 → 拒绝并断言错误文案;`LINE n → step id` 映射函数(含跨行语句与「语句内相对行」的退化口径)。
- 混合链分派(`build_duckdb_args`):下一步是 duckdb → argv 为 `COPY ( … ) TO '…parquet' (FORMAT PARQUET)` 且**不含** `-csv`/`-separator`;下一步是 xan / 本步是最后一步 → argv 与今天的实现逐字节一致(回归红线)。
- `make_temp_parquet()` 命名与登记进 `TempFiles`。
- 回归:`references_input()` 的既有测试必须原样通过(它决定了前导 SQL 拼不拼)。
- 集成(实测依赖真实 `duckdb.exe`,用「检测不到可执行文件即跳过」或 `#[ignore]` 标记,避免 CI 红):`list_duckdb_tables`(多表/单表/空库)、`read_tabular_file` 对 parquet 与 `.duckdb` 的首行/行数/列数、物化后的临时 CSV(表头、分隔符与 `default_delimiter` 一致、`-noheader` 生效);**全链 duckdb 三步链**:单进程执行、最终结果与逐步执行等价、中间零文件、错误归因到出错的那一步;**混合链 duckdb→xan→duckdb**:边界产物分别为 parquet 与 CSV;以及 §4.4.1 的三个 PoC 验证项(`PIVOT` 子查询、`temp_directory` 溢写、报错行号口径)与 §4.4.2 的 `COPY` 失败退出码/stderr。

前端(`vitest`):

- `fileFormat.test.ts`(新):扩展名大小写、未知 → `null`、`.db` → `duckdb`。
- `useTabsDelimiter.test.ts`(扩展):`.parquet` 走 `read_tabular_file` 且**不**触发分隔符逻辑;切换分隔符设置时非 CSV 标签不重读;duckdb 单表自动选中 / 多表走回调 / 0 表报错。
- 回归:`pnpm test` 全量通过;`pnpm typecheck` / `pnpm lint` 无新增问题(`max-lines` 若因 `tabular.rs` 之外的既有文件越界,保持 `warn`)。

---

## 8. 已知限制

- **强依赖 DuckDB 插件**:parquet 与 `.duckdb` 都必须有 `duckdb.exe`;缺失时功能不可用(只有明确提示,没有内置兜底)。
- **`.db` 扩展名有歧义**:SQLite 文件会被当成 DuckDB 打开并报错。这是「不做格式嗅探」的取舍(嗅探要读文件头,成本与误判风险都更高)。
- **预览是类型化之后又被字符串化**:parquet 的 `DECIMAL`/`TIMESTAMP` 在预览网格里是文本,与真实分析结果可能观感不同(仅预览如此;原生直读的 duckdb 步骤不受影响)。
- **物化路径会落地一份与源同体积的临时 CSV**(仅当第一步是 xan 命令时);极端情况下需要等量磁盘空间。
- **不做格式嗅探/校验**:扩展名是唯一依据。
- **每次预览都起一个 duckdb 进程**:没有连接池/缓存;单次百毫秒级启动开销,换来的是「文件被外部改写后预览永远是新的」。
- 导出脚本(`.sh`/`.ps1`)不装非 CSV 输入;导出的脚本需要用户自行补数据源(与 duckdb 步骤今天在脚本里的待遇一致)。
- **链中非最后的 duckdb 步必须是单条查询语句**(单进程链的 `CREATE TEMP TABLE … AS ( … )` 与混合链的 `COPY ( … )` 包装都要求);多语句步骤请拆成多步或放在链尾(链尾原样执行,语义与今天一致)。字符串字面量里的 `;` 会被启发式误判为多语句(已知误报,宁可拒绝也不静默改变语义)。
- **单进程链的错误归因依赖 DuckDB 报错里的行号格式**:映射是确定性的(脚本由我们生成,行号表是现成的),但格式若变需要跟随;最坏退化是「错误挂在整条链上」(见 PoC ③)。
- **单进程链的中间结果是 TEMP 表**:超内存按 `temp_directory` 溢写;与逐进程方案相比,整条链共享一份内存预算(逐进程的每步内存互不影响)。
- **混合链的跨进程交接仍落 parquet 临时文件**(全链 duckdb 没有);由 `TempFiles` 守卫统一清理。
- 表结构、行数统计、schema 浏览等元信息一律不做(超出「读取」范畴)。

---

## 9. 参考

- DuckDB CLI 官方文档(参数表:`-c` / `-csv` / `-noheader` / `-separator` / `-bail`;`duckdb [OPTIONS] [FILENAME] [SQL]`):https://duckdb.org/docs/stable/clients/cli/overview
- DuckDB CSV / Parquet 读取(`read_csv_auto` / `read_parquet`)、`ATTACH` 与 `READ_ONLY` 选项:https://duckdb.org/docs/stable/data/parquet/overview 、https://duckdb.org/docs/stable/sql/statements/attach
- 本项目现状源码:`src-tauri/src/pipeline.rs`(`execute_xan_pipeline` / `pipeline_seq` / `build_duckdb_args` / `make_temp_csv`)、`src-tauri/src/plugins.rs`(`resolve_plugin_executable`)、`src-tauri/src/csv.rs`(`read_csv_sync`)、`src/hooks/useTabs.ts`(`loadCsvData`)、`src/hooks/fileIO/useFileOpen.ts`
- 相关设计:`docs/design/011_duckdb-plugin.md`、`docs/design/018_open-file-delimiter-detection.md`
