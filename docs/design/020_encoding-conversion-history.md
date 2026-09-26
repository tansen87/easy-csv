# CSV 编码转换 保留上次记录 — 设计文档

> 状态: 已实现(2026-09-21)
> 日期: 2026-09-21
> 关联: `docs/design/017_separate-dialog-ux.md`(本方案直接复用其「上次结果」模式)、`docs/AI/INDEX.md` → 修改 CSV 编码转换 / 修改国际化文本
> 前置: 016 / 017 已实现(拆分好/坏行的「上次结果」已在跑)

---

## 1. 背景与目标

`CsvEncodingDialog`(编码转换)与 `SeparateCSVDialog`(拆分好/坏行)是同一类「选文件 → 执行 → 得到新文件」的对话框,但只有后者保留了上次记录。编码转换目前的实际体验:

- 关掉对话框后再打开,**上次转换到哪儿了、转换了多少字节、什么时候转的**全部丢失,只能重跑一次或者凭记忆去翻目录;
- 「把 GBK 转成 UTF-8」这类操作通常是**成批重复**的,连源/目标编码都要重新选一遍。

本次目标:

| # | 诉求 | 落地位置 |
|---|------|----------|
| 1 | 关闭对话框后重新打开,仍能看到上一次的转换结果(输出路径 / 字节数 / 完成时间 / 耗时) | §3.2 |
| 2 | 重新打开时回填上次的输入/输出路径与源/目标编码,直接点转换即可 | §3.3 |
| 3 | 提供「打开路径」「清除记录」,输出文件被手工删除时给出提示 | §3.4 |

### 非目标

- 不改动编码转换算法与 `stream_convert` 的 64 KiB 分块流式实现(既有能力不动)。
- 不做编码自动检测(与 `SeparateCSVDialog` 的分隔符检测不同,这里没有探测步骤,详见 §6)。
- 不做历史列表(只保留最近一条,与 017 一致)。
- 不为 i18n 引入插值机制;带数字的文案仍由组件拼接。

---

## 2. 现状分析(基于当前代码)

`src/modules/dialogs/file/CsvEncodingDialog.tsx`:

```ts
// 结果只活在本次打开期间,且不复用任何持久化
const [result, setResult] = useState<CsvEncodingResult | null>(null);

// 每次打开整体复位:结果被清空 = 诉求 1 的根因
useEffect(() => {
  if (isOpen) {
    setInputFile(initialInputFile || "");
    setOutputFile("");
    setSourceEncoding("utf-8");
    setTargetEncoding("utf-8");
    setResult(null);          // ← 关闭即失忆
    setError(null);
  }
}, [isOpen, initialInputFile]);
```

三个关键事实:

- 组件本身**不会卸载**(`src/app/App.tsx` 始终渲染 `<CsvEncodingDialog isOpen={ui.showCsvEncoding} …/>`,内部 `if (!isOpen) return null`),所以 React state 能跨「关闭→重开」存活;真正清空结果的就是上面那个 `isOpen` 复位 effect。
- 后端 `CsvEncodingResult`(`src-tauri/src/csv.rs`)只有 `output_path` / `bytes_read` / `bytes_written`,**没有任何时间信息**,无法展示「什么时候转的、转了多久」。
- 拆分侧已经有一套现成的解法(`src/utils/separateHistory.ts` + `SeparateCSVDialog` 的「上次拆分」区块),本次直接对齐,不另起一套语义。

---

## 3. 方案

### 3.1 后端:`CsvEncodingResult` 增加 `elapsed_ms`

与 017 给 `SeparateResult` 加 `elapsed_ms` 完全对称:

```rust
pub struct CsvEncodingResult {
  pub output_path: String,
  pub bytes_read: usize,
  pub bytes_written: usize,
  /// Wall-clock duration of the conversion itself (excludes IPC/render time).
  pub elapsed_ms: u64,
}
```

