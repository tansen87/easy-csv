# 080 · 命令参数框改版：命令优先（方案 C）

> 状态: **已实现（2026-11-26）· 61 个命令里 52 个已走新面板,9 个需要文件选择器 / 面板编辑器的仍用旧表单**
> 日期: 2026-11-26
> 原型: `docs/design/prototypes/080/`（`00-compare.html` 三案对照；`03-command-first.html` 定稿方向）
> 关联: `019`（模块边界）、`053`/`072`/`073`（命令面板与命令目录）、`074`（帮助入口迁到表单标题行）、`076`（ViewDock）
> 范围: 只改前端对话框与表单层。`handleCommandSubmit`、参数序列化、xan 执行链路都不动。

---

## 1. 结论

**采用方案 C「命令优先」**：弹窗主体是一条可编辑的 `xan <cmd>` 命令，参数是 token；点某个 token 才展开它的编辑器；没用到的参数在下方排队等你加。

三条按拍板定下的细则：

1. **列名类参数（`select` / `columns` / `columns2` / `x` / `y` …）既能手打，也能从表头选。** 控件是「可输入的 token 输入框 + 一行表头 chip」：输入框里可以直接敲列名（支持表达式/多列），下面的 chip 是读 `headers` 得到的快捷选择，点一下即填入。不把选择器做成必须打开的弹层——表头只有几列时，弹层比 chip 贵。
2. **所有滚动容器统一用 `@/components/ui/ScrollArea`**，不用浏览器原生滚动条。`CommandFormShell` 已经是这个写法（`hideHorizontalScrollbar` + `viewportStyle={{ maxHeight }}`），新面板沿用同一条路径；原型右侧那根 6px 细滚动条就是它的样子。
3. **主按钮不带键帽。** 按钮文案是「添加步骤」（现有 i18n `commandAdd` 是「添加」，实现时改成「添加步骤」，英文 `Add step`），不显示 `⏎` —— 回车提交仍然可用（键盘用户照旧），只是不再用键帽装饰按钮。

---

## 2. 诊断（为什么不是小修）

| 事实 | 位置 |
|---|---|
| 62 个表单手写，共约 7.9k 行，每个表单各自决定 grid 与字段顺序 | `src/modules/dialogs/command/forms/*.tsx` |
| 字段名直接是 CLI flag（`select`、`keep-last`、`keep-duplicates`），中文界面里读不出目的 | 同上 |
| 唯一的人话说明来自 `getParameterDescription()`，但只塞进 `placeholder`，一打字就消失 | `forms/dedup.tsx` 等 |
| 62 个表单里只有 3 个用上了 `headers`（`duckdb` / `eval` / `map`），其余 59 个靠用户背列名 | `grep -l headers forms/*` |
| `dedup` 的 5 个布尔项用 `grid-cols-5` 硬铺，长 flag 会挤、必填与可选混排 | `forms/dedup.tsx` |
| 参数元数据其实齐全（`name/type/description/descriptionCn/required/default/options`），表单没用 | `src/types/xan.ts`、`src/data/commands/*.ts` |

结论：这不是样式问题，是**每个表单各写一遍版式**导致的一致性问题。C 之所以成立，是因为 xan 命令本身就是「动词 + 参数」的线性结构，token 化之后界面结构和命令行结构同构。

---

## 3. 方向

- **产品**：把 xan 命令包成可视化管道的桌面工具，用户是每周洗几千万行 CSV 的人。
- **性格**：精确、克制、可核对。
- **世界**：终端与制表——等宽命令、纸白表面、发丝框线。
- **时刻**：命令行区块本身是界面上唯一有「纸质」质感的地方（`--paper` 底 + 1px 边），其余退成中性。
- **签名**：参数 token（`-c 地区`）与编辑器标题行的等宽 flag 一一对应，删 token 即删参数。

---

## 4. 结构

