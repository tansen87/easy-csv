<!-- Generated -->
# batch-from

```txt
批量转换: 选择多个源文件或文件夹及输入格式.

此命令将多种格式(Excel、JSON等)的多个文件批量转换为CSV.它与batch-to配合使用,定义完整的转换管道.

batch-from options:
    --source-path <path>       源文件夹或文件路径(必填).
                               多个路径可以用分号分隔.
    --format <format>          输入格式.可选: csv, ods, xls, xlsb, xlsx,
                               json, jsonl, ndjson, txt, npy, tar, md, markdown.
                               如果未指定,将根据文件扩展名自动推断.
    --pattern <pattern>        文件模式过滤(例如 "*.xlsx"). [default: *]
    --recursive                递归搜索子目录.

Excel/OpenOffice 选项:
    --sheet-index <i>          要转换的工作表的0基索引.
    --sheet-name <name>        要转换的工作表名称.

JSON 选项:
    --sample-size <n>          在输出表头前采样的记录数.
    --sort-keys                按字典序排序JSON键.
    --key-column <name>        解析JSON映射时键列的名称.
    --value-column <name>      解析JSON映射时值列的名称.
    --single-object            将单个JSON对象映射为单行CSV.

Text/Raw 选项:
    --column <name>            要创建的列的名称.

Markdown 选项:
    --nth-table <n>            选择文档中的第n个表格.

注意: 此命令必须与batch-to配对使用以完成转换.
```
