<!-- Generated -->
# xan help

```txt
打印有关 `xan` 表达式语言和其他各种内容的帮助.

`xan help cheatsheet` 将打印有关语言工作方式的简短备忘单.也可以在此处在线找到:
https://github.com/medialab/xan/blob/master/docs/moonblade/cheatsheet.md

`xan help functions` 将打印语言所有函数的参考(用于 `xan select -e`、`xan map`、`xan filter`、
`xan transform`、`xan flatmap` 等).
也可以在此处在线找到:
https://github.com/medialab/xan/blob/master/docs/moonblade/functions.md

`xan help aggs` 将打印语言所有聚合函数的参考(主要用于 `xan agg` 和 `xan groupby`).也可以在此处在线找到:
https://github.com/medialab/xan/blob/master/docs/moonblade/aggs.md

`xan help scraping` 将打印有关 `xan scrape` 使用的 DSL 和相关函数的信息.也可以在此处在线找到:
https://github.com/medialab/xan/blob/master/docs/moonblade/scraping.md

`xan help window` 将打印语言所有窗口聚合函数的参考(用于 `xan window`).也可以在此处在线找到:
https://github.com/medialab/xan/blob/master/docs/moonblade/window.md

`xan help gradients` 将打印 `xan heatmap` 或 `xan spark` 等可视化命令中使用的所有渐变的参考.

使用 -p/--pager 标志在合适的分页器中打开所需的文档.

使用 -O/--open 在线阅读所需的文档(可能略有过时！).

Usage:
    xan help cheatsheet [options]
    xan help functions [options]
    xan help aggs [options]
    xan help scraping [options]
    xan help window [options]
    xan help gradients [options]
    xan help --help

help options:
    -O, --open             在网页浏览器中打开所需的文档.
    -p, --pager            将帮助信息通过管道传输到分页器(相当于通过强制颜色管道传输到 `less -SRi`).
    -S, --section <query>  过滤 `functions` 文档,仅包含与给定不区分大小写查询匹配的部分.
    --json                 将帮助信息转储为 JSON 数据.
    --md                   将帮助信息转储为 Markdown.
    --color <when>         何时使用 ANSI 转义码为输出着色.使用 `auto` 进行自动检测,`never` 完全禁用颜色,`always`
                           强制使用颜色,即使输出无法处理.
                           [default: auto]

Common options:
    -h, --help             显示帮助
```
