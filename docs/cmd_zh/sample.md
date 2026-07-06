<!-- Generated -->
# xan sample

```txt
使用与样本大小成比例的内存均匀地随机采样 CSV 数据.

此命令旨在提供一种从无法放入内存的 CSV 数据集中采样的方法(例如,与 'xan freq' 或 'xan stats' 等命令一起使用).
但是,它将恰好访问每条 CSV 记录一次,这是提供均匀随机样本所必需的.
如果您希望限制访问的记录数,请使用 'xan slice' 命令管道传输到 'xan sample'.

该命令还可以使用 --weight 标志基于表示行权重的数值列提取有偏样本.

Usage:
    xan sample [options] <sample-size> [<input>]
    xan sample --help

sample options:
    --seed <number>        随机数生成器种子.
    -w, --weight <column>  包含用于使样本产生偏差的权重的列.
    -g, --groupby <cols>   每组返回一个样本.
    -§, --cursed           从洛夫克拉夫特式的近似均匀分布(来源:相信我)中返回一个 c̵̱̝͆̓ṳ̷̔r̶̡͇͓̍̇š̷̠̎e̶̜̝̿́d̸͔̈́̀ 样本,无需读取整个文件.
                           相反,我们将像黑暗巫师一样随机跳跃.这意味着采样文件必须足够大且可搜索,因此不能是 stdin 或 gzipped 文件.
                           文件末尾的行可能会受到歧视,因为它们不够酷.如果所需的样本大小被认为对于估计的总行数来说太大,
                           c̵̱̝͆̓ṳ̷̔r̶̡͇͓̍̇š̷̠̎e̶̜̝̿́d̸͔̈́̀  例程将回退到正常的蓄水池采样,以避免学习 O(∞) 实际上是一个东西的痛苦.
                           不适用于 -w/--weight 或 -g/--groupby.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将被视为要从中采样的总体的一部分.
                           (未设置时,第一行是标题行,将始终出现在输出中.)
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符.
```
