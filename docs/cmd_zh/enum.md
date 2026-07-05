<!-- Generated -->
# xan enum

```txt
通过在每行前添加索引列来枚举 CSV 文件.

或者,使用 -B, --byte-offset 标志添加字节偏移列.

Usage:
    xan enum [options] [<input>]
    xan enum --help

enum options:
    -c, --column-name <arg>  要添加的列名.默认为 "index",当给出 -B, --byte-offset 时为 "byte_offset".
    -S, --start <arg>        开始计数的数字.[default: 0].
    -B, --byte-offset        是否指示行在文件中的字节偏移量.可用于稍后使用 `xan slice --byte-offset` 执行常量时间切片.
    -A, --accumulate         类似于 -B/--byte-offset,但将累计写入的偏移量大小(以字节为单位),
                             以创建一个自描述文件,可被视为索引文件的一种方式.

Common options:
    -h, --help             显示帮助
    -n, --no-headers       设置后,第一行将不会被视为表头.
    -o, --output <file>    将输出写入 <file> 而非stdout.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
