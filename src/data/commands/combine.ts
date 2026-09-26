import { XanCommand } from "@/types/xan";

/** Combine multiple CSV files (design 019 §4.5). */
export const combineCommands: XanCommand[] = [
  {
    id: "cat",
    name: "cat",
    description: "Concatenate by row or column",
    descriptionCn: "按行或列拼接",
    category: "Combine multiple CSV files",
    parameters: [
      {
        name: "mode",
        type: "select",
        description: "Concatenation mode",
        descriptionCn: "拼接模式",
        required: true,
        options: ["rows", "columns"],
        default: "rows",
        isPositional: true,
      },
      {
        name: "inputs",
        type: "string",
        description: "Input CSV file(s) to concatenate",
        descriptionCn: "要拼接的输入CSV文件",
        required: false,
        isPositional: true,
      },
      {
        name: "pad",
        type: "flag",
        description:
          "When concatenating columns, this flag will cause all records to appear. It will pad each row if other CSV data isn't long enough.",
        descriptionCn:
          "拼接列时,此标志将使所有记录出现.如果其他CSV数据不够长,将填充每行",
        required: false,
        default: false,
      },
      {
        name: "intersection",
        type: "flag",
        description:
          "Compute the intersection of headers of all concatenated files and reorder columns accordingly. Incompatible with --union, preprocessing and --no-headers.",
        descriptionCn:
          "计算所有拼接文件头的交集并相应地重新排列列.与--union、preprocessing和--no-headers不兼容",
        required: false,
        default: false,
      },
      {
        name: "union",
        type: "flag",
        description:
          "Compute the union of headers of all concatenated files and reorder columns accordingly. Incompatible with --intersection, preprocessing and --no-headers.",
        descriptionCn:
          "计算所有拼接文件头的并集并相应地重新排列列.与--intersection、preprocessing和--no-headers不兼容",
        required: false,
        default: false,
      },
      {
        name: "paths",
        type: "string",
        description:
          'When concatenating rows, give a text file (use "-" for stdin) containing one path of CSV file to concatenate per line',
        descriptionCn:
          '拼接行时,提供一个文本文件(使用"-"表示stdin),每行包含一个要拼接的CSV文件路径',
        required: false,
      },
      {
        name: "path-column",
        type: "string",
        description:
          "When given a column name, --paths will be considered as CSV, and paths to CSV files to concatenate will be extracted from the selected column",
        descriptionCn:
          "给定列名时,--paths将被视为CSV,要拼接的CSV文件路径将从选定的列中提取",
        required: false,
      },
      {
        name: "glob",
        type: "string",
        description: "Use given glob pattern to collect files to concatenate",
        descriptionCn: "使用给定的glob模式收集要拼接的文件",
        required: false,
      },
      {
        name: "source-column",
        type: "string",
        description:
          "Name of a column to prepend in the output of 'cat rows' indicating the path to source file",
        descriptionCn: "在'cat rows'输出中添加的列名,指示源文件路径",
        required: false,
      },
      {
        name: "preprocess",
        type: "string",
        description:
          "Preprocessing using only xan subcommands. See xan parallel -h for more information about preprocessing.",
        descriptionCn:
          "仅使用xan子命令进行预处理.有关预处理的更多信息,请参阅xan parallel -h",
        required: false,
      },
      {
        name: "run",
        type: "string",
        description:
          "Run xan script at given path as preprocessing. See xan run -h for more information.",
        descriptionCn:
          "运行给定路径的xan脚本作为预处理.有关更多信息,请参阅xan run -h",
        required: false,
      },
      {
        name: "shell-preprocess",
        type: "string",
        description:
          "Preprocessing commands that will run directly in your own shell using the -c flag. See xan parallel -h for more information about preprocessing.",
        descriptionCn:
          "将直接在您的shell中使用-c标志运行的预处理命令.有关预处理的更多信息,请参阅xan parallel -h",
        required: false,
      },
      {
        name: "raw",
        type: "flag",
        description:
          "Concatenate files as fast as possible, while skipping subsequent files' headers. Will not normalize the CSV stream at all while doing so, nor verify columns alignment. Only use for performance, and if you know what you are doing.",
        descriptionCn:
          "尽可能快地拼接文件,同时跳过后续文件的头.这样做时不会规范化CSV流,也不会验证列对齐.仅用于性能,且如果您知道自己在做什么",
        required: false,
        default: false,
      },
    ],
  },
  {
    id: "join",
    name: "join",
    description: "Join CSV files",
    descriptionCn: "连接 CSV 文件",
    category: "Combine multiple CSV files",
    parameters: [
      {
        name: "columns",
        type: "string",
        description:
          "Columns to join on (for single column set) or left columns (for two column sets)",
        descriptionCn: "连接的列(单列集)或左列(双列集)",
        required: false,
        isPositional: true,
      },
      {
        name: "input1",
        type: "string",
        description: "First input file path",
        descriptionCn: "第一个输入文件路径",
        required: true,
        isPositional: true,
      },
      {
        name: "columns2",
        type: "string",
        description:
          "Right columns to join on (if different from left columns)",
        descriptionCn: "右列用于连接(如果与左列不同)",
        required: false,
        isPositional: true,
      },
      {
        name: "input2",
        type: "string",
        description: "Second input file path",
        descriptionCn: "第二个输入文件路径",
        required: true,
        isPositional: true,
      },
      {
        name: "join-type",
        type: "select",
        description: "Join type",
        descriptionCn: "连接类型",
        required: false,
        default: "inner",
        options: [
          "inner",
          "left",
          "right",
          "full",
          "semi",
          "anti",
          "cross",
          "fuzzy",
        ],
      },
      {
        name: "contains",
        type: "flag",
        description: "Join by matching substrings (fuzzy join)",
        descriptionCn: "通过匹配子字符串连接(模糊连接)",
        required: false,
        default: false,
      },
      {
        name: "regex",
        type: "flag",
        description: "Join by regex patterns (fuzzy join)",
        descriptionCn: "通过正则表达式模式连接(模糊连接)",
        required: false,
        default: false,
      },
      {
        name: "url-prefix",
        type: "flag",
        description: "Join by url prefix (fuzzy join)",
        descriptionCn: "通过URL前缀连接(模糊连接)",
        required: false,
        default: false,
      },
      {
        name: "ignore-case",
        type: "flag",
        description: "When set, joins are done case insensitively",
        descriptionCn: "设置时,连接不区分大小写",
        required: false,
        default: false,
      },
      {
        name: "nulls",
        type: "flag",
        description: "When set, joins will work on empty fields",
        descriptionCn: "设置时,连接将适用于空字段",
        required: false,
        default: false,
      },
      {
        name: "drop-key",
        type: "select",
        description:
          "Indicate whether to drop columns representing the join key",
        descriptionCn: "指示是否删除表示连接键的列",
        required: false,
        options: ["left", "right", "none", "both"],
      },
      {
        name: "prefix-left",
        type: "string",
        description:
          "Add a prefix to the names of the columns in the first dataset",
        descriptionCn: "为第一个数据集中的列名添加前缀",
        required: false,
      },
      {
        name: "prefix-right",
        type: "string",
        description:
          "Add a prefix to the names of the columns in the second dataset",
        descriptionCn: "为第二个数据集中的列名添加前缀",
        required: false,
      },
      {
        name: "sorted",
        type: "flag",
        description:
          "Use this flag to indicate both inputs are sorted to speed up computation",
        descriptionCn: "使用此标志指示两个输入都已排序以加速计算",
        required: false,
        default: false,
      },
      {
        name: "reverse",
        type: "flag",
        description:
          "Reverse sort order for sorted inputs, i.e. descending order",
        descriptionCn: "反转已排序输入的排序顺序,即降序",
        required: false,
        default: false,
      },
      {
        name: "numeric",
        type: "flag",
        description:
          "Compare keys according to their numerical values instead of the default lexicographic order",
        descriptionCn: "根据键的数值而不是默认的字典顺序进行比较",
        required: false,
        default: false,
      },
      {
        name: "simplified-urls",
        type: "flag",
        description:
          "When using --url-prefix, drop irrelevant parts of the urls to facilitate matches",
        descriptionCn: "使用--url-prefix时,删除URL的不相关部分以方便匹配",
        required: false,
        default: false,
      },
      {
        name: "parallel",
        type: "flag",
        description: "Use parallelization acceleration",
        descriptionCn: "使用并行化加速",
        required: false,
        default: false,
      },
      {
        name: "threads",
        type: "number",
        description: "Number of threads used",
        descriptionCn: "使用的线程数",
        required: false,
      },
    ],
  },
  {
    id: "merge",
    name: "merge",
    description: "Merge and sort CSV files",
    descriptionCn: "合并并排序 CSV 文件",
    category: "Combine multiple CSV files",
    parameters: [
      {
        name: "inputs",
        type: "string",
        description: "Input files to merge",
        descriptionCn: "要合并的输入文件",
        required: false,
        isPositional: true,
      },
      {
        name: "select",
        type: "string",
        description: "Select a subset of columns to sort",
        descriptionCn: "选择要排序的列子集",
        required: false,
      },
      {
        name: "numeric",
        type: "flag",
        description: "Compare according to string numerical value",
        descriptionCn: "根据字符串数值进行比较",
        required: false,
        default: false,
      },
      {
        name: "reverse",
        type: "flag",
        description: "Reverse order",
        descriptionCn: "反转顺序",
        required: false,
        default: false,
      },
      {
        name: "uniq",
        type: "flag",
        description:
          "When set, identical consecutive lines will be dropped to keep only one line per sorted value",
        descriptionCn: "设置时,将删除相同的连续行,仅保留每个排序值的一行",
        required: false,
        default: false,
      },
      {
        name: "source-column",
        type: "string",
        description:
          "Name of a column to prepend in the output of the command indicating the path to source file",
        descriptionCn: "在命令输出中添加的列名,指示源文件路径",
        required: false,
      },
      {
        name: "paths",
        type: "string",
        description:
          "Give a text file containing one path of CSV file to concatenate per line",
        descriptionCn: "提供一个文本文件,每行包含一个要拼接的CSV文件路径",
        required: false,
      },
      {
        name: "path-column",
        type: "string",
        description:
          "When given a column name, --paths will be considered as CSV, and paths to CSV files to merge will be extracted from the selected column",
        descriptionCn:
          "给定列名时,--paths将被视为CSV,要合并的CSV文件路径将从选定的列中提取",
        required: false,
      },
    ],
  },
];
