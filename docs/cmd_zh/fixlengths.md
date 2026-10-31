<!-- Generated -->
# xan fixlengths

```txt
转换 CSV 数据,使所有行具有相同的列数.默认情况下,列数将推断为输入数据中
任意行出现过的最大列数.为使其生效,所有数据必须缓冲到内存中.

或者,你也可以使用 -l/--length 标志强制指定列数(较长的行会被截断,较短的行
会用空列补齐).

你也可以使用 -H/--trust-header 信任文件的第一行具有正确的列数.

使用 -l/--length 或 -H/--trust-header 时,数据将以流式处理,无需缓冲到内存中.

用法:
    xan fixlengths [options] [<input>]

fixlengths 选项:
    -l, --length <arg>     强制设置每条记录的长度.如果记录长度与该值不符,
                           将按需截断或补齐.
    -H, --trust-header     信任第一行指示文件的正确列数.

通用选项:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -d, --delimiter <arg>  读取CSV数据时的字段分隔符,必须是单个字符.
```
