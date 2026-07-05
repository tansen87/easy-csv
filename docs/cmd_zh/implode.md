<!-- Generated -->
# xan implode

```txt
通过将多个连续行合并为一行来内爆 CSV 文件,其中不同的单元格将由管道字符 ("|") 或 --sep 标志给出的任何分隔符连接.

此命令在概念上是 "explode" 命令的反向操作.

例如,以下 CSV:

*file.csv*
name,color
John,blue
John,yellow
Mary,red

可以在 "color" 列上进行内爆:

    $ xan implode color --pluralize file.csv > imploded.csv

生成以下文件:

*imploded.csv*
name,color
John,blue|yellow
Mary,red

Usage:
    xan implode [options] <columns> [<input>]
    xan implode --help

implode options:
    --sep <sep>          用于连接不同单元格的分隔符.
                         [默认: |]
    -P, --pluralize      使内爆的列名复数化(仅支持非常简单的以英语为中心的情况).不适用于 -r, --rename.
    -r, --rename <name>  不同列的新名称.不适用于 -P, --pluralize.
    --cmp <column>       限制要比较的列,以断定连续行是否必须合并.请注意,这将忽略给定选择中的所有其他列,
                         因此仅将其用作优化技巧(因为您有包含唯一 id 的列和/或可以保证所有其他单元格将相同).

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout
    -n, --no-headers       设置后,第一行将不会被视为表头
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符
```
