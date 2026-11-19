# 清除符号（Clean Characters）— 设计文档

> 状态: 已实现
> 日期: 2026-11-19
> 原型: `docs/design/prototypes/064/01-clean-special-chars.html`
> 关联: `docs/design/016_separate-good-bad-rows.md`（拆分坏行）、`docs/design/017_separate-dialog-ux.md`
> 入口: 工具菜单「拆分坏行」下方 + 命令面板

---

## 1. 背景与目标

拆坏行时通常要勾「忽略引号」，否则一条坏引号会把后续记录全部拖成坏行。代价是拆出来的 `_good` 文件里仍残留：

- 成对或孤立的 `"`；
- 字段里的制表符 `\t`（xan 读作列分隔或直接报错）；
- Windows 换行留下的 `\r`；
- 连续空行。

xan 的 CSV 读取对这些问题比拆分逻辑更严格，于是「行已经拆好」但「仍然读不了」。这个工具负责最后一道清扫：**按物理行删掉/替换干扰字符，另存为干净副本**。竖线 `|` 可能是有效的分隔符或内容，明确不处理。

### 非目标

- 不修列数、不补列、不合并字段内换行（这些属于拆分坏行）。
- 不解析 CSV、不处理引号语义、不重新给字段加引号。
- 不处理竖线 `|` 与反斜杠 `\`，原样保留，避免破坏本来就是分隔符或内容的数据。
- 不改编码、不去 BOM（属于「转换编码」）。
- 不修改原文件。

---

## 2. 入口与菜单位置

工具子菜单中紧跟在「拆分坏行」之后：

```
对比差异
转换编码
拆分坏行
清除符号   ← 新增
按行数拆分
组内编号
──────────
转为 Excel
合并工作簿
```

理由：两步是固定顺序（先拆走列数不对的行，再清扫剩下的好行），位置相邻；不跨过第二条分隔线。命令面板 action id 为 `clean-special-chars`，中文标签「清除符号」，英文 `Clean Characters`。

从当前标签页进入时自动带出 `inputFile`，与其它工具一致。

---

## 3. 对话框结构

沿用「拆分坏行」的三步卡片 + 结果卡 + 底部运行区，宽度 `max-w-2xl`（672px），高度上限 `85vh`。

### 3.1 处理规则（顶部说明）

- 第 1 行：`按物理行处理 {file} · 不解析 CSV，引号不成对也能清理`
- 第 2 行（等宽）：当前生效的规则摘要，例如
  `删除 "、\r 与空行 · \t 替换为空格 · 竖线原样保留`

### 3.2 步骤 1 · 选择要清理的 CSV

- 文本框 + 「打开」按钮（`csv` / `txt` / `tsv`）。
- 选择后显示探测结果：`✓ 第一行 N 列 · 表头：…`（复用 `useCsvProbe`，分隔符用默认值探测即可，仅作信息展示）。

### 3.3 步骤 2 · 清理内容

四项字符复选 + 自定义输入 + 空白符号处理方式。
| 项 | 默认 | 处理 | 说明 |
|---|---|---|---|
| `\r` 回车符 | 勾选 | 删除 | 输出统一 LF |
| `¶` 空行 | 勾选 | 合并 | 连续空行只保留一个；文件末尾空行删除 |
| `\t` 制表符 | 勾选 | 替换为空格 | 固定空格，避免相邻内容粘连 |
| `"` 双引号 | 勾选 | 删除 | |
| 其他符号 | 空 | 替换为空格 | 自由输入，例如 `·`、`、`、`;`；按字符逐一处理 |
| 合并引号内换行 | 不勾选 | 合并 | 成对引号内的物理换行并为一个空格；引号未闭合时该段按行原样保留 |

制表符与自定义符号固定替换为空格，不提供“删除”选项；`\r`、空行、`"` 始终删除；竖线 `|` 与反斜杠 `\` 不处理，原样保留。

「合并引号内换行」单独列出，不与字符清理混在一起：它改变的是行结构，风险高于删字符，因此默认关闭。开启后按引号开关状态判断：行内引号数为奇数时，下一物理行并入当前行并以一个空格连接；遇到闭合引号结束合并。若到文件末尾仍未闭合，这段缓存按原始换行逐行写出，不吞并后续内容，并计入 `unclosed_lines`，结果卡提示「N 行引号未闭合，已按原样保留」。

页脚提示：`行尾换行作为行分隔符保留，否则所有行会挤成一行。`

### 3.4 步骤 3 · 输出文件

- 默认 `{stem}_clean{ext}`，与输入同目录；可手动修改或「另存为」。
- 校验：不能与输入路径相同；父目录必须存在。
- 已存在同名文件时直接覆盖（与其它工具一致）。

### 3.5 结果卡

- 空态一句话：`选择 CSV 与要清除的字符后点击开始清理。输出写在输入文件旁，原文件保持不动。`
- 完成态：
  - `✓ 已完成 · 完成时间 … · 耗时 …`
  - 三格统计：`清理行数` / `删除字符` / `替换为空格`
  - 输出路径 + 「打开路径」「清除记录」
  - `unclosed_lines > 0` 时在路径上方追加一行弱提示：`N 行引号未闭合，已按原样保留`
- 历史记录复用现有工具历史模式（localStorage），再次打开带出上次输入、勾选项与输出路径。

### 3.6 底部运行区

- 左侧就绪提示：`将写入 {output} · 保留行尾换行`；未选任何清理项时改为 `至少选择一项要清除的符号`。
- 右侧：`<RunTimer running={isRunning} />` + 主按钮「开始清理」。
- 运行中按钮文案「清理中…」，不额外显示“运行中”标签。
- 未选任何字符或没有输入文件时主按钮禁用。

---

## 4. 处理规则（后端）

命令：`clean_special_chars`

```rust
#[derive(Deserialize)]
struct CleanOptions {
    path: String,
    out_path: String,
    remove_cr: bool,
    merge_blank_lines: bool,
    tab_clean: bool,         // 勾选后 \t → 空格
    quote_remove: bool,
    custom_chars: Vec<char>, // 逐个替换为空格
    merge_quoted_newlines: bool,
}

