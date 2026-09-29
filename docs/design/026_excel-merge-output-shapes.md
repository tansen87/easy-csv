# Excel 合并输出形态扩展(按 sheet 分文件 / 多 sheet 合并一簿 / 拆分)— 设计文档

> 状态: **已实现(2026-09-29,P0 + P0′;P1 进度/取消与 D1 独立入口未做)**
> 日期: 2026-09-29
> 关联: `docs/design/025_excel-multi-file-merge.md`(**本设计的直接基座**,下文简称 025;既有能力、xan 实测数字、「上次记录」模式全部继承自它)、`docs/design/021_split-lines-by-line-count.md`(多输出历史的「目录 + 前 5 个」先例)、`docs/design/023_plugin-repository-and-in-app-install.md`(`plugin://progress` 进度事件先例)、`docs/design/024_parquet-duckdb-file-reading.md`(「不为一个格式引入重依赖」的决策先例,本设计对它做一次**有依据的破例**)、`docs/AI/INDEX.md`
> 前置: 025 已实现(`excel_merge.rs` 的 `scan_excel_sources` / `merge_excel_sources` 与 `MergeExcelDialog`)
>
> ### 实施记录(2026-09-29,与设计的偏差与补充)
>
> - **开放问题①定案:`rust_xlsxwriter 0.99.1`**(`cargo add` 实测 crates.io 可达,经 rsproxy 镜像);
>   单元格全按字符串写(`write_string`),sheet 名经 `sanitize_sheet_name` 后 `set_name`;
>   超 xlsx 行/列上限时库错误被映射为含 sheet 名/行列号的文案。**未启用 constant_memory 模式**
>   (默认整表驻内存;与 025 读取阶段「按 sheet 计费」同量级,后续大 sheet 再评估);
> - **D1 未做独立 UI**:设计 §4.4 的「by_sheet 单簿自动退化即拆分」按原样成立(后端接受 `split` 作为
>   `by_sheet` 别名),对话框只提供三个形态选项(合并为一表 / 按 sheet 名分文件 / 合成多 sheet 工作簿);
> - **执行层拆分**:`convert_parts`(转换 + 来源列 + 空 sheet 跳过)与 `run_single_sheet_output`
>   (025 管道)/ `run_multi_sheet_output` 三段;`ConvertedPart` 同时携带 header/rows/label/输出 sheet 名,
>   使 by_sheet 的逐输出 `union_summary` 与 multi_sheet 的行数统计零重复解析;
> - `ExcelMergeRequest` 新增 `output_shape` / `output_dir` / `sheet_names_filter`(均 serde default,
>   **025 旧请求零变化**);`ExcelMergeResult` 新增 `outputs: Vec<OutputSummary>` 与
>   `name_mappings`,顶层字段镜像第一个输出保持兼容;
> - **前端形态默认值**:切换形态时来源列重置为该形态默认(by_sheet → `file`,其余 → `file_sheet`),
>   这是显式的用户动作,不保留跨形态记忆;`split` 记录值回读时映射回 by_sheet 展示;
> - **多 sheet 说明文案只出现一次**(输出分区),结果卡不重复;xlsx「单 Sheet1」说明在
>   multi_sheet 形态下不显示(它有具名 sheet);
> - 测试:后端 158 → **169**(+11:sanitize×3 / plan_outputs×5 / 端到端×3,含 by_sheet 的
>   xlsx 输出与 fail-fast 保留已完成输出、multi_sheet 的同名 stem 去重与内容回读);
>   前端 vitest 455 → **464**(历史 026 字段 + 向后兼容 4 例,对话框 5 例);
>   `tsc` / `eslint`(0 错误)/ `check:index`(138 路径)全绿。

---

## 0. 方案速览(先读这一节)

**要解决什么**:025 只支持「N 个工作簿 → **1 张表**」(纵向堆叠)。本次把**输出形态**扩展成四种:

