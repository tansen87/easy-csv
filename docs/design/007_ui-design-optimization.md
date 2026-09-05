# UI 设计与优化（对话框体系 · 面板系统 · 设计 token · 可达性）

> 基于 `docs/AI/INDEX.md`(2026-09 核对)与 UI 层代码实测,识别 Easy CSV 的 UI 设计优化点。
> 与既有文档分工:
> - 画布内交互(缩放、框选、切刀、节点状态、空画布引导)→ `canvas-ux-optimization.md`
> - 应用级功能与主题硬编码色值清理 → `feature-and-ui-roadmap.md`
> - 架构与工程化 → `architecture-engineering-optimization.md`
> - 结果展示的**功能设计**(ResultPanel 数据链路)→ `feature-expansion-plan.md` F1;本文只覆盖其**视觉与交互规范**
>
> 本文聚焦四个未被覆盖的 UI 维度:**对话框体系、浮动面板系统、设计 token 一致性、键盘可达性**。
> 每条给出:现状证据(实测)→ 问题 → 方案 → 验收清单。

---

## 1. 现状基线(实测)

| 维度 | 实测数据 | 问题信号 |
|------|---------|---------|
| 对话框形态 | **两套并存**:模态居中(`CommandDialog` `fixed inset-0 z-50 max-w-2xl rounded-xl` + backdrop) vs 可拖拽浮动小窗(`FilterDialog` `w-[240px]`、`PivotDialog` `w-[360px] h-[420px]`、`BatchFilterDialog` `w-[280px]`,均 `fixed z-50 rounded-lg cursor-grab`) | 同为"命令配置",视觉与交互心智不同 |
| 字号使用 | `text-sm` 629 次、`text-xs` 249 次;**任意值逃逸**:`text-[10px]` 25 次、`text-[11px]` 9 次 | token 体系存在但被绕过 |
| z-index | `z-50`×31、`z-10`×12、`z-40`×4、`z-60`×3、`z-20`×3、**`z-[9999]`×1、`z-[60]`×1** | 无分层规范,靠魔数叠罗汉 |
| 圆角 | `rounded-md`×376、`rounded-lg`×44、`rounded-xl`×8、`rounded-sm`×8、`rounded-2xl`×5 | 五档混用,同类元素不同圆角 |
| Esc 关闭 | 模态类(`CommandDialog`/`ConfirmDialog`/`CsvDiff`/`CsvEncoding`/`Update`)有 Escape 处理;**全部浮动小窗(Filter/Pivot/Sort/Replace/Pad/Split/文本/数值/日期/窗口函数/批量筛选)均无** | 键盘可达性断层 |
| 面板位置 | 各自为政:`AIPanel` 底部居中悬浮(`fixed bottom-2 w-[min(700px,...)]`)、`LogPanel` 右下角(`absolute bottom-4 right-4`)、`CommandList` 浮动可拖、`ChartPanel` 独立拖拽、`DataProfilePanel` 右侧栏 | 无统一停靠/折叠/互斥规则 |
| 滚动条 | 仅 `index.css` 与 `AIPanel` 自定义 webkit-scrollbar,其余面板用系统默认 | 明暗主题下观感不一 |
| 加载反馈 | `animate-spin` 仅 7 处,分散在对话框/菜单/节点 | 无统一 loading 规范 |
| 表格 sticky | `CsvDiffDialog` 与 `TableNode` 已有 `sticky top-0` 表头 | 主预览表无此处理(见 D6) |

---

## 2. 问题与方案

### D1. 对话框体系统一(P0)

**现状证据**:同为"命令参数配置"入口,`CommandDialog` 是居中模态(带 `bg-black/20` backdrop、`rounded-xl`),而 `FilterDialog` 等 11 个旧对话框仍是 `fixed` 浮动小窗(宽度 240~360px 硬编码、`rounded-lg`、`cursor-grab` 标题栏拖拽)。INDEX.md 显示旧对话框已是"薄包装器委托 `commands/` 表单"的过渡态,但外壳双轨未收敛。

