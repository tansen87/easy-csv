# 083 · 可自定义快捷键

> 状态: **已实现（2026-11-27）**
> 日期: 2026-11-27
> 关联: `030`（设置目录）、`053`（命令面板，`Mod+F` 是它唯一的入口）、`071`（日志抽屉，`Alt+Q`）、`074`（菜单栏命令输入，命令面板接管了 Ctrl F）
> 范围: 把原先写死在 `useKeyboardShortcuts` 里的 12 个组合抽成注册表 + 可绑定；新增设置页「快捷键」组。不改动作本身的分发规则（guard、输入框让位、对话框内的 Ctrl F），也不做导入/导出配置。

---

## 1. 决策

| | 方案 | 结论 |
|---|---|---|
| **A** | 设置页新增一个组，一行一个动作，右侧键帽录制 | **采用**：与设置页既有节奏一致，用户已经知道「去设置里改」 |
| B | 独立「键盘快捷键」窗口 | 不采用：多一个模态层级，和设置页的搜索/目录完全脱节 |
| C | 命令行 / 配置文件手改 | 不采用：普通用户够不到，也不该为一次改键打开文本编辑器 |

持久化采用**一个 JSON 字符串 blob**（`shortcuts`），而不是后端为每个动作建字段：

- 动作 id 的 schema 归前端所有，加一个动作、改一个名字都不需要 Rust 迁移；
- 读取时 `mergeShortcuts` 逐 id 过滤，未知 id 丢弃、缺失 id 回默认、非字符串忽略，所以老版本写下的 blob 不会让新版本崩掉；
- 后端只存不解释，`get_shortcuts` / `set_shortcuts` 各一行。

## 2. combo 格式

平台中立字符串，例如 `Mod+S`、`Alt+Q`、`Mod+Shift+Z`、`F5`：

| 片段 | 含义 |
|---|---|
| `Mod` | Windows/Linux 的 `Ctrl`，macOS 的 `⌘`（录制时 `ctrlKey \|\| metaKey`） |
| `Alt` / `Shift` | 字面修饰键，必须**精确**匹配（多按少按都不算命中） |
| 末段 | `event.key`；单个字符转大写，其余保留（`ArrowUp`、`Escape`、`F5`） |

键帽文本由 `comboTokens` 生成：`Mod` → `modKeySymbol()`（macOS `⌘`，其它 `Ctrl`），并配一张可读名表（`ArrowUp` → `↑`、`Delete` → `Del`、`Escape` → `Esc`、空格 → `Space`）。

默认绑定：

| 动作 | 默认 | 动作 | 默认 |
|---|---|---|---|
| 打开文件 | `Mod+O` | 撤销 | `Mod+Z` |
| 新建标签页 | `Mod+N` | 重做 | `Mod+Y` |
| 保存管道 | `Mod+S` | 执行 | `Mod+R` |
| 导入管道 | `Mod+I` | 模板 | `Mod+T` |
| 导出管道 | `Mod+E` | 命令面板 | `Mod+F` |
| 日志抽屉 | `Alt+Q` | AI 面板 | `Alt+A` |

## 3. 绑定规则

| 规则 | 原因 |
|---|---|
| 必须含 `Mod` 或 `Alt`，或本身是 `F1`–`F99` | 裸字母会在打字时到处触发；仅 `Shift+字母` 同理 |
| 与已有动作冲突 → **拒绝**并提示「与『X』冲突」 | 不做自动交换：用户没说要谁让位 |
| 单按修饰键忽略，录制继续 | `Ctrl` 按下只是组合的开始 |
| `Esc` 取消录制，不改绑定 | 与设置页「第一次 Esc 清搜索、第二次关闭」不冲突：录制中先被组件接管 |
| 录制期间 `preventDefault` + `stopPropagation`（window capture） | 录 `Ctrl+S` 时不能顺手把管道存了 |
| 改完立即生效、立即持久化 | 刚录的键必须马上能用；不等底部「保存设置」 |
| 「全部恢复默认」只在确实改过时出现 | 没改过就没有可恢复的东西，安静的设置页不该多一个按钮 |

## 4. 设置页位置与外观

- 组顺序：`界面 · 数据 · 窗口 · 快捷键 · 运行 · 日志 · 插件 · AI · 更新 · 维护`（序号 `04`）。
  放在「窗口」之后、「运行」之前：它属于应用行为，不属于数据，也不该排在破坏性操作附近。
- 组是 `summary: "shortcuts"`（与插件组同一套「无行、专属面板」机制），内容由 `ShortcutsSection` 渲染；
  组名与别名（`shortcut`/`hotkey`/`快捷键`/`键位`…）留在 `settingsSections` 里，所以搜索框仍能找到它。
