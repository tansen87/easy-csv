# 074 · 命令面板退役(073 之后它已经多余)

> 状态: 已实现(2026-11-22,实施记录见 §6)
> 日期: 2026-11-22
> 原型: `docs/design/prototypes/074/01-command-panel-removal.html`
> 关联: `073_menubar-command-input.md`(取代它的输入框)、`072_command-panel-redesign.md`(被审的停靠目录)、`027_first-run-onboarding.md`(首步引导)、`071_logs-panel-and-storage.md` / `040_settings-redesign.md`(形态基线)
> 范围: 菜单栏右端 ⌘ 图标 + 260px 停靠命令面板(`CommandList`)。**不动**命令表单、输入框面板、画布手势。

---

## 1. 现状审计

| # | 观察 | 影响 |
|---|---|---|
| 1 | 停靠面板(`CommandList.tsx` + `commandSearch.ts`)与输入框面板(`CommandPalette.tsx`)读同一份 `xanCommands`、同一张 `COMMAND_CATEGORY_VIEW` | 两处都是「61 条命令 / 14 类」 |
| 2 | 072 §3 的分工「目录 = 被看见,搜索 = 被找到」已失效:073 把输入框的空查询做成了目录 | 现在两者都在回答「有哪些操作」 |
| 3 | 菜单栏同时有输入框与 ⌘ 图标 | 同一个动作,两个入口 |
| 4 | 三个输入框:菜单栏、停靠面板头部、帮助 | 前两个搜同一批命令 |
| 5 | 面板 260px 常驻左缘,工具轨要右移 268px(`FlowPanel.tsx` 的 `commandPanelInset`) | 开关面板时画布横向跳一次 |
| 6 | 行语法分裂:停靠 40px 两行 / 输入框 34px 单行 | 同一条 `filter` 长得不一样 |
| 7 | 首步引导给 ⌘ 图标加高亮(`highlightCommandEntry`),引导卡「添加一个操作」也打开停靠面板 | 引导教的是更不可见的那扇门 |
| 8 | `Alt C` 开关面板、`Ctrl K` 开输入框、面板动作里还有一条「命令」在切换 | 两套快捷键 + 一条重复动作 |
| 9 | 日志是抽屉(071)、设置是对话框(040)、检索是输入框(073) | 只剩它还是「常驻画布上的目录箱」 |

## 2. 方向(unslop 五条)

- **产品**: 桌面上的 CSV 管道工具;加一步、找一条命令、跳到一个步骤,都从顶部那一个输入框开始。
- **性格**: 准确、安静、不绕路。
- **世界**: 账本与索引卡(033 / 040 / 072 / 073)。目录页只需要一本。
- **时刻**: 输入框下方那列结果——`01–14` 序号、等宽命令名、命中只换墨色;它是唯一「选东西」的画面。
- **签名**: `›` 提示符 + 键帽 + 等宽序号;⌘ 图标退休后,不再有第二个「命令」符号。

## 3. 决策

| 方案 | 判断 | 理由 |
|---|---|---|
| **A 删除停靠面板与 ⌘ 图标** | **采纳** | 内容与输入框完全重合;删掉 260px 遮挡、第二个搜索框、第二套行语法;入口 3 → 1 |
| B 只在空管道时自动出现一次 | 否 | 第一眼仍是两个入口;「一次性首屏」是 027 已否掉的引导屏思路 |
| C ⌘ 改成把目录弹层锚在按钮下 | 否 | 只是把重复内容换个位置,还会出现两种同内容浮层 |
| D 停靠面板改成「当前管道步骤目录」 | 否 | 换成了另一件功能;步骤已在画布 / 标签页 / 血缘里可见 |

**保留的东西**: 072 的分类显示序、`01–14` 编号、组头吸顶、行尾 `?` —— 这些已经在 073 的输入框面板里;073 的 34px 单行 + 来源标签不变。

## 4. 交互与文案的连带改动

| 项 | 改成 |
|---|---|
| 首步引导「添加一个操作」 | 打开顶部输入框(原:打开停靠面板) |
| 引导文案 `onboardingAddStepDesc` | 「在顶部输入框里浏览全部 {count} 个操作」;示例回放第 1 步改「按 Ctrl F」 |
| 首步高亮 | 从 ⌘ 图标移到输入框(品牌 50% 描边 + 3px 12% 环) |
| 面板首步提示条 | **删除**(不搬进输入框面板) |
| **每条命令的帮助**(原面板行尾 `?`) | **两处都做**:命令表单标题行「文档」按钮 + 输入框面板 `Shift+Enter`;帮助菜单与帮助中心不动 |
| 快捷键 | `Alt C` 删除(不留别名);`Ctrl K` 删除;`Ctrl F` 是唯一命令搜索快捷键 |
| 命令面板内的「命令」动作 | 删除 |

