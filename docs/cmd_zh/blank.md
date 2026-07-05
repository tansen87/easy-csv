<!-- Generated -->
# xan blank

```txt
将 CSV 文件的选定列置空.也就是说,此命令将根据列选择编辑任何连续相同的单元格.

这可以作为演示技巧或压缩方案使用.

"blank" 术语来自 OpenRefine,功能相同.

Usage:
    xan blank [options] [<input>]
    xan blank --help

blank options:
    -s, --select <cols>    选择要置空的列.
    -r, --redact <value>   使用提供的替换字符串编辑置空的值.默认为空字符串.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,文件将被视为没有表头.
    -d, --delimiter <arg>  读取CSV数据时的字段分隔符.必须是单个字符.
```