| 形态 | 语义 | 例(用户原话) |
|------|------|----------------|
| **A. 合并为一表**(025 现状,默认) | N 簿 → 1 文件 1 sheet | t1、t2 → merged.xlsx(单 sheet) |
| **B. 按 sheet 名分文件**(新增) | N 簿 → **M 个文件**,每个输出 = 各簿**同名 sheet** 的合并 | t1{s1,s2,s3} + t2{s1,s2,s3} → **s1.xlsx / s2.xlsx / s3.xlsx** |
| **C. 每簿一 sheet 合成一簿**(新增) | N 簿 → **1 个 xlsx 多 sheet**,输出 sheet 名 = 来源簿文件名 | t1、t2 各取指定 sheet → **merged.xlsx{sheets: t1, t2}** |
| **D. 拆分成多文件**(补充建议) | 1 簿(或 N 簿)→ **每个 sheet 一个文件** | t.xlsx{s1,s2,s3} → s1.xlsx / s2.xlsx / s3.xlsx |

**关键结论**(每条的依据在正文):

1. **B、D 复用 025 全部既有管道**(转换 → 预检 → `cat rows` → 原子落盘),只是把「一个输出」推广成「**输出计划 = 多个 (输出名, parts) 二元组**」,后端改动集中在把 `resolve_parts` 重构成 `plan_outputs`(§6)。**B 的待合并 sheet 由用户显式勾选**(勾 1 个出 1 个文件、勾 2 个出 2 个,不默认全选,一个没勾不发请求);
2. **C 的唯一技术洞是「多 sheet xlsx 写出」**:`xan to xlsx` 恒为单 sheet(025 §2.1 实测)。设计稿给出三个候选并**倾向引入 `rust_xlsxwriter`**(§5.2)—— 这是 024「不为一个格式引入重依赖」原则的一次**有依据的破例**:读取侧有 xan 可用所以能守零依赖,**写出侧没有任何既有能力**,不引库就得自己写 OOXML(把正确性风险留在交付数据上,代价更高)。**最终取舍列为开放问题①**。
3. C 的输出**只能是 xlsx**(CSV 没有多 sheet 概念),界面上该形态锁定 xlsx。
4. sheet 名做文件名 / 输出 sheet 名都有**约束集**:文件名要防 Windows 保留名与末尾点空格;输出 sheet 名 ≤31 字符、非法字符替换、大小写不敏感去重(§4.2 / §5.1)。
5. **同名 sheet 分文件(B)的转换总次数与 025「全部 sheet」模式相同**:每个 (簿, sheet) 对恰好出现在一个输出里,不会多读。

**状态**:设计稿。开放问题 3 个(§11),均有倾向性建议,不阻塞按建议先实现。

---

## 1. 背景与目标

### 1.1 现状

025 已交付「N 个工作簿 → 1 张表」:`MergeExcelDialog` 三种取 sheet 策略(第 1 个 / 所有 / 指定名称)+ 三种列对齐(并集默认)+ 来源列 + 原子落盘 + 上次记录。但输出**恒为一个文件、单 sheet**,以下三类真实诉求无法表达:

- **按 sheet 名归堆**:各分部/各分公司报来的表结构相同(sheet 名一致、内容不同),希望 `s1` 归 `s1`、`s2` 归 `s2`,各自成一个文件 —— 现在只能把所有 sheet 堆进一张表再用来源列人肉拆分;
- **保留 sheet 边界的汇总**:想把多个文件各取一张表装进**一个工作簿的不同 sheet**(发给别人的汇总件),且 sheet 名沿用来源文件名 —— 现在输出只有一个 `Sheet1`;
- **反向操作**:拿到一个多 sheet 工作簿,想把每个 sheet 拆成独立文件 —— 现在只能逐个 sheet 手工「另存为」。

025 §8 P2 ①②(「自定义输出 sheet 名 / 多 sheet 输出」「每个源文件一个 sheet」)预见了其中两项;本设计把它们与用户本次提出的形态一起,统一成**输出形态矩阵**(§2),并给出统一的执行模型。

### 1.2 目标

| # | 诉求 | 落地 |
|---|------|------|
| 1 | 同名 sheet 各自合并成一个文件(B) | §4 |
| 2 | 每簿一个 sheet 合成多 sheet 工作簿(C) | §5 |
| 3 | (补充)拆分:每 sheet 一个文件(D) | §4.4(与 B 同一执行模型) |
| 4 | 四种形态共用一套对话框与既有选项(对齐 / 来源列 / 递归 / 扩展名 / 上次记录) | §7 |
| 5 | 失败不留半截文件的保证**逐输出成立**(B/D 是多输出批处理) | §4.3 |

