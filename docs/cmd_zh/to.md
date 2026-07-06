<!-- Generated -->
# xan to

```txt
将 CSV 文件转换为各种数据格式.

Usage:
    xan to <format> [options] [<input>]
    xan to --help

Supported formats:
    html    - HTML table
    json    - JSON array or object
    jsonl   - JSON lines (same as `ndjson`)
    latex   - LaTeX table
    md      - Markdown table
    ndjson  - Newline-delimited JSON (same as `jsonl`)
    npy     - Numpy array
    txt     - Text lines
    xlsx    - Excel spreadsheet

Some formats can be streamed, some others require the full CSV file to be loaded into
memory.

Streamable formats are `html`, `jsonl`, `ndjson`, `npy` and `txt`.

JSON options:
    --sample-size <size>  用于推断列类型的 CSV 采样行数.
                          设置为 -1 以采样整个 CSV 输入.
                          [默认值:512]
    --nulls               将空字符串转换为 null 值
    --omit                忽略空值
    --strings <columns>   强制将选定列视为原始字符串,而非整数、浮点数等

NPY options:
    --dtype <type>       npy 转换使用的数值类型,必须是 "f32" 或 "f64".[默认值:f64]
    -s, --select <cols>  要输出的文件数值列

TXT options:
    -s, --select <col>  要以文本形式输出的文件列.如果要转换为文本的文件包含多列
                        或选择结果产生多于一列,将会报错

Markdown options:
    -l, --limit <n>  最大输出行数.如果在限制内未到达表格末尾,
                     将在末尾写入包含省略号字符的虚拟行

LateX options:
    --caption <caption>  latex 中设置的标题可选名称,未指定时为空

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout
    -n, --no-headers       设置后,第一行将不会被视为表头
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符
```