**问题**:
- 用户学一次交互要学两遍:模态点 backdrop 关闭,浮动窗必须找 X 按钮(且无 Esc);
- 浮动小窗宽度 240px 放不下 `WindowDialog` 的 19 种窗口函数参数表单,实际使用中会溢出或挤压;
- 两套外壳意味着新命令表单接入时要选择走哪套,`CommandFormWrapper` 的统一按钮体系只在模态那套生效。

**方案**:
1. **收敛为单一模态体系**:所有命令配置统一走 `CommandDialog` 外壳(居中 + backdrop + Esc),旧浮动对话框逐个改为薄委托(表单逻辑已拆在 `dialog/commands/`,外壳替换成本可控);
2. 模态宽度分级规范:窄表单(单参数类)`max-w-md`、标准 `max-w-2xl`(现状)、复杂表单(Window/Pivot)`max-w-3xl`;高度超过视口 70% 时内部滚动、提交按钮固定底部;
3. backdrop 点击关闭可配置(表单有未保存输入时弹确认,复用 `ConfirmDialog`);
4. 过渡期对旧浮动窗至少补 Esc + 双击标题栏最大化,降低收敛前的挫败感。

**验收清单**:
- [ ] 全部 11 个命令配置入口视觉一致(同一 backdrop/圆角/按钮组/关闭方式);
- [ ] Esc 与 backdrop 点击行为符合各对话框配置;
- [ ] 复杂表单(WindowDialog 19 种函数)在 `max-w-3xl` 下无溢出;
- [ ] 表单有输入时误点 backdrop 出现确认而非直接丢失;
- [ ] 中英文界面下标题与按钮均不换行溢出(英文文案更长,需实测)。

### D2. 浮动面板停靠系统(P1)

**现状证据**:`AIPanel` 固定底部居中、`LogPanel` 固定右下、`CommandList` 自由拖拽、`ChartPanel` 自由拖拽 + 最大化、`DataProfilePanel` 右侧栏 —— 五种面板五种位置策略,`z-index` 各写各的(z-40/z-10/z-[9999] 混用),互相遮挡时无规则。

**问题**:
- 多面板同开时(执行中看日志 + AI 助手 + 命令列表),遮挡关系随机;
- 面板无记忆:拖到别处的 CommandList 重启回到默认位(会话快照只存管道,不存面板位置);
- 底部 AI 胶囊展开 `h-[36vh]` 时会盖住右下 LogPanel,互斥关系未定义。

**方案**(轻量停靠,不做完整 dock 布局引擎):
1. 定义**面板分层规则**替代魔数:`base(画布) < panel(停靠面板 z-10) < floating(自由浮窗 z-40) < modal(z-50) < toast(z-60)`,清理 `z-[9999]`/`z-[60]` 等 magic number 进 `index.css` 变量或 Tailwind token;
2. 面板位置持久化:扩展 `session.rs` 快照结构,记录各面板 `{x, y, collapsed, visible}`(向后兼容:旧快照无此字段取默认);
3. 互斥与避让规则:AI 面板展开时 LogPanel 自动上移避让(或左右分置);`ChartPanel` 最大化时其他浮窗自动降级为标签收起;
4. 所有浮动面板统一加折叠态(收为边缘胶囊),`useDraggable` 已有边界约束基建,补"贴近边缘吸附"即可。

**验收清单**:
- [ ] 全项目无裸 `z-[9999]`/`z-[60]`,层级由 token 定义;
- [ ] 面板拖动位置跨会话保留;
- [ ] AI 面板与 LogPanel 同开不互相遮挡(有明确避让行为);
- [ ] 每个浮动面板可折叠为胶囊且可展开恢复;
- [ ] 最小窗口尺寸(如 1024×640)下面板不越界。

### D3. 设计 token 收敛(P1)

**现状证据**:字体 token(`--font-sans/mono`)、圆角 token(`--radius` 亮 0.625rem/暗 0.5rem)、字号档位齐备,但组件层大量绕过:`text-[10px]`×25、`text-[11px]`×9、圆角五档混用(同类按钮 `rounded-md` 与 `rounded-lg` 并存)。