### 1.3 非目标(继承并扩充 025 §1.3)

- 不做 sheet 内数据变换(筛选/排序/去重);不做配色/公式/多行表头迁移(025 既有限制原样继承);
- 不做**按列值**拆分(group-by 拆文件)—— 那是数据变换不是结构重排,且与管道的 `partition` 域职责重叠;
- 不做**跨形态的混合输出**(如一次请求同时产出 B 和 C 的文件);一次请求一个形态;
- 不为 C 做**样式/格式**写入(冻结首行、列宽等):`rust_xlsxwriter` 虽支持,但本期只搬数据,保持与 025「只搬数据」同一边界。

---

## 2. 输出形态矩阵

一张表看全所有形态,含补充建议与明确不做项:

| 形态 | 输入 | 输出 | 输出命名 | 输出格式 | 技术量 | 分期 |
|------|------|------|----------|----------|--------|------|
| A 合并为一表(现状) | N 簿 | 1 文件 1 sheet | `{stem}_merged` | csv / xlsx | 0(已实现) | — |
| **B 按 sheet 名分文件** | N 簿 | M 文件,每文件 = 各簿同名 sheet 合并 | `{sheet 名}` | csv / xlsx | 小(复用 025 管道 × M) | **P0** |
| **C 每簿一 sheet 合成一簿** | N 簿 | 1 文件多 sheet,输出 sheet = 来源簿 | `{簿 stem}` | **仅 xlsx** | 中(需多 sheet 写出器) | **P0**(随开放问题①定案) |
| **D1 拆分:单簿每 sheet 一文件** | 1 簿 | 每 sheet 一文件 | `{sheet 名}` | csv / xlsx | 极小(= B 的单簿退化) | **P1** |
| **D2 拆分:N 簿每 (簿,sheet) 一文件** | N 簿 | 每 (簿,sheet) 一文件 | `{stem}#{sheet}`(防跨簿同名) | csv / xlsx | 小 | P2 |
| C 的取 all 变体 | N 簿 | 1 文件,每 (簿,sheet) 一个输出 sheet | `{stem}#{sheet}` | 仅 xlsx | 小(在 C 之上) | P2 |
| 多 sheet 的 CSV 变体 | — | — | — | — | **不可能**(CSV 无 sheet 概念) | 明确不做 |
| 按列值拆分成多文件 | N 簿 | 按某列 group-by 分文件 | — | — | 属数据变换,与 `partition` 域重叠 | 明确不做 |

> 补充说明:用户问「还能补什么」时最容易想到的「每簿取第一个 sheet 各成一个文件」其实是 D2 的子集;「把 B 的输出再合成一簿」= 先 B 后 C,两次调用即可,不值得做成单一形态(选项爆炸,且中间文件语义含混)。

---

## 3. 从 025 继承的机制(不重述,只列差异)

以下机制**原样复用**,本设计不再展开:

| 机制 | 出处 | 差异 |
|------|------|------|
| 扫描(`scan_excel_sources`,`--list-sheets` 廉价枚举) | 025 §3.2 | **零改动**。四种形态的扫描输入完全相同 |
| 逐 sheet 转临时 CSV(`xan from` + 自建来源列) | 025 §3.4 | 零改动。**注意**:B/D 的每个 (簿, sheet) 仍只转换一次(§4.1) |
| 列对齐三策略 + `union_summary` 琥珀提示 | 025 §3.5 | 零改动,**per 输出**生效(每个输出各自预检、各自算摘要) |
| 写前预检 + 临时输出 rename 原子落盘 | 025 §3.6 | 零改动,per 输出执行 |
| `TempFiles` RAII / `collect_workbooks` / `exclude` 排除 | 025 | 零改动 |
| 上次记录(excelMergeHistory) | 025 §3.8 | **结果字段变化**:多输出形态只存「输出目录 + 文件数 + 前 5 个文件名」(021 先例,2048 字节上限) |

**内存模型不变**:转换峰值 = max(单个 sheet);拼接(`cat rows`)流式;单线程串行(025 §2.5/§2.6 的决定原样适用于多输出 —— 串行只是把「一张表的墙钟」乘以输出个数,用 P1 的进度事件缓解,不引入并发)。

