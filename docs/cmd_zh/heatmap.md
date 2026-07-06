<!-- Generated -->
# xan heatmap

```txt
将 CSV 数据渲染为热力图网格.x 轴标签将取自文件的标题(或使用 -n/--no-headers 时的 0 基列索引).
而 y 轴标签默认取自文件的第一列.第一列之后的所有列将被视为数值并用于绘制热力图网格.

如果您的文件不是这样组织的,您仍然可以使用 -l/--label 标志选择 y 轴标签列和/或 -v/--values 标志选择要用于绘制热力图网格的列.

此命令通常用于显示 `xan matrix` 的结果.例如,以下是绘制相关矩阵的方法:

    $ xan matrix corr -s 'sepal_*,petal_*' iris.csv | xan heatmap --diverging --unit

这是另一个绘制邻接矩阵的示例:

    $ xan matrix adj source target edges.csv | xan heatmap

请注意,绘制的矩阵不必是方形的,可以是任何东西.可以将结果视为给定表格数据的符号表示,其中每个单元格由具有连续颜色的正方形表示.

考虑以下示例,例如,我们绘制 Twitter 账户关于转发、回复和点赞的流行度概况的热力图:

    $ xan groupby user_screen_name \
    $   'mean(retweet_count) as rt, mean(reply_count) as rp, mean(like_count) as lk' \
    $   tweets.csv | \
    $ xan heatmap --size 2 --cram --show-numbers

您还可以通过利用 -W/--width 标志并显示数字来实现类似于电子表格中条件格式的结果:

    $ xan matrix count lang1 lang2 data.csv | xan heatmap -W 6 --show-numbers

请注意,默认情况下,由于 x 轴上没有足够的空间,标签将打印在热力图本身的图例中.如果可以腾出空间,
请随意使用大于 1 的 -S/--size 并切换 -C/--cram 标志以将标签放在 x 轴上方.

增加 -S/--size 还意味着您可以尝试使用 -N/--show-numbers 将数字放在热力图的单元格内.

最后,如果要查看可用颜色渐变的展示,请使用 `xan help gradients`.

Usage:
    xan heatmap [options] [<input>]
    xan heatmap --green-hills
    xan heatmap --help

heatmap options:
    -l, --label <column>    包含 y 轴标签的列.默认为文件的第一列.
    -v, --values <columns>  包含要在热力图中显示的数值的列.默认为文件第一列之后的所有列.
    -G, --gradient <name>   要使用的渐变.使用 `xan help gradients` 查看可用选项.
                            [default: or_rd]
    -A, --ascii             使用 ascii 阴影字符 (░▒▓█) 绘制热力图,而不是为单元格背景着色.因此输出可以复制粘贴,
                            但仅限于 4 级渐变.不适用于 -N/--show-numbers 或 -Z/--show-normalized.
    -m, --min <n>           热力图中单元格的最小值.将限制不相关的值并使用此最小值进行归一化.
    -M, --max <n>           热力图中单元格的最大值.将限制不相关的值并使用此最大值进行归一化.
    -U, --unit              使用 -D/--diverging 时的 --min 0, --max 1 或 --min -1, --max 1 的简写.
    --normalize <mode>      如何归一化热力图的值.可以是 "full"、"row" 或 "col" 之一.
                            [default: full]
    -S, --size <n>          热力图正方形在终端行中的大小.
                            [default: 1]
    -W, --width <n>         如果需要矩形而不是正方形,并且希望有更多空间使用 -N/--show-numbers 或 -Z/--show-normalized
                            显示单元格数字,请使用此选项设置热力图网格单元格宽度.
    -D, --diverging         使用发散颜色渐变.目前仅是 "--gradient rd_bu" 的简写.
    -C, --cram <choice>     是否将 x 轴标签挤在热力图网格列上方.可以是 "auto"、"always" 或 "never".
                            [default: auto]
    -N, --show-numbers      是否尝试在单元格中显示数字.通常仅在 -S/--size > 1 时有用.不能与 -Z/--show-normalized 同时使用.
    -Z, --show-normalized   是否尝试在单元格中显示归一化数字.通常仅在 -S/--size > 1 时有用.不能与 -N/--show-numbers 同时使用.
    -a, --align <choice>    显示时数字在单元格中的对齐方式.可以是 "left"、"center" 或 "right".
                            [default: center]
    -F, --fill              是否用 "⡪" 字符填充空单元格.
    --repeat-headers <n>    每 <n> 个热力图行重复一次标题.也可以设置为 "auto",根据终端高度选择合适的数字.
    --color <when>          何时使用 ANSI 转义码为输出着色.使用 `auto` 进行自动检测,`never` 完全禁用颜色,`always`
                            强制使用颜色,即使输出无法处理.
                            [default: auto]

Common options:
    -h, --help             显示帮助
    -n, --no-headers       设置后,文件将被视为没有标题
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符
```
