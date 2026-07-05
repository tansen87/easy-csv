<!-- Generated -->
# xan bins

```txt
将包含连续数据的选定列离散化为区间.

生成的区间表格式如下:

field       - 列名
value       - 区间的标签(取决于 -l/--label 给出的内容)
lower_bound - 区间的下界
upper_bound - 区间的上界
count       - 落入此区间的行数

可以使用 -b/--bins 标志选择区间数量.请注意,默认情况下,此数字是一个近似目标,因为命令会尝试为区间找到可读的边界,
这使得很难精确遵守区间数量.如果要强制命令精确遵守 -b/--bins,请使用 -e/--exact 标志.

与 `xan hist` 结合使用,此命令对于可视化连续列的分布非常有用:

    $ xan bins -s count data.csv | xan hist

使用对数刻度:

    $ xan bins -s count data.csv | xan hist --scale log

Usage:
    xan bins [options] [<input>]
    xan bins --help

bins options:
    -s, --select <arg>      选择要计算区间的列子集.有关更多详细信息,请参阅 'xan select --help'.
    -b, --bins <number>     要生成的区间数量.请注意,如果没有 -e/--exact,此数字应被视为近似目标.
                            该命令默认尝试为区间找到美观且可读的边界,这意味着并不总是能实现精确的区间数量.
                            [default: 10]
    -H, --heuristic <name>  用于自动查找合适数量区间的启发式算法.必须是 `freedman-diaconis`、`sqrt` 或 `sturges` 之一.
    --max-bins <number>     要生成的最大区间数.仅在使用 -H/--heuristic 标志时有用.
    -e, --exact             是否确保返回提供给 -b/--bins 的精确区间数,这意味着区间边界的可读性可能会受到影响.
    -l, --label <mode>      选择区间的标签(将放置在 `value` 列中).在管道传输到 `xan hist` 时主要用于调整表示.
                            可以是 "full"、"lower" 或 "upper" 之一.
                            [default: full]
    -m, --min <min>         覆盖最小值.低于此最小值的值将被计为超出范围.
    -M, --max <max>         覆盖最大值.大于此最大值的值将被计为超出范围.
    -N, --no-extra          不包括空单元格、NaN 和超出范围的计数.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,文件将被视为没有表头.
    -d, --delimiter <arg>  读取CSV数据时的字段分隔符.必须是单个字符.
```
