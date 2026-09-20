import { XanCommand } from "@/types/xan";

/** Generate CSV files (design 019 §4.5). */
export const generateCommands: XanCommand[] = [
  {
    id: "range",
    name: "range",
    description: "Create a CSV file from a numerical range",
    descriptionCn: "从数值范围创建 CSV 文件",
    category: "Generate CSV files",
    parameters: [
      {
        name: "end",
        type: "number",
        description: "End of the range",
        descriptionCn: "范围的结束",
        required: true,
        isPositional: true,
      },
      {
        name: "start",
        type: "number",
        description: "Start of the range",
        descriptionCn: "范围的开始",
        required: false,
        default: 0,
      },
      {
        name: "step",
        type: "number",
        description: "Step of the range",
        descriptionCn: "范围的步长",
        required: false,
        default: 1,
      },
      {
        name: "column-name",
        type: "string",
        description: "Name of the column containing the range",
        descriptionCn: "包含范围的列的名称",
        required: false,
        default: "n",
      },
      {
        name: "inclusive",
        type: "flag",
        description: "Include the end bound",
        descriptionCn: "包含结束边界",
        required: false,
        default: false,
      },
    ],
  },
];
