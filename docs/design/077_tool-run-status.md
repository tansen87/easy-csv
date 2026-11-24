# 077 · 工具菜单里显示「正在运行」的工具

> 状态: **已实现(2026-11-24,采用方案 C:只留计时)**
> 日期: 2026-11-24
> 原型: `docs/design/prototypes/077/01-tools-menu-running.html`(现状 + 三案对比)
> 关联: `025_excel-multi-file-merge.md`(合并工作簿)、`017_separate-dialog-ux.md`(「上次结果」模式)、`071_logs-panel-and-storage.md`(`RunTimer` 与抽屉)、`076_view-dock-redesign.md`(同一天的另一处停靠区改造)
> 范围: 菜单栏「工具」下拉的状态显示。**八个工具对话框的内部逻辑、参数与结果面板一律不动。**

---

## 1. 现状审计

工具菜单里的八件事都是「开一个对话框 → 点开始 → 等」。查代码发现三件事:

| # | 事实 | 位置 | 后果 |
|---|---|---|---|
| 1 | 八个对话框都是模态(`fixed inset-0 z-50`) | 各自的根节点 | 运行时菜单栏点不到 —— 所以提示只能给「对话框已关掉」的那段时间 |
| 2 | 但它们**全都允许运行中关闭**:点背景、×、Esc 都直接 `onClose` | `MergeExcelDialog.tsx` 的遮罩 / 关闭按钮 | 关掉对话框 ≠ 停掉后端那条 `invoke`,`isMerging` 之类的本地开关连同组件一起消失 |
| 3 | 成功时没有任何回声:成功分支只 `saveLastExcelMergeResult` + 本地 `setState` | `MergeExcelDialog.tsx:539` 附近 | 对话框已关时,这次结果要等下次打开工具才看得见;**只有失败**才 `onShowToast` |

合起来就是:用户以为关掉=取消,于是再开一次点开始 → 两个进程写同一个输出文件;或者关掉去干别的,回来不知道刚才那件事到底跑完没有。

## 2. 决策

原型给了三案,A 条目右端「运行中 + 计时」、B 顶部运行卡、C 只留圆点 + 计时。**采用 C**:

- 菜单是「选一件事」的地方,状态越安静越好;计时本身已经说明"它在动"。
- 不新增行、不加卡片,八行的高度与顺序一个像素不变,只在跑着的那一行右端多 60px。
- 「运行中」三个字不进视觉,但留在无障碍名字里(`sr-only`),读屏仍能听到。

## 3. 实现

### 3.1 状态从对话框抬到壳

新增 `src/hooks/useToolRuns.tsx`:

```ts
type ToolId = "csvDiff" | "csvEncoding" | "separateGoodBad" | "cleanChars"
            | "splitLines" | "enumerateByGroup" | "csvToExcel" | "mergeExcel";
type ToolRuns = Partial<Record<ToolId, number>>;   // 工具 → 本次开始时间(epoch ms)
```

- `useToolRuns()` 持有 `runs` 与稳定的 `begin` / `end`;`begin` 已存在时**不重置开始时间**(二次启动不会把计时归零)。
- `ToolRunProvider` 同时下发 `runs` 与两个动作;`useToolRun(id)` 返回 `{ begin, end, running, startedAt }` —— 对话框既能上报,也能读到"这个工具已有一份运行在别处"。没有 provider(单测单独渲染对话框)时是 no-op、`running` 恒为 false。

App 里 `const toolRuns = useToolRuns();`,整个窗口包一层 `<ToolRunProvider actions={toolRuns.actions}>`,`runs` 以 prop 交给 `MainMenu`。

### 3.2 八个工具各改三行

每个对话框:

```ts
const { begin, end, running, startedAt } = useToolRun("<id>");
const busy = isXxx || running;      // 本对话框发起,或上一次运行还活着
```