计时点取 `convert_csv_encoding` 闭包内、`resolve_encoding` 之前到 `stream_convert` 返回之后,即**只统计转换本身**,不含 Tauri IPC 与前端渲染。`elapsed_ms` 在前端是可选字段(`elapsed_ms?`),旧 payload / 测试 mock 不传时不影响渲染。

> 为什么不用前端计时:前端计时会把 IPC 往返、spawn_blocking 排队时间算进「耗时」,大文件下这部分不可忽略;后端计时是拆分侧已经验证过的口径。

### 3.2 持久化:`src/utils/encodingHistory.ts`

**刻意**做成 `separateHistory.ts` 的镜像(同样的 key 命名、同样的类型守卫 + 体积上限 + 静默降级):

```ts
export const ENCODING_HISTORY_KEY = "easy-csv-encoding-last";

export interface StoredEncodingResult {
  outputPath: string;     // 结果:写到哪儿了
  bytesRead: number;
  bytesWritten: number;
  finishedAt: string;     // 结果:ISO 8601
  elapsedMs?: number;     // 结果:后端耗时
  inputFile: string;      // 选项:产生这条记录的输入
  sourceEncoding: string; // 选项
  targetEncoding: string; // 选项
}
```

与 `StoredSeparateResult` 的两处**有意的差异**:

1. **校验更严**:除 `elapsedMs` 外全部字段都是必填,缺一个就整条丢弃(而不是部分加载)。因为这里的选项会被**直接回填进 path 输入框与编码下拉**,部分加载会把 `undefined` 写进 UI。代价是以后新增字段必须声明为可选(`?`)才不破坏旧记录。
2. 选项里**不存 `outputFile`**:它恒等于结果里的 `outputPath`,存两份只会漂移。

### 3.3 对话框改造(`CsvEncodingDialog.tsx`)

对齐 `SeparateCSVDialog` 的三件套:**一个 `lastResult` 状态**(替代原来的 `result`+`lastResult` 双份)、**一个 `isStaleResult` 标记**、**`clearFeedback` 只清错误不清结果**。

```ts
useEffect(() => {
  if (isOpen) {
    const stored = loadLastEncodingResult();
    setInputFile(initialInputFile || stored?.inputFile || "");
    setOutputFile(stored?.outputPath ?? "");
    setSourceEncoding(stored?.sourceEncoding ?? "utf-8");
    setTargetEncoding(stored?.targetEncoding ?? "utf-8");
    setLastResult(stored);
    setIsStaleResult(stored !== null);
    setError(null);
    autoBaseRef.current = null;   // 不触发「按目标编码改名」的自动后缀
  }
}, [isOpen, initialInputFile]);
```

- **回填优先级**:调用方给的 `initialInputFile`(从当前标签页带过来的文件)> 记录里的 `inputFile`。即「打开某个文件的编码转换」不会被上次记录抢走输入路径,但**记录本身照常展示**(对照测试:忽略存储的输入文件,但仍显示上次记录)。
- **`autoBaseRef` 置空**:记录里的输出路径是显式值,不能被「`名字_<编码>.csv`」的自动命名覆盖;只有用户重新浏览选择输入文件时才会重新启用自动命名。
- **成功后写入**:`handleConvert` 组出 `StoredEncodingResult`(含 `finishedAt: new Date().toISOString()` 与后端 `elapsed_ms`)→ `saveLastEncodingResult` → `setIsStaleResult(false)`。关闭期间完成转换时仍走既有的 toast 分支。
- **编辑即「过期」**:任何输入/选项变更调 `clearFeedback()` → `isStaleResult = true`,于是面板标题从 `转换成功` 变成 `上次转换`,错误条被清掉但**结果不清空**。

### 3.4 结果区与失效提示

打开时若存在记录,`invoke("file_exists", { filePath: lastResult.outputPath })` 检查输出文件是否还在:

| 状态 | 展示 |
|------|------|
| `null`(未知/查询失败) | 正常展示,「打开路径」可点 |
| `true` | 正常展示,「打开路径」可点 |
| `false` | 追加一行 `输出文件已不存在`(琥珀色),「打开路径」置灰并带 title 提示 |

