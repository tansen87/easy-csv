<!-- Generated -->
# xan stats

```txt
计算 CSV 数据的描述性统计信息.

如果要打印人类可读的输出,请使用 -R/--report 标志.

否则,此命令可用于生成 CSV 输出,可以轻松地管道传输到其他 `xan` 命令.

默认情况下,统计信息报告 CSV 数据中的*每*列,但您可以使用 -s/--select 标志限制分析的列集.

默认统计集对应于可以在常量内存的流上高效计算的内容,但可以使用后面记录的标志选择更多内容.

也可以使用 -g/--groupby 标志按组计算统计信息.

如果您有更具体的需求或想要执行自定义聚合,请务必查看 `xan agg` 或 `xan groupby` 命令.

以下是 CSV 输出的样子:

field              (default) - 被描述列的名称
count              (default) - 列包含的非空值数量
count_empty        (default) - 列包含的空值数量
type               (default) - 列最可能的类型
types              (default) - 列中所有类型的管道分隔列表
sum                (default) - 数值总和
mean               (default) - 数值平均值
q1                 (-q, -A)  - 数值的第一四分位数
median             (-q, -A)  - 数值的第二四分位数,即中位数
q3                 (-q, -A)  - 数值的第三四分位数
log_dist           (-q, -A)  - 表示数值分布的迷你图(例如 ▇▅▄▃▂▃▂▂▂)
variance           (default) - 数值的总体方差
stddev             (default) - 数值的总体标准差
min                (default) - 最小数值
max                (default) - 最大数值
approx_cardinality (-a)      - 不同字符串值数量的近似值
approx_q1          (-a)      - 数值第一四分位数的近似值
approx_median      (-a)      - 数值中位数的近似值
approx_q3          (-a)      - 数值第三四分位数的近似值
cardinality        (-c, -A)  - 不同字符串值的数量
mode               (-c, -A)  - 最频繁的字符串值(平局打破是任意的和随机的！)
tied_for_mode      (-c, -A)  - 与模式并列的值数量
lex_first          (default) - 词法顺序中的第一个字符串
lex_last           (default) - 词法顺序中的最后一个字符串
min_length         (default) - 最小字符串长度
max_length         (default) - 最大字符串长度

可以使用 -p/--parallel 或 -t/--threads 标志并行计算统计信息.但这不适用于流或 gzipped 文件,
除非可以找到 `.gzi` 索引(由 `bgzip -i` 创建).并行化与 -g/--groupby 选项不兼容.

请注意,-R/--report 的输出可以轻松地管道传输到分页器,如下所示(不要忘记强制颜色):

    $ xan stats -R data.csv --color always | less -SR

Usage:
    xan stats [options] [<input>]

stats options:
    -s, --select <arg>       选择要计算统计信息的列子集.有关格式详情,请参阅 'xan select --help'.
                             此处提供是因为将 'xan select' 管道传输到 'xan stats' 将禁用索引的使用.
    -R, --report             打印人类可读的输出,适合理解列中包含的内容,以及相关的数据可视化
                             (条形图、排行榜等).不适用于 -g/--groupby.
    --sep <str>              指示必须使用给定分隔符拆分单元格.
    -g, --groupby <cols>     如果给定,将按给定列选择定义的组计算统计信息.
    -A, --all                -cq 的简写.
    -c, --cardinality        显示基数和众数.这需要将所有 CSV 数据存储在内存中.
    -q, --quartiles          显示四分位数.这需要将所有 CSV 数据存储在内存中.
    -a, --approx             计算近似统计信息.
    --nulls                  在计算均值和标准差时将空值包含在总体大小中.
    -p, --parallel           是否使用并行化来加速计算.将根据核心数自动选择合适的线程数.
                             如果您想自己指定线程数,请使用 -t, --threads.
    -t, --threads <threads>  使用指定数量的线程进行并行计算.如果您想自动选择线程数,
                             请使用 -p, --parallel.

stats -R/--report options:
    --cols <num>    图表的终端列数(即字符数).默认使用终端全部宽度,
                    如果找不到终端大小则为 80(即管道传输到文件时).
                    也可以作为终端宽度的比率或百分比给出,例如 "45%" 或 "0.5".
    --color <when>  何时使用 ANSI 转义码为输出着色.使用 `auto` 自动检测,
                    `never` 完全禁用颜色,`always` 强制着色(即使输出无法处理).[default: auto]

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会被解释为列名,即它们将包含在统计信息中.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