## 5. 实施记录(已完成)

| 文件 / 项 | 改动 |
|---|---|
| `modules/logs/CommandList.tsx` | 删除(面板、首步提示条、底栏计数) |
| `modules/logs/CommandRow.tsx`、`lib/commandSearch.ts` | 删除;`categoryView.ts` 只服务输入框面板 |
| `components/menu/MainMenu.tsx` | 删 ⌘ 图标与 `highlightCommandEntry`;右端 = 窄窗搜索图标 + 日志 / AI / 设置 |
| `app/App.tsx` | 删 `showCommandPanel`、`searchQuery`、面板挂载、`commandPanelInset` 计算;`handleHelpClick` 收敛为 `showCommandHelp(commandName)`;命令项补 `onHelp`;命令栏接 `highlight` |
| `modules/pipeline/FlowPanel.tsx` | 删 `commandPanelInset` 与工具轨位移,固定 `left-3` |
| `components/onboarding/FirstStepGuide.tsx` | `onAddStep` 改为打开输入框;键帽 `Alt+C` → `Ctrl F` |
| `modules/logs/CommandBar.tsx` | 键帽 `Ctrl K` → `Ctrl F`;新增 `highlight`(引导期给输入框描边) |
| `modules/logs/CommandPalette.tsx` / `PaletteItem` | 条目增加可选 `onHelp`;`Shift+Enter` 调用并关闭;底栏加 `⇧↵ 文档`(当前行无文档时压暗) |
| `modules/dialogs/command/CommandDialog.tsx` | 标题行右侧加「文档」按钮(`BookOpen` + 文案);`onShowHelp(commandDialog.type)`;`onMouseDown` 阻止拖拽 |
| `hooks/useKeyboardShortcuts.ts` | 删 `Alt C` 与 `Ctrl K`;`Ctrl F` 是唯一命令搜索快捷键 |
| 帮助文档 | `HelpContent.ts` / `HelpContentCn.ts` 的「Alt+C 打开命令面板」「Ctrl+K」全部改为 `Ctrl F 命令搜索` |
| i18n | 删 `commandPanel` / `cmds` / `searchCommand` / `commandSearchPlaceholder` / `command*` 目录键 / `onboardingPanelHint`;加 `commandDocs`;改 `onboardingAddStepDesc` 与示例回放第 1 步 |
| 测试 | 删 `CommandList`(11)+ 首步提示(2)+ `commandSearch` 用例;`ExecuteMenu` 右端按钮 4 → 3;补「`Shift+Enter` 打开文档」。66 文件 / **809 例全绿** |

**度量**: 画布可用宽度 +260px;可见入口 3 → 1;搜索框 3 → 2;命令面板由 2 处渲染降为 1 处。

## 6. 代价与风险

- **连续加步**: 停靠面板可以一直开着连续挑;改后每加一步要再按一次 `Ctrl F`。命令表单本身是模态,选完面板本来也会被挡住。
- **`Alt C` 已删除**: 按 2026-11-22 拍板不再保留别名;帮助文档与引导卡上的 `Alt C` 一并改成 `Ctrl F`。
- **072 的工作**: 分类序与编号全部留在输入框面板,不是推倒重来。

## 7. 已拍板(2026-11-22)

1. `Alt C` **彻底删除**(不留别名)。
2. 首步提示条**直接删除**,不搬进输入框面板。
3. 空管道时输入框**不自动展开**(避免抢焦点)。
4. 帮助**两处都做**:命令表单标题行「文档」+ 面板 `Shift+Enter`。
5. `Ctrl K` 取消,`Ctrl F` 成为唯一的命令搜索快捷键(含帮助文档、引导卡键帽、字段键帽)。

## 8. 验收

- [x] 菜单栏右端只剩搜索(窄窗)/ 日志 / AI / 设置
- [x] 画布工具轨固定在 `x=12`,开关检索无横向位移
- [x] 首步引导卡与「添加一个操作」都指向输入框,输入框在引导期有描边
- [x] 61 条命令、14 个分类、当前管道 / 文件 / 标签页 / 模板都只在输入框面板出现一次
- [x] `Alt C` 与 `Ctrl K` 已移除;`Ctrl F` 打开命令搜索
- [x] 命令表单标题行有「文档」;面板 `Shift+Enter` 打开同一份帮助;帮助菜单 / 帮助中心不变
