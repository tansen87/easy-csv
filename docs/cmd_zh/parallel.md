<!-- Generated -->
# xan parallel

```txt
CSV 数据的并行处理.

此命令通常在多个文件上并行化计算,但当可用线程数大于要读取的文件数时,也能够自动分块 CSV 文件和 bgzipped CSV 文件
(当可以找到 `.gzi` 索引时).

这意味着此命令完全能够对单个 CSV 文件进行并行化.

要并行处理单个 CSV 文件:

    $ xan parallel count docs.csv

要一次处理多个文件,必须将它们的路径作为多个参数传递给命令,或通过 stdin 传递(每行一个路径),
或在使用 --path-column 标志时通过 CSV 列传递:

    通过 shell glob 传递多个参数:
    $ xan parallel count data/**/docs.csv

    每行一个路径,通过 stdin 喂入:
    $ ls data/**/docs.csv | xan parallel count

    通过 stdin 从 CSV 列传递路径:
    $ cat filelist.csv | xan parallel count --path-column path

您还可以使用 --glob 标志为命令提供 glob 模式(例如,如果您的 shell 不支持该模式或文件数量超过参数限制):

    $ xan parallel count --glob 'data/**/docs.csv'

请注意,有时您可能会发现使用 `split` 或 `partition` 命令先将大文件拆分为可管理的块很有用,如果您可以腾出磁盘空间.

此命令具有多个子命令,每个子命令执行一些典型的并行归约操作:

    - `count`:计算整个数据集中的行数.
    - `cat`:预处理文件并将连接的行重定向到输出(例如,并行搜索所有文件并检索结果).
    - `freq`:并行构建频率表.有关输出示例,请参阅 "xan freq -h".
    - `stats`:并行计算已知统计信息.有关输出示例,请参阅 "xan stats -h".
    - `agg`:并行化自定义聚合.有关更多详细信息,请参阅 "xan agg -h".
    - `groupby`:并行化自定义分组聚合.有关更多详细信息,请参阅 "xan groupby -h".
    - `top`:返回最大化给定 <column> 的前 10 行(或使用 -l/--limit 标志的任意计数).
    - `map`:将给定预处理的结果写入原始文件旁边的新文件.此子命令接受文件名模板,其中 `{}` 将被每个目标文件的名称替换
            (不带任何扩展名,例如会去掉 `.csv` 或 `.csv.gz`).此命令无法利用 CSV 文件分块.

例如,以下命令:

    $ xan parallel map '{}_freq.csv' -P 'freq -s Category' *.csv

将为当前目录中的每个 CSV 文件创建一个后缀为 "_freq.csv" 的文件,其中包含其 "Category" 命令的频率表.

最后,可以使用两种不同的方法对每个文件进行预处理:

1. 仅使用带有 -P, --preprocess 的 xan 子命令:
    $ xan parallel count -P "search -s name John | slice -l 10" file.csv

2. 使用传递给 "$SHELL -c" 或 "cmd /C" 的带有 -H, --shell-preprocess 的子命令:
    $ xan parallel count -H "rg john | xan from -f ndjson" data.ndjson

Usage:
    xan parallel count [options] [<inputs>...]
    xan parallel cat [options] [<inputs>...]
    xan parallel freq [options] [<inputs>...]
    xan parallel stats [options] [<inputs>...]
    xan parallel agg [options] <expr> [<inputs>...]
    xan parallel groupby [options] <group> <expr> [<inputs>...]
    xan parallel top [options] <column> [<inputs>...]
    xan parallel map [options] <template> [<inputs>...]
    xan parallel --help
    xan p count [options] [<inputs>...]
    xan p cat [options] [<inputs>...]
    xan p freq [options] [<inputs>...]
    xan p stats [options] [<inputs>...]
    xan p agg [options] <expr> [<inputs>...]
    xan p groupby [options] <group> <expr> [<inputs>...]
    xan p top [options] <column> [<inputs>...]
    xan p map [options] <template> [<inputs>...]
    xan p --help

parallel options:
    -P, --preprocess <op>        仅使用 `xan` 子命令进行预处理.
    -H, --shell-preprocess <op>  预处理命令将直接在您自己的 shell 中使用 -c 标志运行.
    --run <path>                 运行给定 <path> 的 xan 脚本作为预处理.
                                 有关更多信息,请参阅 `xan run -h`.
    --progress                   显示并行任务的进度条.每个文件/分块的进度条将在预处理后每处理一行 CSV 数据时更新一次！
    -t, --threads <n>            要使用的线程数.默认为基于可用 CPU 的合理数量.
    --path-column <name>         如果 stdin 以 CSV 文件形式给出(而非每行一个路径),则指定路径列的名称.
    --glob <pattern>             使用给定的 glob <pattern> 来收集要处理的文件.
    --dont-chunk                 告诉命令不要尝试将 CSV 输入分块,即使可用线程数大于要处理的文件数.当预处理需要处理非标准 CSV 文件
                                 (如 `xan input` 处理的文件)时,这可能很有用.

parallel count options:
    -S, --source-column <name>  如果提供,将返回一个 CSV 文件,其中包含一个显示被计数源文件的列和一个显示计数本身的列.

parallel cat options:
    -B, --buffer-size <n>       线程在刷新到输出前允许保留在内存中的行数.设置为 -1 表示无限缓冲区大小,这意味着每个处理文件仅刷新一次.
                                这对于确保结果行在输出中按输入文件分组可能很有用.但请记住,这也可能消耗大量内存.
                                [default: 1024]
    -S, --source-column <name>  在输出中前置的列名,用于指示源文件的路径.

parallel freq options:
    -s, --select <cols>       要构建频率表的列.
    --sep <char>              使用提供的分隔符将单元格拆分为多个值进行计数.
    -A, --all                 移除限制.
    -l, --limit <n>           将频率表限制为最常见的 N 个项目.使用 -A, --all 或设置为 0 以禁用限制.
                              [default: 10]
    -a, --approx              如果设置,返回最可能具有最高计数的项目(根据给定的 --limit).如果 --limit 为 0 或使用 -A, --all 则不起作用.
                              结果的准确性随给定的限制而提高.
    -X, --approx-algo <name>  使用 -a/--approx 标志时,用于查找 top-k 近似的算法名称.可以是默认的 `space-saving` (`ss`) 算法,
                              或 `heavy-keeper` (`hk`) 算法,后者更适合 zipfian 流(项目分布遵循幂律).
                              [default: heavy-keeper]
    -N, --no-extra            不包含空单元格和剩余计数.

parallel stats options:
    -s, --select <cols>    要构建统计信息的列.
    -A, --all              -cq 的简写.
    -c, --cardinality      显示基数和众数.
                           这需要将所有 CSV 数据存储在内存中.
    -q, --quartiles        显示四分位数.
                           这需要将所有 CSV 数据存储在内存中.
    -a, --approx           显示近似统计信息.
    --nulls                在计算均值和标准差时将空值包含在总体大小中.

parallel top options:
    -l, --limit <n>       要返回的前 N 个项目的数量.不能小于 1.
                          [default: 10]
    -R, --reverse         反转顺序.
    -L, --lexicographic   按字典顺序对值进行排序,而不是将其视为数字.
    -r, --rank <col>      要前置的排名列的名称.
    -T, --ties            保留所有并列的行.因此将消耗 O(k + t) 内存,其中 t 是并列的数量.

parallel map options:
    -z, --compress <kind>  使用 "gz|gzip" 或 "zst|zstd" 压缩创建的文件.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会被视为表头.请注意,这在连接列时没有效果.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符.
```
