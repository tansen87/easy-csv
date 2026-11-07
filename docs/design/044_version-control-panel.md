# 044 · 版本控制面板改版(提交日志)

> 状态:**已实施 2026-11-07**;原型 `docs/design/prototypes/044/01-version-control.html`。
> 对象:「查看 → 版本控制」打开的右侧吸附面板(`src/modules/pipeline/panels/VersionControlPanel.tsx`)。
> 管道语义、版本数据结构、保存/恢复/删除的行为全部不动。

## 1. 为什么改

旧面板是「每版一张带边框的卡片」:12px 内边距里塞 4 个 20px 图标、时间、差异摘要、标签。
320px 宽一屏只放得下 4 张,版本一多就是滚不完的卡片墙;选中任意一版,顶部固定 240px 的对比区
(`h-60`)还会把列表挤到只剩半屏。

| # | 现状 | 改法 |
|---|------|------|
| 1 | 一版一卡(约 84~110px),一屏 4 版 | 一行一版 56px,同样高度能看 4 倍数量 |
| 2 | 对比面板固定 `h-60`,把列表压掉半屏 | diff 落进被选中的行里,高度跟改动条数走 |
| 3 | 行内 4 个 20px 图标 + 头部 4 个 24px 图标,全屏 Tooltip、无 `aria-label` | 行内一个 `⋯`(重命名/标签/恢复/删除),头部只留「保存版本」与关闭 |
| 4 | 恢复与删除并排、同尺寸、同权重 | 恢复升为展开区按钮,删除退成红色文字 |
| 5 | `toLocaleString()` → `2026/11/7 20:12:00`,不对齐 | 相对时间(今天/昨天/M月D日)+ `tabular-nums`,完整时间进 `title` |
| 6 | 单条目 5 种颜色(当前实心徽章、+N 绿、−N 红、~N 黄、主色标签) | 只有 diff 保留语义色,标签退成 `#发布前` 弱文字 |
| 7 | 新建版本必须填描述才可保存,但列表里又有「未命名版本」文案 | 允许留空存为未命名,保存区独立占位 |
| 8 | 空状态一行灰字,不解释、无入口 | 两句话 + 「保存当前管道」,并报出当前步骤数 |
| 9 | 「查看」菜单四项写了 `aria-checked` 但界面上没有勾 | 左侧补 12px 勾选位(关闭时留白,不抖动) |

## 2. 结构

```
┌ 面板 320 ─────────────────────────────┐
│ 版本控制                    ＋保存版本 ✕ │ 28px
│ 8 个版本 · 当前工作区有未保存改动        │ 20px,无改动时整行不渲染
│ [ 搜索版本(带 ✕) ]                    │ 32px
├───────────────────────────────────────┤
│ ●  首版: 导入与筛选           ⋯        │ 56px,一点两行
│    今天 20:12 · 5 步 · 3 连接 #发布前 +1 当前
│ ○  加上去重                   ⋯        │
│    今天 18:40 · 4 步 · 3 连接      +2 −1
├───────────────────────────────────────┤
│ 列表 时间线                  清除所有版本 │ 36px
└───────────────────────────────────────┘
```

- **竖轨**是签名:一列连续细线 + 每行一个 7px 节点,当前版本实心(品牌色)、其余空心。
  轨道画在 CSS 伪元素上(`src/index.css` 的 `.version-rail`),展开的 diff 也补同一段
  (`.version-exp::before`),因此历史读起来是一条线而不是一叠卡。
- **节点对齐行标题**(而不是行框中心):`margin-top: 15px`;首行轨道从节点起(`top: 19px`),
  末行轨道止于节点(`bottom: calc(100% - 19px)`)。
- **行高必须量**:`.version-rail` 作为栅格项会拿到行内边距内的 36px,加 `margin-block: -10px`
  才撑满 56px,否则轨道被切成互不相连的短段(实测踩过,见 §6)。
- **展开区**缩进 44px(= 16 内边距 + 20 轨道列 + 8 间隙),与行文字左缘对齐。
- **diff 行只写步骤名**(别名优先,否则命令名),不带 `key=value` 参数值 —— 320px 宽里塞参数只会
  把两端的结构信息挤掉,要看参数应回画布上的节点。
- **基线切换用应用的 `Select` 组件**(可搜索的 combobox),不是原生 `<select>`:面板其余控件都是这套
  语言,版本描述较长时还能在弹层里搜索。展开区贴近列表底部时弹层会被滚动容器裁掉,因此给 `Select`
  加了 opt-in 的 `flip`:视口下方不足 200px 且上方更宽时向上展开。

## 3. 状态

| 状态 | 触发 | 表现 |
|------|------|------|
| 列表 | 默认 | 新→旧扁平列表;尾行轨道收在节点 |
| 时间线 | 底部切换 | 按 `parentId` 嵌套,深度缩进 `min(depth,2)×8`(线性历史不会把文字挤到只剩一半) |
| 展开 | 点行 / Enter | 行底色 `--muted` + 左侧 2px 品牌条(贯通 diff);显示的 diff = 该版 vs 基线 |
| 基线切换 | 展开区下拉 | 默认父版本,可选「当前工作区」或其它版本;方向恒为旧→新 |
| 保存 | 头部「保存版本」/ 空状态按钮 | 描述 + 标签 chips(回车成 chip、退格删末个)、`Ctrl+Enter` 保存、`Esc` 取消;描述留空存为未命名 |
| 搜索 | 输入 | 匹配描述与标签,结果恒为扁平列表;无命中给「没有匹配「X」的版本」+ 清除 |
| 行菜单 | `⋯` | portal 渲染(滚动容器裁不到),按窗口边界上下翻转 |
| 空状态 | 无版本 | 解释 + 步骤数 + 保存入口 |

