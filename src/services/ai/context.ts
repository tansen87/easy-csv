import { AIContext } from "./types";
import { xanCommands } from "@/data/commands";

const cmdDocs = import.meta.glob<{
  default: string;
}>("/src/docs/cmd/*.md", { query: "?raw", import: "default", eager: true });

const moonbladeDocs = import.meta.glob<{
  default: string;
}>("/src/docs/moonblade/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const aiUsageDocs = import.meta.glob<{
  default: string;
}>("/src/docs/AI_usage/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

function buildDocMap(
  globModules: Record<string, { default: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [path, mod] of Object.entries(globModules)) {
    const name = path.split("/").pop()?.replace(/\.md$/, "") ?? "";
    map.set(name, mod.default);
  }
  return map;
}

const cmdDocMap = buildDocMap(cmdDocs);
const moonbladeDocMap = buildDocMap(moonbladeDocs);
const aiUsageDocMap = buildDocMap(aiUsageDocs);

async function loadCommandDoc(commandName: string): Promise<string> {
  return cmdDocMap.get(commandName) ?? "";
}

async function loadMoonbladeDoc(docName: string): Promise<string> {
  return moonbladeDocMap.get(docName) ?? "";
}

async function loadAiUsageDoc(commandName: string): Promise<string> {
  return aiUsageDocMap.get(commandName) ?? "";
}

function buildCompactMoonbladeReference(fullDoc: string): string {
  const lines = fullDoc.split("\n");
  const kept: string[] = [];
  let inCode = false;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (inCode) {
        kept.push("");
        inCode = false;
      }
      kept.push(line);
    } else if (line.trim().startsWith("```")) {
      inCode = !inCode;
    } else if (inCode) {
      kept.push(line);
    }
  }

  return kept.join("\n").trim();
}

const EXPRESSION_COMMANDS = new Set(["map"]);

interface IntentRoute {
  intent: string;
  keywords: string[];
  synonyms?: string[];
  commands: string[];
}

