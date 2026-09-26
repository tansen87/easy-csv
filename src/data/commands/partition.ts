import { XanCommand } from "@/types/xan";

/** Split a CSV file into multiple (design 019 §4.5). */
export const partitionCommands: XanCommand[] = [
{
    id: "split",
    name: "split",
    description: "Split CSV data into chunks",
    descriptionCn: "将 CSV 数据分割为多个块",
    category: "Split a CSV file into multiple",
    parameters: [
      {
        name: "out-dir",
        type: "string",
        description:
          "Where to write the chunks. Defaults to current working directory",
        descriptionCn: "写入分块的目录,默认为当前工作目录",
        required: false,
      },
      {
        name: "size",
        type: "number",
        description: "The number of records to write into each chunk",
        descriptionCn: "每个分块中要写入的行数",
        required: false,
        default: 1000000,
      },
      {
        name: "chunks",
        type: "number",
        description:
          "Divide the file into at most <n> chunks having roughly the same number of records",
        descriptionCn:
          "将文件分割为最多 <n> 个分块,每个分块包含大致相同数量的行数",
        required: false,
      },
      {
        name: "segments",
        type: "flag",
        description:
          "When used with -c/--chunks, output the byte offsets of found segments instead",
        descriptionCn: "与 -c/--chunks 一起使用时,输出找到的分段的字节偏移量",
        required: false,
        default: false,
      },
      {
        name: "filename",
        type: "string",
        description:
          "A filename template to use when constructing the names of the output files",
        descriptionCn: "用于构造输出文件名的模板",
        required: false,
        default: "output_{}.csv",
      },
    ],
  },
{
    id: "partition",
    name: "partition",
    description: "Partition CSV data based on a column value",
    descriptionCn: "根据列值分割 CSV 数据",
    category: "Split a CSV file into multiple",
    parameters: [
      {
        name: "column",
        type: "string",
        description: "Column to partition by",
        descriptionCn: "用于分区的列",
        required: true,
        isPositional: true,
      },
      {
        name: "out-dir",
        type: "string",
        description: "Where to write the chunks",
        descriptionCn: "写入分块的目录",
        required: false,
      },
      {
        name: "filename",
        type: "string",
        description:
          "A filename template to use when constructing the names of the output files",
        descriptionCn: "用于构造输出文件名的模板",
        required: false,
        default: "output_{}.csv",
      },
      {
        name: "prefix-length",
        type: "number",
        description:
          "Truncate the partition column after the specified number of bytes when creating the output file",
        descriptionCn: "创建输出文件时,将分区列截断为指定的字节数",
        required: false,
      },
      {
        name: "sorted",
        type: "flag",
        description:
          "Use this flag if you know the file is sorted on the partition column in advance",
        descriptionCn: "如果文件已按分区列排序,请使用此标志",
        required: false,
        default: false,
      },
      {
        name: "drop",
        type: "flag",
        description: "Drop the partition column from results",
        descriptionCn: "从结果中删除分区列",
        required: false,
        default: false,
      },
      {
        name: "case-sensitive",
        type: "flag",
        description:
          "Don't perform case normalization to assess whether a new file has to be created when seeing a new value",
        descriptionCn: "不执行大小写规范化来判断是否需要创建新文件",
        required: false,
        default: false,
      },
    ],
  },
];
