import { XanCommand } from "@/types/xan";

/** Scripting (design 019 §4.5). */
export const scriptingCommands: XanCommand[] = [
{
    id: "run",
    name: "run",
    description: "Run a xan pipeline or script",
    descriptionCn: "运行 xan 工作流或脚本",
    category: "Scripting",
    parameters: [
      {
        name: "pipeline",
        type: "string",
        description: "Pipeline to run",
        descriptionCn: "要运行的工作流",
        required: true,
        isPositional: true,
      },
      {
        name: "file",
        type: "string",
        description: "Run pipeline from a script file instead",
        descriptionCn: "改为从脚本文件运行工作流",
        required: false,
      },
      {
        name: "tee",
        type: "flag",
        description:
          "Interleave a call to `xan view -T` between each step of given pipeline",
        descriptionCn: "在给定工作流的每一步之间交错调用`xan view -T`",
        required: false,
        default: false,
      },
    ],
  },
{
    id: "eval",
    name: "eval",
    description: "Evaluate/debug a single expression",
    descriptionCn: "评估/调试单个表达式",
    category: "Scripting",
    parameters: [
      {
        name: "expr",
        type: "string",
        description: "Expression to evaluate",
        descriptionCn: "要评估的表达式",
        required: true,
        isPositional: true,
      },
      {
        name: "explain",
        type: "flag",
        description: "Print concrete expression plan",
        descriptionCn: "打印具体表达式计划",
        required: false,
        default: false,
      },
      {
        name: "headers",
        type: "string",
        description: "Pretend headers, separated by commas, to consider",
        descriptionCn: "假装要考虑的表头,用逗号分隔",
        required: false,
      },
      {
        name: "row",
        type: "string",
        description: "Pretend row with comma-separated cells",
        descriptionCn: "假装带有逗号分隔单元格的行",
        required: false,
      },
    ],
  },
];
