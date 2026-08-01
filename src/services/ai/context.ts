import { AIContext } from "./types";
import { xanCommands } from "@/data/commands";

const COMMAND_DOCS_CACHE: Record<string, string> = {};

async function loadCommandDoc(commandName: string): Promise<string> {
  if (COMMAND_DOCS_CACHE[commandName]) {
    return COMMAND_DOCS_CACHE[commandName];
  }

  try {
    const response = await fetch(`/docs/cmd/${commandName}.md`);
    if (response.ok) {
      const content = await response.text();
      COMMAND_DOCS_CACHE[commandName] = content;
      return content;
    }
  } catch (error) {
    console.warn(`Failed to load docs for command: ${commandName}`);
  }

  return "";
}

const MOONBLADE_DOCS_CACHE: Record<string, string> = {};

async function loadMoonbladeDoc(docName: string): Promise<string> {
  if (MOONBLADE_DOCS_CACHE[docName]) {
    return MOONBLADE_DOCS_CACHE[docName];
  }

  try {
    const response = await fetch(`/docs/moonblade/${docName}.md`);
    if (response.ok) {
      const content = await response.text();
      MOONBLADE_DOCS_CACHE[docName] = content;
      return content;
    }
  } catch (error) {
    console.warn(`Failed to load moonblade docs: ${docName}`);
  }

  return "";
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

const EXPRESSION_COMMANDS = new Set(["map", "transform", "select"]);

interface IntentRoute {
  intent: string;
  keywords: string[];
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
      "view",
    ],
    commands: ["view", "head", "tail", "slice"],
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
    commands: ["search", "filter"],
  },
  {
    intent: "排序",
    keywords: ["排序", "升序", "降序", "顺序", "order"],
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
    commands: ["agg", "count", "stats", "frequency"],
  },
  {
    intent: "分组聚合",
    keywords: ["分组", "按某列", "group"],
    commands: ["groupby"],
  },
  {
    intent: "数据透视/重塑",
    keywords: ["透视", "宽表", "长表", "转置", "重塑"],
    commands: ["pivot", "unpivot", "transpose"],
  },
  {
    intent: "去重",
    keywords: ["去重", "重复", "唯一", "distinct"],
    commands: ["dedup"],
  },
  {
    intent: "清洗/空值",
    keywords: ["清洗", "空值", "填充", "缺失", "补齐", "修复"],
    commands: ["fill", "blank", "search", "fixlengths"],
  },
  {
    intent: "合并/连接",
    keywords: ["合并", "连接", "追加", "关联", "拼接", "两个文件"],
    commands: ["join", "cat", "merge"],
  },
  {
    intent: "导出",
    keywords: ["导出", "保存", "输出", "写出"],
    commands: ["output", "to"],
  },
  {
    intent: "采样/随机",
    keywords: ["采样", "随机", "抽样", "随机取"],
    commands: ["sample", "shuffle"],
  },
  {
    intent: "可视化",
    keywords: ["图", "绘图", "图表", "直方图", "热力图", "分布图"],
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
    commands: ["split", "explode", "implode", "separate"],
  },
  {
    intent: "窗口/滚动",
    keywords: ["窗口", "滚动", "滑动", "移动平均"],
    commands: ["window"],
  },
  {
    intent: "批量处理",
    keywords: ["批量", "多文件", "批次"],
    commands: ["batch-filter", "batch-from", "batch-to"],
  },
  {
    intent: "抽取/爬取",
    keywords: ["爬取", "抓取", "网页", "网络"],
    commands: ["scrape", "network"],
  },
  {
    intent: "格式/编码/分隔符",
    keywords: ["格式", "分隔符", "编码", "转换格式", "制表符"],
    commands: ["fmt", "from", "to", "input"],
  },
  {
    intent: "行操作",
    keywords: ["行号", "行范围", "区间", "分段", "倒序", "倒置", "插入"],
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

function buildCompactCommandDoc(commandName: string): string {
  const cmd = xanCommands.find((c) => c.name === commandName);
  if (!cmd) {
    return "";
  }

  const lines: string[] = [`### ${cmd.name}`, `${cmd.descriptionCn || cmd.description}`];
  if (cmd.parameters.length > 0) {
    lines.push("参数:");
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
    (route) => `- ${route.intent} → ${route.commands.join(", ")}`,
  ).join("\n");
}

function retrieveRelevantCommands(
  userMessage: string,
  context: AIContext,
): string[] {
  const query = userMessage.toLowerCase();
  const scores = new Map<string, number>();

  INTENT_ROUTES.forEach((route) => {
    const hit = route.keywords.some((k) => query.includes(k.toLowerCase()));
    if (hit) {
      route.commands.forEach((cmd) =>
        scores.set(cmd, (scores.get(cmd) || 0) + 3),
      );
    }
  });

  context.headers.forEach((header) => {
    if (query.includes(header.toLowerCase())) {
      COLUMN_COMMANDS.forEach((cmd) =>
        scores.set(cmd, (scores.get(cmd) || 0) + 2),
      );
    }
  });

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
    });
  });

  const ranked = [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  const picked = ranked.slice(0, MAX_RAG_DOCS).map(([name]) => name);

  if (picked.length === 0) {
    return ["view", "search", "filter", "sort", "select", "agg", "count"];
  }

  return picked;
}

