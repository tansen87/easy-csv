<!-- Generated -->
# xan complete

```txt
通过为给定列的缺失值添加行来补全 CSV 数据.

此命令能够处理整数或部分日期(年-月-日、年-月或仅年份).

可以使用 --min 和/或 --max 标志指定要补全的范围.请注意,如果输入包含超出指定范围的值,它们将从输出中过滤掉.

如果您知道输入已经按要补全的列排序,可以使用 -S/--sorted 标志使命令运行更快并使用更少的内存.

此命令还能够使用 --check 标志检查给定列是否完整.

示例:

补全名为 "score" 的整数列,范围从 1 到 10:
    $ xan complete -m 1 -M 10 score input.csv

补全名为 "date" 的列中已排序的日期值:
    $ xan complete -D --sorted date input.csv

检查 "score" 列中值的完整性(已按降序排序):
    $ xan complete --check --sorted --reverse score input.csv

补全按 "name" 和 "category" 列定义的分组中的整数列 "score":
    $ xan complete --groupby name,category score input.csv

Usage:
    xan complete [options] <column> [<input>]
    xan complete --help

complete options:
    --check                  检查输入是否完整.与 --min 或 --max 一起使用时,仅检查指定范围内的完整性.
    -m, --min <value>        要补全的范围的最小值.请注意,输入中低于此最小值的值将被过滤掉.
    -M, --max <value>        要补全的范围的最大值.请注意,输入中大于此最大值的值将被过滤掉.
    -D, --dates              设置以指示您的值是日期(支持年、年-月或年-月-日).
    -S, --sorted             指示输入已经排序.
    -R, --reverse            是否反向考虑数据.
    -g, --groupby <cols>     选择要分组的列.补全将在每个组内独立完成.

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而非stdout.
    -n, --no-headers         设置后,第一行将不会被视为表头.
    -d, --delimiter <arg>    读取CSV数据时的字段分隔符.必须是单个字符.
```
