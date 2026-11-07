# 046 · 管道变量面板改版(已实施,2026-11-07)

> 原型:`docs/design/prototypes/046/01-pipeline-variables.html`(亮/暗色、现状 vs 改后、状态细节、诊断表)。
> 范围:只改 `VariablePanel`、其菜单入口与 `utils/params.ts` 的新增纯函数;**执行侧的弹窗补填、`{{名}}` 替换语义、`PipelineVariable` 结构、面板 320px 宽度与吸附位置全部不动**。

## 1. 诊断(改前)

| # | 问题 | 位置 |
|---|------|------|
| 1 | 头部「管道变量 + 全部清除(文字+垃圾桶) + 关闭」并排,「全部清除」与「添加变量」同权重;下面紧跟两行 11px 提示段,760 高的窗口里第一个变量要到 y≈100 才出现 | `VariablePanel.tsx:99-125`(旧) |
| 2 | 一变量一张卡片(名称行 + 类型下拉 + 默认值输入,约 74px),4 个变量就要滚;5 个变量看起来像 5 张独立表单 | `:134-177`(旧) |
| 3 | 已声明(写进 `tab.variables`)和仅被引用(不持久化)外观一样,只差一个删除 `×` | `:158`(旧) |
| 4 | 默认值为空的变量毫无标记,但执行到它就弹 `VariableValuesDialog` | `useExecution.ts:506` |
| 5 | `setDefault` 每次输入都调 `inferVariableType()` **覆盖手选类型**;而类型不参与执行,下拉形同虚设 | `VariablePanel.tsx:56-61`(旧) |
| 6 | 底部固定 52px 添加栏;名称只校验非空/重名 —— **中文名能加进去,但占位符正则 `[A-Za-z_]\w*` 永不匹配 = 死变量** | `:67-80`(旧)、`params.ts:12` |

## 2. 方向

克制的台账。一行一个变量、两个数字(几个变量、几处引用);等宽的 `{{名}}`、左对齐的键、右对齐的计数;琥珀只标记「会挡住执行」。双花括号本身就是图标,名称前不再放任何圆形图标。

## 3. 改法

### 3.1 分组(固定顺序,不排序)

- **待填写**:已声明且默认值为空 —— 会挡住执行;组名琥珀,行左侧 2px 琥珀标记(内缩 8px,`::before`),值显示「未填写」;组下带一行说明「没有默认值,执行到这里会弹窗补填」。
- **已就绪**:已声明且有值;按声明顺序。
- **仅管道引用**:未声明但被 `{{名}}` 引用 —— 名称走灰,第二行「用于 第 N 步 · 命令」,右侧「声明」一键写入 `tab.variables`(类型按空值推断为 `string`);未声明项永不持久化,与现状一致。

行(48px,两行):

```
{{dateRange}}                    2 处 ›
默认   2024-01-01..2024-03-31
```

- 未被引用的已声明变量在计数位显示「未被引用」。
- 点名称行 / 引用数:原地展开引用清单(`被 N 个参数引用` + 每行 `01 筛选 from`,步骤序号等宽、参数名等宽灰)。
- 点值行:就地变输入框(`⏎` 保存 / `esc` 取消 / 失焦保存);悬停时值有虚线下划点线暗示可编辑。
- 行内 `⋯`(悬停出现,点击外部关闭):复制 `{{名}}` / **类型下拉(共享 `ui/Select`,文本/数值/路径,当前值即显)** / 删除变量(红)。新增表单里的类型同样用 `Select`(`width 88px`),不用原生 `<select>`。
- 面板头部只留标题 + `⋯`(清除全部变量,红)+ 关闭;「全部清除」点开后在头部下方给**行内确认**(不用模态),文案写明「管道里的 `{{…}}` 仍会生效,只是不再有默认值」。
- 新增收成列表末尾一行虚线入口,点开就地输入:名称 + 类型下拉 + 添加;名称实时校验,非法时红边 + 「只能用字母、数字与下划线」,重名提示「变量名已存在」,非法时添加按钮禁用。
- 底部 36px 计数条:`N 个变量 · N 个待填写`(琥珀)+ 右侧 `N 个仅引用`。
- 空状态承载语法说明:「在任意步骤的参数值里写 `{{名字}}`,这里就会出现它」。

### 3.2 菜单入口