---

## 4. 形态 B:按 sheet 名分文件(N→M)

### 4.1 语义与输出计划

- 输入侧:扫描后得到所有工作簿 sheet 名的**并集**(025 已有)。B 形态提供**多选清单**,由**用户显式勾选**要合并哪些 sheet —— **初始全不选,勾几个出几个文件**(勾 1 个只出 1 个文件,勾 2 个出 2 个,比如只归 `Q1`/`Q2`、丢掉 `Notes`);
- **未勾选任何 sheet 名 → 前端拦截报错、不发请求**(与 025「指定名称留空 = 报错」同一哲学:不静默落回「全选」—— 用户以为只合了选中的、实际合了全部,是同类静默失败);后端对空 `sheet_names_filter` 同样报错兜底;
- 对每个选中的 sheet 名 `s`:parts = 「所有**拥有** `s` 的工作簿的 (簿, s) 对」;**没有工作簿拥有的名字不会出现在清单里**(并集保证),所以不存在「空输出」;
- `missing_sheet` 策略在 B 形态**退化为无操作**:按名归堆时「缺」就是「不在这个输出里」,天然是 skip 语义,不提供 error 选项(与 025 的 `sheet_mode=name` 不同 —— 那是「指定一个名,缺了算异常」;这里是「按名分组,缺了就不参与该组」)。界面在 B 形态下隐藏该控件;
- 某个输出只有 1 个 part(仅一簿有 `s`)= 025 `sheet_mode=name` 的单文件情形,**照常输出**(拆分本身可能就是目的:把 `Notes` 单独拎出来),结果区标注「单来源」;
- **来源列默认值按形态调整**:B 形态内 sheet 名恒同,`file_sheet` 的后半段是冗余 → **默认 `file`**(文件名),仍可选 none / file / file_sheet。

**转换去重**:每个 (簿, sheet) 对恰好归属一个输出,转换总次数 = 025「全部 sheet」模式,不因形态 B 增加读取量。

### 4.2 输出文件命名

输出 = `<输出目录>/<sheet 名>.<ext>`。sheet 名天然不能含 `\ / : * ? [ ]`(Excel 限制),但不能直接信任,需过一层 `sanitize_filename`:

| 风险 | 规则 |
|------|------|
| Windows 保留设备名(`CON` `PRN` `AUX` `NUL` `COM1..9` `LPT1..9`,大小写不敏感、含带扩展名形式) | 追加 `_`(`CON` → `CON_`) |
| 末尾点 / 空格(Windows 静默丢弃,造成「文件名对不上」) | 裁剪;裁剪后为空则用 `sheet` |
| 跨簿 `s1` 与 `S1`(Excel sheet 名跨簿可共存,Windows 文件名**大小写不敏感会撞**) | 按**大小写折叠**保序去重:先到先得,后来者加 `_2`、`_3`…,并在结果区**琥珀色说明**映射关系(s1→s1.xlsx,S1→S1_2.xlsx) |
| 超长(理论不会:>255 需 >31 字符的 sheet 名,Excel 不允许) | 兜底截断到 240 |

> `sanitize_filename` / `dedup_names` 都是纯函数,CI 可全量测(§9)。

输出目录:默认**第一个输入所在目录**,可改;B/D 形态下对话框的「输出文件」控件替换为「输出目录」。

### 4.3 多输出的失败语义

025 的「失败不留半截文件」是**单文件**契约;批处理下细化为:

- 每个输出独立走「预检 → `cat` → 临时文件 rename」,**单文件契约逐输出成立**(输出目录里出现的每个文件都是完整的);
- **fail-fast**:某个输出失败(预检冲突 / `cat` 报错 / `to xlsx` 失败)立即终止后续输出,报错文案**列出失败的输出名与原因**,并注明「已完成 k/M 个输出,均已保留」;
- **不回滚已完成的输出**:它们是有效文件,删除反而制造意外数据丢失;重跑会按覆盖语义重写;
- `TempFiles` 清理全部中间产物(含失败输出已转换的临时 CSV)。

### 4.4 形态 D:拆分(1→N 与 N→N)

D 与 B 是**同一执行模型**的两种预填:

