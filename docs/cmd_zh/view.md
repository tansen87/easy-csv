<!-- Generated -->
# xan view

```txt
在终端中以人类友好的方式预览 CSV 数据,具有对齐的列、闪亮的颜色等.

该命令默认将尝试显示尽可能多的列,但将截断单元格/列以避免溢出可用的终端屏幕.

如果您想使用分页器显示所有列,建议使用 -p/--pager 标志,它内部依赖于无处不在的 "less" 命令.

如果您仍然想手动使用分页器,请不要忘记在管道传输之前使用 -e/--expand 和 --color=always 标志,如下所示:

    $ xan view -e --color=always file.csv | less -SR

最后,可以通过 "XAN_VIEW_ARGS" 环境变量自定义此命令的默认行为.
此变量接受一系列支持的标志:
-t/--theme、-p/--pager、-l/--limit、-R/--rainbow、-E/--sanitize-emojis、
和 -S/--significance、-I/--hide-index、--color、--repeat-headers、
--reveal-whitespace 和 -M/--hide-info.

要使用 `borderless` 主题,隐藏索引列并限制默认显示的浮点小数位数,以下是通过 "XAN_VIEW_ARGS" 变量完成的方法:

    $ XAN_VIEW_ARGS="-t borderless -S 5 -I"

Usage:
    xan view [options] [<input>]
    xan v [options] [<input>]
    xan view --help

view options:
    -s, --select <arg>          选择要可视化的列.详见 'xan select -h' 了解完整语法
    -t, --theme <name>          表格显示的主题,可选值:"table"、"borderless"、
                                "compact"、"rounded"、"slim" 或 "striped"
                                [默认值:table]
    --name <name>               查看表的名称.默认为文件路径(如果有),
                                查看标准输入时为 "<stdin>"
    -p, --pager                 自动使用 "less" 命令对结果进行分页
                                此标志在 Windows 上不工作
    -A, --all                   移除行限制并显示所有内容
    -l, --limit <number>        读取到内存中的最大行数.使用 -A, --all 或
                                设置为 0 以禁用限制.默认为 100 行,
                                设置 -T/--tee 时为 5 行
    -R, --rainbow               列使用交替颜色,而非按值类型着色
    --cols <num>                图表的终端列宽,即字符数
                                默认使用终端的全部宽度,如果无法找到终端大小
                                (如管道输出到文件时)则为 80
                                也可以作为终端宽度的比例或百分比给出
                                例如 "45%" 或 "0.5"
    --color <when>              何时使用 ANSI 转义码为输出着色
                                使用 `auto` 自动检测,`never` 完全禁用颜色
                                `always` 强制着色,即使输出无法处理颜色
                                [默认值:auto]
    -e, --expand                展开表格以便于管道传输到 "less" 等分页器,
                                具有更大的宽度约束
    -E, --sanitize-emojis       用短代码替换表情符号以避免格式问题
    -S, --significance <n>      用于格式化数字的最大浮点精度
    -I, --hide-index            隐藏左侧的行索引
    -H, --hide-headers          隐藏标题.设置 -n, --no-headers 时隐含此选项
    -M, --hide-info             隐藏关于显示列数、行数等的信息
    -g, --groupby <cols>        隔离并强调行组,由选定列中具有相同连续值的行表示
    -r, --right <col>           强制选定列右对齐
    --repeat-headers <when>     何时在打印表格底部重复标题
                                默认情况下,当终端太短无法显示完整数据时会重复标题,
                                这意味着您需要向上滚动才能看到标题
                                使用 `auto` 自动检测,`never` 或 `always`
                                [默认值:auto]
    --reveal-whitespace <when>  何时使用中间点揭示前导/尾随空白并高亮显示
                                回车、制表符、换行符等.默认情况下,输出启用颜色时
                                会揭示这些内容.使用 `auto` 自动检测,`never` 或 `always`
                                [默认值:auto]
    -T, --tee                   使用时,将表格打印到标准错误并转发给定流
                                到标准输出.在管道中打印中间表格非常有用
                                默认 --limit 设置为 5,隐含 --color=always
                                和 --repeat-headers=never.与 -p/--pager 不兼容

Common options:
    -h, --help             显示帮助
    -n, --no-headers       设置后,第一行将不会被视为文件标题
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符
```