const AI_USAGE_DOCS_CACHE: Record<string, string> = {};

async function loadAiUsageDoc(commandName: string): Promise<string> {
  if (AI_USAGE_DOCS_CACHE[commandName]) {
    return AI_USAGE_DOCS_CACHE[commandName];
  }

  try {
    const response = await fetch(`/docs/AI_usage/${commandName}.md`);
    if (response.ok) {
      const content = await response.text();
      AI_USAGE_DOCS_CACHE[commandName] = content;
      return content;
    }
  } catch (error) {
    console.warn(`Failed to load AI usage docs: ${commandName}`);
  }

  return "";
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

  if (commandNames.some((name) => EXPRESSION_COMMANDS.has(name))) {
    const functionsDoc = await loadMoonbladeDoc("functions");
    if (functionsDoc) {
      filtered.push(
        `### Moonblade 函数参考(map 表达式)\n${buildCompactMoonbladeReference(functionsDoc)}`,
      );
    }
  }

  return filtered.length > 0 ? filtered.join("\n\n") : "";
}

export async function buildSystemPrompt(
  context: AIContext,
  userMessage: string,
): Promise<string> {
  const commandIndex = getCommandIndex();
  const routingHints = getRoutingHints();
  const relevantCommands = retrieveRelevantCommands(userMessage, context);
  const relevantDocs = await loadRelevantDocs(relevantCommands);

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

  return `你是Easy CSV的AI助手.
  你的职责: 理解用户的自然语言需求,转换为xan命令,以JSON格式返回.需要多步骤时,按正确顺序返回命令数组.

## 最关键规则(必须遵守,违反即视为错误)
- count 命令只能统计整个文件的行数,没有任何筛选能力.只要用户需求包含"筛选/查找/以...开头/以...结尾/包含/匹配/过滤"等意图,哪怕后面还跟着"统计/行数/计数",第一步必须输出 search 或 filter,第二步才输出 count.严禁只输出 count.
- 需求含筛选+统计时,回答必须是两步数组 [筛选命令, count].示例:
  用户: "筛选idx以1结尾的行并统计行数"
  正确: [{"command":"search","parameters":{"select":"idx","regex":"1$"},"explanation":"筛选idx以1结尾的行"},{"command":"count","parameters":{},"explanation":"统计行数"}]
  错误: [{"command":"count","parameters":{},"explanation":"统计行数"}]

## 意图路由(先根据用户意图定位命令,再查看下方详细参数)
${routingHints}

## 命令索引(全量,所有可用命令及用途)
${commandIndex}

## 本次查询相关命令详细参数(根据用户需求按需检索)
${relevantDocs || "(无可检索到的详细文档)"}

## 当前状态
${contextParts.length > 0 ? contextParts.join("\n") : "未打开文件"}

## 响应格式
当用户描述需求时,请返回JSON格式.
优先考虑是否需要多个步骤,当需求包含筛选+统计、分组+聚合、排序+取前N等组合时,一律返回命令数组:

\`\`\`json
[
  { "command": "命令1", "parameters": {...}, "explanation": "..." },
  { "command": "命令2", "parameters": {...}, "explanation": "..." }
]
\`\`\`

只有单一动作时才返回单个对象:

\`\`\`json
{
  "command": "命令名",
  "parameters": { "参数名": "值" },
  "explanation": "解释说明"
}
\`\`\`

如果用户的问题与CSV处理无关,可以用自然语言回答,但优先引导到CSV处理相关话题.

## 其他规则
1. "查询/查找/筛选数据" 使用 search 或 filter,不是 view
2. "查看数据/预览" 才使用 view
3. filter 用于复杂条件表达式,search 用于简单文本匹配
4. 多个步骤时,确保命令顺序正确
5. "以某文本结尾" 用 search -s 列名 -r '文本$'; "以某文本开头" 用 search -s 列名 -r '^文本'
6. 命令参数必须与"本次查询相关命令详细参数"中的定义一致,参数名使用短横线形式(如 select → -s)

## Moonblade表达式语法
filter、map等命令使用Moonblade表达式语言:
- 比较: ==, !=, >, <, >=, <=
- 逻辑: &&, ||, !
- 正则: .matches("pattern")
- 数学: +, -, *, /
- 列引用: 直接使用列名
- 示例: 'age > 30 && name.contains("张")'
- "以某文本结尾" → 列名.ends_with("文本"), 如: 'idx.ends_with("1")'
- "以某文本开头" → 列名.starts_with("文本")

## 输出前自查(最后一步,必须逐条检查)
1. 用户需求是否包含"筛选/查找/包含/开头/结尾/匹配/过滤/等于"等意图? 若是,我的输出里第一步必须是 search 或 filter,绝不能是 count. count 只会统计整个文件,不会筛选.
2. 若用户同时要求"筛选/过滤 + 统计/行数/计数",我的输出必须是两步数组 [search 或 filter, count],缺一不可.
3. 我是否只输出了 count 而没有 search/filter? 若是,立即改为两步数组.`;

}

export async function buildFullPrompt(
  userMessage: string,
  context: AIContext,
): Promise<{ role: "system" | "user"; content: string }[]> {
  const systemPrompt = await buildSystemPrompt(context, userMessage);

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userMessage },
  ];
}

export { loadCommandDoc, getCommandIndex, getRoutingHints };
