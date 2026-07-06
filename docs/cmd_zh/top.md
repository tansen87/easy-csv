<!-- Generated -->
# xan top

```txt
在选定列中查找前 k 个值并返回关联的 CSV 行.

运行时间为 O(n * log k),n 是目标 CSV 文件中的行数,仅消耗 O(k) 内存,这当然比将 `xan sort` 管道传输到 `xan head` 更好.

请注意,选定列中具有空值或无法解析为数字的值的行将被忽略.

此命令还可以使用 -L/--lexicographic 标志按字典顺序返回前 k 个值或后 k 个值
(请注意,该命令的逻辑是为数值设计的,因此在这方面与 `xan sort` 相反).

示例:

"score" 列中的前 10 个值:

    $ xan top score file.csv

前 50 个值:

    $ xan top -l 50 score file.csv

最小的 10 个值:

    $ xan top -R score file.csv

具有潜在并列的前 10 个值:

    $ xan top -T score file.csv

"category" 列每个不同值的前 10 个值:

    $ xan top -g category score file.csv

相同的,带有前置的 "rank" 列:

    $ xan top -g category -r rank score file.csv

按字典顺序的最后 10 个名称:

    $ xan top -L name file.csv

按字典顺序的前 10 个名称:

    $ xan top -LR name file.csv

Usage:
    xan top <column> [options] [<input>]
    xan top --help

top options:
    -l, --limit <n>          要返回的前 k 项数量,不能小于 1.
                             [默认值:10]
    -R, --reverse            反转顺序
    -L, --lexicographic      按字典顺序排序值,而非将它们视为数字
    -g, --groupby <cols>     返回每个分组的前 n 个值,分组由给定列表示
    -r, --rank <col>         要前置的排名列名称
    -T, --ties               保留所有并列的最后行,因此将消耗 O(k + t) 内存,
                             t 为并列数量
    -p, --parallel           是否使用并行化来加速计算
                             将根据核心数自动选择合适的线程数
                             如需手动指定线程数,请使用 -t, --threads
    -t, --threads <threads>  使用指定数量的线程进行并行计算
                             如需自动选择线程数,请使用 -p, --parallel

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而非stdout
    -n, --no-headers         设置后,第一行将不会被视为表头
    -d, --delimiter <arg>    读取 CSV 数据时的字段分隔符,必须是单个字符
```