「查看 → 管道变量」保留勾选,右侧新增琥珀计数 = **引用且默认值为空的变量数**(即会让执行停在补值弹窗的数量,0 不渲染)。数据在 `App.tsx` 现算(`collectVariablesFromPipeline` + 声明表),经 `MainMenu` 新可选 prop `pendingVariables` 传入;不加新快捷键。

### 3.3 两个行为修复

1. **类型不再被覆盖**:`setDefault` 只写 `defaultValue`;类型只在「声明」(新写入)与手动选择时变化。
2. **名称规则与正则同源**:`isValidVariableName` = `^[A-Za-z_][A-Za-z0-9_]*$`(`params.ts` 导出),面板实时校验 —— 中文/空格/数字开头直接拒绝,不再产生永远匹配不到的死变量。

## 4. 数据与实现

- 新增 `collectVariableRefs(steps): VariableRef[]`(`utils/params.ts`):扫 `step.parameters` 里的字符串与字符串数组,产出 `{name, stepIndex(1-based), stepId, commandLabel(alias||command.name), paramKey}`;同一参数内的重复提及去重。引用数与清单都由它派生,不新增持久化字段。
- 文件拆分:`VariableRow.tsx`(行内编辑、引用展开、行菜单;导出 `TYPE_OPTIONS`/`typeLabel`)+ `VariablePanel.tsx`(分组、头部菜单、行内确认、新增表单、空状态、计数条)。
- 空状态 + 新增表单的渲染条件是 `isEmpty && !addOpen` —— 空状态下点「新增变量」也要能看到表单(实测踩过)。
- i18n:删 `variableEmptyName` / `noVariablesDetected` / `clearAllVariables` / `confirmClearAllVariables`;新增 25 个 `variable*` 键(zh/en);`variableName` 值改「变量名」、`variableDefault` 改「默认」、`addVariable` 改「新增变量」。**`variablePlaceholderHint` 保留** —— `CommandFormShell` 与 `VariableHint` 还在用。
- 045 遗留的两条红测(`lineageFullscreen`/`lineageClose` 值 vs 测试期望不一致)按用户拍板处理:**保留短文案「全屏」/「关闭」(en: Fullscreen / Close),测试期望同步改为一致**,不改 i18n 值。

## 5. 红线

- 不动 `resolveStepPlaceholders`、执行前 `VariableValuesDialog` 的触发条件与数据流;
- 不动 `PipelineVariable` 结构与 tab 快照持久化;
- 不动面板宽度(320px)、吸附位置、开关动画;
- 不做搜索、不做重命名(要同步改写 `{{旧名}}`,单独一稿)、不做「跳到步骤」(需要 VariablePanel → FlowPanel 的定位通道)、不给类型加校验语义。

## 6. 实施记录(2026-11-07)

- `utils/params.ts`:+`VARIABLE_NAME_RE` / `isValidVariableName` / `collectVariableRefs`。
- `modules/variables/VariablePanel.tsx` 重写(213 → 451 行)+ 新 `modules/variables/VariableRow.tsx`(约 300 行)。
- `App.tsx` 现算 `pendingVariableCount` 并传 `MainMenu`;`MainMenu.tsx` 新可选 prop `pendingVariables`,渲染琥珀计数徽标。
- i18n zh/en/types 如 §4;`docs/AI/INDEX.md` 登记 `VariableRow.tsx` 与本设计稿。
- 测试:新 `src/__tests__/VariablePanel.test.tsx`(12 例:分组 / 未引用标记 / 引用展开 / 声明 / Enter 提交且类型不变 / Escape 取消 / 行菜单改类型 / 复制+删除 / 行内确认清空 / 新增校验与重名 / 空状态 / 变量消失后收起);`params.test.ts` +6 例(`isValidVariableName`、`collectVariableRefs` 三态)。**全量 60 文件 / 729 例通过**,`tsc` 0 error,`eslint` 0 error(`max-lines` 仅剩 types.ts 旧告警),`check:index` OK。

### 踩坑

- 面板测试夹具最初用了中文变量名(`{{日期范围}}`)导致引用扫描为空 —— 这正是占位符正则不收中文的必然结果,夹具必须用 ASCII 名。
- `getByText` 只匹配元素的**直接文本子节点**:幽灵行的「第 3 步 · sort」在同一个 span 里,只能用正则或 `getAllByText` 断言。
- 行菜单的可访问名要与头部菜单区分:行内用 `{{name}} 变量操作`,头部用 `变量操作`,否则 `getAllByLabelText` 撞车。
