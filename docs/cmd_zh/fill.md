<!-- Generated -->
# xan fill

```txt
通过使用之前看到的任何非空值(通常称为前向填充)或使用 -v, --value 标志给出的任何常量值来填充 CSV 文件的空单元格.

例如,将文件中所有空值替换为 0:

    $ xan fill -v 0 data.csv > filled.csv

Usage:
    xan fill [options] [<input>]
    xan fill --help

fill options:
    -s, --select <cols>  选择要填充的列.
    -v, --value <value>  使用提供的值填充空单元格,而不是使用最后一个非空值.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,文件将被视为没有标题行.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