const INTENT_ROUTES: IntentRoute[] = [
  {
    intent: "查看/预览数据",
    keywords: [
      "查看",
      "预览",
      "前几行",
      "后几行",
      "显示",
      "第几行",
      "看下",
      "看看",
    ],
    synonyms: ["展示", "浏览", "检查", "look", "view", "show", "preview"],
    commands: ["head", "tail", "slice"],
  },
  {
    intent: "搜索/查找/筛选",
    keywords: [
      "搜索",
      "查找",
      "查询",
      "筛选",
      "包含",
      "匹配",
      "找出",
      "等于",
      "开头",
      "结尾",
      "空值",
      "非空",
      "过滤",
    ],
    synonyms: ["search", "find", "filter", "select", "query", "locate", "检索"],
    commands: ["search", "filter"],
  },
  {
    intent: "排序",
    keywords: ["排序", "升序", "降序", "顺序", "order"],
    synonyms: ["sort", "排列", "整理", "arrange", "rank"],
    commands: ["sort"],
  },
  {
    intent: "列操作",
    keywords: [
      "列",
      "保留",
      "删除列",
      "重命名",
      "改名",
      "前缀",
      "后缀",
      "表头",
    ],
    synonyms: [
      "column",
      "字段",
      "选择列",
      "移除列",
      "rename",
      "select",
      "drop",
    ],
    commands: ["select", "drop", "rename", "behead"],
  },
  {
    intent: "新增列/计算/变换",
    keywords: [
      "新增",
      "计算",
      "变换",
      "乘以",
      "拆分",
      "提取",
      "相加",
      "相减",
      "转换列",
    ],
    synonyms: [
      "add",
      "calculate",
      "compute",
      "transform",
      "map",
      "衍生",
      "生成",
    ],
    commands: ["map", "transform", "enum"],
  },
  {
    intent: "统计/聚合",
    keywords: [
      "统计",
      "聚合",
      "总和",
      "合计",
      "平均",
      "均值",
      "计数",
      "行数",
      "求和",
      "最大",
      "最小",
      "汇总",
    ],
    synonyms: [
      "aggregate",
      "sum",
      "count",
      "average",
      "mean",
      "max",
      "min",
      "stats",
      "total",
    ],
    commands: ["agg", "count"],
  },
  {
    intent: "分组聚合",
    keywords: ["分组", "按某列", "group", "groupby"],
    synonyms: ["groupby", "group", "分类", "归类", "categorize"],
    commands: ["groupby"],
  },
  {
    intent: "数据透视/重塑",
    keywords: ["透视", "宽表", "长表", "转置", "重塑"],
    synonyms: ["pivot", "unpivot", "transpose", "reshape", "宽转长", "长转宽"],
    commands: ["pivot", "unpivot", "transpose"],
  },
  {
    intent: "去重",
    keywords: ["去重", "重复", "唯一", "distinct"],
    synonyms: ["dedup", "unique", "distinct", "重复移除", "唯一值"],
    commands: ["dedup"],
  },
  {
    intent: "清洗/空值",
    keywords: ["清洗", "空值", "填充", "缺失", "补齐", "修复"],
    synonyms: [
      "clean",
      "fill",
      "null",
      "empty",
      "missing",
      "补全",
      "清理",
      "数据清洗",
    ],
    commands: ["fill", "blank", "search", "fixlengths"],
  },
  {
    intent: "合并/连接",
    keywords: ["合并", "连接", "追加", "关联", "拼接", "两个文件"],
    synonyms: [
      "join",
      "merge",
      "cat",
      "concat",
      "combine",
      "拼合",
      "联合",
      "合并文件",
    ],
    commands: ["join", "cat", "merge"],
  },
  {
    intent: "导出",
    keywords: ["导出", "保存", "输出", "写出"],
    synonyms: ["export", "save", "output", "write", "转换格式", "另存为"],
    commands: ["output", "to"],
  },
  {
    intent: "采样/随机",
    keywords: ["采样", "随机", "抽样", "随机取"],
    synonyms: ["sample", "shuffle", "random", "抽签", "随机排序"],
    commands: ["sample", "shuffle"],
  },
  {
    intent: "可视化",
    keywords: ["图", "绘图", "图表", "直方图", "热力图", "分布图"],
    synonyms: ["plot", "chart", "graph", "visualization", "画图", "作图"],
    commands: [
      "plot",
      "hist",
      "heatmap",
      "spark",
      "matrix",
      "bins",
      "frequency",
    ],
  },
  {
    intent: "拆分/合并单元格",
    keywords: ["拆分", "分割", "展开", "合并", "单元格"],
    synonyms: ["split", "explode", "implode", "separate", "分列", "合并单元格"],
    commands: ["split", "explode", "implode", "separate"],
  },
  {
    intent: "窗口/滚动",
    keywords: ["窗口", "滚动", "滑动", "移动平均"],
    synonyms: ["window", "rolling", "滑窗", "移动窗口", "moving"],
    commands: ["window"],
  },
  {
    intent: "批量处理",
    keywords: ["批量", "多文件", "批次"],
    synonyms: ["batch", "multi", "批量处理", "批处理", "多个文件"],
    commands: ["batch-filter", "batch-from", "batch-to"],
  },
  {
    intent: "抽取/爬取",
    keywords: ["爬取", "抓取", "网页", "网络"],
    synonyms: ["scrape", "crawl", "fetch", "网页抓取", "数据抓取"],
    commands: ["scrape", "network"],
  },
  {
    intent: "格式/分隔符",
    keywords: ["格式", "分隔符", "转换格式", "制表符"],
    synonyms: ["format", "delimiter", "tab", "制表符", "分隔"],
    commands: ["fmt", "from", "to", "input"],
  },
  {
    intent: "行操作",
    keywords: ["行号", "行范围", "区间", "分段", "倒序", "倒置", "插入"],
    synonyms: [
      "range",
      "enum",
      "reverse",
      "partition",
      "行号",
      "倒序",
      "反转",
      "添加行号",
    ],
    commands: ["range", "enum", "reverse", "partition", "split"],
  },
];

const COLUMN_COMMANDS = new Set([
  "agg",
  "map",
  "filter",
  "groupby",
  "select",
  "drop",
  "sort",
  "rename",
  "search",
  "transform",
  "stats",
  "frequency",
  "bins",
  "window",
  "fill",
  "dedup",
]);

const MAX_RAG_DOCS = 6;

const COMMAND_BY_NAME = new Map(xanCommands.map((c) => [c.name, c] as const));