- **D1(单簿拆分,P1)**:来源恰好 1 个工作簿 → 每个输出 = 该簿一个 sheet,命名同 §4.2;
- **D2(N 簿全拆,P2)**:每 (簿, sheet) 一个输出,命名 `{stem}#{sheet}`(`#` 同 025 来源列的分隔符,用户已熟悉);stem 过 §4.2 同一层 sanitize,再用 `dedup_names` 去重。

入口决策:**不新增菜单项**,D1 作为 B 形态的自动退化(来源只有 1 簿时,「按 sheet 名分文件」即「拆分」)—— 对话框在单簿时把标题/提示切成拆分语义即可,避免「合并」菜单里藏一个叫拆分的东西却要用户自己发现。D2 是否独立入口,等 D1 落地后按真实需求再定(P2)。

---

## 5. 形态 C:每簿一 sheet 合成一簿(N→1 多 sheet)

### 5.1 语义与输出 sheet 命名

- 每个工作簿按取 sheet 策略(**第 1 个 / 指定名称 / 全部**,沿用 025 三选一)选出参与 sheet;
- 取 `first` / `name`:每簿至多 1 个输出 sheet,输出 sheet 名 = **簿文件 stem**;取 `all`:每 (簿, sheet) 一个输出 sheet,名 = `{stem}#{sheet}`;
- `missing_sheet = skip` 时缺名工作簿**不产生输出 sheet**(记入 `skipped`);`error` 时整体失败 —— 语义与 025 一致;
- 每个输出 sheet 内部只有 1 个 part(单簿单 sheet),**无列对齐问题**;对齐/缺失策略控件在该形态下隐藏(`union_summary` 自然为空);
- 来源列沿用(默认 `file_sheet`,在多 sheet 语境下 `file` 与 `file_sheet` 等价,统一用 `file_sheet` 文案)。

**输出 sheet 名约束**(与文件名不同,这里受 Excel sheet 名规则):

| 约束 | 规则 |
|------|------|
| ≤31 字符 | 超长截断到 31;截断造成撞名 → 走去重 |
| 非法字符 `\ / : * ? [ ]` 与首尾 `'` | 替换为 `_` / 裁剪 |
| **大小写不敏感唯一** | `dedup_names` 同款逻辑(`报告` 与 `REPORT` 撞)→ `_2` 后缀 + 结果区说明 |
| 空名(极端:stem 全是非法字符) | 回退 `Sheet{n}` |
| `History` 保留名 | 追加 `_` |

### 5.2 多 sheet xlsx 写出:方案评估与倾向

`xan to xlsx` 恒为单 sheet(025 §2.1),这是 C 形态唯一的**没有既有能力**的环节。三个候选:

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **① `rust_xlsxwriter`**(倾向) | 各 part 的临时 CSV 逐行写入各 worksheet | 成熟(纯 Rust、活跃维护、无系统依赖);**流式 + 常量内存**(与「按 sheet 计费」内存模型一致);正确性外包,不留自研 OOXML 的坑 | **新依赖**(破 024/025 的零依赖先例);体积 + 数百 KB(`opt-level="z"` 下可感知但可接受) |
| ② 手写 OOXML(zip + inlineStr) | 用已在依赖树的 `zip` 4.6 + `quick-xml` 拼 `[Content_Types].xml` / `workbook.xml` / `sheetN.xml` | 零新依赖;项目已用同款技术生成测试夹具(025 附录) | **把交付数据的正确性责任留给自己**:XML 转义、控制字符、非法 UTF-8、cell 引用边界……错一处就是损坏文件;长期维护面大 |
| ③ zip 层后处理拼接 | 先 `xan to xlsx` 出 K 个单 sheet 文件,再在 zip 层把 `sheetN.xml` 合并进一个 workbook.xml | 复用 xan 写出 | 依赖 xan **内部产物结构**(无契约保证,升级即碎);本质是 ② 的脆弱变体 |

**倾向 ① 的完整论证**(也是对「破例」的交代):