**问题**:
- 任意值字号绕过主题体系,暗色模式下若调基准字号这些硬编码点不跟随;
- 亮暗主题 `--radius` 不一致(0.625 vs 0.5rem)是有意设计还是漂移无文档说明;
- 新组件照抄邻近代码,误差逐步累积(376 处 `rounded-md` 44 处 `rounded-lg` 说明已出现分叉)。

**方案**:
1. 制定并落档 **UI token 规范**(进本文档附录或独立 `docs/design/ui-tokens.md`):
   - 字号仅允许 `text-xs / text-sm / text-base`(辅助信息 xs、正文 sm、标题 base+);`text-[10px]` 全部升为 `text-xs` 或以 `text-muted-foreground` 弱化替代"变小";
   - 圆角仅两档:控件 `rounded-md`(即 token 默认)、容器/模态 `rounded-xl`;`rounded-lg/2xl/full` 保留给特殊形态(胶囊、头像)并在文档列明白名单;
2. 用脚本一次性盘点 + 批量替换任意值字号(纯 class 替换,风险低);
3. `--radius` 亮暗不一致问题:确认设计意图后统一或注释说明;
4. ESLint(依赖 `architecture-engineering-optimization.md` B 项落地)加 `tailwindcss/no-arbitrary-value` 类规则防回流。

**验收清单**:
- [ ] `text-[10px]`/`text-[11px]` 清零(或仅存于设计文档白名单);
- [ ] token 规范文档存在且被三个设计文档引用;
- [ ] 亮暗主题切换后字号/圆角表现一致;
- [ ] 抽查 5 个高频界面(命令面板、命令对话框、日志、表格节点、设置)视觉无回归。

### D4. 键盘可达性补全(P0,低成本)

**现状证据**:Esc 处理仅覆盖 5 个模态对话框,11 个浮动小窗全部缺失;`CommandPalette`/搜索框有键盘导航(已有较好基建),但普通对话框内 Tab 顺序、focus trap 未系统性处理;部分组件已有 `aria-`(CommandList/CommandPalette 等 10 个文件),覆盖不全。

**方案**:
1. **Esc 全覆盖**:封装 `useEscClose(onClose)` hook,所有对话框/面板统一接入;模态栈(后开先关)用一个全局 dialog stack 维护,避免按一次 Esc 关掉两层;
2. focus 规范:模态打开 focus 进首个输入框、Tab 循环在模态内(focus trap)、关闭后焦点归还触发元素;radix 系 `ui/` 组件已具备此能力,自研外壳(旧浮动窗)需补;
3. `aria-label` 补齐纯图标按钮(X 关闭、拖拽把手、▶ 类操作按钮),对照 `CommandPalette` 的实现作为项目内标杆;
4. 新增 `Ctrl+Enter` 提交表单(命令对话框"添加/更新"按钮),与 `feature-expansion-plan.md` F2 的运行快捷键在 `KeyboardShortcuts.ts` 冲突表中一并登记。

**验收清单**:
- [ ] 任意对话框按 Esc 关闭且只关一层;
- [ ] 模态内 Tab 不逃逸到背景,关闭后焦点归还;
- [ ] 纯图标按钮全部有 `aria-label`(中英文随 i18n);
- [ ] `Ctrl+Enter` 在命令表单中触发提交;
- [ ] 快捷键登记进冲突表并更新 README。

### D5. 滚动条与加载反馈统一(P2)

**现状证据**:自定义 webkit-scrollbar 仅 `index.css`(全局基础)与 `AIPanel`(局部细化)两处;`animate-spin` 7 处散落,长任务(CSV 对比、编码转换、管道执行)各自实现 loading 文案。

**方案**:
1. 全局滚动条样式收敛进 `index.css`(细、圆角、`border` 色,亮暗主题各一套变量),删除 AIPanel 局部重复定义;
2. 统一 `<Spinner size>` 组件封装 `animate-spin`,规定尺寸档(14px 行内/20px 按钮内/28px 面板级);
3. 长任务统一"按钮内 spinner + 禁用"模式(编码转换对话框已如此,作为标杆推广到执行按钮、CSV 对比、批量转换);
4. 首帧加载(懒加载面板,依赖 architecture 文档 A3)统一骨架屏样式。

