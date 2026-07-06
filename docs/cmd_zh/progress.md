<!-- Generated -->
# xan progress

```txt
在读取 CSV 文件的行时显示进度条.

该命令将尝试缓冲一些已读取的文件以自动查找总行数.如果您事先知道总数,也可以使用 --total 标志.

Usage:
    xan progress [options] [<input>]
    xan progress --help

progress options:
    -S, --smooth         每次写入一行时刷新输出缓冲区.这使得进度条更平滑,但可能性能较差.
    -B, --bytes          显示文件字节的进度,而不是解析 CSV 行.
    --prebuffer <n>      要预缓冲的文件兆字节数,以尝试自动知道进度条总数.[default: 64]
    --title <string>     加载条的标题.
    --total <n>          给定 CSV 文件的总行数.

Common options:
    -h, --help             显示帮助
    -n, --no-headers       设置后,第一行将包含在进度条总数中.
    -o, --output <file>    将输出写入<file>而非stdout.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符.
```
