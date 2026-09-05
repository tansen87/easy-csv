# search 命令多条件筛选支持（多值 OR 与多条件 AND）

> 基于 `src/docs/cmd/search.md`（xan 官方参数文档）、`src/data/commands.ts` L1094-1321（前端命令定义）、
> `src/components/dialog/commands/SearchFilterForms.tsx` L61-231（SearchForm 实测）、
> `src-tauri/src/pipeline.rs` L159-179（参数序列化）识别的能力缺口。
> 与既有文档分工:本文只覆盖 **search 命令的多条件筛选**,不涉及 filter 表达式编辑器本身的增强。

---

## 1. 先回答:现在怎样才能筛多个条件?

xan `search` 的多模式能力**后端已具备**,是前端 UI 没有暴露。三种立即可用的方式:

### 方式 A:同一列多个值(OR,推荐) —— `-P/--add-pattern` 重复传

```bash
# name 等于 tom 或 jerry(精确匹配)
xan search -e tom -P jerry -s name file.csv > matches.csv
```

- `-P` 可以重复任意次,主模式 + 每个 `-P` 都是并列模式,**任一命中即输出该行(OR 语义)**;
- xan 内部用 Aho-Corasick 自动机/哈希表/regex 自动机一次性匹配所有模式,不是逐个循环,性能无虞;
- 模式也可来自文件:`--patterns patterns.txt`(每行一个)或 CSV 列(`--patterns people.csv --pattern-column name`)。

### 方式 B:同一列多个值 —— 正则交替(当前 UI 唯一能凑合用的)

```bash
# 子串匹配
xan search -r 'tom|jerry' file.csv
# 近似精确匹配(整单元格)
xan search -r '^(tom|jerry)$' file.csv
```

在当前 UI 的 regex 模式 + pattern 框里手写 `|` 交替即可,但值多时可读性差、需自行处理转义,只算过渡手段。

---

## 2. 现状证据(实测)

| 层 | 现状 | 证据 |
|----|------|------|
| xan CLI | 多模式完整支持:`-P` 重复、`--patterns` 文件/CSV/stdin、`-b` breakdown、`-U` unique-matches | `src/docs/cmd/search.md` L44-71 |
| 命令定义 | `add-pattern` 定义为**单值 string** 参数;`patterns`/`pattern-column` 已定义 | `commands.ts` L1246-1251, L1276-1288 |
| 表单 UI | `add-pattern` 只有一个 TextField(单值);`patterns` 要求用户填**文件路径** | `SearchFilterForms.tsx` L166-175, L195-200 |
| 参数序列化 | 非定位参数逐条输出 `--{name} {value}`;`parameters` 是 Vec,**天然允许同名参数重复出现** | `pipeline.rs` L161-178 |
| 疑似 bug | `commands.ts` L1312 参数名写成 `"--every-column"`,序列化会拼成 `----every-column`;且 SearchForm 的 checkbox 写的是 `every-column`(L92),与定义名不一致,勾选可能永远不生效 | `commands.ts` L1311-1319, `SearchFilterForms.tsx` L92 |

**关键结论**:`pipeline.rs` 的参数列表是数组,同一个 `add-pattern` 名称出现多次就会输出多组 `-P <value>` ——**多条件链路的后端与序列化层零改动,缺口只在前端表单与提交组装**。

---

## 3. 问题

- **P0 · UI 单值缺口**:想筛 `tom`、`jerry` 两个值,表单里 `add-pattern` 只能填一个,`patterns` 又强制要求先造一个文本文件,普通用户无路可走(只能手写正则,见方式 B);
- **P0 · 语义引导缺失**:表单不说明"多个模式是 OR"、"跨列 AND 应去 filter",用户会拿 search 反复尝试 AND 组合然后失败;
- **P1 · 命名 bug**:`--every-column` 参数名双横线重复,序列化产物 `----every-column` 必然被 clap 拒绝;同时定义名与表单 checkbox 键不一致,该开关实际不可用;
- **P2 · 可发现性**:多值输入、模式来源(手动/文件/CSV 列)三类入口平铺在 30 多个字段的表单里,没有分组。

---

## 4. 方案

### S1. 多值输入框(add-pattern 列表化)(P0)

将 `add-pattern` 的单行 TextField 改为**标签式多值输入**(tag input):