```
┌ 连接  join                              文档  × ┐   52px 标题（沿用 CommandDialog）
├─────────────────────────────────────────────────┤
│ xan join  [-c 地区 ×] [--input1 … ×] [+ 参数]    │   命令行区（--paper 底）
│                                                 │
│ 正在编辑                                        │   分组标签（等宽 10.5）
│ ┌ columns  连接列                     移除 ┐    │   编辑器卡（--paper 底；参数在左、解释在右，
│ │                                        │    │   flag 时开关就排在「移除」左边）
│ │ 可直接输入列名，也可以点下面的表头        │    │
│ │ [ 地区                                ▾ ] │    │   可输入 + 可下拉
│ │ 表头  地区  订单号  客户  金额  日期      │    │   表头 chip（读 headers）
│ └──────────────────────────────────────────┘    │
│                                                 │
│ 还能加                     必填还差 input1…     │
│ + join-type   连接类型           默认 inner    │   38px 一行，整行可点
│ + columns2    右表键列                          │
│ …                                   ⟵ ScrollArea│
├─────────────────────────────────────────────────┤
│ 必填 2 / 4 已就位  复制命令    取消   添加步骤   │   52px 底栏（无键帽）
└─────────────────────────────────────────────────┘
```

宽度 700，高度 524（`max-height: min(524px, 80vh)`），中间区滚动。

### 4.1 复制命令

底栏左侧常驻一个「复制命令」按钮（图标 + 文字，`navigator.clipboard.writeText`，与现有「复制列」同一条路径），放在底栏而不是命令行行尾的原因：命令行在滚动区里，滚久了会看不见；底栏一直在。

- **必填未齐时禁用**：不复制半条命令，避免贴进终端才发现报错。禁用态仍显示，配 `title` 说明还差哪几项。
- **点击反馈**：换成「✓ 已复制」并转品牌色，1.5 秒后复原；不弹 toast。按钮固定 `min-width: 82px`（图标 12 + 间距 6 + 四字 44 + 内边距 16），两种文案都在同一宽度里居中，底栏不会跳。
- 不新增快捷键；主按钮才是回车动作。

### 与现有代码的接缝

- `CommandDialog` 保留：标题、文档入口、Esc、拖拽、焦点陷阱都不动，只把 `<FormComponent>` 换成统一的 `ParamSheet`。
- `COMMAND_FORMS`（62 项映射）保留一个迁移期：先让 `ParamSheet` 覆盖通用命令，特殊表单（`chart` / `plot` / `batch-*` 这类有多面板的）继续用自己的组件，逐个替换。
- 提交仍走 `handleCommandSubmit({ commandDialog, … })`，`params` 仍以 CLI 名为键 —— C 只是在它前面加了一层「token ↔ params」的双向映射，不改变提交契约。

---

## 5. 实施步骤（每步可独立验证）

1. **字段元数据**：给 `XanParameter` 补 `group?: "required" | "common" | "advanced"`（缺省推导：`required` → 必填，有 `default` 或在白名单 → 常用，其余 → 高级）。纯数据，不碰 UI。
2. **`ColumnField`**：可输入 + 表头 chip 的受控组件，`headers` 为空时退化成纯输入框（不显示空 chip 行）。单测覆盖「手打 → 提交值」与「点 chip → 提交值」。
3. **`ParamSheet`（方案 C 骨架）**：命令行 token 区 + 编辑器卡 + 「还能加」列表 + 底栏计数；先用 `join`、`dedup`、`select` 三个命令接入，其余命令暂时保留旧表单。
4. **迁移 10 个高频命令**：`dedup`、`select`、`filter`（含 `search` 系列）、`sort`、`rename`、`cast`、`groupby`、`join`、`plot`、`to`。每迁一个删掉对应旧表单文件，覆盖测试。
5. **收尾**：`COMMAND_FORMS` 清空到只剩特殊表单；`parameterDescriptions` 的使用点从 placeholder 改为字段说明行；`docs/AI/INDEX.md` 更新模块表。

