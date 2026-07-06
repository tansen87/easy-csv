<!-- Generated -->
# xan tail

```txt
返回 CSV 文件的最后几行.

`xan slice -L/--last <n>` 的别名.

Usage:
    xan tail [options] [<input>]

head options:
    -l, --limit <n>  要返回的行数.[默认值:10]

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout
    -n, --no-headers       设置后,第一行将不会被视为表头
                           否则,第一行将始终作为标题行显示在输出中
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符
```
