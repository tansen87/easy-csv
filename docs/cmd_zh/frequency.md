<!-- Generated -->
# xan frequency

```txt
计算 CSV 数据的频率表.

生成的频率表如下所示:

field - 列名
value - 列的某个不同值
count - 包含此值的行数

管道传输到 `xan hist` 以轻松可视化结果:

    $ xan freq -s category data.csv | xan hist

默认情况下,数据中每个字段的前 N 个最频繁值各有一行.可以使用 -l/--limit 调整返回的值数量,也可以使用 -A/--all 标志完全禁用限制.

由于这计算的是精确频率表,因此需要与每个选定列的基数成比例的内存.如果预计这会溢出内存,可以使用 -a, --approx 标志计算近似 top-k.

要计算每个组的自定义聚合(不仅仅是计数),请务必查看 `xan groupby` 命令.

可以使用 -p/--parallel 或 -t/--threads 标志并行计算频率表.这不适用于流或 gzipped 文件,除非可以找到 `.gzi` 索引
(由 `bgzip -i` 创建).并行化与 -g/--groupby 选项不兼容.

Usage:
    xan frequency [options] [<input>]
    xan freq [options] [<input>]

frequency options:
    -s, --select <arg>        选择要计算频率的列子集.有关选择语言详细信息,请参阅 'xan select --help'.
    --sep <char>              使用提供的分隔符将单元格拆分为多个值进行计数.
    -g, --groupby <cols>      如果给出,将按给定列定义的组计算频率表.
    -A, --all                 移除限制.
    -l, --limit <arg>         将频率表限制为最常见的 N 个项目.使用 -A, -all 或设置为 0 以禁用限制.
                              [default: 10]
    -a, --approx              如果设置,返回最可能具有最高计数的项目,根据给定的 --limit.如果 --limit 为 0 或使用
                              -A, --all 则不适用.结果的准确性随给定限制而增加.
    -X, --approx-algo <name>  使用 -a/--approx 标志时用于查找 top-k 近似的算法名称.可以是默认的 `space-saving`
                              (`ss`) 算法,或 `heavy-keeper` (`hk`) 算法,后者更适合 zipfian 流(项目分布遵循幂律).
                              [default: heavy-keeper]
    -N, --no-extra            不包括空单元格和剩余计数.
    -p, --parallel            是否使用并行化来加速计算.将根据核心数自动选择合适的线程数.
                              如果要自己指定线程数,请使用 -t, --threads.
    -t, --threads <threads>   使用指定数量的线程进行并行计算.如果要自动选择线程数,请使用 -p, --parallel.

Hidden options:
    --no-limit-we-reach-for-the-sky  此处无内容...

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会包含在频率表中.此外,'field' 列将是基于 0 的索引而不是标题名称.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