#[derive(Serialize)]
struct CleanResult {
    output_path: String,
    rows: u64,
    removed_chars: u64,
    replaced_chars: u64,
    unclosed_lines: u64,
    elapsed_ms: u64,
}
```

算法（逐行流式，常量内存）：

1. 以 `BufReader` 按 `\n` 切物理行（`read_until`），每行去掉末尾 `\r`。
2. 若开启 `merge_quoted_newlines`：维护 `in_quotes` 状态（每遇到一个 `"` 翻转），未闭合期间把物理行缓存起来；闭合时用单个空格连接缓存行写成一行。EOF 仍未闭合时，缓存行按原换行逐行写出，`unclosed_lines += 缓存行数`。
3. 空行：若开启 `merge_blank_lines`，连续空行只写一个空行；文件末尾空行不写。
4. 对行内每个字符：
   - `"`：按勾选删除；
   - `\t` / 自定义字符：勾选后写一个空格；
   - 竖线 `|`、反斜杠 `\` 与其它字符原样写。
5. 行尾写 `\n`（最后一行保留换行）。
6. 全流程统计 `rows`、`removed_chars`、`replaced_chars`、`unclosed_lines`、`elapsed_ms`。

约束：

- **UTF-8 严格读取**；遇到非法字节序列直接失败，错误信息提示「请先用『转换编码』把文件转成 UTF-8」。
- 输入路径与输出路径相同视为错误，不覆盖原文件。
- 输出先写临时文件，成功后原子重命名；失败时不留半成品（与拆分坏行的写入策略一致）。
- 前端不做整文件读取，仅传路径与选项。

### 边界情况

| 场景 | 行为 |
|---|---|
| 空文件 | 生成空输出，统计 0，视为成功 |
| 只有表头 | 正常输出表头 |
| CRLF | `\r` 删除，行分隔变 LF |
| 成对引号内换行 | 开启合并时并为一个空格；关闭时保留原换行 |
| 引号未闭合 | 开启合并时该段按原换行逐行写出，`unclosed_lines` 计数并在结果卡提示 |
| 末尾无换行 | 补一个 `\n`，保证行完整 |
| 引号字段内含分隔符 | 引号被删除后该行可能多列；本工具不负责修列数，文档与 UI 提示中说明 |
| 二进制/非文本文件 | UTF-8 校验失败 → 报错 |
| 输出目录不存在 | 前端提示；后端返回明确错误 |
| 大文件 | 流式处理，内存占用与单行长度相关 |

---

## 5. 预览（原型 03）

- 取输入前 5 行，在对话框内做「前 / 后」对照。
- 被删除的字符用红色删除线；控制符显示为键帽 `CR` / `TAB` / `¶`；替换出的空格用浅绿底标出。
- 预览只是规则核对，不参与结果统计，不写入文件。

---

## 6. 国际化

新增键（`zh/dialog.ts`、`en/dialog.ts`、`types.ts` 同步）：

```
cleanSpecialChars
cleanCharsRule
cleanCharsRuleSummary
cleanCharsStepFile
cleanCharsStepOptions
cleanCharsStepOutput
cleanCharsCharCR / Tab / Newline / Quote
cleanCharsCustom
cleanCharsCustomPlaceholder
cleanCharsSelectedCount
cleanCharsMergeQuotedNewlines
cleanCharsMergeQuotedHint
cleanCharsUnclosedLines
cleanCharsKeepLineEnding
cleanCharsOutputHint
cleanCharsStart / cleanCharsRunning
cleanCharsEmptyResult / cleanCharsDone
cleanCharsRows / cleanCharsRemoved / cleanCharsReplaced
cleanCharsNoOptionSelected
cleanCharsReady
cleanCharsWrongEncoding
cleanCharsSamePath
```

---

## 7. 测试

后端：

- CRLF → LF；连续空行合并；末尾空行删除。
- `\t` 与自定义符号固定替换为空格；竖线与反斜杠保持原样。
- 引号删除；竖线与反斜杠保持原样。
- 合并引号内换行：成对时并为一个空格；未闭合时原样保留并计数。
- 非法 UTF-8 报错；输入 = 输出拒绝；空文件。
- 统计数字与实际替换一致。

前端：

- 默认勾选与默认「替换为空格」。
- 未选任何字符时按钮禁用、页脚提示替换。
- 结果卡渲染三格统计与输出路径。
- 历史恢复。

---

## 8. 与现有工具的关系

| 工具 | 职责 |
|---|---|
| 拆分坏行 | 按列数把好行/坏行分开，可忽略引号 |
| **清除符号** | 按行清扫残留控制符与引号，产出 xan 可读的副本 |
| 转换编码 | 非 UTF-8 输入先转 UTF-8；本工具不猜编码 |
| 按行数拆分 | 纯行复制，不解析内容，与本工具互不影响 |