1. 024/025 守零依赖的前提是「**读取/格式适配有既有二进制可用**」;写出侧 xan 只有单 sheet,**不引库的唯一替代就是自研 OOXML 写出**(方案 ②)—— 两害相权:库的依赖成本是**显式且一次性的**(版本、体积、MSRV),自研的错误成本是**隐式且在用户数据上兑现的**(损坏文件 / 静默丢内容)。
2. 内存模型一致:该库有常量内存写模式,单 sheet 写出的峰值与 025 的 `from` 读取同量级;不引入「整簿物化」的回退。
3. 类型语义:本管道的数据全部经过 CSV 中转(025 既有路径),写出的单元格**全部按字符串写** —— 与现状(经 `xan to xlsx` 的 CSV 中转)语义一致,不引入新的类型分歧。⚠️ 实施时需验证 `xan to xlsx` 是否会把纯数字 CSV 字段写成数值类型:若是,则 C 形态(全字符串)与 A 形态(可能数值)存在类型差异,**必须在结果区说明**,并评估是否对纯数字列做嗅探写入(倾向不做, sniffing 是静默改数据的入口)。
4. 回退路径干净:若库验证不通过(MSRV / 体积 / 维护状态),方案 ② 的夹具技术已验证可行,可降级实施 —— 但要把 025 的三个对抗性夹具加两个**写出侧**用例(含控制字符的单元格值、超长共享字符串)。

> **开放问题①(见 §11)**:`rust_xlsxwriter` 当前版本 / MSRV / 与既有依赖树的兼容性需在实施首日实测。倾向已给出,不阻塞 B/D 先行。

### 5.3 失败行为

- 任何 sheet 写出失败 → 整簿失败,临时输出不 rename(单文件契约,与 025 一致);
- 超 xlsx 单 sheet 行数上限(1,048,576)→ 该 sheet 报错,文案含实际行数;不静默截断;
- `rust_xlsxwriter` 对非法字符(控制字符等)的行为在实施首日随开放问题①一并验证;验证不过则写入前清洗(替换/剔除,结果区说明)。

---

## 6. 后端结构:`resolve_parts` → `plan_outputs`

把 025 的 `resolve_parts`(单一 part 清单)重构为**输出计划**,执行层统一消费:

```rust
/// 一个输出的计划:输出名(文件名或 sheet 名,已 sanitize/去重)+ 参与 parts。
pub struct OutputPlan {
  pub name: String,                       // 已过 sanitize + dedup
  pub parts: Vec<(PathBuf, String)>,      // (工作簿, sheet)
  pub sheet_names: Vec<String>,           // 输出内的 sheet 名(仅 multi_sheet 用)
}

/// 按 output_shape 把扫描结果解析成输出计划。
/// "single"(默认,= 025 现状)| "by_sheet" | "multi_sheet" | "split"(= by_sheet 的单簿预填)
fn plan_outputs(files: &[ExcelSourceFile], req: &ExcelMergeRequest)
  -> Result<(Vec<OutputPlan>, Vec<String> /*skipped*/), String>;

/// 文件名清洗(§4.2)与跨输出大小写折叠去重(§4.2/§5.1 共用)。
fn sanitize_filename(name: &str) -> String;
fn sanitize_sheet_name(name: &str) -> String;   // 31 字符 / 非法字符 / History(§5.1)
fn dedup_names(names: &mut Vec<String>) -> Vec<(String, String)>; // (原名, 最终名),供结果区说明
```

- `ExcelMergeRequest` 增字段 `output_shape: String`(默认 `"single"`,**旧请求零变化**);B 形态增 `sheet_names_filter: Vec<String>`(**必填,用户显式勾选;空 = 后端报错兜底**,前端已拦截);C 形态复用既有 `sheet_mode`/`sheet_name`/`missing_sheet`;
- 执行层分派:`single` / `by_sheet` / `split` → 循环既有「预检 → `cat` → rename(→ `to xlsx`)」;`multi_sheet` → 新增 `write_multi_sheet_xlsx(parts, plan, out)`(§5.2 方案①的薄壳);
- `ExcelMergeResult` 增 `outputs: Vec<OutputSummary>`(每个输出的路径 / 行数 / 表头 / union_summary;`single` 形态恰为长度 1,**既有前端字段保持兼容**,顶层 `output_path` 等字段继续填充 first);增 `name_mappings: Vec<(String, String)>`(`dedup_names` 的结果,琥珀色展示);
- 纯函数全部落 `excel_merge.rs` 并可 CI 全量测(无 xan 依赖)。

