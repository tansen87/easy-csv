<!-- Generated -->
# xan window

```txt
计算窗口聚合,如累积和、滚动平均值、前导和滞后值、排名等.

此命令能够在文件的单次遍历中计算多个聚合,并且从不使用超过适合最大所需窗口的内存用于滚动统计和前导/滞后.

但是,排名聚合(如 `frac` 或 `dense_rank`)仍然需要将整个文件缓冲到内存中.

也可以使用 -g/--groupby <cols> 标志按组计算聚合,但也将需要将整个文件缓冲到内存中,
除非您可以保证文件按分组列排序并使用 -S/--sorted 标志向命令指示.

计算累积和:

    $ xan window 'cumsum(n)' file.csv

计算滚动平均值和方差:

    $ xan window 'rolling_mean(10, n) as mean, rolling_var(10, n) as var' file.csv

添加滞后列:

    $ xan window 'lag(n) as "n-1"' file.csv

对数值进行排名:

    $ xan window 'dense_rank(n) as rank' file.csv

计算单元格相对于目标列总和的分数:

    $ xan window 'frac(n) as frac' file.csv

按 "country" 列的每个值计算窗口聚合:

    $ xan window -g country 'cumsum(n)' file.csv

最后,此命令还能够对整个文件或按组运行任意聚合函数(如 `xan agg` 和 `xan groupby`),并为每行重复其结果.
这对于过滤属于某些组的行(例如,如果聚合分数超过某个阈值)或用于规范化目的可能很有用.

请注意,这样做时,整个文件(或使用 -g/--groupby 和 -S/--sorted 时的整个组)将被缓冲到内存中.

保留 `count` 列平均值超过 10 的组的行:

    $ xan window -g country 'mean(count) as mean' file.csv | xan filter 'mean > 10'

# 按列窗口聚合

有时您可能想以相同的方式为给定的列选择添加一列或多列.

您可以使用 -C/--along-columns <cols> 标志执行此操作.在这种情况下,`_` 占位符可用于表达式中以表示当前列.

例如,给定以下数据:

a,b
4,5
1,7

以下命令(注意我们可以如何模板化添加的列名):

    $ xan window -C a,b 'mean(_) as "{}_mean", lag(_) as "{}_lag"' file.csv

将产生以下内容:

a,a_mean,a_lag,b,b_mean,b_lag
4,2.5,,5,6.0,
1,2.5,4,7,6.0,5

这也可以与 -O/--overwrite 标志一起使用:

    $ xan window -OC a,b 'mean(_) as "{}_mean", lag(_) as "{}_lag"' file.csv

产生:

a_mean,a_lag,b_mean,b_lag
2.5,,6.0,
2.5,4,6.0,5

---

要获取可用窗口聚合函数列表,请使用 `xan help window`.

要获取可用通用聚合函数列表,请使用 `xan help aggs`.

要快速了解表达式语言的功能,请查看 `xan help cheatsheet` 命令.

要获取可用函数列表,请使用 `xan help functions`.

Usage:
    xan window [options] <expression> [<input>]
    xan window --help

window options:
    -g, --groupby <cols>        如果指定,将对由给定列选择表示的每个分组运行聚合
                                除非提供 -S/--sorted,否则会将整个文件缓冲到内存中
    -S, --sorted                与 -g/--groupby 一起使用时,表示文件按分组列排序
                                以便在遇到新分组时重置状态以节省内存并加速计算
    -O, --overwrite             如果设置,与文件中已存在列同名的表达式将被其结果覆盖
                                而非在末尾添加新列
                                这意味着您可以同时转换和添加列
    -C, --along-columns <cols>  对选定列重复相同的表达式

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而非stdout
    -n, --no-headers         设置后,第一行将不会被视为表头
    -d, --delimiter <arg>    读取 CSV 数据时的字段分隔符,必须是单个字符
```
