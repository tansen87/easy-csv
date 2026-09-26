import { XanCommand } from "@/types/xan";

/** Transpose & pivot (design 019 §4.5). */
export const transposePivotCommands: XanCommand[] = [
  {
    id: "transpose",
    name: "transpose",
    description: "Transpose CSV file",
    descriptionCn: "转置 CSV 文件",
    category: "Transpose & pivot",
    parameters: [],
  },
  {
    id: "pivot",
    name: "pivot",
    description: "Split distinct values into their own columns",
    descriptionCn: "将不同值拆分为各自的列",
    category: "Transpose & pivot",
    parameters: [
      {
        name: "columns",
        type: "string",
        description: "Columns to pivot",
        descriptionCn: "要透视的列",
        required: false,
        isPositional: true,
      },
      {
        name: "expr",
        type: "string",
        description: "Aggregation expression",
        descriptionCn: "聚合表达式",
        required: false,
        isPositional: true,
      },
      {
        name: "groupby",
        type: "string",
        description: "Group results by given selection of columns",
        descriptionCn: "按给定的列选择对结果进行分组",
        required: false,
      },
      {
        name: "column-sep",
        type: "string",
        description:
          "Separator used to join column names when pivoting on multiple columns",
        descriptionCn: "在多列上透视时用于连接列名的分隔符",
        required: false,
        default: "_",
      },
    ],
  },
  {
    id: "unpivot",
    name: "unpivot",
    description: "Stack multiple columns into fewer columns",
    descriptionCn: "将多列堆叠为更少的列",
    category: "Transpose & pivot",
    parameters: [
      {
        name: "columns",
        type: "string",
        description: "Columns to unpivot",
        descriptionCn: "要逆透视的列",
        required: true,
        isPositional: true,
      },
      {
        name: "name-column",
        type: "string",
        description:
          "Name for the column that will contain unpivoted column names",
        descriptionCn: "将包含逆透视列名的列的名称",
        required: false,
      },
      {
        name: "value-column",
        type: "string",
        description:
          "Name for the column that will contain unpivoted column values",
        descriptionCn: "将包含逆透视列值的列的名称",
        required: false,
      },
    ],
  },
];
