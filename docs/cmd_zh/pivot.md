<!-- Generated -->
# xan pivot

```txt
通过允许一列的不同值分隔到各自的列中来透视 CSV 文件.

例如,给定以下数据:

country,name,year,population
NL,Amsterdam,2000,1005
NL,Amsterdam,2010,1065
NL,Amsterdam,2020,1158
US,Seattle,2000,564
US,Seattle,2010,608
US,Seattle,2020,738
US,New York City,2000,8015
US,New York City,2010,8175
US,New York City,2020,8772

以下命令:

    $ xan pivot year 'first(population)' file.csv

将产生以下结果:

country,name,2000,2010,2020
NL,Amsterdam,1005,1065,1158
US,Seattle,564,608,738
US,New York City,8015,8175,8772

默认情况下,行将使用除透视列之外的所有列以及聚合子句中不存在的列进行分组和聚合.如果您想以不同方式对行进行分组,
可以使用 -g/--groupby 标志,这样以下命令:

    $ xan pivot year 'sum(population)' -g country file.csv

将产生:

country,2000,2010,2020
NL,1005,1065,1158
US,564,608,738

该命令也可以在没有 <column> 或 <expr> 的情况下调用,作为便捷简写,它们将分别代表 "name" 和 "first(value)",
因此您可以轻松地在 `xan unpivot` 下游调用 `xan pivot`:

    $ xan unpivot january: monthly.csv | <processing> | xan pivot

Usage:
    xan pivot [-P...] [options] <columns> <expr> [<input>]
    xan pivot-wider [-P...] [options] <columns> <expr> [<input>]
    xan pivot [-P...] [options] [<input>]
    xan pivot-wider [-P...] [options] [<input>]
    xan pivot --help
    xan pivot-wider --help

pivot options:
    -g, --groupby <columns>  按给定的列选择对结果进行分组,而不是按未用于透视且不在聚合中的列进行分组.
    --column-sep <sep>       在多列透视时用于连接列名的分隔符.[default: _]

pivotal options:
    -P  至少使用三次以获得朋友的帮助！

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而非stdout.
    -n, --no-headers         设置后,第一行将不会被视为表头.
    -d, --delimiter <arg>    读取 CSV 数据时的字段分隔符,必须是单个字符.
```
