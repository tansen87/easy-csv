# 053 · 命令面板改版(命令行式搜索 + 相关度排序)

> 原型:`docs/design/prototypes/053/01-command-palette.html`(现状 / 改后 / 四种状态 / 解剖 / 11 条诊断 / 规格)。
> 入口:`Ctrl+K`(`useKeyboardShortcuts`)、「查看 → 命令面板」(Alt+C 是另一个面板,别混)。
> 目标文件:`src/modules/logs/CommandPalette.tsx`(267 行 → 重写)。

## 1. 为什么改

现状 `CommandPalette.tsx`(改前 267 行)能用,但它把 97 条入口当成一张平铺的清单,而这一屏的全部价值就是「在一秒内找到那一条」。具体问题:

1. **97 行同权重**。`:62-80` 只做 `haystack.includes(q)`,命中项保持 `paletteItems` 的原顺序;打 `fi` 时 `filter` 被排在 26 条「操作」之后。
2. **打字之后仍是五段分组**。最相关的结果压在组标题下面,分组在搜索时只挡路。
3. **命中了不说命中在哪**。`filter` / `fill` / `batch-filter` 三行的差别只在字面,肉眼要逐字比。
4. **26 个操作平铺一个组**(`App.tsx:1460-1714` 全部 `group: t.paletteActions`),高频与低频没有任何区分。
5. **组名 11px 大写宽字距 + 组图标**(`:193`),`CommandPalette` 是五个组各挂一枚不同字形(Zap / Command / LibraryBig / NotebookTabs / FileClock),组内又隐藏每行图标。
6. **每行一个透明 ↵**(`:238-242`):未选中行仍占 14px 画一个 `text-transparent` 的图标。
7. **576 × 420 的卡片**(`:161` `max-w-xl`,`:181` `min(420px, calc(100vh-300px))`),命令名 + 中文描述先被截断。
8. **位置与遮罩靠模糊和阴影说**(`:154` `backdrop-blur-xs` + `shadow-2xl` + `pt-[20vh]`)。
9. **Esc 说两遍**:查询行右侧一个 `esc` 键帽,底栏又一句「ESC 关闭」。
10. **不可用项直接消失**(`:63` `filter(!disabled)`),计数不解释少了几条。
11. **键盘与鼠标互相抢**:`:164` 在整块 dialog 上 `onMouseMove` 复位 `keyboardNav`,而 `:210-212` 的 `onMouseEnter` 依赖它 —— 由于 `mouseenter` 先于 `mousemove` 触发,鼠标进入新的一行那一帧 `keyboardNav` 还是 `true`,于是**要划过第二行才接管**;另一头 `ArrowDown` 用 `Math.min` 夹住不回环。

## 2. 方向

- **产品**:把 CSV 清洗编成管道的桌面工具。Ctrl+K 是键盘用户在一秒内找到 97 个入口的唯一通道。
- **性格**:精确、快、不寒暄 —— 像一个会记住你打到第几个字的终端。
- **世界**:命令行与表格列:等宽的名字、键帽、一个 `›` 提示符;中性灰打底,颜色只留给命中处。
- **两个瞬间**:① 查询行 `› fi` 后面的实时计数 ② 结果里你敲的那几个字上色,其余全灰。
- **签名**:**键帽**。快捷键写成和菜单栏完全同一种小键帽 `Ctrl+O`(细边、无底、等宽),底栏的 `↑ ↓ ↵ esc` 用同一套 —— 面板和菜单教的是同一套写法。

## 3. 结构

```
遮罩 30% 纯色(无模糊) · 顶部 48
┌─────────────────────────────────────────────── 600 ──┐
│ ›  fi                                   5 / 97             │ 52  › 提示符 14 mono · 查询 13 mono · 计数 10.5 mono
├────────────────────────────────────────────────────────────┤
│ 操作  26                                                   │ 空查询:分组 · 组名 11/500 + mono 计数
│   打开文件        CSV, Excel, JSON          [Ctrl+O]       │ 行 34 · 名字 13/500 · 描述 11.5 · 键帽 18
│   打开到新标签页                          [Ctrl][N]        │
│ 标签页  3                                                  │
│   销售收入        sales_2026.csv              当前         │
├────────────────────────────────────────────────────────────┤
│ ↑ ↓ 移动    ↵ 执行    esc 关闭                             │ 40
└────────────────────────────────────────────────────────────┘

有查询时(跨组排序,单列,无组标题):
  ›  fi                                   5 / 97
  ▏filter        根据表达式结果筛选 CSV 行      命令
   fill          填充空值                    命令
   fixlengths    补齐长度不一致的行           命令
   finance_2025.csv  D:\data\finance_2025.csv  文件
   batch-filter  搜索多个值并输出单独文件      命令
```