「打开路径」复用既有的 `reveal_paths` 命令(017 引入,已在 `storage.rs` 中实现,无需新增后端能力),单文件传 `paths: [outputPath]`。查询失败**不**降级成「已删除」——不知道就说不知道。

结果区文案(与拆分侧同构,便于用户形成一致的肌肉记忆):

```
✓ 转换成功 / 上次转换 · 完成时间 2026-09-21 16:12:33 · 耗时 1.5 s
GBK / GB2312 → UTF-8 · 2048 字节 → 1024 字节
/tmp/a_utf8.csv
[打开路径] [清除记录]
```

### 3.5 i18n

新增 1 个 key(其余全部复用 017 已建的通用 key):

| key | en | zh |
|-----|----|----|
| `csvEncodingLastResult` | Last conversion | 上次转换 |

复用既有 key:`t.success`(本次转换的标题,保持既有测试与语义)、`t.finishedAt`、`t.elapsed`、`t.bytes`、`t.openPath`、`t.clearRecord`、`t.lastResultNoOutput`、`t.sourceEncoding`、`t.targetEncoding`、`t.csvEncodingNoResult`。

> `t.lastResult`(en `Last run` / zh `上次拆分`)语义绑定拆分,故不复用,新开 `csvEncodingLastResult`。
> 编码名的展示名由组件内的 `encodingLabel()` 从 `ENCODINGS` 表反查(如 `gbk` → `GBK / GB2312`),不进 i18n。

### 3.6 顺带:`formatElapsed` 上提到 `utils/format.ts`

`formatElapsed`(`"820 ms"` / `"1.4 s"`)原本只定义在 `separateHistory.ts`,现在两个历史模块都要用。它本身是**纯时间格式化**,与「拆分」无业务关系,因此移到 `src/utils/format.ts`(与 `formatDateTime` 同址),`separateHistory.ts` / `SeparateCSVDialog.tsx` / `separateHistory.test.ts` 改为从新位置引入,**不保留 re-export**(避免双入口)。

### 3.7 边界与失败行为汇总

| 场景 | 行为 |
|------|------|
| 无记录 | 面板显示既有的 `csvEncodingNoResult` 引导文案,输入/编码为默认值(`utf-8` / `utf-8`) |
| 记录存在但 localStorage 被清 | 等价于「无记录」,不报错 |
| localStorage 写入失败(隐私模式 / 配额) | `try/catch` 静默降级为仅会话内可见 |
| 记录字段缺失或类型不符 | 整条丢弃(`isStoredEncodingResult` 返回 false) |
| 记录体积 > 2048 字节(超长路径) | 跳过写入,不覆盖旧记录以外的任何数据 |
| 输出文件被手工删除 | 显示 `输出文件已不存在`,`打开路径` 置灰 |
| 源编码 == 目标编码 | 维持既有行为:`转换` 按钮置灰 + 琥珀色提示,不产生记录 |

---

## 4. 影响面

| 文件 | 改动 |
|------|------|
| `src-tauri/src/csv.rs` | `CsvEncodingResult` 增加 `elapsed_ms`;`convert_csv_encoding` 内加 `Instant` 计时 |
| `src/utils/encodingHistory.ts` | 新增:`easy-csv-encoding-last` 的读写/清除 + 严格类型守卫 |
| `src/utils/format.ts` | 新增 `formatElapsed`(从 `separateHistory.ts` 迁入) |
| `src/utils/separateHistory.ts` | 移除 `formatElapsed`(改由 `utils/format` 提供) |
| `src/modules/dialogs/file/CsvEncodingDialog.tsx` | `result` → `lastResult` + `isStaleResult` + `outputExists`;打开时回填选项;结果区加完成时间/耗时/编码对/打开路径/清除记录/失效提示 |
| `src/modules/dialogs/file/SeparateCSVDialog.tsx` | 仅改 `formatElapsed` 的 import 来源 |
| `src/i18n/translations/types.ts` · `{en,zh}/dialog.ts` | 新增 `csvEncodingLastResult` |
| `src/__tests__/encodingHistory.test.ts` | 新增 5 个用例 |
| `src/__tests__/CsvEncodingDialog.test.tsx` | 新增 6 个用例(`last result` 分组);`beforeEach` 清 localStorage + 重置后端 mock |
| `src/__tests__/separateHistory.test.ts` | `formatElapsed` 的 import 来源改到 `@/utils/format` |
| `docs/AI/INDEX.md` | 登记 §4 全部文件 + 更新「修改 CSV 编码转换」速查行 + 测试文件计数 |