1. 用户逐个回车/逗号添加值,已添加值显示为可删除标签;也可以直接粘贴 `tom, jerry` 一次性拆分;
2. **提交组装**:拆分为多条 `{name: "add-pattern", value: "tom"}`、`{name: "add-pattern", value: "jerry"}` 追加到该步骤 `parameters` 数组(主 `pattern` 保留为第一个模式),序列化层自动产出 `search <pattern> -P tom -P jerry`;
3. 兼容性:单值时行为与现状完全一致;旧会话快照中已有的单值 `add-pattern` 参数原样保留;
4. 与 `patterns`(文件)/`pattern-column` 互斥提示:表单检测到用户同时填写时给出 warning 文案(不硬阻断,高级用户可能有意组合);
5. i18n:输入框 placeholder 中英文各一条,如"添加搜索值,回车确认(多个值为『或』关系)"。

> 实现落点:`SearchFilterForms.tsx` SearchForm + 提交时参数展开 helpers;若 CommandDialog 的 `params: Record<string, any>` 不便承载列表,新增 `paramsList` 旁路字段或以约定分隔符存储、提交时拆分,二选一以对现有类型侵入最小者为准。

### S2. 粘贴文本模式(patterns 免文件化)(P1,可选增强)

`patterns` 目前只支持文件路径。增加一个可选的"每行一个值"多行文本域(与 S1 的标签输入二选一出现,避免两个入口):

- 用户粘贴多行值,前端写入临时文件(复用现有 Tauri temp 目录能力)后传 `--patterns <tmp>`;
- 若实现成本高,P2 降级为仅在帮助文案里说明"多值请用上方多值输入"。

### S3. AND 语义引导(filter 跳转)(P0,零后端)

在 SearchForm 顶部增加一行弱化提示(双语):

> 多个值之间是"或"关系;需要多列同时满足(且)时,请使用 **filter** 命令的表达式,或在管道中串联多个 search 步骤。

提示内嵌 `filter` 链接,点击直接打开 FilterForm(复用 `CommandDialog` 现有切换能力),把选型错误拦在表单层。

### S4. 修复 `--every-column` 命名 bug(P0,顺手)

1. `commands.ts` L1312 参数名 `"--every-column"` 改为 `"every-column"`;
2. 回归验证:勾选后 CLI 参数应为 `--every-column`(单对横线);
3. 全库扫描 `name: "--` 是否存在同类双重横线定义(防伴生 bug)。

### S5. 表单分组与文案(P2)

SearchForm 字段按语义分三组,降低 30+ 字段的压迫感:

| 分组 | 字段 |
|------|------|
| 匹配模式 | pattern、多值输入(S1)、patterns/pattern-column(高级折叠) |
| 匹配方式 | ignore-case、exact、regex、url-prefix、levenshtein、damerau-levenshtein、empty/non-empty、invert-match、every-column |
| 输出增强 | flag、count、replace、replacement-column、unique-matches、sep、breakdown、name-column、left、limit、parallel/threads/fast-parser |

分组标题 + `details` 折叠(高级项默认收起),样式沿用 `CommandFormWrapper` 既有体系,不新增 token。

---

## 5. 验收清单

- [x] 表单中添加 `tom`、`jerry` 两个值,执行管道时 xan 收到 `search <pattern> -P tom -P jerry`(可通过日志面板查看完整命令行验证);
- [x] `-e`(精确)+ 多值组合可正确筛出 `name ∈ {tom, jerry}` 的行;
- [x] 单值输入行为与改造前完全一致;旧会话快照恢复后步骤参数不丢;
- [x] 多值与 `--patterns` 文件路径同时填写时出现 warning 提示;
- [x] 勾选 `every-column` 后执行,CLI 参数为 `--every-column` 且功能生效;全库无 `name: "--` 双横线定义残留;
- [x] 中英文界面下新增文案(placeholder、warning、AND 提示)完整,无硬编码;

---

## 6. 实施提示

- 全部改动集中在 `commands.ts`(S4 改名)、`SearchFilterForms.tsx`(S1/S3/S5)与提交组装 helper;`pipeline.rs` 序列化层零改动;
- 建议提交顺序:S4(bug 修复,独立)→ S1+S3(核心能力)→ S2/S5(增强);
- 方式 B(正则交替)无需开发,可先写进 README 的 search 示例或帮助中心,作为 S1 落地前的临时指引。
