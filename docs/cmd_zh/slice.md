<!-- Generated -->
# xan slice

```txt
返回 CSV 文件中指定范围内的行.可以通过 0 基行索引、文件中的字节偏移以及使用自定义表达式作为起始和停止条件来指定此范围.

切片文件的前 10 行:

    $ xan slice -l 10 file.csv

切片索引 5 到 10 之间的行:

    $ xan slice -s 5 -e 10 file.csv

检索某些索引处的行:

    $ xan slice -I 4,5,19,65 file.csv

检索最后 5 行:

    $ xan slice -L 5 file.csv

从文件中的某个字节偏移处开始切片行:

    $ xan slice -B 56356 file.csv

切片行直到 "count" 列超过 `45` 的行:

    $ xan slice -E 'count > 45' file.csv

该命令当然会在找到指定的行范围后立即终止,如果不需要,不会读取整个文件或流.

当然,与字节偏移相关的标志仅适用于可搜索的输入,例如磁盘上的文件,但不适用于 stdin 或 gzipped 文件.

请注意,混合使用与行索引、字节偏移和条件相关的标志是完全可以的.在这种情况下,以下是操作顺序的描述:

- 首先,如果给出了 -B/--byte-offset,命令将在目标文件中搜索,如果给出了 --end-byte,则不会读取超过某个字节偏移.
- 然后应用 -S/--start-condition 和 -E/--end-condition.
- 最后,与行索引相关的标志将适用.请注意,索引因此相对于字节偏移和起始条件的应用,而不是文件中的第一个实际行.

因此,例如,如果您想在文件中切片 5 行,但仅在 "count" 列超过 `10` 的行之后,您可以执行以下操作:

    $ xan slice -S 'count > 10' -l 5 file.csv

Usage:
    xan slice [options] [<input>]

slice options to use with row indices:
    -s, --start <n>    要切片的起始行索引.
    --skip <n>         与 -s, --start 相同.
    -e, --end <n>      要切片的结束行索引.
    -l, --len <n>      切片的长度(可替代 --end 使用).
    -i, --index <i>    切片单行(-s N -l 1 的快捷方式).
    -I, --indices <i>  返回包含多个索引的切片.必须提供以逗号分隔的索引,
                       例如 "1,4,67,89".请注意,选定的行将按文件顺序输出,
                       而非给定顺序.
    -L, --last <n>     返回文件的最后 <n> 行.与其他标志不兼容.如果文件可搜索,
                       则以 O(n) 时间和内存运行.否则以 O(N) 时间(N 为文件总行数)
                       和 O(n) 内存运行.

slice options to use with expressions:
    -S, --start-condition <expr>  在给定表达式返回 true 之前不开始输出行.
    -E, --end-condition <expr>    在给定表达式返回 false 时立即停止输出行.

slice options to use with byte offets:
    -B, --byte-offset <b>  在切片文件中搜索的字节偏移量.可用于以常量时间访问特定行切片,
                           无需读取前面的字节.必须提供以 CSV 行开头的字节偏移量,
                           否则输出可能损坏.要求输入可搜索(不支持 stdin 或 gzipped 文件).
    --end-byte <b>         仅读取到提供的字节位置(不含).要求输入可搜索
                           (不支持 stdin 或 gzipped 文件).
    --raw                  原始切片,跳过 CSV 数据解析以提高性能.仅在您知道自己在做什么时使用.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会被视为表头.否则,第一行将始终作为标题行出现在输出中.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
