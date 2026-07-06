<!-- Generated -->
# xan spark

```txt
从 CSV 数据打印 ASCII 迷你图(使用 ▁▂▃▄▅▆▇ 字符).

此命令能够表示任意数值序列以及分类数据、时间序列、分布等.

打印两个数值列:

    $ xan spark count1,count2 data.csv

    count1 ▅▆▅▇▅▃▅▅▁▅▅▄▅▄▆▃▅▄▃▁
    count2 ▆▆▅▇▅▃▅▅▁▆▆▄▅▄▅▃▄▅▄▁

打印两个数值列的分布:

    $ xan spark count1,count2 -D -H 2 -z data.csv

           ▇▃
    count1 ██▇▆▆▂▁▃▁▁ ▁▂▃▁▃▁▂
           ▇▂
    count2 ██▇▆▆▆▆▁▄ ▂ ▂▃▂▂▁▂

按列值分组打印时间序列:

    $ xan spark value -T date -g group data.csv

    group1    ▁▂▃▄▆▇▇▅▃▂▁▁▁
    group2           ▂▇▇▇▄▁
    group3 ▁▂▃▇▆▆▆▄▂▁▁▁
    group4      ▂▄▅▇▄▆▃▂▂▂▁
    group5           ▁▂▂▄▇▄
    group6 ▅▇▇▆▃▁▁▁▁▁▁▁▁▁▂▁

从 `xan freq` 的输出打印垂直条形图:

    $ xan freq -s category data.csv | xan spark count -c value -H .5 -W7 -C always --hide-names -N

    ▇▇▇▇▇▇▃▃▃▃▃▃
    ████████████▆▆▆▆▆▆▂▂▂▂▂▂▁▁▁▁▁▁
    ██████████████████████████████▁▁▁▁▁▁
    94    85    75    66    64    48
    Vinyl  Disc Other Downl… Tape Strea…

按组打印分类条形图:

    $ xan spark value -c category -g author_name

    group1 ▇▁▁
    group1  ▇
    group1    ▇
    group1 ▂  ▇
    group1 ▇ ▁

打印来自 "Unknown Pleasures" 专辑封面的非常字面的 Joy Division 图:

    $ curl https://gist.githubusercontent.com/borgar/31c1e476b8e92a11d7e9/raw/0fae97dab6830ecee185a63c1cee0008f6778ff6/pulsar.csv | \
    $ xan spark --along-rows '*' --hide-all

缩小终端以获得更好的效果 ;)

Usage:
    xan spark debate
    xan spark --count [options] [<input>]
    xan spark [options] [--] <y> [<input>]
    xan spark --help

spark mode options:
    --along-rows          沿行方向收集要打印的序列,而非沿列方向.
    -T, --time <col>      使用选定的 <col> 在时间轴上定位点,并按时间顺序重新排列 x 轴.
    -D, --dist            通过打印分布直方图重新解释给定序列.
    -g, --groupby <cols>  在 <cols> 选择中每个值打印一个序列.
    -c, --category <col>  选择一个 <col> 来表示打印序列中数据点的类别.将用于为数据点选择颜色,
                          因此与下面的其他着色标志不兼容.

spark options:
    -W, --width <n>     迷你图条允许的字符宽度.[default: 1]
    -H, --height <n>    迷你图条允许的字符高度.也可以作为终端高度的比率或百分比给出,
                        例如 "45%" 或 "0.5".默认为 1.
    --scale <scale>     对 y 轴应用缩放.可以是 "lin"、"pow"、"sqrt"、
                        "pow(custom_exponent)"(如 "pow(4.5)")、"log"、
                        "log2"、"log10" 或 "log(custom_base)"(如 "log(2.5)").[default: lin]
    --log               使用对数刻度,--scale=log 的简写.
    -m, --min <n>       强制 <y> 最小值.超出范围的值将被过滤掉.
    -M, --max <n>       强制 <y> 最大值.超出范围的值将被过滤掉.
    --share-scale       是否强制序列共享 y 轴.
    --hide-names        是否隐藏序列名称.
    --hide-legend       是否隐藏所有图例.
    --hide-all          --hide-names 和 --hide-legend 的简写.
    -F, --flatter       在序列顶部而非左侧打印序列名称,为序列本身留出更多空间.
    -w, --wrap          允许序列溢出到多行,而非将其离散化以适应终端宽度.
    -S, --small-multiples <n>
                        使用时,每行显示 <n> 个序列而非单个.如果您有足够的空间,这有助于一次查看更多序列.
    -N, --show-numbers  在各自条形下显示序列数字.仅在 -W/--width 大于 1 时有用.
    -P, --show-percentages
                        在各自条形下以百分比形式显示序列数字.仅在 -W/--width 大于 1 时有用.
    --repeat-x-axis <choice>
                        使用 -T/--time 时是否为每个图表重复 x 轴.可以是 "yes" 或 "no".[default: yes]
    --cols <num>        可用于绘制标签、图例和迷你图的终端列数(即字符数).默认使用终端全部宽度,
                        如果找不到终端大小则为 80(即管道传输到文件时).也可以作为终端宽度的比率或
                        百分比给出,例如 "45%" 或 "0.5".
    --color <when>      何时使用 ANSI 转义码为输出着色.使用 `auto` 自动检测,`never` 完全禁用颜色,
                        `always` 强制着色(即使输出无法处理).[default: auto]

spark coloring options:
    -G, --gradient <name>             使用给定渐变为每个条形着色.
    -B, --background-gradient <name>  隐藏条形并使用给定渐变打印背景色.结果可视为一种热力图.
    -V, --vertical-gradient <name>    使用给定渐变为条形着色,但将颜色映射到条形中字符的高度.
                                      仅用于美观目的.仅在 -H/--height 大于 1 时有用.
    -R, --rainbow                     按循环模式为每个序列分配颜色.在使用多个 <y> 列或
                                      -g/--groupby 时用于区分序列.
    -z, --striped                     调暗每个奇数条形的颜色以提高可读性.

请参阅 `xan help gradients` 获取可用渐变列表.

spark -T/--time options:
    --count                 计算落入同一时间桶的行数,而非依赖数值列.
    --sort                  按起点对给定时间序列排序.
    -A, --aggregate <mode>  在离散化时间 x 轴时如何聚合落入同一桶的值(例如使用 -T/--time 标志时).
                            可以是 "sum" 或 "mean".使用 --count 时默认为 "sum",否则为 "mean".

spark -D/--dist options:
    -b, --bins <n>  分布直方图的分箱数.[default: 35]

spark -c/--category options:
    -C, --cram <choice>  打印分类图例时,是否尝试将类别名称挤入序列条形下方.可以是
                         "always"、"never" 或 "auto".当给定 "auto" 时,如果有足够空间则会挤入.
                         仅在 -W/--width 大于 1 时有用.[default: auto]

Common options:
    -h, --help             显示帮助
    -n, --no-headers       设置后,第一行将不会包含在计数中.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
