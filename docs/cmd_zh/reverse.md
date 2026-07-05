<!-- Generated -->
# xan reverse

```txt
反转 CSV 数据的行.

如果目标是可搜索的(例如磁盘上的未压缩文件),此命令能够在摊销线性时间和常量内存下工作.
如果目标不可搜索,此命令需要将整个文件缓冲到内存中才能反转它.

如果您只需要检索大文件的最后几行,请参阅 `xan tail` 或 `xan slice -L`.

Usage:
    xan reverse [options] [<input>]

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会被视为表头.也就是说,它将与其余行一起反转.
                           否则,第一行将始终作为标题行出现在输出中.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符.
```