- 每行复用 `SettingsRow`：标题取菜单里已有的文案（`openFile`、`savePipeline`、`execute`…），
  右侧是一枚 84×28 的等宽键帽（`rounded-md border font-mono text-[11px]`），录制时描边主色并显示「按下按键…」。
- 卡片下只有一行 11px 说明：默认是「点击键位后按下新组合, Esc 取消」，出错时就地变红（`text-danger`）；
  右侧的动作按钮默认为空，改过之后才出现「全部恢复默认」。
- 无障碍：键帽的 `aria-label` 带动作名与当前组合，录制时读作「动作: 按下按键…」。

## 5. 实现

| 文件 | 内容 |
|---|---|
| `src/lib/shortcuts.ts` | 动作 id、默认表、combo 纯函数（`comboFromEvent`/`isUsableCombo`/`comboMatches`/`comboTokens`/`mergeShortcuts`/`conflictingAction`/`shortcutsDiffer`） |
| `src/hooks/useShortcuts.ts` | 启动读取 `get_shortcuts` → `mergeShortcuts`；每次变更 `set_shortcuts`（整张表）；写入失败静默 |
| `src/hooks/useKeyboardShortcuts.ts` | 分发改为「查表 → 匹配 → switch(action)」，guard 与输入框/对话框规则原样保留；`default` 用 `never` 穷尽 |
| `src/components/setting/ShortcutsSection.tsx` | 键帽录制、冲突/裸键提示、恢复默认 |
| `src/components/setting/settingsSections.ts` | 新增第 4 组；`summary?: "plugins" \| "shortcuts"` |
| `src/components/setting/SettingsTabContent.tsx` · `SettingsDialog.tsx` · `src/app/App.tsx` | 透传 `shortcuts` / `onShortcutChange` / `onResetShortcuts`，并把 map 交给分发 hook |
| `src-tauri/src/config.rs` · `lib.rs` | `AppConfig.shortcuts: Option<String>`；`get_shortcuts` / `set_shortcuts` 命令与注册 |
| `src/i18n/translations/{types,zh/settings,en/settings}.ts` | `settingsGroupShortcuts`、`shortcutRecording`、`shortcutNeedsModifier`、`shortcutConflict`（`{action}` 占位）、`shortcutResetAll` |
| `src/__tests__/shortcuts.test.ts` | 注册表纯函数 8 例 |
| `src/__tests__/SettingsDialog.test.tsx` | 快捷键组 5 例（键帽渲染、录制、冲突、裸键与 Esc、恢复默认可见性） |

## 6. 行为

| 场景 | 行为 |
|---|---|
| 首次启动 / 没有 blob | 用默认表，设置页显示默认组合 |
| 改一个键 | 立即生效，立即写库；其余动作保持现值 |
| 录制的组合已被占用 | 不写入，键帽保持原值，卡下提示「与『X』冲突」 |
| 录制中按裸字母 | 不写入，提示「需要 Ctrl / ⌘ 或 Alt」 |
| 录制中按 `Esc` | 退出录制，绑定不变，错误提示清除 |
| 录制中按 `Mod+S` 等真实快捷键 | 被捕获阶段吞掉，不会触发保存/执行 |
| 输入框内按非命令面板的快捷键 | 照旧让位（与 083 之前一致） |
| 对话框内按命令面板键 | 不触发（对话框拥有自己的按键） |
| 保存/导出/执行/撤销/重做的 guard | 条件不满足时照旧 no-op，键帽显示的是绑定而非可用性 |
| 损坏的 blob | `JSON.parse` 失败或结构不对 → 回退默认表，不阻塞启动 |

## 7. 已知限制

- 不做冲突自动交换，也不提示「哪些键空闲」；冲突只有一次拒绝。
- 组合只支持「修饰键 + 一个键」，不支持序列（如 `Ctrl K Ctrl S`）或鼠标侧键。
- `Mod` 是平台固定的 Ctrl/⌘ 归并，不能单独把「仅 Ctrl」和「仅 ⌘」分开绑。
- 设置页底部的「恢复默认」**不**包含快捷键（与主题一样是即时生效项，恢复默认放在组内）。
- 没有导入/导出配置；换机器需要重新绑定。

## 8. 验证

- `pnpm typecheck`、`pnpm eslint --quiet`（新增与改动文件）通过。
- `pnpm vitest run src/__tests__/shortcuts.test.ts src/__tests__/SettingsDialog.test.tsx` 通过。
- 全量测试 75 文件 / 879 例通过（`VersionControlPanel` 的既有偶发并发失败单跑通过，与本次改动无关）。
- `cargo check`（`src-tauri`）通过。
