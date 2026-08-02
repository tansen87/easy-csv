import { AIContext } from "./types";
import { xanCommands } from "@/data/commands";

const cmdDocs = import.meta.glob<{
  default: string;
}>("/public/docs/cmd/*.md", { query: "?raw", import: "default", eager: true });

const moonbladeDocs = import.meta.glob<{
  default: string;
}>("/public/docs/moonblade/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const aiUsageDocs = import.meta.glob<{
  default: string;
}>("/public/docs/AI_usage/*.md", {
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

const EXPRESSION_COMMANDS = new Set(["map", "transform"]);

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

  const sections: string[] = [];

  sections.push(`
    你是Easy CSV的AI助手.
    你的职责: 理解用户的自然语言需求,转换为xan命令,以JSON格式返回.需要多步骤时,按正确顺序返回命令数组.`);

  sections.push(`
    ## 核心规则(必须遵守)
    - count 只能统计整个文件行数,没有筛选能力.需求含"筛选/查找/包含/开头/结尾/匹配/过滤"时,即使同时要求"统计/行数/计数",第一步必须是 search,第二步才是 count.严禁只输出 count.
    - 需求含筛选+统计 → 两步编号:
      示例: 用户"筛选idx以1结尾的行并统计行数"
      正确:
      1. {"command":"search","parameters":{"select":"idx","regex":true,"pattern":"1$"},"explanation":"筛选"}
      2. {"command":"count","parameters":{},"explanation":"统计行数"}
      错误: {"command":"count","parameters":{},"explanation":"统计行数"}

    ## 模糊需求处理
    当用户提示词模糊或可能有歧义时,输出格式必须为:
    {"suggestion":"建议的提示词","commands":[编号步骤]}
    - suggestion 字段: 给出更清晰的提示词建议
    - commands 字段: 基于合理理解执行的默认操作

    示例: 用户说"拆分date"
    输出: {"suggestion":"'将date列按-拆分取第2个'","commands":[{"command":"map","parameters":{"expression":"col(\\"date\\").split(\\"-\\")"},"explanation":"按-拆分date列"}]}

    当需求明确时,直接输出编号步骤,不需要 suggestion 字段.

    ## search vs filter 选择规则
    优先使用 search,仅在需要数值比较时才用 filter:

    search 用于所有文本类操作:
    - 等于/不等于 → search + exact 参数(精确匹配)
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
    - -e / exact: 精确匹配标志(不带值,配合 pattern 使用)
    - -r / regex: 正则表达式标志(不带值,配合 pattern 使用)
    - -i / ignore-case: 不区分大小写标志
    - -v / invert-match: 反向匹配标志
    - --empty: 查找空单元格
    - --non-empty: 查找非空单元格
    重要: -r 和 -e 是 flag 类型参数,后面不接值.模式内容始终放在 pattern(-p) 参数中.`);

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
    ${relevantDocs || "(无可检索到的详细文档)"}`);

  sections.push(`
    ## 当前状态
    ${contextParts.length > 0 ? contextParts.join("\n") : "未打开文件"}`);

  sections.push(`
    ## 响应格式
    返回JSON,必须用数字编号区分每个步骤:

    多步骤(必须编号):
    \`\`\`json
    1. {"command":"命令1","parameters":{...},"explanation":"..."}
    2. {"command":"命令2","parameters":{...},"explanation":"..."}
    3. {"command":"命令3","parameters":{...},"explanation":"..."}
    \`\`\`

    单步骤:
    \`\`\`json
    {"command":"命令名","parameters":{...},"explanation":"..."}
    \`\`\`

    模糊需求:
    \`\`\`json
    {"suggestion":"建议的提示词","commands":[编号步骤]}
    \`\`\`

    重要: 多步骤时每个命令前必须有数字编号(1. 2. 3.),编号与命令同行,不要把编号放在单独一行.非CSV问题可自然语言回答,但优先引导到CSV处理.`);

  sections.push(`
    ## 其他规则
    1. "查询/查找/筛选数据" 优先用 search,不是 view
    2. "查看数据/预览" 才用 view
    3. 文本类筛选优先用 search,数值比较才用 filter
    4. 多步骤时确保命令顺序正确
    5. -r(regex)和 -e(exact)是 flag,后面不接值.正则模式放在 -p(pattern) 中
    6. "以某文本结尾" → search -s 列名 -r -p '文本$'; "以某文本开头" → search -s 列名 -r -p '^文本'
    7. "等于/不等于" → search -s 列名 -e -p '值' (-v 反向, -i 不区分大小写)
    8. 参数名用短横线形式(如 select → -s)`);

  if (needsExpressionDoc) {
    sections.push(`
      ## Moonblade表达式语法
      filter、map等命令使用Moonblade表达式:
      - 比较: ==, !=, >, <, >=, <=
      - 逻辑: &&, ||, !
      - 正则: .matches("pattern")
      - 数学: +, -, *, /
      - 列引用: 直接使用列名
      - 示例: 'age > 30 && name.contains("张")'
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
): Promise<{ role: "system" | "user"; content: string }[]> {
  const systemPrompt = await buildSystemPrompt(context, userMessage);

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userMessage },
  ];
}

export { loadCommandDoc, getCommandIndex, getRoutingHints };