---

## 7. 前端交互(`MergeExcelDialog` 扩展)

| 控件 | 变化 |
|------|------|
| **输出形态**(**新增,对话框最顶部**) | `Select` 四项:**合并为一张表**(默认,= 现状)/ **按 sheet 名分文件** / **合成多 sheet 工作簿** / **拆分为多个文件**(仅来源恰好 1 簿时可选,置灰并提示) |
| 取 sheet 策略 | 形态 B 下隐藏(被「sheet 名多选」取代);形态 C 保留三选一;形态 A/D 维持现状 |
| **sheet 名多选**(形态 B 专用) | 复选框列表(选项 = 扫描并集,**初始全不选**),**用户显式勾选要合并哪些 sheet,勾几个出几个文件**;一个都没勾 → 拦截报错、不发请求;扫描未跑时自动触发(同 025 的守卫) |
| 缺失策略 | 形态 B 隐藏(§4.1:天然 skip);形态 C 保留 |
| 列对齐 | 形态 C 隐藏(每输出 sheet 单 part);A/B/D 维持 |
| 来源列 | 默认值按形态:B → `file`,C → `file_sheet`,其余不变 |
| 输出 | 形态 B/D:目录选择;A/C:文件路径;形态 C 锁定 xlsx(csv 选项隐藏 + 说明文案) |
| 结果区 | 多输出形态列出「输出目录 + 文件数 + 前 5 个文件名」(021 样式)+ `name_mappings` 琥珀提示 + 单来源标注;C 形态补「输出 sheet 名 = 来源文件名(截断/去重规则见结果)」 |
| 上次记录 | 选项字段增 `outputShape` / `sheetNamesFilter`;结果字段增 `outputDir` + `outputCount` + `outputNames[≤5]`(021 模式);**旧记录向后兼容**(类型守卫把缺字段当无记录,不崩) |

i18n 增 key 域 `mergeExcelShape*` / `mergeExcelSheetFilter*` / `mergeExcelOutputDir*` / `mergeExcelNameMapping*` / `mergeExcelMultiSheetNote*` 等,`types.ts` + `{en,zh}/dialog.ts` 同步;复用既有 key 优先。

---

## 8. 影响面

| 文件 | 改动 |
|------|------|
| `src-tauri/src/excel_merge.rs` | `OutputPlan` / `plan_outputs` / `sanitize_filename` / `sanitize_sheet_name` / `dedup_names` / `write_multi_sheet_xlsx`;`ExcelMergeRequest`/`ExcelMergeResult` 增字段;`merge_excel_sources` 执行分派;`resolve_parts` 收敛进 `plan_outputs`(旧调用点迁移) |
| `src-tauri/Cargo.toml` | (开放问题①定案后)`rust_xlsxwriter` 依赖 |
| `src-tauri/src/lib.rs` | 无新命令(扩展既有 `merge_excel_sources` 的请求形状) |
| `src/modules/dialogs/file/MergeExcelDialog.tsx` | 输出形态选择 + 按形态的控件分派 + 结果区扩展(§7) |
| `src/utils/excelMergeHistory.ts` | 增字段 + 向后兼容守卫 |
| `src/i18n/translations/types.ts` · `{en,zh}/dialog.ts` | 新 key |
| `src/__tests__/MergeExcelDialog.test.tsx` · `excelMergeHistory.test.ts` | 新用例(§9) |
| `docs/AI/INDEX.md` | 登记 026 + 速查行 |

`capabilities/default.json` 不动;除开放问题①外**不加新 Tauri 命令**。

---

## 9. 测试计划

### 后端(CI 可全量,无 xan)

- `plan_outputs`:`single` 与 025 `resolve_parts` 结果逐字段一致(**重构红线**);`by_sheet` 的分组正确性(含只有 1 part 的组)、**按勾选生成输出(勾 1 出 1、勾 2 出 2)、空 `sheet_names_filter` 返回 Err**;`multi_sheet` 的 per-簿选择与 `missing_sheet` 分叉;`split` 的 (簿, sheet) 展开;
- `sanitize_filename`:保留名全表(CON/nul/com1,含大小写与带扩展名形式)、末尾点空格、空回退;
- `sanitize_sheet_name`:31 字符截断、非法字符替换、`History`、空回退 `Sheet{n}`;
- `dedup_names`:大小写折叠撞名(`s1`/`S1`)保序去重、无撞名返回空映射;
- `ExcelMergeResult` 兼容:`single` 形态的顶层字段与 025 结果完全一致。

