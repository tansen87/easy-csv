import { XanCommand } from "@/types/xan";

/** Plugins (design 019 §4.5). */
export const pluginsCommands: XanCommand[] = [
{
    id: "pinyin",
    name: "pinyin",
    description: "Convert Chinese characters in columns to pinyin",
    descriptionCn: "将中文列转换为拼音",
    category: "Plugins",
    plugin: true,
    parameters: [
      {
        name: "columns",
        type: "string",
        description:
          "Columns to convert, as names or 0-based indices (comma-separated)",
        descriptionCn: "要转换的列(列名或 0 起点索引,逗号分隔)",
        required: true,
      },
      {
        name: "style",
        type: "select",
        description:
          "Pinyin style: plain (capitalized initial per Chinese character), upper or lower",
        descriptionCn: "拼音风格:plain(每字拼音首字母大写)/ upper / lower",
        required: false,
        options: ["plain", "upper", "lower"],
        default: "upper",
      },
      {
        name: "suffix",
        type: "string",
        description:
          "Append new columns named <col><SUFFIX> instead of replacing in place",
        descriptionCn: "保留原列,追加 <列名><后缀> 的新列;不填则原位替换",
        required: false,
      },
    ],
  },
{
    id: "duckdb",
    name: "duckdb",
    description: "Run a DuckDB SQL query",
    descriptionCn: "用 DuckDB 执行 SQL 查询",
    category: "Plugins",
    plugin: true,
    parameters: [
      {
        name: "sql",
        type: "string",
        description: "SQL query",
        descriptionCn: "SQL 查询语句",
        required: true,
      },
    ],
  },
];
