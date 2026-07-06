<!-- Generated -->
# xan explode

```txt
通过使用管道字符 ("|") 或 --sep 标志给出的任何分隔符拆分选定单元格,将 CSV 行拆分为多行.

此命令在概念上是 "implode" 命令的反向操作.

例如,以下 CSV:

*file.csv*
name,colors
John,blue|yellow
Mary,red

可以在 "colors" 列上进行拆分:

    $ xan explode colors --singular file.csv > exploded.csv

生成以下文件:

*exploded.csv*
name,color
John,blue
John,yellow
Mary,red

请注意,可以在多个对齐良好的列上拆分文件,这些列将被拆分为相同数量的值.否则您可以随时使用 --pad 标志.

或者,如果您需要使用自定义逻辑(例如解析 JSON 等)拆分单元格,可以使用 -e <expr> 标志使用表达式.

    $ xan explode json_names -e '_.parse_json().compact()' file.csv

Usage:
    xan explode [options] <columns> [<input>]
    xan explode --help

explode options:
    --sep <sep>            用于拆分单元格的分隔符.
                           [default: |]
    -e, --evaluate <expr>  评估表达式以拆分单元格,而不是使用简单分隔符.
    -f, --evaluate-file <path>  从文件中读取拆分表达式.
    -S, --singularize      将拆分的列名单数化(仅支持非常简单的英语用例).不能与 -r, --rename 一起使用.
    -r, --rename <name>    拆分列的新名称.如果拆分多列,必须以 CSV 格式编写.有关更多详细信息,
                           请参阅 'xan rename' 帮助.不能与 -S, --singular 一起使用.
    -k, --keep             在每次拆分时保留拆分的列.
    -D, --drop-empty       当选定单元格为空时删除行.
    --pad                  同时拆分多列时,填充较短的拆分以使其与最长的对齐,而不是报错.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入 <file> 而非stdout.
    -n, --no-headers       设置后,第一行将不会被设置为表头.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
