import type { Translations } from "@/i18n/translations/types";

/** First-run onboarding: canvas guide card, gesture card, sample data, completion toast, built-in templates. */
export const zhOnboarding = {
  // 画布空态引导卡
  onboardingStartTitle: "从这里开始",
  onboardingStartDesc:
    "数据已经就位. 选一个操作就能开始, 走完再决定要不要串成一条链",
  onboardingAddStep: "添加一个操作",
  onboardingAddStepDesc: "打开命令面板, 浏览全部 {count} 个操作",
  onboardingAskAi: "直接描述需求",
  onboardingAskAiDesc: "「按地区汇总金额」",
  onboardingSeeExample: "先看看示例",
  onboardingSeeExampleDesc: "加载一份示例数据 + 一条现成管道",
  onboardingRecommendedBadge: "推荐 · 30 秒",
  onboardingFlowOpenData: "打开数据",
  onboardingFlowAddStep: "添加操作",
  onboardingFlowExecute: "执行并导出",
  onboardingFlowNote: "整条流程都在这块画布上, 不写代码",
  onboardingBranchNote:
    "新加的节点会自成一条分支, 直接就能执行; 想串起来再连线",
  onboardingDismiss: "我知道了",
  onboardingDismissHint: "关闭后不再自动出现, 可在设置里找回",

  // 命令面板内的就地提示
  onboardingPanelHint:
    "选中第一个操作后, 它会直接对输入数据生效(自成一条分支) - 不需要先连线",

  // 手势提示卡
  onboardingGestureTitle: "画布手势",
  onboardingGestureCollapse: "收起",
  onboardingGestureRightDrag: "右键拖拽",
  onboardingGestureConnect: "从操作节点拖到目标 → 连线",
  onboardingGestureRightSlash: "右键划过",
  onboardingGestureCut: "切掉连线 / 节点",
  onboardingGestureSpaceOrMiddle: "空格 / 中键",
  onboardingGesturePan: "拖拽平移画布",
  onboardingGestureLeftDrag: "左键拖拽",
  onboardingGestureSelect: "空白处框选节点",
  onboardingGestureNote: "连线起点必须是操作节点, 输入节点不能起手",

  // 示例数据
  onboardingSampleFailed: "示例数据准备失败：{error}",
  // 示例逐步骤回放: 每一步都写明「这一步是怎么加进来的」
  onboardingDemoRevealAction1: "打开命令面板, 点 search → 去掉金额为空的行",
  onboardingDemoRevealAction2: "再点 dedup → 去掉完全重复的行",
  onboardingDemoRevealAction3: "最后点 groupby → 按地区汇总金额",
  onboardingDemoRevealRunning: "三步装好了, 正在跑一遍…",
  onboardingDemoRevealReady: "三步都在画布上了, 点「跑一遍」看结果",
  onboardingDemoRevealNext: "下一步",
  onboardingDemoRevealRun: "跑一遍",
  onboardingDemoRevealSkip: "跳过",

  // 设置页
  onboardingReset: "重新显示新手引导",
  onboardingResetDesc: "清除「已看过引导」标记, 下次打开文件时重新显示",

  // 内置模板
  builtinTemplatesGroup: "内置模板",
  myTemplatesGroup: "我的模板",
  copyToMyTemplates: "复制到我的模板",
  builtinTemplateCopied: "已复制到我的模板：{name}",
  builtinTplDemoName: "示例",
  builtinTplDemoDesc:
    "含一份示例销售数据, 三步清理并汇总. 打开即可运行, 不需要准备文件",
  builtinTplCleanName: "快速清洗",
  builtinTplCleanDesc: "去掉整行为空的行, 再去重. 对任何文件都能直接用",
  builtinTplProfileName: "先摸清数据",
  builtinTplProfileDesc: "先看列名, 再看每列的统计(类型、空值数、最值)",
  builtinTplGroupName: "按第一列分组计数",
  builtinTplGroupDesc:
    "按第一列分组统计行数. 把「0」改成你的列名即可按任意列汇总",
  builtinTplTopName: "排序并取前 100 行",
  builtinTplTopDesc: "按第一列排序后取前 100 行. 把「0」改成你的列名即可",
  builtinStepSearchAmount: "1 去掉金额为空的行",
  builtinStepDedup: "2 去除重复行",
  builtinStepGroupByRegion: "3 按地区汇总金额",
} satisfies Partial<Translations>;
