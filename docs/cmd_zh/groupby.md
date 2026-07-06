<!-- Generated -->
# xan groupby

```txt
按列选择中包含的值对 CSV 文件进行分组,然后使用自定义聚合表达式对每个组的数据进行聚合.

有关非分组聚合,请查看 `xan agg` 命令.

运行命令的结果将是一个 CSV 文件,包含分组列和每个计算聚合的附加列.

例如,您可以计算每组的列总和:

    $ xan groupby user_name 'sum(retweet_count)' file.csv

您可以使用动态表达式在聚合前处理数据:

    $ xan groupby user_name 'sum(retweet_count + replies_count)' file.csv

您可以一次执行多个聚合:

    $ xan groupby user_name 'sum(retweet_count), mean(retweet_count), max(replies_count)' file.csv

您可以使用 'as' 语法重命名输出列:

    $ xan groupby user_name 'sum(n) as sum, max(replies_count) as "Max Replies"' file.csv

您可以在多列上分组(阅读 `xan select -h` 了解有关列选择的更多信息):

    $ xan groupby name,surname 'sum(count)' file.csv

# 在同一遍中计算总聚合

此命令可以在计算每组聚合的同一遍中计算整个文件的总聚合,因此您可以轻松地管道传输到其他命令以计算比率等.

例如,给定以下文件:

user,count
marcy,5
john,2
marcy,6
john,4

使用以下命令:

    $ xan groupby user 'sum(count) as count' -T 'sum(count) as total' file.csv

将产生以下结果:

user,count,total
john,6,17
marcy,11,17

然后您可以将其管道传输到 `xan select -e` 等并获取比率:

    $ <command-above> | xan select -e 'user, count, (count / total).to_fixed(2) as ratio'

产生:

user,count,ratio
marcy,11,0.65
john,6,0.35

# 按列聚合

此命令还能够使用 --along-cols <cols> 标志按列聚合.在这种情况下,聚合函数将接受匿名 `_` 占位符,表示当前处理的列值.

例如,给定以下文件:

user,count1,count2
marcy,4,5
john,0,1
marcy,6,8
john,4,6

使用以下命令:

    $ xan groupby user --along-cols count1,count2 'sum(_)' file.csv

将产生以下结果:

user,count1,count2
marcy,10,13
john,4,7

# 按矩阵聚合

此命令还可以使用 -M/--along-matrix 标志对选定列的所有值进行聚合,从而表示一个二维矩阵.在这种情况下,
聚合函数将接受匿名 `_` 占位符值,表示当前处理的列值.

例如,给定以下文件:

user,count1,count2
marcy,4,5
john,0,1
marcy,6,8
john,4,6

使用以下命令:

    $ xan groupby user --along-matrix count1,count2 'sum(_) as total' file.csv

将产生以下结果:

user,total
marcy,23
john,11

---

要快速了解表达式语言的功能,请查看 `xan help cheatsheet` 命令.

要获取可用聚合函数列表,请使用 `xan help aggs`.

要获取可用函数列表,请使用 `xan help functions`.

可以使用 -p/--parallel 或 -t/--threads 标志并行计算聚合.但这不适用于流或 gzipped 文件,除非可以找到 `.gzi` 索引
(由 `bgzip -i` 创建).并行化与 -S/--sorted 或 -C/--along-cols 标志不兼容.

Usage:
    xan groupby [options] <columns> <expression> [<input>]
    xan groupby --help

groupby options:
    --keep <cols>              在输出中保留此列选择(除了表示组的列).只有每组第一行的值会被保留.
    -C, --along-cols <cols>    对所有选定列执行单个聚合,并为每个组创建一个结果列.
    -M, --along-matrix <cols>  聚合给定列选择中找到的所有值.
    -T, --total <expr>         在同一遍中对整个文件运行聚合,并将结果列添加到每组结果的末尾.在管道传输到 `map`、
                               `transform`、`select -e` 等时,可用于计算总比率等.
    -S, --sorted               使用此标志表示文件已按组列排序,这样命令可以显著优化内存使用.
    -p, --parallel             是否使用并行化来加速计算.将根据核心数自动选择合适的线程数.
    -t, --threads <threads>    使用指定数量的线程进行并行计算.

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而非stdout
    -n, --no-headers         设置后,第一行将不会被视为表头
    -d, --delimiter <arg>    读取 CSV 数据时的字段分隔符,必须是单个字符
```
