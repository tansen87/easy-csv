# 031 · 右键快捷操作恢复为引导式浮窗

> 状态:**已实现(2026-10-21)**。范围:输入数据表格的 11 个右键入口。

## 1. 背景

v0.6.0 的前端重构(design 019)把输入数据表格右键的 11 个专用浮动对话框收敛成「居中模态 `CommandDialog` + 原始参数表单」。这次收敛解决了参数构建双实现的问题,但对新手不友好:

- 右键「筛选」看到的是 `search` 的 20 多个原始参数,而不是「列 / 运算符 / 值」。
- 右键「文本转换」看到的是一整段 xan 表达式,不知道从何下手。
- 旧版的窄窗会在右键位置浮出,点 Apply 即生成步骤并自动起可读别名。

本设计恢复旧版的交互形态,同时保留统一 `CommandDialog` 作为「高级参数」入口,不破坏命令面板与步骤编辑路径。

## 2. 架构

```
右键表格列/单元格
  → TableNode.onContextMenu(col, x, y)
  → FlowPanel.tableContextMenu
  → ContextMenu.onSelect(QuickActionRequest)
  → HomeView.quickAction
  → QuickActionDialog (按 kind 渲染引导表单)
      ├─ Apply   → buildQuickCommand() → onAddCommand(command, params, alias)
      └─ 高级参数 → buildQuickCommand() → setCommandDialog({ type, params })
```

- 新增 `src/modules/dialogs/quick/`,与 `modules/dialogs/command/` 并列。
- `CommandDialog` / `COMMAND_FORMS` 行为不变,只作为高级入口。
- 右键上下文类型 `QuickActionRequest` 放在 `src/types/dialog.ts`(components/ 不得引用 modules/)。

## 3. 文件

| 文件 | 职责 |
|------|------|
| `quick/types.ts` | `QuickDraft` 判别联合、`QuickBuildResult`、`QuickAliasLabels` |
| `quick/lib/buildQuickCommand.ts` | 纯函数:草稿 → `{ type, params, alias }`;11 类规则唯一实现 |
| `quick/lib/position.ts` | `computeAnchoredPosition`:右/下溢出翻转 + 边距夹取 |
| `quick/lib/dateFormats.ts` | 旧日期格式表 |
| `quick/lib/windowFunctions.ts` | 旧窗口函数表与表达式生成 |
| `quick/lib/labels.ts` | `useQuickAliasLabels()`,别名与运算符文案走 i18n |
| `quick/QuickActionShell.tsx` | 非模态浮窗外壳:定位、拖动、Esc/外点关闭、底部按钮 |
| `quick/QuickActionDialog.tsx` | 按 `kind` 分发 11 个表单 |
| `quick/forms/*` | Filter / Sort / Replace / Pivot / Date / Text / Number / Slice / Pad / Window / BatchFilter |

批量筛选的字段体从 `command/forms/batch-filter.tsx` 抽成 `BatchFilterFields`,统一表单与快速表单共用。

## 4. 参数规则

与 v0.5.0 的 Apply 逻辑一致,详见 `buildQuickCommand` 与 `src/__tests__/quickCommandParams.test.ts`:

| 入口 | 命令 | 说明 |
|------|------|------|
| 筛选·文本 | `search` | equals/not_equals 用 `exact`;前后缀/包含生成正则 + `regex`;空值用 `empty` / `non-empty` |
| 筛选·数值 | `filter` | `col("X") <op> N` |
| 排序 | `sort` | `select` 多列逗号连接、`reverse`、`numeric` |
| 替换 | `map` | 嵌套 `replace(...)`,regex 写成 `/pattern/flags`,末带别名 |
| 日期 | `map` | `strftime(datetime(...))`;`overwrite = 别名 === 源列` |
| 文本/数值变换 | `map` | 多列表达式逗号连接 |
| 切片/分裂 | `map` | `[:n]` / `[-n:]` / `[a:b]` / `split(...)` + 索引拼接 |
| 补位 | `map` | `lpad/rpad(col, width[, char])` |
| 透视 | `agg` / `groupby` / `pivot` | 按透视列/分组列是否为空选择命令 |
| 窗口 | `window` | 多条窗口表达式逗号连接 |
| 批量筛选 | `batch-filter` | 参数原样透传 |

别名取 i18n 文案(排序/替换/日期转换/文本转换/数字转换/切片/填充/窗口/批量筛选/透视或聚合/筛选运算符),提交时快照写入步骤。

## 5. 浮窗行为

- 宽度:filter 240;排序/替换/日期/文本/数值/切片 280;补位 240;窗口 300;透视/批量筛选 360。
- 高度:默认最大 `min(78vh, 680px)`;筛选表单用 `min(56vh, 560px)`,并给内容区一个 `min(33vh, 560px)` 的最小高度,让中间区域始终足够大(多值输入占空间时再在内部滚动)。
- 内容区使用共享的 `ScrollArea`。Radix viewport 的 `h-full` 需要已解析的父高度,而浮窗是自动高度的 flex 列,所以**把 `max-height` 直接加在 viewport 上**(`viewportStyle={{ maxHeight: "calc(<浮窗 max-height> - 86px)" }}`,86px = 标题栏 + 底栏),内容超出时由 ScrollArea 滚动,「忽略大小写」等底部字段始终可滚到。
- 多值 tag 加 `max-w-full break-all`,超长值不会把窗口横向撑破。
- 首帧用估算高度定位,`useLayoutEffect` 按真实尺寸校正;右/下溢出时翻到锚点另一侧,最小边距 8px。
- 标题栏拖动并按视口夹取;`.no-drag` 区域不触发拖动。
- 无遮罩、`aria-modal=false`、`z-50`;Esc 与外部 `mousedown` 关闭;点击内部不关闭。

## 6. 与 design 019 的关系

019 的结论「一个命令只有一处参数构建实现」仍然成立:

- `buildQuickCommand` 是引导字段 → xan 参数的唯一实现。
- 统一表单(`COMMAND_FORMS`)仍是原始参数的唯一编辑入口。
- 两者通过「高级参数」交接,不复制命令注册或提交逻辑。
- 因此删除了 `command/lib/initialParams.ts` 及其 28 例测试,断言迁移到 `quickCommandParams.test.ts`。

## 7. 测试

- `quickCommandParams.test.ts`:11 类命令/参数/别名/转义/无效输入。
- `quickPosition.test.ts`:四角与边距。
- `QuickActionDialog.test.tsx`:非模态、锚点、Apply、高级交接、Esc/外点关闭、筛选双模式。

## 8. 非目标

- 不恢复旧的 11 个独立组件文件与其重复外壳(统一由 `QuickActionShell` 承担)。
- 不改变右键菜单项与顺序。
- 不改变命令面板、步骤点击编辑、`CommandDialog` 的居中模态行为。
