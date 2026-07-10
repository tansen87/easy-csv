<!-- Generated -->
# batch-to

```txt
批量转换: 选择输出格式和输出目录.

此命令定义批量转换的输出格式和目标位置.它与batch-from配合使用,定义完整的转换管道.

batch-to options:
    <format>                   输出格式(必填).可选: csv, html, json,
                               jsonl, md, ndjson, npy, txt, xlsx.
                               [default: xlsx]
    --output-dir <dir>         输出目录.默认与源文件相同目录.
    --sample-size <n>          用于推断列类型的采样行数(JSON).
                               [default: 512]
    --nulls                    将空字符串转换为null值(JSON).
    --omit                     忽略空值(JSON).
    --strings <columns>        强制指定列为原始字符串(JSON).
    --dtype <type>             npy转换的数字类型: f32 或 f64.
    --select <columns>         作为文本输出的列(txt)或NPY的数值列.
    --limit <n>                最大输出行数(Markdown).

注意: 此命令必须与batch-from配对使用以完成转换.
```