---

## 5. 测试计划(已落地)

### 后端

`cargo check` 通过。`convert_csv_encoding` 无新增纯函数,既有 `stream_convert` 单测覆盖转换逻辑本身;`elapsed_ms` 为新增只读字段,由前端用例断言。

### 前端(`vitest`)

- `encodingHistory.test.ts`(5 例):往返、无记录、坏 JSON / 字段类型不符 / **缺选项字段**、超长跳过、清除。
- `CsvEncodingDialog.test.tsx` 的 `last result` 分组(6 例):
  - 预置记录 → 打开即显示 `Last conversion` / `Finished at` / `Took 1.5 s` / `GBK / GB2312 → UTF-8` / 输出路径,且两个路径输入框与两个编码下拉被回填;
  - 传入 `initialInputFile` 时输入框以它为准,但记录仍展示;
  - 成功一次后写入 localStorage(`outputPath` / 字节数 / 编码对 / `inputFile`),标题为 `Conversion successful`;再编辑选项 → 记录不消失且标题变为 `Last conversion`;
  - `Clear record` 清空 localStorage 并回到引导文案;
  - `Open path` 调用 `reveal_paths(['/tmp/prev_utf8.csv'])`;
  - `file_exists` 返回 false → 按钮置灰 + `Output file no longer exists`。
- 回归:既有 8 例(空态、同编码禁用、invoke 形状、缺文件报错、错误处理、关闭期间成功/失败 toast)全绿。

---

## 6. 已知限制

- **没有编码自动检测**:分隔符检测的成本是「读 64 KiB + 打分」,而编码检测要么靠 BOM(只有 UTF-8/16/32 有),要么靠「用各编码解码再验证字符是否合法」的启发式 —— 后者对 GBK/GB18030/Latin-1 之间的区分并不可靠,误判后会把**整个文件**转错,比选错分隔符严重得多。因此这里仍然要求用户显式选源编码,本方案只解决「记住上次选了什么」。
- 「源 == 目标」被直接拦住(既有行为),所以**不存在**「用同一编码重写一遍规范化文件」的用法;若将来要放开,得先想清楚它和「无操作」的区别。
- 记录只保留最近一条,且**不做时间/文件校验**:手工把记录里的输出文件挪走后,只能靠 `file_exists` 提示,不会自动清理记录。
- 完成时间取前端本地时钟,不做时区归一;系统时间被改过时会失真(与 017 一致)。
- 回填输出路径时**不会**重新计算 `名字_<编码>.csv` 后缀 —— 记录里是显式路径。若用户改了目标编码,输出文件名保持不变,需要自己改名或重新浏览选择。
- `outputExists` 只在**打开时与记录变化时**查询一次;对话框开着的时候从外部删除该文件,界面不会实时刷新。
- `CsvEncodingDialog.tsx` 由 360 行涨到 438 行,触发了 019 §5.3 的 `max-lines` **警告**(规则刻意保持 `warn`,同目录的 `SeparateCSVDialog.tsx` 为 618 行)。若该规则将来升级为 `error`,应把结果区抽成同目录的 `EncodingResultPanel.tsx`(把结果区 JSX + `encodingLabel` + `ENCODINGS` 目录表一并下移),本次为控制改动面未做。
