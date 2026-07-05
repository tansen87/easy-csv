<!-- Generated -->
# xan plot

```txt
基于二维数据绘制散点图或折线图.

也可以通过提供 -c/--category 列或选择多个列作为 <y> 系列来绘制多个系列/线条,
以及绘制多个系列/线条作为小倍数(有时也称为facet网格).

此命令还能够在给出 -T/--time 标志时绘制时间 x 轴,并接受以下格式:

* 完整的 ISO 日期时间或 Z 终止的时间戳
* 标准的秒级时间戳
* 完整或部分 ISO 日期(例如 2025-03-12、2025-03、2025)

使用 `xan map`、`xan select -e` 或 `xan transform` 在 `xan plot` 命令之前处理其他日期时间格式.

绘制简单的散点图:

    $ xan plot sepal_width sepal_length iris.csv

绘制分类散点图:

    $ xan plot sepal_width sepal_length -c species iris.csv

相同的,作为小倍数:

    $ xan plot sepal_width sepal_length -c species iris.csv -S 2

作为折线图:

    $ xan plot -L sepal_length petal_length iris.csv

绘制时间序列:

    $ xan plot -LT datetime units sales.csv

绘制毫秒时间戳时间序列:

    $ xan select -e 'timestamp_ms(time)' | xan plot -LT 0 --count

一次绘制多个可比较的时间序列:

    $ xan plot -LT datetime amount,amount_fixed sales.csv

不同的时间序列,作为小倍数:

    $ xan plot -LT datetime revenue,units sales.csv -S 2

Usage:
    xan plot --count [options] <x> [<input>]
    xan plot [options] <x> <y> [<input>]
    xan plot --help

plot options:
    -L, --line                 是否绘制折线图而非默认的散点图.
    -T, --time                 用于指示 x 轴是时间轴.轴将根据某种推断的时间粒度进行离散化,
                               并且 y 值将针对新离散化的 x 轴进行求和.
    --count                    省略 y 列,改为计算行数.仅在与 -T, --time 一起使用时相关,该标志将离散化 x 轴.
    -A, --aggregate <mode>     在离散化 x 轴时(例如使用 -T/--time 标志时),如何聚合落入同一桶中的值.
                               可以是 "sum" 或 "mean".当给出 --count 时默认为 "sum",否则为 "mean".
    -c, --category <col>       用于绘制每个类别不同系列的分类列的名称.当使用 <y> 选择多个列时不起作用.
    -R, --regression-line      绘制回归线.仅在绘制具有单一系列的散点图时有效.
    -g, --granularity <g>      使用 -T, --time 时强制指定 x 轴离散化的时间粒度.必须是 "years"、"months"、"days"、
                               "hours"、"minutes" 或 "seconds" 之一.如果省略将自动推断.
    --cols <num>               图形的宽度(以终端列数为单位,即字符数).默认为使用终端的全部宽度,如果无法找到终端大小(即通过管道输出到文件时),
                               则默认为 80.也可以作为终端宽度的比例或百分比给出,例如 "45%" 或 "0.5".
    --rows <num>               图形的高度(以终端行数为单位,即字符数).默认为使用终端的全部高度减 2,如果无法找到终端大小
                               (即通过管道输出到文件时),则默认为 30.也可以作为终端宽度的比例或百分比给出,例如 "45%" 或 "0.5".
    -S, --small-multiples <n>  显示由 -c, --category 给出的数据集的小倍数(也称为分面网格),或当为 <y> 提供多个系列时,使用提供的网格列数.
                               图形将共享相同的 x 缩放,但默认使用不同的 y 缩放.请参阅 --share-y-scale 标志以调整此行为.
    --share-x-scale <yes|no>   使用 -S 绘制小倍数时,给 "yes" 以共享所有图形的 x 缩放,或给 "no" 以保持它们独立.[default: yes]
    --share-y-scale <yes|no>   使用 -S 绘制小倍数时,给 "yes" 以共享所有图形的 y 缩放,或给 "no" 以保持它们独立.
                               当给出 -c, --category 时默认为 "yes",当为 <y> 提供多个系列时默认为 "no".
    -M, --marker <name>        要使用的标记.可以是以下之一(按大小排序):'braille'、'dot'、'halfblock'、'bar'、'block'.
                               [default: braille]
    -G, --grid                 绘制背景网格.
    --x-ticks <n>              x 轴刻度线的近似数量.默认为基于终端尺寸的某个合理数字.
    --y-ticks <n>              y 轴刻度线的近似数量.默认为基于终端尺寸的某个合理数字.
    --x-min <n>                强制设置 x 轴的最小值.
    --x-max <n>                强制设置 x 轴的最大值.
    --y-min <n>                强制设置 y 轴的最小值.
    --y-max <n>                强制设置 y 轴的最大值.
    --x-scale <scale>          对 x 轴应用缩放.可以是 "lin"、"pow"、"sqrt"、"pow(custom_exponent)"(如 "pow(4.5)")、"log"、"log2"、"log10" 或 "log(custom_base)"(如 "log(2.5)")之一.[default: lin]
    --y-scale <scale>          对 y 轴应用缩放.可以是 "lin"、"pow"、"sqrt"、"pow(custom_exponent)"(如 "pow(4.5)")、"log"、"log2"、"log10" 或 "log(custom_base)"(如 "log(2.5)")之一.[default: lin]
    -D, --density-gradient <name>
                               用于映射到图中单元格密度的颜色渐变名称.当点非常密集时,这可用于增强可读性,
                               并克服用于在屏幕上绘制它们的盲文字符的粒度.这实际上将图形转换为一种热力图.
                               运行 `xan help gradients` 以显示可用的渐变.绘制多个系列时不起作用.
    --density-scale <scale>    对密度渐变应用缩放.可以是 "lin"、"pow"、"sqrt"、"pow(custom_exponent)"
                               (如"pow(4.5)")、"log"、"log2"、"log10" 或 "log(custom_base)"(如 "log(2.5)")之一.
                               [default: log]
    --color <when>             何时使用 ANSI 转义码为输出着色.使用 `auto` 进行自动检测,使用 `never` 完全禁用颜色,
                               使用 `always` 强制使用颜色,即使输出无法处理颜色.
                               [default: auto]
    -i, --ignore               忽略无法正确解析的值.
    --timezone <name>          用于离散化时间序列的时区,也用于格式化 x 轴刻度.仅当给定的值具有时区信息时才相关.默认为系统时区.
    -Q, --square               尝试使绘图区域尽可能呈方形以避免失真.
    --hide-legend              绘制多个系列时隐藏图例.
    --hide-x-axis              完全隐藏 x 轴和刻度.
    --hide-y-axis              完全隐藏 y 轴和刻度.
    --hide-all                 --hide-legend、--hide-x-axis、--hide-y-axis 的简写.

Common options:
    -h, --help             显示帮助
    -n, --no-headers       设置后,文件将被视为没有标题行.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符.[default: ,]
```
