<!-- Generated -->
# xan from

```txt
将各种数据格式转换为 CSV.

Usage:
    xan from [options] [<input>]
    xan from --help

Supported formats:
    - ods: OpenOffice spreadsheet
    - xls, xlsb, xlsx: Excel spreadsheet
    - json: JSON array or object
    - ndjson, jsonl: newline-delimited JSON data
    - toml: TOML configuration
    - txt: text lines
    - npy: numpy array
    - tar: tarball archive
    - md, markdown: Markdown table
    - raw: read whole input as a single CSV cell

Optionally supported formats (requires `xan` to be compiled using optional features):
    - parquet: Parquet frame (requires the `parquet` feature)

Some formats can be streamed, some others require the full file to be loaded into
memory. The streamable formats are `ndjson`, `jsonl`, `parquet`, `tar`,`txt` and `npy`.

Some formats will handle gzip decompression on the fly if the filename ends
in `.gz`: `json`, `ndjson`, `jsonl`, `raw`, `tar` and `txt`.

Tarball extraction was designed for utf8-encoded text files. Expect weird or
broken results with other encodings or binary files.

from options:
    -f, --format <format>  要转换的格式.如果未给出,将从文件扩展名推断.从标准输入读取时必须指定,因为我们没有文件扩展名可用.

Excel/OpenOffice-related options:
    --sheet-index <i>    要转换的工作表的基于 0 的索引.默认为转换第一个工作表.或者使用 -s/--sheet 按名称选择工作表.
                         [default: 0]
    --sheet-name <name>  要转换的工作表名称.
    --list-sheets        打印工作表名称而不是转换文件.

JSON/TOML options:
    --sample-size <n>      在发出标题之前要采样的记录数.设置为 -1 以在发出标题之前采样所有记录.这可能会消耗大量内存,
                           但将确保所有可能的键都被观察到,并且在转换时不会丢失数据.
                           [default: 64]
    --sort-keys            按字典顺序排序 JSON 键以相应地发出列.这对于协调没有一致键顺序的不同 JSON 源很有用.
    --key-column <name>    解析 JSON 映射时键列的名称.
                           [default: key]
    --value-column <name>  解析 JSON 映射时值列的名称.
                           [default: value]
    --single-object        如果 JSON 仅表示您想要映射到单个 CSV 行的单个对象,而不是映射到 key,value 列,请使用此选项.
    --root <path>          转换在路径处找到的嵌套对象,而不是根对象.此路径必须使用表达式语言作为 getter 给出.例如 "data"
                           或"_.nodes[0].metadata".
    --model <json>         传递一个虚拟 JSON 对象,用作提取"模型".可以避免采样的需要和/或限制最终输出中提取的路径.

Text lines & raw options:
    -c, --column <name>    要创建的列的名称.使用 -f=txt 时默认为 "line",使用 -f=raw 时默认为 "value".

Markdown options:
    -n, --nth-table <n>    选择文档中的第 n 个表,从 0 开始.负索引可用于从末尾选择.
                           [default: 0]

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
```