- `begin()` 放在 `setIsXxx(true)` 之前,`end()` 放在 `finally` 的第一行;
- `busy` 接管主按钮的 `disabled`、按钮文案(`合并中…` / `开始合并`)、`RunTimer` 的 `running` 与 `startedAt`(重开对话框时计时从当初那一刻接着走,不归零);
- handler 开头加 `if (busy) return;`,挡住回车/快捷键这类绕过禁用按钮的路径;
- `begin / end / busy` 都补进该 `useCallback` 的依赖数组。

`finally` 一定会执行,所以**即使对话框中途被关掉,`end()` 也会在真正跑完时把菜单里的计时清掉** —— 这正是要的效果。

### 3.3 关掉之后跑完,补一条 toast

成功分支原本只在对话框还开着时才有意义(结果写进本地 state 与「上次结果」)。现在补上关闭的情况:

- 每个对话框加 `const isOpenRef = useRef(isOpen); isOpenRef.current = isOpen;` —— **不能用 `isOpen` prop 判断**:关掉对话框时,在飞的那次调用握着的是旧闭包,`isOpen` 永远是 `true`,这也是原来「失败才弹 toast」那段代码形同虚设的原因(现已一并改成读 ref)。
- 成功处:`if (!isOpenRef.current) onShowToast?.(模板字符串, "success")`。
- 文案用新键 `toolFinished`(中「已完成」/英「Finished」):单产物工具给路径;分片工具给第一个分片 + `· +N`;对比差异没有产物,只报「已完成: 对比差异」。

### 3.4 菜单里的那一行

`MainMenu.tsx` 新增 `ToolElapsed`(4px 品牌圆点 + 等宽计时):

- 计时**复用** `RunTimer` 的格式化函数(本次把它导出):`0.4 s`/`12.4 s`(不足 1 分钟)、`1:04`(超过)。不另造一套数字格式。
- 每 500ms 自更新一次;只在菜单打开时存在(菜单项是条件渲染),关掉即停。
- 右端对齐靠条目里已有的 `flex-1` 标签,不加 `ml-auto`。
- 无障碍:`<span class="sr-only">运行中</span>` 让按钮的可读名字变成「合并工作簿 运行中 12.4 s」。

## 4. 不做 / 待定

- **已补:关掉后成功也提示**(§3.3),顺带修好了失败分支读旧闭包的同一个问题。
- **不做取消**:合并、拆分、编码都没有 cancel 命令;画一个按不动的按钮比不画更糟。要做先在后端补取消。
- **不做进度百分比**:八件事都是一次 `invoke`,后端没有进度事件;计时是唯一诚实的数字。
- **不做菜单置顶**:运行中的工具仍待在原位,菜单位置稳定优先。
- **`runs` 已下发,重复启动已堵**:对话框重开时读 `running` → 按钮显示「合并中…」并禁用,计时接着后台那次走;handler 里还有 `if (busy) return;` 兜底。剩下的只是文案细节:底部左侧的「就绪」仍是本对话框自身的就绪状态,与"后台在跑"并列时略绕,暂不改。

## 5. 验证

- `npx tsc --noEmit` 通过;`npx eslint src` 0 error(警告数与改动前同级,新代码无告警)。
- `npx vitest run`:**69 文件 / 822 例全绿**。新增:
  - `toolRuns.test.tsx` 5 例:开始记录时间、结束清除、两个工具互不干扰、二次开始不重置时间、`running` 会下发给对话框、无 provider 时 no-op。
  - `ExecuteMenu.test.tsx` 1 例:运行中的「合并工作簿」出现计时,空闲时不渲染任何状态。
  - `MergeExcelDialog.test.tsx` 2 例:后台有运行、对话框重开时主按钮显示「合并中…」且禁用;以及**运行中关掉对话框、后端随后成功 → 弹出「已完成: <路径>」**(这一例在旧写法下必然失败,守住了 ref 的用法)。
- 真实组件截图确认:菜单宽度未变,计时右对齐,其余七行无变化。
