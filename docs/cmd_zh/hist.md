<!-- Generated -->
# xan hist

```txt
打印给定 CSV 文件的水平直方图,每行代表图中的一个条形.

此命令通常与 `frequency` 或 `bins` 命令一起使用:

    $ xan freq -s username tweets.csv | xan hist

    $ xan bins -s retweet_count,like_count tweets.csv | xan hist

否则,此命令期望 CSV 文件具有以下列:

    - "field"(可选):要打印的直方图的名称
    - "value":单个条形的标签
    - "count":单个条形表示的数值

您始终可以通过 -f/--field、-l/--label 和 -v/--value 标志分别自定义这些列名.

Usage:
    xan hist [options] [<input>]
    xan hist --help

hist options:
    --name <name>            当没有字段列时,表示的字段名称.[默认: unknown].
    -f, --field <name>       字段列的名称,即包含表示值的列(请记住此命令可以打印多个直方图).[默认: field].
    -l, --label <name>       标签列的名称,即包含直方图单个条形标签的列.[默认: value].
    -v, --value <name>       计数列的名称,即包含每个条形值的列.[默认: count].
    -B, --bar-size <size>    条形字符的大小,可以是 "small"、"medium" 或 "large".[默认: medium].
    --cols <num>             图表在终端列(即字符)中的宽度.默认使用终端的全部宽度,如果找不到终端大小(即管道传输到文件时)则为 80.
                             也可以作为终端宽度的比例或百分比给出,例如 "45%" 或 "0.5".
    -R, --rainbow            为条形使用交替颜色.
    -m, --domain-max <type>  如果是 "max",最大条形长度将按最大条形值缩放.如果是 "sum",最大条形长度将按条形值总和缩放(即条形长度总和为 100%).
                             也可以是绝对数值,用于限制条形或确保不同的直方图使用相同的比例表示.
                             [默认: max]
    -c, --category <col>     用于为每个类别分配不同颜色的分类列的名称.与 -R, --rainbow 不兼容.
    --color <when>           何时使用 ANSI 转义码为输出着色.使用 `auto` 进行自动检测,`never` 完全禁用颜色,`always` 强制使用颜色,
                             即使输出无法处理.
                             [默认: auto]
    -P, --hide-percent       不显示百分比.
    -u, --unit <unit>        值单位.
    -D, --dates              设置此标志表示值为日期(支持年、年月或年月日格式).这将按日期排序条形并添加缺失的日期.
    -G, --compress-gaps <n>  如果给定,将压缩至少 <n> 个连续设置为 0 的条目之间的间隙,并用省略号替换.
    --scale <scale>          对值应用比例.可以是 "lin"、"pow"、"sqrt"、"pow(custom_exponent)" 如 "pow(4.5)"、"log"、
                             "log2"、"log10" 或 "log(custom_base)" 如 "log(2.5)" 之一.
                             [默认: lin]
    --log                    使用对数比例,--scale=log 的简写.

Common options:
    -h, --help             显示帮助
    -n, --no-headers       设置后,文件将被视为没有标题
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符
```
