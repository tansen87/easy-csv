<!-- Generated -->
# xan agg

```txt
使用自定义聚合表达式对 CSV 数据进行聚合.

对于典型统计信息,请查看 `xan stats` 命令,通常更简单易用.

对于分组聚合,请查看 `xan groupby` 命令.

# 自定义聚合

运行自定义聚合时,结果将是包含整个文件聚合结果的单行 CSV.

例如,给定以下 CSV 文件:

| name | count1 | count2 |
| ---- | ------ | ------ |
| john | 3      | 6      |
| lucy | 10     | 7      |

运行以下命令:

    $ xan agg 'sum(count1) as sum1, sum(count2) as sum2'

将产生以下输出:

| sum1 | sum2 |
| ---- | ---- |
| 13   | 13   |

查看以下示例以了解如何编写表达式.请注意,完整的聚合函数列表可使用 `xan help aggs` 查看.

计算列的总和:

    $ xan agg 'sum(retweet_count)' file.csv

使用动态表达式在聚合前处理数据:

    $ xan agg 'sum(retweet_count + replies_count)' file.csv

一次执行多个聚合:

    $ xan agg 'sum(retweet_count), mean(retweet_count), max(replies_count)' file.csv

使用 'as' 语法重命名输出列:

    $ xan agg 'sum(n) as sum, max(replies_count) as "Max Replies"' file.csv

# 按行聚合

使用 --along-rows 标志时,此命令可用于按行聚合选定的列,而不是聚合整个文件.在这种情况下,
聚合函数将接受匿名 `_` 占位符值,表示当前处理的列值.

在某种程度上,它是 `xan map` 的变体,能够利用聚合函数并对目标列进行泛化.

请注意,使用 --along-rows 时,`col_index()` 函数将返回当前处理列的索引,而不是行索引.
当与 `argmin/argmax` 等一起使用时,这可能很有用.

例如,给定以下 CSV 文件:

| name | count1 | count2 |
| ---- | ------ | ------ |
| john | 3      | 6      |
| lucy | 10     | 7      |

运行以下命令(注意表达式中的 `_`):

    $ xan agg --along-rows count1,count2 'sum(_) as sum'

将产生以下输出:

| name | count1 | count2 | sum |
| ---- | ------ | ------ | --- |
| john | 3      | 6      | 9   |
| lucy | 10     | 7      | 17  |

典型用例包括获取密集向量的维度方差:

    $ xan agg -R 'dim_*' 'var(_) as variance' vectors.csv

找到最大化分数的列:

    $ xan agg -R '*_score' 'argmax(_, header(col_index()) as best' results.csv

# 按列聚合

此命令也可用于使用 -C/--along-columns 标志对选定的列运行相同的聚合.
在这种情况下,聚合函数将接受匿名 `_` 占位符值,表示当前处理的列值.

例如,给定以下文件:

| name | count1 | count2 |
| ---- | ------ | ------ |
| john | 3      | 6      |
| lucy | 10     | 7      |

运行以下命令(注意表达式中的 `_`):

    $ xan agg --along-cols count1,count2 'sum(_)'

将产生以下输出:

| count1 | count2 |
| ------ | ------ |
| 13     | 13     |

# 按矩阵聚合

此命令也可用于使用 -M/--along-matrix 标志对选定列的所有值运行自定义聚合,从而表示一个二维矩阵.
在这种情况下,聚合函数将接受匿名 `_` 占位符值,表示当前处理的列值.

例如,给定以下文件:

| name | count1 | count2 |
| ---- | ------ | ------ |
| john | 3      | 6      |
| lucy | 10     | 7      |

运行以下命令(注意表达式中的 `_`):

    $ xan agg --along-matrix count1,count2 'sum(_) as total'

将产生以下输出:

| total |
| ----- |
| 26    |

---

要快速了解表达式语言的功能,请查看 `xan help cheatsheet` 命令.

要获取可用聚合函数列表,请使用 `xan help aggs`.

要获取可用函数列表,请使用 `xan help functions`.

可以使用 -p/--parallel 或 -t/--threads 标志并行计算聚合.但这不适用于流或 gzipped 文件,除非可以找到 `.gzi` 索引
(由 `bgzip -i` 创建).并行化与 -R/--along-rows、-M/--along-matrix 或 -C/--along-cols 选项不兼容.

Usage:
    xan agg [options] <expression> [<input>]
    xan agg --help

agg options:
    -R, --along-rows <cols>    为每一行而不是整个文件聚合选定的列.
    -C, --along-cols <cols>    以相同方式聚合选定的列,并在输出中返回具有相同名称的聚合列.
    -M, --along-matrix <cols>  聚合给定选定列中找到的所有值.
    -p, --parallel             是否使用并行化来加速计算.将根据核心数自动选择合适的线程数.
                               如果要自己指定线程数,请使用 -t, --threads.
    -t, --threads <threads>    使用指定数量的线程进行并行计算.如果要自动选择线程数,请使用 -p, --parallel.

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而非stdout.
    -n, --no-headers         设置后,第一行将不会被视为表头.
    -d, --delimiter <arg>    读取CSV数据时的字段分隔符,必须是单个字符.
```
