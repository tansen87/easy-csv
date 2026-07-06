<!-- Generated -->
# xan behead

```txt
删除 CSV 文件的标题行.

请注意,为了尽可能提高性能,此命令不会尝试智能处理,只解析第一行 CSV 行并将其删除.
文件的其余部分将按原样刷新到输出,不进行任何规范化.

Usage:
    xan behead [options] [<input>]
    xan guillotine [options] [<input>]

behead options:
    -A, --append  仅在输出已存在且非空时才删除标题行.需要设置 -o/--output.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -d, --delimiter <arg>  读取CSV数据时的字段分隔符,必须是单个字符.
```