function buildCompactCommandDoc(commandName: string): string {
  const cmd = COMMAND_BY_NAME.get(commandName);
  if (!cmd) {
    return "";
  }

  const lines: string[] = [
    `### ${cmd.name}`,
    `${cmd.descriptionCn || cmd.description}`,
  ];
  if (cmd.parameters.length > 0) {
    lines.push("parameter:");
    cmd.parameters.forEach((p) => {
      const flag = p.flag ? ` (${p.flag})` : "";
      const required = p.required ? " [必填]" : "";
      lines.push(
        `- ${p.name}${flag}: ${p.descriptionCn || p.description}${required}`,
      );
    });
  }
  return lines.join("\n");
}

function getCommandIndex(): string {
  const categories: Record<string, typeof xanCommands> = {};
  xanCommands.forEach((cmd) => {
    if (!categories[cmd.category]) {
      categories[cmd.category] = [];
    }
    categories[cmd.category].push(cmd);
  });

  return Object.entries(categories)
    .map(([category, commands]) => {
      const lines = commands
        .map(
          (cmd) => `  - ${cmd.name}: ${cmd.descriptionCn || cmd.description}`,
        )
        .join("\n");
      return `### ${category}\n${lines}`;
    })
    .join("\n");
}

function getRoutingHints(): string {
  return INTENT_ROUTES.map(
    (route) =>
      `- ${route.intent} → ${route.commands.join(", ")}${route.synonyms ? ` (同义词: ${route.synonyms.slice(0, 3).join(", ")})` : ""}`,
  ).join("\n");
}

// Fuzzy matching function with pinyin-like support
function fuzzyMatch(query: string, text: string): number {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match
  if (textLower.includes(queryLower)) {
    return 10;
  }

  // Partial match
  let score = 0;
  let queryIdx = 0;
  for (let i = 0; i < textLower.length && queryIdx < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIdx]) {
      score += 1;
      queryIdx++;
    }
  }

  // If all query chars found
  if (queryIdx === queryLower.length) {
    return score / queryLower.length;
  }

  return 0;
}

// Synonym expansion function
function expandWithSynonyms(query: string): string[] {
  const expanded: string[] = [query];
  const queryLower = query.toLowerCase();

  INTENT_ROUTES.forEach((route) => {
    // Check if query matches any keyword
    const matchesKeyword = route.keywords.some((k) =>
      queryLower.includes(k.toLowerCase()),
    );
    if (matchesKeyword && route.synonyms) {
      expanded.push(...route.synonyms.slice(0, 2));
    }

    // Check if query matches any synonym
    if (route.synonyms) {
      const matchesSynonym = route.synonyms.some((s) =>
        queryLower.includes(s.toLowerCase()),
      );
      if (matchesSynonym) {
        expanded.push(...route.keywords.slice(0, 2));
      }
    }
  });

  return [...new Set(expanded)];
}