确认框统一走 `ConfirmDialog`(删除 / 恢复 / 清除所有版本),不再手写两套 portal 弹窗。

## 4. 数据与派生(不新增状态)

- `当前工作区有未保存改动` = `!snapshotsEqual(当前版本快照, currentSnapshot)`;
- 行内 `+n −n ~n` = `summarizeDiff(diffSnapshots(父快照, 本版快照))`,父版本缺失时退化为数组前一项;
- 保存区的「与「X」相比 +a −r」同样由 `currentSnapshot` 与当前版本做 diff 得出;
- 时间由 `utils/format.ts` 的 `relativeStamp()` 拆成 `{kind, clock|month/day|year}`,
  再由 i18n 模板拼(`今天 {time}` / `Today {time}`),避免把中文写进格式化函数。
  **版本时间戳是裸本地 `YYYY-MM-DD HH:mm:ss`**,`new Date()` 在部分引擎按 UTC 解析,故手工拆字段。

## 5. i18n

新增(zh/en + `types.ts`):`versionPanelMeta`、`versionDirtyHint`、`versionStepUnit`、
`versionEdgeUnit`、`versionEmptyTitle/Desc/Action`、`versionSaveTitle/Facts/Against`、
`versionTagInputPlaceholder`、`versionNoMatchTitle/Hint`、`versionClearSearch`、`versionWorkspace`、
`versionActions`、`versionRemoveTag`、`versionMenuDelete`、`versionTimeToday/Yesterday/MonthDay/Full`。
复用:`save` / `saving` / `cancel` / `close` / `restore` / `versionCurrent` / `versionDiff` /
`versionEdges` / `versionNoChanges` / `versionCompareWithCurrent` / `listView` / `timelineView`。

## 6. 实施记录(2026-11-07)

- `VersionControlPanel.tsx` 重写(771 → 720 行,行渲染拆出后为 665 行);
  新增 `VersionLogRow.tsx`(381 行):行 + 展开 diff + 行内编辑器,全部表现层,动作经 `RowActions` 传入。
- `src/index.css` 追加 `.version-rail` / `.version-exp::before` 两段。
- `utils/format.ts` 新增 `export type RelativeStamp` 与 `relativeStamp()`。
- `MainMenu.tsx` 查看菜单补可见勾选:四项 `menuitemcheckbox` 左侧加 12px `Check`(未选中时
  `opacity-0` 保留占位),「命令面板」「在画布中搜索」两项补同宽空位,标签左缘对齐。
- **踩坑一**:`.version-rail` 作为栅格项,`align-self: stretch` 只撑到行内容盒(56−2×10=36px),
  轨道因此断成短段。实测(`getBoundingClientRect`)确认后改 `margin-block: -10px` 撑满 56px。
- **踩坑二**:节点描边原本写 `var(--border-strong)`,该 token 在本项目**不存在**;
  未定义变量在 `border` 简写里回落成 `currentColor`,空心节点会画成近黑色。改为
  `color-mix(in oklab, var(--foreground) 24%, transparent)`。
- 视觉核对用临时 vite 脚手架(单入口渲染面板 + 无头 Chrome 截图,亮/暗/展开/时间线/空状态五态),
  用完已删除。
- 测试:新增 `src/__tests__/VersionControlPanel.test.tsx`(10 例)与 `relativeStamp.test.ts`(6 例);
  全量 57 文件 / **678 例**通过,`tsc`、`eslint` 均 0 error。`VersionControlPanel.tsx` 仍带
  `max-lines`(665)与 `no-cross-module-imports`(引用 `ConfirmDialog`)两条 warning —— 后者是旧代码就有的。

### 与原型不一致处

- 原型里当前版本行只显示 `当前` 不显示差异;实现中当前版本只要是「有父版本」就照常给 `+n −n`,
  `当前` 排在它后面 —— 少一个特例分支,信息也更全。
- 原型时间线视图未画;实现沿用树形,但把缩进上限设为两级(原型说明里写的是「沿用现有关系」)。
- 原型说「Tab 逐行 / Enter 展开」:实现为行本身可聚焦(`role="button"`,全部在 Tab 序列里),
  **没有做 ↑↓ 漫游**,文档按实现写。

### 2026-11-07 复核后的两处调整(用户要求,原型同步)

- 基线选择从原生 `<select>` 改为 `Select` 组件(`height="h-6 px-2 pr-6 text-[11px]"`、宽 136、`flip`);
  `Select` 因此多了一个默认关闭的 `flip` 属性(见 §6 与 `src/components/ui/Select.tsx` 注释)。
- diff 行删掉具体参数(`key=value`),只保留步骤名;原型的第 03/04 帧同步删掉了 `<em>` 参数。
- 测试相应加一条断言:`对比` 控件是 `input[role=combobox]`(钉住「不是原生 select」)。

## 7. 未做 / 开放问题

- 时间线模式的顺序是「根 → 叶」(旧→新),列表模式是「新→旧」;同一份历史切换时方向会翻转。
  树形要「新→旧」需要子节点排在父节点之前,读起来更像倒放的树,暂不做。
- 标签的移除靠 hover 出现的 `×`(键盘可达),没有「编辑标签」面板;`⋯ → 添加标签` 只能追加,去重依赖
  `usePipelineVersions.addTag` 的现状(不去重)。若要整洁,应单开一稿做标签管理。
- 面板仍固定 320px,未做拖拽改宽;`max-lines` 未进一步拆分(头部/composer 还可再拆)。
