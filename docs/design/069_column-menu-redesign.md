# 069 · 列右键菜单：补动词，不猜数据

> 状态: 已实现（2026-11-21）
> 日期: 2026-11-21
> 原型: `docs/design/prototypes/069/01-column-menu-redesign.html`
> 关联: `docs/design/031_quick-action-dialogs.md`
> 范围: 输入数据表格表头右键的「快捷操作」菜单

---

## 1. 反馈与取舍

本版基于两条明确反馈：

1. **排序不需要子菜单。** 现有排序浮窗已经支持升序 / 降序、多列选择和数值比较，右键的列会自动预选。拆成「升序 / 降序 / 自定义」反而多一层。
2. **删除列摘要。** 菜单头部不显示类型、行数、空值统计，也不按类型重排动词。

因此本版只做三件事：

- 补高频清洗动词：空值、去重、连续重复置空；
- 把分析和列操作各收进一个子菜单；
- 其它入口保持现状。

### 明确不做

| 不做 | 原因 |
|---|---|
| 列摘要（类型 / 行数 / 空值） | 菜单不承担数据判断；统计由数据概况面板负责 |
| 按列类型重排变换入口 | 没有摘要时重排是隐形行为，用户无法预期 |
| 排序子菜单 / 一键升序降序 | 现有浮窗已覆盖方向、多列和数值比较 |
| 列类型转换、按分隔符拆列 | 没有稳定命令，误判成本高 |

---

## 2. 现状审计

| 观察 | 影响 |
|---|---|
| 9 个入口平铺，没有分区 | 变换、聚合、列操作混排，新增入口后菜单过长 |
| 缺少空值入口 | 想只看空值、排除空值、填充空值都要绕到命令面板或搜索浮窗 |
| 缺少按列去重 | 报表类清洗要 reopen 命令面板；连续重复置空也只能去命令面板 |
| 缺少分析动作 | 分组统计、取前 N 行不在菜单里 |
| 排序已是正确形态 | 浮窗预选当前列，支持升 / 降序、多列、数值比较，不需要改 |

---

## 3. 新结构

```
快捷操作
├── 搜索
├── 批量搜索
├── 排序                  ← 保留单入口，打开现有浮窗
├── ────────────────
├── 空值 ▸                ← 新增子菜单
│   ├── 只看空值
│   ├── 排除空值
│   ├── ─────────────
│   ├── 填充空值…
│   └── 连续重复置空
├── 按此列去重            ← 新增
├── ────────────────
├── 文本转换 ▸            （不变）
├── 数字转换 ▸            （不变）
├── 替换                  （不变）
├── 日期                  （不变）
├── ────────────────
├── 分析 ▸                ← 新增子菜单
│   ├── 分组统计
│   ├── 取前 N 行
│   ├── ─────────────
│   ├── 透视              （从首层移入）
│   └── 窗口              （从首层移入）
└── 列操作 ▸              ← 新增子菜单
    ├── 复制列名
    ├── 复制整列
    ├── 重命名…
    ├── ─────────────
    ├── 删除此列
    └── 只保留此列
```

首层 11 行，约 385px，不需要滚动；子菜单最多一层，最多 5 项。

---

## 4. 排序为什么保持一个入口

现有 `SortQuickForm` 已经满足全部需求：

| 能力 | 现状 |
|---|---|
| 当前列预选 | `request.col` 直接作为首个排序列 |
| 方向 | 升序 / 降序分段控件 |
| 多列 | `ColumnPicker` 多选，按选择顺序生成 `select` |
| 数值比较 | 显式「按数值比较」勾选，生成 `--numeric` |

所以菜单里的「排序」只负责打开这个浮窗，不拆子菜单，也不预先生成升序 / 降序步骤。

---

## 5. 动作清单

### 5.1 新增

| 动作 | 命令 | 参数 | 交互 | 优先级 |
|---|---|---|---|---|
| 只看空值 | `search` | `select=列`、`empty` | 一键 | P1 |
| 排除空值 | `search` | `select=列`、`non-empty` | 一键 | P1 |
| 填充空值… | `fill` | `select=列`，可选 `value` | 浮窗：上一个非空值 / 固定值 | P1 |
| 按此列去重 | `dedup` | `select=列` | 一键 | P1 |
| 连续重复置空 | `blank` | `select=列` | 一键（空值 ▸） | P1 |
| 复制列名 | — | — | 一键剪贴板 | P1 |
| 删除此列 | `drop` | `selection=列` | 一键，可撤销 | P1 |
| 只保留此列 | `select` | `selection=列` | 一键，可撤销 | P2 |
| 分组统计… | `groupby` | `columns=列`、`expression` | 浮窗：聚合方式（count / sum / avg / min / max）+ 目标列 | P2 |
| 取前 N 行… | `top` | `column=列`、`limit=10` | 浮窗：N + 反转 | P2 |
| 复制整列 | — | — | 一键剪贴板，仅已加载行 | P2 |
| 重命名… | `rename` | 重建完整列名列表 | 小浮窗：新列名 | P2 |

### 5.2 迁移 / 保留

| 动作 | 变化 |
|---|---|
| 透视 / 窗口 | 从首层移入「分析 ▸」，表单不变 |
| 排序 | 不变，保持一个入口 |
| 文本转换 / 数字转换 / 替换 / 日期 | 位置与表单不变，只重新分段 |
| 搜索 / 批量搜索 | 不变，留在第一段 |

### 5.3 一键动作的步骤别名