---

## 6. 未决

- **token 顺序**：命令行里 token 的排列按「必填 → 常用 → 高级 → 用户添加顺序」，而 xan 对多数 flag 的顺序不敏感；若某命令顺序敏感（如 `input1`/`input2` 位置参数），需要在数据里标 `positional: true`，本轮先只处理 `join` 这类显式 flag。
- **必填校验时机**：现在是「点加入时才校验并弹一条 warning」。C 里字段在命令行可见，可以在底栏实时显示「必填 2 / 4」，但**是否允许带着缺失项关闭弹窗**需要拍板（倾向于允许，加入时再拦）。
- **表达式参数**（`choose`、`expr`）：仍用纯输入框 + 语音提示，不接表达式编辑器；双行高度留给后续。
- **回滚**：`COMMAND_FORMS` 的旧映射保留到第 5 步，任何一步出问题都能回到旧表单。

---

## 7. 原型说明

- `00-compare.html`：三案对照（含改用建议：A 打底、B 供长命令、C 作为 A 的命令行展开形态——本次先只落 C）。
- `03-command-first.html`：定稿方向，`join`（13 项、2 必填）为样本，演示 token、编辑器、表头 chip、ScrollArea 细滚动条、底栏计数。
- 原型里的明暗切换靠 `document.documentElement.classList` 翻 token，与 `src/index.css` 的两套变量同源。
- 上一版原型按钮上的 `⏎` 已按拍板去掉；`01`/`02` 也同步去掉了，保持三案可比。

---

## 8 · 实施记录（2026-11-26）

### 落地内容

| 文件 | 作用 |
|---|---|
| `modules/dialogs/command/ParamSheet.tsx` | 方案 C 骨架：命令行 token 区、编辑器卡、「还能加」列表、底栏（必填计数 / 复制 / 取消 / 添加步骤），滚动走 `ScrollArea` |
| `modules/dialogs/command/fields/ParamControl.tsx` | 四类控件的一份实现：开关（flag）、`Select`（select）、`ColumnField`（列名）、文本/数字输入 |
| `modules/dialogs/command/fields/ColumnField.tsx` | 可手打 + 表头 chip 切换（逗号列表），`headers` 为空时退化为纯输入框 |
| `modules/dialogs/command/lib/paramMeta.ts` | 分组推导、双语字段标签、列名参数判定、「是否在命令行上」的判定 |
| `modules/dialogs/command/lib/commandTokens.ts` | 镜像 `pipeline.rs` 的 argv 规则，供 token 区与复制共用 |
| `modules/dialogs/command/CommandDialog.tsx` | `PARAM_SHEET_COMMANDS`（join / dedup / select）走新面板，其余继续用 `COMMAND_FORMS`，`key={type}` 保证切换命令时状态不串 |
| i18n（zh / en / types） | 新增 18 个 `param*` 键；`commandAdd` 保持「添加」，新按钮用 `paramAddStep`（「添加步骤」），避免影响变量面板 |

### 实施中的三个决定

