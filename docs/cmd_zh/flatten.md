<!-- Generated -->
# xan flatten

```txt
打印展平的记录,使字段按行分隔显示.此模式对于一次查看一条记录特别有用.

还有一个紧凑视图(-c 或 --condense),它将缩短每个字段的内容以提供摘要视图.

如果需要分页显示结果,请管道传输到 "less -r",并使用 --color=always 以保留颜色:

    $ xan flatten --color=always file.csv | less -Sr

Usage:
    xan flatten [options] [<input>]
    xan f [options] [<input>]

flatten options:
    -s, --select <arg>     选择要可视化的列.有关完整语法,请参阅 'xan select -h'.
    -l, --limit <n>        要读取的最大行数.默认为读取整个文件.
    -c, --condense         不将单元格值换行,而是用省略号截断它们.
    -w, --wrap             在考虑标题缩进的同时换行单元格值.
    -F, --flatter          更扁平的表示,在输出中交替列名和内容.用于显示包含大量文本的单元格.
    --row-separator <sep>  使用给定字符串分隔输出中的行,而不是显示带有行索引的标题.如果给出空字符串,
            例如 --row-separator '',则不会分隔行.
    --csv                  将结果写为具有 row,field,value 列的 CSV 文件.可被视为整个文件的逆透视.
    --cols <num>           图形的终端列宽,即字符数.默认使用终端的全部宽度,如果找不到终端大小(例如管道传输到文件时),
                           则为 80.也可以作为终端宽度的比例或百分比给出,例如 "45%" 或 "0.5".
    -R, --rainbow          单元格交替颜色,而不是按值类型着色.
    --color <when>         何时使用 ANSI 转义码为输出着色.使用 `auto` 进行自动检测,`never` 完全禁用颜色,`always` 强制着色,
                           即使输出无法处理它们.
                           [default: auto]
    -S, --split <cols>     拆分包含多个值的列(由 --sep 分隔),以列表形式显示.
    --sep <sep>            由 -S/--split 拆分的单元格中分隔多个值的分隔符.[default: |]
    -H, --highlight <pat>  以红色突出显示与给定正则表达式模式匹配的文本单元格部分.不能与 -R/--rainbow 一起使用.
    -i, --ignore-case      如果给出,给定 -H/--highlight 的模式将不区分大小写.
    -N, --non-empty        对于每行,仅显示非空值.当数据稀疏时,这可能很有用.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.仅在设置 --csv 时使用.
    -n, --no-headers       设置后,第一行将不会被解释为标题.设置后,每个字段的名称将是其索引.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