| 动作 | 别名 |
|---|---|
| 只看空值 | 只看 <列> 的空值 |
| 排除空值 | 排除 <列> 的空值 |
| 按此列去重 | 按 <列> 去重 |
| 连续重复置空 | <列> 连续重复置空 |
| 删除此列 | 删除 <列> |
| 只保留此列 | 只保留 <列> |

别名在应用时快照写入步骤，之后改语言不影响已有步骤（沿用 031）。

---

## 6. 交互规则

| 类型 | 行为 |
|---|---|
| 一键动作 | 关闭菜单 → 用当前列生成参数 → 新增一步 → 新节点高亮一次；不弹窗 |
| 复制列名 / 整列 | 只写剪贴板；整列只复制表格已加载的行 |
| 浮窗动作 | 沿用 `QuickActionShell`；当前列预填，Enter 应用、Esc 关闭 |
| 破坏性动作 | 不做二次确认，依赖 `Ctrl+Z`；固定放在「列操作」分隔线之后，danger 文本 |
| 禁用 | 无输入表：整个菜单不出现；整表视图（无列）：列相关项灰显 |
| 边界 | 视口下方不足时向上翻转；子菜单右侧不足时翻到左侧 |
| 高度 | 首层 11 行不滚动；视口高度不足时内部滚动，头部固定 |
| 动效 | 菜单只淡入 80ms；不做位移与缩放 |

---

## 7. 实现影响

| 位置 | 改动 |
|---|---|
| `src/components/menu/ContextMenu.tsx` | 增加四段分区、三个子菜单与新增条目；`onSelect` 继续只上报 `QuickActionRequest` |
| `src/types/dialog.ts` | `QuickActionKind` 增加 `fill`、`groupby`、`top`、`search-empty`、`search-non-empty`；一键 kind 直接处理，不进表单分发 |
| `src/modules/data-preview/HomeView.tsx` | `handleQuickAction` 先处理一键 kind（直接 `onAddCommand`），其余仍打开浮窗 |
| `src/modules/dialogs/quick/lib/buildQuickCommand.ts` | 增加 fill / groupby / top / rename-column 的参数映射 |
| `src/modules/dialogs/quick/lib/instantColumnAction.ts`（新增） | 一键动作的纯函数：空值搜索、去重、置空、删列、保留列 |
| `src/modules/dialogs/quick/forms/` | `FillQuickForm`、`GroupAggregateQuickForm`、`TopRowsQuickForm`、`RenameColumnQuickForm` |
| `src/modules/pipeline/FlowPanel.tsx` | 无需改动：菜单仍由 `ContextMenu` 渲染，回调签名不变 |
| i18n | 见 §8 |
| 测试 | `quickCommandParams.test.ts` 覆盖 fill / groupby / top / rename；`instantColumnAction.test.ts` 覆盖一键动作 |

不新增列摘要读取 hook，也不改排序浮窗与数据概况面板。

---

## 8. 文案

| 键 | 中文 | English |
|---|---|---|
| `emptyValuesAction` | 空值 | Empty values |
| `onlyEmptyAction` | 只看空值 | Only empty |
| `excludeEmptyAction` | 排除空值 | Exclude empty |
| `fillAction` | 填充空值 | Fill empty cells |
| `dedupByColumnAction` | 按此列去重 | Deduplicate by this column |
| `blankDownAction` | 连续重复置空 | Blank repeated runs |
| `groupAggregateAction` | 分组统计 | Group and aggregate |
| `topRowsAction` | 取前 N 行 | Top rows |
| `copyColumnNameAction` / `copyColumnAction` | 复制列名 / 复制整列 | Copy name / Copy column |
| `renameColumnAction` | 重命名 | Rename |
| `deleteColumnAction` / `keepOnlyColumnAction` | 删除此列 / 只保留此列 | Delete column / Keep only this column |
| `analyzeActions` / `columnActions` | 分析 / 列操作 | Analyze / Column actions |

---

## 9. 非目标

- 不新增 xan 命令，不改任何命令的参数语义。
- 不在菜单里做列摘要、类型推断或按类型重排。
- 不改排序浮窗的行为与入口数量。
- 不做「按分隔符拆分此列」：`split` 是拆文件、`merge` 是合文件，没有稳定的拆列命令。
- 不做列类型转换。
- 不做「复制整列」的完整文件导出；只复制已加载行。

---

## 10. 验收标准

1. 表头右键菜单首层 11 行，含「空值」「分析」「列操作」三个子菜单；1280×800 下不滚动、不越界。
2. 首层「排序」直接打开现有浮窗，当前列预选，可切升 / 降序、多列与数值比较；没有「排序 ▸」子菜单。
3. 菜单头部只有「快捷操作」，不显示类型、行数或空值统计。
4. 点「只看空值」生成 `search` 步骤（`select=列`、`empty`）；「排除空值」生成 `non-empty`。
5. 点「按此列去重」生成 `dedup` 步骤（`select=列`），别名为「按 <列> 去重」；`Ctrl+Z` 可撤销。
6. 「连续重复置空」生成 `blank` 步骤；「删除此列」「只保留此列」生成 `drop` / `select` 步骤。
7. 「填充空值」「分组统计」「取前 N 行」打开浮窗且当前列预填。
8. 没有输入表时不出现菜单；整表视图下所有列相关项灰显。
9. `npm run typecheck`、`eslint`、`vitest`、`npm run build` 通过。

---

## 11. 后续可选

1. 「重命名」当前是小浮窗（重建完整列名列表）；是否改成表头行内编辑由后续决定。
2. 是否接受把「透视」「窗口」移进「分析」？这是首层保持 11 行的前提。