### 后端(依赖 xan,本地跑;CI 跳过 —— 025 §2.4 同款门控)

- 端到端:两簿各 `{s1,s2,s3}` → B 形态产出 `s1/s2/s3.xlsx` 且内容 = 025 单表语义按组切分;C 形态产出多 sheet 簿(回读 sheet 名与顺序);D1 拆分;
- C 形态类型行为:`xan to xlsx`(A 形态)vs `rust_xlsxwriter`(C 形态)对同一数字 CSV 字段的回读差异(开放问题①的验证用例);
- 失败:by_sheet 第 2/3 个输出预检失败 → 第 1 个输出保留、错误列出失败项与已完成数。

### 前端(vitest,`beforeEach` 清 localStorage + 显式重置 invoke mock)

- 默认 payload 不含 `output_shape` 变化(仍 `single`);切形态后控件按需渲染/隐藏(B 无缺失策略、C 无对齐、C 锁 xlsx);
- B 形态 sheet 名多选(**初始全不选;勾 1 个 → payload `sheet_names_filter` 恰含该名;一个没勾 → 拦截报错不发请求**)与自动扫描;C 形态 sheet 名 = stem 的结果展示;`name_mappings` 琥珀提示的显隐;
- 历史往返(新字段)+ **旧格式记录(无 `outputShape`)仍能读**(向后兼容);D1 在多簿来源下置灰。

### 回归红线

- `npx tsc --noEmit` / `npx vitest run` / `npx eslint src --ext .ts,.tsx` / `pnpm check:index` 全绿;
- `cargo test --lib` 无 xan 机器全绿;**025 的全部既有测试不改断言**(`single` 形态语义零变化是本设计的回归红线)。

---

## 10. 已知限制

- C 形态输出 sheet 内**全部单元格为文本**(CSV 中转的既有语义);若实施验证发现 A 形态(`xan to xlsx`)写数值,两形态存在类型差异,以结果区说明 + 开放问题①的结论为准;
- C 形态单 sheet 受 xlsx 1,048,576 行硬上限;
- B/D 的输出文件数 = sheet 名并集大小,超大并集(几百个 sheet 名)时串行墙钟线性增长 —— P1 进度事件的直接受益场景;
- 多输出不回滚(§4.3),失败后「部分完成」是可见状态而不是错误;
- 其余 025 §7 的限制(格式支持面、公式缓存值、非数据 sheet 混入等)原样继承。

---

## 11. 开放问题(均有倾向,不阻塞 B/D)

1. **多 sheet 写出器定案**(§5.2):倾向 `rust_xlsxwriter`;实施首日实测版本 / MSRV / 依赖树兼容 / 控制字符行为,并跑 §9 的类型行为对照用例。
2. **B 形态单来源输出的默认行为**(§4.1):倾向「照常输出 + 单来源标注」;若用户反馈噪音大,加「跳过单来源」开关(P2)。
3. **D2(全拆)是否独立入口**(§4.4):等 D1 落地后按真实需求定。

---

## 12. 分期

| 期 | 内容 |
|----|------|
| **P0** | `plan_outputs` 重构(保 025 语义零变化)+ 形态 B(含 sheet 名多选、sanitize/dedup、多输出失败语义)+ 前端形态选择与结果区 + 历史 + i18n + 测试 |
| **P0′**(随开放问题①) | 形态 C:写出器定案 → `write_multi_sheet_xlsx` → C 形态前端与测试 |
| **P1** | D1 拆分退化 + **进度事件 / 取消**(`excel://merge-progress`,025 P1① 原案,多输出形态下价值放大) |
| **P2** | D2 全拆独立入口、C 取 all 变体(`{stem}#{sheet}`)、「跳过单来源」开关、025 P2④(输出格式扩到 `to` 全集,与 B 形态天然兼容) |
| **明确不做** | 按列值拆分、跨形态混合输出、C 形态样式写入、多 sheet 的 CSV 变体 |