function retrieveRelevantCommands(
  userMessage: string,
  context: AIContext,
): string[] {
  const query = userMessage.toLowerCase();
  const scores = new Map<string, number>();

  // 1. Expand query with synonyms
  const expandedQueries = expandWithSynonyms(userMessage);

  // 2. Intent route matching with synonyms
  INTENT_ROUTES.forEach((route) => {
    // Check original keywords
    const hitOriginal = route.keywords.some((k) =>
      query.includes(k.toLowerCase()),
    );
    // Check synonyms
    const hitSynonym = route.synonyms?.some((s) =>
      query.includes(s.toLowerCase()),
    );

    if (hitOriginal) {
      route.commands.forEach((cmd) =>
        scores.set(cmd, (scores.get(cmd) || 0) + 3),
      );
    } else if (hitSynonym) {
      route.commands.forEach((cmd) =>
        scores.set(cmd, (scores.get(cmd) || 0) + 2),
      );
    }

    // Check expanded queries against route keywords
    expandedQueries.forEach((expanded) => {
      if (expanded !== userMessage) {
        const hitExpanded = route.keywords.some((k) =>
          expanded.toLowerCase().includes(k.toLowerCase()),
        );
        if (hitExpanded) {
          route.commands.forEach((cmd) =>
            scores.set(cmd, (scores.get(cmd) || 0) + 1),
          );
        }
      }
    });
  });

  // 3. Column name matching
  context.headers.forEach((header) => {
    if (query.includes(header.toLowerCase())) {
      COLUMN_COMMANDS.forEach((cmd) =>
        scores.set(cmd, (scores.get(cmd) || 0) + 2),
      );
    }
  });

  // 4. Command name and description matching with fuzzy
  xanCommands.forEach((cmd) => {
    const haystack =
      `${cmd.name} ${cmd.description} ${cmd.descriptionCn} ${cmd.category} ${cmd.parameters
        .map((p) => `${p.name} ${p.descriptionCn || p.description}`)
        .join(" ")}`.toLowerCase();
    const tokens = query.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2);
    tokens.forEach((token) => {
      if (haystack.includes(token)) {
        scores.set(cmd.name, (scores.get(cmd.name) || 0) + 1);
      }
      // Fuzzy match
      const fuzzyScore = fuzzyMatch(token, cmd.name);
      if (fuzzyScore > 0.5) {
        scores.set(cmd.name, (scores.get(cmd.name) || 0) + fuzzyScore);
      }
    });
  });

  // 5. Correction rules matching (from user feedback)
  if (context.correctionRules && context.correctionRules.length > 0) {
    context.correctionRules.forEach((rule) => {
      if (query.includes(rule.pattern.toLowerCase())) {
        // Boost the correct command
        const currentScore = scores.get(rule.correctCommand) || 0;
        scores.set(rule.correctCommand, currentScore + 5);
        // Penalize the wrong command
        const wrongScore = scores.get(rule.wrongCommand) || 0;
        if (wrongScore > 0) {
          scores.set(rule.wrongCommand, Math.max(0, wrongScore - 3));
        }
      }
    });
  }

  const ranked = [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  const picked = ranked.slice(0, MAX_RAG_DOCS).map(([name]) => name);

  if (picked.length === 0) {
    return ["search", "filter", "sort", "select", "agg", "count"];
  }

  return picked;
}

async function loadRelevantDocs(commandNames: string[]): Promise<string> {
  const docs = await Promise.all(
    commandNames.map(async (name) => {
      const aiDoc = await loadAiUsageDoc(name);
      if (aiDoc) {
        return aiDoc;
      }
      const compact = buildCompactCommandDoc(name);
      return compact.length > 0 ? compact : "";
    }),
  );

  const filtered = docs.filter((doc) => doc.length > 0);

  const needsExpressionDoc = commandNames.some((name) =>
    EXPRESSION_COMMANDS.has(name),
  );
  const moonbladePromise = needsExpressionDoc
    ? loadMoonbladeDoc("functions")
    : Promise.resolve("");

  const moonbladeDoc = await moonbladePromise;
  if (moonbladeDoc) {
    filtered.push(
      `### Moonblade 函数参考(map 表达式)\n${buildCompactMoonbladeReference(moonbladeDoc)}`,
    );
  }

  return filtered.length > 0 ? filtered.join("\n\n") : "";
}

// Clarification detection patterns
interface ClarificationPattern {
  pattern: RegExp;
  question: string;
  options: string[];
  /**
   * When the query already answers the question, asking again is noise.
   * e.g. "分别统计销售额、成本、利润的总和" already states the aggregation.
   */
  skipIf?: RegExp;
}

/** Aggregation functions the user may state explicitly in the query. */
const EXPLICIT_AGGREGATION =
  /总和|求和|合计|总计|累加|平均|均值|average|avg|计数|数量|个数|条数|count|最大|最小|max|min|极值|中位数|median|方差|标准差|stddev|sum/i;

const CLARIFICATION_PATTERNS: ClarificationPattern[] = [
  {
    pattern: /拆分.+/i,
    question: "您是想按行拆分,还是按条件拆分为多个文件?",
    options: [
      "按行拆分为多个文件(split)",
      "按条件拆分为多个文件(batch-filter)",
    ],
  },
  {
    pattern: /转换.+(?:格式|excel|json|html)/i,
    question: "您想转换成什么格式?",
    options: ["Excel (.xlsx)", "JSON", "HTML", "Markdown", "TSV"],
  },
  {
    pattern: /合并.+(?:文件|多个)/i,
    question: "您想如何合并文件?",
    options: [
      "按行拼接(上下合并)",
      "按列拼接(左右合并)",
      "按关键列关联(类似SQL JOIN)",
    ],
  },
  {
    pattern: /排序.+(?:多列|多个)/i,
    question: "多列排序的优先级是?",
    options: ["第一列优先", "最后一列优先", "自定义顺序"],
  },
  {
    pattern: /新增.+(?:列|计算)/i,
    question: "您想如何新增列?",
    options: ["基于现有列计算", "添加固定值列", "添加行号列"],
  },
  {
    pattern: /统计|聚合|汇总/i,
    question: "您想统计什么?",
    options: ["计数", "求和", "平均值", "最大/最小值", "自定义聚合"],
    skipIf: EXPLICIT_AGGREGATION,
  },
  {
    pattern: /导出|保存|输出/i,
    question: "您想导出成什么格式?",
    options: ["CSV(默认)", "Excel (.xlsx)", "JSON", "TSV"],
  },
];