- **空查询** = 一条完整的可滚清单,按 `操作 → 标签页 → 最近文件 → 模板 → 命令` 分区;分区只让滚动时有地标,不折叠、不截断。
- **有查询** = 取消分组,跨组按分数排成单列,来源压成右列 10px 标签;原来放键帽的位置让给来源,有快捷键的仍然显示键帽(两列:来源 + 键帽)。
- **选中行** = 9% 品牌底 + 2px 左轨(`--brand-soft` + `bg-primary`),文字颜色不变。

## 4. 检索与排序(唯一新增逻辑)

`src/modules/logs/lib/scoreItem.ts` 是纯函数,不碰 React:

| 规则 | 分 | 说明 |
|---|---|---|
| 标签整词相符 | 100 | `filter` → `filter` |
| 标签前缀 | 80 | `fi` → `filter` / `fill` / `finance_2025.csv` |
| 标签内任意位置 | 60 | `batch-fi…` → `batch-filter` |
| 拼音首字母 | 55 | `dk` → 打开文件(仅纯字母查询) |
| 描述 / 关键词 / 快捷键 / 组名 | 30 | `去重` → `dedup`;`Ctrl+R` → 执行 |

同分时按**来源**排:`操作 → 命令 → 标签页 → 最近文件 → 模板`,再按原数组顺序。命令排在文件前面 —— 你在命令面板里找的多半是命令。这条与空查询的分区顺序(操作 / 标签页 / 最近 / 模板 / 命令)是两件事,前者是「搜索时谁先」,后者是「浏览时谁先」。

**命中高亮**:`matchItem` 同时返回标签与描述里的命中区间;标签命中用 `text-primary` + `font-semibold`(小字号只换色不够),描述命中从 `muted-foreground` 转 `foreground`。不加底色、不加下划线、不给整行染色。

**拼音首字母**:`src/utils/pinyinInitials.ts` 由 `scripts/gen-pinyin-initials.mjs` 生成 —— 从 `src/i18n/translations/zh/*` 与 `src/data/commands/*` 里收集汉字(约 1.2k 个),逐字喂给 `plugins/pinyin-cli`(`-s plain` 每个汉字输出其首字母),写成两张并行字符串 + 启动时构一次 Map。运行时零依赖、零异步;表里没有的字直接跳过,**只会少匹配,不会错匹配**。标签改动后重跑脚本。

**计数**:查询行右侧 `命中 / 可用`(`available` 已扣掉 `disabled`),这样「26 个操作怎么只搜到 24 条」有答案。空查询时显示 `97 项`。

**键盘**:`↑↓` 回环;`Enter` 执行当前行并关闭;`Esc` 关闭;输入法组字期间(`e.isComposing`)的 `Enter` 不执行。

**鼠标**:只有**真的动了**的指针才接管选中 —— `onMouseEnter` 被 `keyboardNav` 挡住(避免 `scrollIntoView` 把行滚到静止的指针下面导致选中跳动),行级 `onMouseMove` 在 `keyboardNav` 为真时立刻接管。两者合起来:划到哪选哪,但按方向键时行从指针下面滚过不会抢。

## 5. i18n

新增:`paletteCount`(`{shown} / {total}`)、`paletteTotal`(`{count} 项`)、`paletteEmptyTitle`(`没有匹配「{query}」的入口`)、`paletteEmptyHint`、`paletteSourceAction`。搜索时右列的来源标签复用已有键:命令 `paletteCommands`、标签页 `paletteTabs`、最近文件 `recentFiles`、模板 `paletteTemplates` —— 只有「操作」需要一个短名字(原 `paletteActions` 是「操作」,但它是组名,将来若改长会带歪标签,所以单独一个键)。

改值:`palettePlaceholder` → `输入命令、文件名或标签页`;`paletteNavigateHint` → `移动`;`paletteSelectHint` → `执行`;`paletteCloseHint` → `关闭`(不再自带 `ESC` 前缀,前面加键帽)。

删除:`paletteNoResults`(被 `paletteEmptyTitle` 取代)。

## 6. 实施记录(2026-11-12)