1. **标签必须双语。** 第一版把中文标签写死在映射里,英文界面会中英混排;改成 `{zh, en}` 结构,`paramLabel(command, param, language)` 由调用方传 `effectiveLanguage`。
2. **位置参数用参数名代替 flag。** `join` 的 `columns`/`input1` 都是 positional,只显示值会出现「地区 客户明细.csv」这种看不懂的 token;改为 `columns 地区` / `input1 客户明细.csv`——写的是参数名而不是中文标签,复制出来的命令仍是纯 positional。同理,「还差」提示只列参数名(`还差 input2`),中文解释一律只出现在参数右侧。
3. **首次打开自动展开第一个未填的必填项**,否则新命令打开是一片空白列表,用户不知道从哪开始。
4. **「还能加」列表里参数在前、解释在后,整行可点。** 先写 flag(`keep-last`),紧跟中文解释,flag 列固定 104px 让解释对齐成一条;整行是按钮,点哪里都能把参数加到命令行,左侧 `+` 只是提示。
5. **明度层次:参数名深、解释浅。** 参数名(等宽)用 `text-foreground`,中文解释用 `text-muted-foreground`,列表行和编辑器卡标题行一致;之前是反过来的(参数浅、解释深),读起来像「中文是标题、flag 是脚注」,和命令优先的定位相反。
6. **布尔 flag 用 switch,不带文案,位置在「移除」左边。** 曾短暂改成 `Checkbox` + 「加入命令行」,但行点击已经承担了"加参数"这个动作,再在卡片里重复一遍语义就是噪音;开关只表达开/关。**编辑器卡的标题行统一是「参数(等宽) → 解释」**,和下方「还能加」列表同序;开关与「移除」一起靠右。开关的滑块用内联 `transform`,不走 `translate-x-[…]`(实测该工具类在这个按钮里没生效,滑块会消失)。

### 验证

- `npx tsc --noEmit` 通过;`npx eslint src` 0 error(77 个既有 warning,与改动前一致)。
- `npx vitest run` **73 文件 / 852 例全绿**(新增 `paramMeta` / `commandTokens` / `ParamSheet` 三个文件共 24 例)。
- 用 `vite` 起临时页把真实组件渲进 Edge 截图核对:明暗两套主题、dedup 的表头 chip、join 的位置参数、必填计数与复制禁用态都与原型一致;**临时页未入库,截图后即删**。

### 迁移范围(2026-11-26 第二批)

面板从 3 个命令扩到 **52 个**:除 `batch-from` / `batch-to` / `batch-search` / `cat` / `chart` / `plot` / `duckdb` / `scrape` / `run` 这 9 个需要文件选择器或独立面板的命令外,全部由 `ParamSheet` 渲染(`usesParamSheet(type)` 反向判定,新命令默认走新面板)。

**解释从哪来。** 手工标签只覆盖首批三个命令;其余参数回落到命令自带的 `descriptionCn` / `description`——两者本就随每条命令维护,双语齐全,不必再手写两百条标签。回落顺序是 **手工标签 → 参数描述 → 通用名(如 `x` = 横轴列) → 参数名**。这里踩过一个坑:起初把「通用名」排在描述前面,`sort --columns`(按列名排序)被显示成「列」,完全误导;描述必须优先。

参数没有描述时(个别 flag),列表行只显示参数名,不重复渲染标签。

### 表达式参数与默认打开项(2026-11-26 第三批)

- **`map --expression` 保留完整表达式编辑器**(design 056 的 `ExpressionEditor`:语法高亮 + 补全 + 签名条),面板里不再退化成单行输入。判定收在 `paramMeta.isExpressionEditorParam(commandId, paramName)`,目前只对 `map.expression` 返回 true——`filter` / `agg` / `window` / `transform` / `pivot` / `eval` 的表达式参数本来就没有这个编辑器,不做顺带"升级"。
- **打开面板时默认展开一个字段**:先找"必填且为空"的第一个,没有就取该命令的第一个非 flag 参数。原先没有可展开项时整块编辑区不出现,`map` 打开只有一行 token,看不出表达式在哪。
- **标题与描述重复时只显示一次**:未定制标签的参数,`paramLabel` 回落到描述,若卡片标题已经是那句话,就不再在下面重复一段。

### 遗留

- 9 个 bespoke 命令待做:文件/目录选择器需要新的字段类型(`path`),面板编辑类(chart/plot)本就不适合 token 化。
- 必填未齐时「添加步骤」仍可点(与旧表单一致),等确认是否改成硬拦。
- `paramMeta` 的字段标签只覆盖 join / dedup / select;新迁一个命令要顺手补它的标签,否则回落到参数名。