**验收清单**:
- [ ] 全应用滚动条观感一致(含暗色);
- [ ] 无裸 `animate-spin` 写法,统一走组件;
- [ ] 执行/对比/转换期间按钮均有 spinner + 禁用态;
- [ ] 懒加载面板首次打开显示骨架而非空白。

### D6. CSV 表格可读性规范(P1)

**现状证据**:`TableNode`(5 行预览)与 `CsvDiffDialog` 已有 sticky 表头,但整体表格样式各自手写;数字列与文本列同字体渲染,宽表无横向滚动指引;这是 CSV 工具的**核心内容形态**,却没有统一的表格组件规范。

**问题**:预览表、对比表、未来的结果预览表(F1)、概况统计表四处表格四套实现,对齐、空值显示(NULL/-/空)、数字右对齐等约定不一致。

**方案**:
1. 抽象 `CsvTable` 表格组件(sticky 表头 + 虚拟滚动可选 + 列宽拖拽 + 双语空值占位 `-`),`TableNode`/`CsvDiffDialog`/F1 `ResultPanel` 三处复用;
2. 列对齐规则:数值列右对齐 + `font-mono`(JetBrains Mono token 已有),文本列左对齐,日期列可用 mono;
3. 空值、超长单元格(截断 + title 提示)、重复列名警告(表节点已有)统一进组件;
4. 列类型推断可复用 `useDataLineage.ts` 的列类型推断逻辑(已有基建)。

**验收清单**:
- [ ] 三处表格由同一组件渲染,样式一致;
- [ ] 数值列右对齐等宽字体,长数字不跳动;
- [ ] 空值统一显示占位符(中英文各自正确);
- [ ] 千行级数据滚动流畅(分页或虚拟化);
- [ ] 亮暗主题下斑马纹/边框对比度达标。

---

## 3. 优先级与依赖

| 优先级 | 项 | 理由 | 依赖 |
|--------|-----|------|------|
| **P0** | D4 键盘可达性 | 成本最低(一个 hook + 全局栈),日常挫败感最强 | 无 |
| **P0** | D1 对话框统一 | 表单已拆分完毕,收外壳正是时候;F1 结果面板也会新增模态 | 无 |
| **P1** | D3 token 收敛 | 先定规范,后续新 UI(F1 面板/模板库)按规范生长 | 建议在 architecture 文档 B(ESLint)后防回流 |
| **P1** | D6 表格组件 | F1 ResultPanel 落地前先有组件,避免第四套表格 | 与 feature-expansion F1 同批 |
| **P1** | D2 面板停靠 | 多面板场景已现痛点,位置持久化顺带补 | 无 |
| **P2** | D5 滚动条/加载 | 打磨项,随手收敛 | 懒加载依赖 architecture A3 |

**建议批次**:
1. 第一批:D4(1~2 天)→ D1(3~4 天),先把"每天都在用"的交互理顺;
2. 第二批:D3 规范落档 + 任意值清理(1 天)、D6 表格组件(2~3 天,与 F1 同批做);
3. 第三批:D2 停靠与持久化(2~3 天)、D5 打磨。

---

## 4. 通用约束(沿用项目约定)

1. 所有 UI 走 i18n 双语,颜色一律主题变量(硬编码色值清理见 roadmap 3.3,本文不重复);
2. 新快捷键(`Ctrl+Enter`)先查 `KeyboardShortcuts.ts` 冲突表;
3. 面板/对话框的结构状态变更不影响撤销栈(仅管道结构走 `onStepsChange`);
4. 涉及拆分的组件(`CsvTable`、`Spinner`、`useEscClose`)放 `components/ui/` 与 `hooks/`,并补 `src/__tests__/` 用例;
5. 英文文案普遍长于中文,所有布局验收必须中英文各过一遍(防英文溢出)。