**新增**:`modules/logs/lib/scoreItem.ts`(排序 + 高亮区间,纯函数)、`modules/logs/lib/paletteTypes.ts`(`PaletteItem` / `PaletteSource` 从组件里搬出来,`scoreItem` 依赖它而不是组件,避免循环)、`utils/pinyinInitials.ts`(生成物,3.9 KB)、`scripts/gen-pinyin-initials.mjs`、`__tests__/PaletteScore.test.ts`。
**重写**:`modules/logs/CommandPalette.tsx`(267 → 376 行,含 `Key` / `Highlighted` 两个小部件)。
**改动**:`app/App.tsx`(四类 item 补 `source`,action 的 map 从「有英文别名才改」改成「总是补 source」)、`i18n/translations/{types,zh/en common}.ts`。
**保留但不渲染**:`PaletteItem.icon` / `groupIcon` / `noIcon` 三个字段留在类型里,面板不再读 —— 调用方(App、菜单、命令列表)还在传,删字段会外溢到 5 个地方。

**尺寸**:面板 **600** × 内容高,列表 `max-h: min(480px, 100vh-220px)`,查询行 52,行 34,底栏 40,分组小标上 10 下 4。

**快捷键写法**:第一版拆成两枚键帽(`Ctrl` + `O`),看着像两个要依次按的键,和菜单栏(`MainMenu.tsx` 一个 `kbd` 里写 `Ctrl+O`)也不是一套语言。现在统一成**一枚 chip 装整串**,字体/边框/透明度都对齐菜单栏;只有底栏的 `↑ ↓ ↵ esc` 还是单枚键帽(它们本来就是单键)。面板宽度同时从 680 收到 600:名字、描述、来源、键帽四段仍能一眼配对,再宽眼睛就要从行首扫到行尾。

**两个实现坑**:

1. **行必须 `w-full`**。`button` 虽然 `display:grid`,宽度仍是 `fit-content`,于是描述与键帽会紧贴名字而不是靠右。改成「列表容器 `px-1.5 py-1.5` + 行 `w-full`」;组头随即从 `px-4` 改成 `px-2.5`,才能和行内文字落在同一条 16px 竖线上。
2. **`calc(100vh-220px)` 在 Tailwind 里是无效值**(CSS 要求 `-` 两边有空格),必须写 `calc(100vh_-_220px)`。旧代码的 `min(420px,calc(100vh-300px))` 一直是坏的,只是没人在意。

**测试**:`CommandPalette.test.tsx` 从 11 例改到 18 例(新增排序、拼音、高亮、回环、IME、指针接管),`PaletteScore.test.ts` 10 例。全量 **62 文件 / 768 例通过**,`tsc` 0 error,`eslint` 0 error,`check:index` 207 条路径通过。

### 与原型不一致处

1. **页脚右侧没有「操作 26 · 命令 61」总计**。标签页 / 最近文件 / 模板是动态的,固定摆两个数字等于说半句真话;计数只留在查询行(`命中 / 可用`)与每个组名后面。
2. **分组的第三列只有键帽**。原型里标签页行右侧显示「当前」「3 步」,但面板拿不到「哪个标签是当前的」「哪次执行成功」,加两个 prop 才能做到 —— 收益不抵接口面,先不做。
3. **没有自绘的 3px 滚动指示条**。改用 `ScrollArea` 自带的滚动条(Radix,悬停显现):自绘细条在暗色与不同缩放下反而最抢眼。
4. **空结果时底栏只剩 `esc 关闭`**(原型 04-A 也是这样,但实现里是条件渲染,不是特例样式)。
5. **没有 hover 底色**。悬停即移动选中行,再给一块 hover 底色会和键盘选中打架;选中行的 9% 品牌底 + 2px 左轨是唯一的「在这里」。
6. **操作顺序没按菜单栏重排**(见 §7 第一条)。

## 7. 未做 / 开放问题

- **操作顺序没有按菜单栏重排**。诊断里提过把 26 条按 文件 → 编辑 → 视图 → 工具 → 帮助 排;但菜单栏与命令面板各写一份 action 定义,手动重排 26 条会与后续新增的操作失配。等两份定义合并成一份 `ACTION_DEFS` 再统一排序。
- **没有「最近使用」排序**。需要新的持久化 key + 清理策略(`utils/*History.ts` 那套),和命令面板的「零状态」冲突,先不做。
- **拼音首字母只覆盖静态标签**。用户自己命名的标签页 / 模板名不在表里(表是按当前 i18n 与命令描述生成的),所以 `dk` 找不到名为「打开的报告」的标签页。要覆盖得让用户数据也进表,或运行时算拼音(需要 pinyin 依赖)。
- **没有作用域前缀**(`>` 只看命令、`@` 只看文件)。97 项不值得记第二套语法。
- **不做行内补全 / 不做「只剩一条自动执行」**。