function detectClarificationNeed(
  userMessage: string,
  context: AIContext,
): { needed: boolean; question?: string; options?: string[] } {
  // Skip if already in clarification round
  if (context.clarificationRound && context.clarificationRound >= 2) {
    return { needed: false };
  }

  // Skip if this is a clarification response
  if (context.pendingClarification) {
    return { needed: false };
  }

  const query = userMessage.toLowerCase();

  for (const pattern of CLARIFICATION_PATTERNS) {
    if (!pattern.pattern.test(query)) continue;
    // The query already contains the answer this pattern would ask for.
    if (pattern.skipIf && pattern.skipIf.test(query)) continue;
    return {
      needed: true,
      question: pattern.question,
      options: pattern.options,
    };
  }

  return { needed: false };
}

export async function buildSystemPrompt(
  context: AIContext,
  userMessage: string,
): Promise<string> {
  const routingHints = getRoutingHints();
  const relevantCommands = retrieveRelevantCommands(userMessage, context);
  const relevantDocs = await loadRelevantDocs(relevantCommands);
  const needsExpressionDoc = relevantCommands.some((name) =>
    EXPRESSION_COMMANDS.has(name),
  );
  const showFullIndex = relevantCommands.length >= 6;

  const contextParts = [];
  if (context.headers.length > 0) {
    contextParts.push(`当前CSV表头: ${context.headers.join(", ")}`);
  }
  if (context.pipelineSteps > 0) {
    contextParts.push(`当前管道已有 ${context.pipelineSteps} 个步骤`);
  }
  if (context.inputFile) {
    contextParts.push(`当前输入文件: ${context.inputFile}`);
  }

  // Add conversation history context
  if (context.conversationHistory && context.conversationHistory.length > 0) {
    const recentHistory = context.conversationHistory.slice(-6);
    const historyText = recentHistory
      .map(
        (msg) =>
          `${msg.role === "user" ? "用户" : "AI"}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? "..." : ""}`,
      )
      .join("\n");
    contextParts.push(`最近对话历史:\n${historyText}`);
  }

  const sections: string[] = [];

  sections.push(`
    你是Easy CSV的AI助手.
    你的职责: 理解用户的自然语言需求,转换为xan命令,以JSON格式返回.需要多步骤时,按正确顺序返回命令数组.`);

  // Correction rules section
  if (context.correctionRules && context.correctionRules.length > 0) {
    sections.push(`
    ## 已知纠正规则(必须遵守)
    以下规则来自用户之前的纠正,请务必遵守:
    ${context.correctionRules.map((r) => `- 当用户说"${r.pattern}"时,不要用${r.wrongCommand},必须用${r.correctCommand}`).join("\n")}`);
  }

  sections.push(`
    ## 核心规则(必须遵守)
    - 筛选/搜索某列=某值(等于/不等于)必须用search + exact匹配,严禁用filter.即使列是数字(如idx=1001)也一样.示例: 用户"筛选idx=1001"或"搜索idx=123" → {"command":"search","parameters":{"select":"idx","exact":true,"pattern":"1001"},"explanation":"筛选idx等于1001"}.filter仅用于数值大小比较(>、<、>=、<=).
    - 需求含"导出/保存/转换为非CSV格式"(如json、xlsx/excel、html、md、txt、jsonl等)时,必须用to命令,format参数指定输出格式.output只负责把CSV写入文件,不转换格式.
    - 参数名用短横线形式(如 select → -s);-r(regex)、-e(exact) 是flag类型参数,后面不接值,模式内容始终放在pattern(-p)中.
    - 创建新列时必须使用as指定列名(如map、groupby、agg命令).示例: 用户"根据debit-credit得到amount" → {"command":"map","parameters":{"expression":"col(\\"debit\\") - col(\\"credit\\") as amount"},"explanation":"计算debit减去credit得到amount列"}.严禁省略as.
    - groupby/agg的expression参数必须包含as子句.示例: 用户"按地区汇总销售额" → {"command":"groupby","parameters":{"columns":"region","expression":"sum(sales) as sales"},"explanation":"按地区汇总销售额"}.严禁写成'sum(sales)'而缺少'as sales'.
    - 需求是"对多列做同一种聚合"(如"分别统计A、B、C的总和"、"同时求X、Y的平均值")时,必须用[一条]agg命令:expression 用英文逗号拼接多个聚合表达式,每个都要有 as 别名.严禁拆成多条 agg 命令——agg 的输出只有一行,串联会让后续步骤基于已聚合的单行重复计算.示例: 用户"分别统计销售额、成本、利润的总和" -> {"command":"agg","parameters":{"expression":"sum(col(\\"销售额\\")) as \"销售额_总和\", sum(col(\\"成本\\")) as \"成本_总和\", sum(col(\\"利润\\")) as \"利润_总和\""},"explanation":"一次性统计三列的总和"}.中文列名请用 col("列名") 形式引用,以保证表达式可解析.
    - 特别注意括号匹配: as 别名必须写在函数括号[外面].正确: sum(col("销售额")) as "销售额_总和" ;错误: sum(col("销售额") as "销售额_总和") - 别名被包进括号会导致括号不闭合.
    - 别名含中文、空格或特殊字符时,必须用[双引号]包裹.正确: sum(col("销售额")) as "销售额_总和"、max(x) as "Max Replies";仅由英文字母/数字/下划线组成的别名(如 total、sales_sum)可不加引号.
    - 需求"合并/拼接某目录下所有CSV文件为1个CSV"时,用cat命令:mode=rows(按行拼接),勾选union(合并各文件列头),glob填目录通配符(如D:\test\*.csv).不要用join、merge或output.示例: 用户"合并D:\test所有的csv文件为1个csv" → {"command":"cat","parameters":{"mode":"rows","union":true,"glob":"D:\\\\test\\\\*.csv"},"explanation":"合并D:\\test下所有csv文件为1个csv"}`);

  sections.push(`
    ## 模糊需求处理
    当用户提示词模糊或可能有歧义时,输出格式必须为:
    {"suggestion":"建议的提示词","commands":[编号步骤]}
    - suggestion 字段: 给出更清晰的提示词建议
    - commands 字段: 基于合理理解执行的默认操作

    示例: 用户说"拆分date"
    输出: {"suggestion":"'将date列按-拆分取第2个'","commands":[{"command":"map","parameters":{"expression":"col(\\"date\\").split(\\"-\\")"},"explanation":"按-拆分date列"}]}

    当需求明确时,直接输出编号步骤,不需要suggestion字段.

    ## search vs filter 选择规则
    优先使用search,仅在需要数值比较时才用filter.

    search 用于所有筛选/搜索场景:
    - 等于/不等于 → search + exact 参数
      示例: search -s 列名 -e -p '值'        (等于)
      示例: search -s 列名 -e -p '值' -i     (不区分大小写等于)
      示例: search -s 列名 -e -p '值' -v     (不等于)
    - 包含/不包含 → search + regex 参数
      示例: search -s 列名 -r -p '值'
      示例: search -s 列名 -r -p '值' -v     (不包含)
    - 开头/结尾 → search + regex 参数
      示例: search -s 列名 -r -p '^文本'     (开头)
      示例: search -s 列名 -r -p '文本$'     (结尾)
    - 空值/非空 → search + empty/non-empty
      示例: search -s 列名 --empty            (空值)
      示例: search -s 列名 --non-empty        (非空)

    filter 仅用于数值比较(>、<、>=、<=):
    - 示例: 用户"筛选年龄大于30"
      正确: {"command":"filter","parameters":{"expression":"col(\\"age\\") > 30"}}
    - 示例: 用户"筛选金额在100到500之间"
      正确: {"command":"filter","parameters":{"expression":"col(\\"amount\\") >= 100 && col(\\"amount\\") <= 500"}}

    search 参数说明:
    - -s / select: 要搜索的列名
    - -p / pattern: 搜索模式(正则表达式或文本)
    - -e / exact: 精确匹配标志(不带值,配合pattern使用)
    - -r / regex: 正则表达式标志(不带值,配合pattern使用)
    - -i / ignore-case: 不区分大小写标志
    - -v / invert-match: 反向匹配标志
    - --empty: 查找空单元格
    - --non-empty: 查找非空单元格`);

  sections.push(`
    ## 意图路由
    ${routingHints}`);

  if (showFullIndex) {
    sections.push(`
      ## 命令索引(全量)
      ${getCommandIndex()}`);
  }

  sections.push(`
    ## 本次查询相关命令参数
    ${relevantDocs}`);

  sections.push(`
    ## 当前状态
    ${contextParts.length > 0 ? contextParts.join("\n") : "未打开文件"}`);

  sections.push(`
    ## 响应格式
    返回JSON,必须用数字编号区分每个步骤,每个字段单独一行.必须用\`\`\`json代码块包裹.

    多步骤(必须编号):
    \`\`\`json
    1. {
      "command": "命令1",
      "parameters": {
        "参数1": "值1",
        "参数2": "值2"
      },
      "explanation": "..."
    }
    2. {
      "command": "命令2",
      "parameters": {
        "参数1": "值1"
      },
      "explanation": "..."
    }
    \`\`\`

    单步骤:
    \`\`\`json
    {
      "command": "命令名",
      "parameters": {
        "参数1": "值1",
        "参数2": "值2"
      },
      "explanation": "..."
    }
    \`\`\`

    模糊需求:
    \`\`\`json
    {
      "suggestion": "建议的提示词",
      "commands": [编号步骤]
    }
    \`\`\`

    意图澄清(当需求模糊需要确认时):
    \`\`\`json
    {
      "clarification": "澄清问题",
      "clarificationOptions": ["选项1", "选项2"]
    }
    \`\`\`

    重要: 多步骤时每个命令前必须有数字编号(1. 2. 3.),编号与命令同行,不要把编号放在单独一行.非CSV问题可自然语言回答,但优先引导到CSV处理.`);

  if (needsExpressionDoc) {
    sections.push(`
      ## Moonblade表达式语法
      filter、map等命令使用Moonblade表达式:
      - 比较: ==, !=, >, <, >=, <=
      - 逻辑: &&, ||, !
      - 正则: .matches("pattern")
      - 数学: +, -, *, /
      - 列引用: 直接使用列名或col("列名")
      - 创建新列必须用as: 表达式 as 列名
      - 示例: 'age > 30 && name.contains("张")'
      - 示例: 'col("debit") - col("credit") as amount'
      - 以某文本结尾 → 列名.ends_with("文本")
      - 以某文本开头 → 列名.starts_with("文本")

      ## 数组索引规则(非常重要)
      Moonblade 数组索引从 0 开始,取第N个元素用 [N-1]:
      - 第1个元素 → [0]
      - 第2个元素 → [1]
      - 第3个元素 → [2]
      - 最后一个元素 → [-1]
      - 倒数第二个 → [-2]

      示例: "对date列按-拆分取第2个"
      正确: col("date").split("-")[1]
      错误: col("date").split("-")[-1]

      示例: "对name列按/拆分取第1个"
      正确: col("name").split("/")[0]
      错误: col("name").split("/")[1]`);
  }

  return sections.join("\n\n");
}

export async function buildFullPrompt(
  userMessage: string,
  context: AIContext,
): Promise<{ role: "system" | "user" | "assistant"; content: string }[]> {
  const systemPrompt = await buildSystemPrompt(context, userMessage);

  const messages: { role: "system" | "user" | "assistant"; content: string }[] =
    [{ role: "system" as const, content: systemPrompt }];

  // Add conversation history if available
  if (context.conversationHistory && context.conversationHistory.length > 0) {
    const recentHistory = context.conversationHistory.slice(-6);
    recentHistory.forEach((msg) => {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    });
  }

  // Add current user message
  messages.push({ role: "user" as const, content: userMessage });

  return messages;
}

export {
  loadCommandDoc,
  getCommandIndex,
  getRoutingHints,
  detectClarificationNeed,
  CLARIFICATION_PATTERNS,
};
