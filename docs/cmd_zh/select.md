<!-- Generated -->
# xan select

```txt
使用简写符号或通过对每行求值表达式(使用 -e/--evaluate 或 -f/--evaluate-file 标志)
从 CSV 数据中选择列.

此命令允许您操作 CSV 数据的列.您可以重新排列、复制、转换甚至删除它们.

# 简写符号

列可以使用从零开始的索引、从末尾开始的负索引、名称(如果文件有标题行)或名称和第 n 个来引用,
这样您可以轻松选择具有重复名称的列.

您还可以使用列名中的 `*` 按前缀或后缀选择列.

最后,也可以使用 `:` 字符选择列范围.请注意,列范围始终包含两端.

示例:

  选择第一列和第四列:
    $ xan select 0,3

  使用负索引选择最后一列(注意 `--` 以避免以连字符开头的参数引起的 shell 问题):
    $ xan select -- -1

  选择第一列和倒数第二列:
    $ xan select 0,-2

  选择前 4 列(按索引或按名称):
    $ xan select 0:3
    $ xan select Header1:Header4

  忽略前 2 列(按范围和排除):
    $ xan select 2:
    $ xan select '!0:1'(使用单引号以避免 shell 问题！)

  在范围中使用负索引:
    $ xan select 3:-2(第四列到倒数第二列)
    $ xan select -- -3:(最后三列)
    $ xan select :-3(直到倒数第三列)

  选择第三个名为 'Foo' 的列(这也适用于范围):
    $ xan select 'Foo[2]'
    $ xan select ':Foo[2]'

  选择最后一个名为 'Foo' 的列:
    $ xan select 'Foo[-1]'

  选择包含空格的列名:
    $ xan select "Revenues in millions"
    $ xan select Revenues\ in\ millions
    $ xan select 1,"Revenues in millions",year

  任意重新排列和复制列:
    $ xan select 3:1,Header3:Header1,Header1,Foo[2],Header1

  对与选择器语法冲突的列名加引号(注意双引号,有问题的字符是 `*`、`:`、`!`、`[` 和 `]`):
    $ xan select '"Start:datetime","Count:int"'

  选择所有列,这对于添加列的副本很有用(注意使用单引号以避免 shell 通配):
    $ xan select '*'
    $ xan select '*,name'
    $ xan select '*,1'
    $ xan select '0:'
    $ xan select ':0'

  使用 "*" 字符的通配符选择(在模式中只能出现一次):

  选择所有以 "dim_" 开头的列(再次注意单引号):
    $ xan select 'dim_*'

  选择所有以 "_count" 结尾的列:
    $ xan select '*_count'

  选择所有以 "vec_" 开头且以 "_count" 结尾的列:
    $ xan select 'vec_*_count'

  选择所有重复列名的第二个出现:
    $ xan select '*[1]'
    $ xan select 'vec_*[1]'
    $ xan select '*_dim[1]'
    $ xan select 'vec_*_count[1]'

# 求值表达式

使用与 `map`、`agg`、`filter` 等命令相同的 SQL 风格语法,您可以处理行并执行自定义选择.

  $ xan select -e 'id, name as surname, count1 + count2 as total'

表达式子句也可以一次返回多个项目以避免重复计算,例如:

拆分全名:

  $ xan select -e 'full_name.split(" ") as (first_name, last_name)' file.csv > result.csv

从 JSON 单元格中提取数据:

  $ xan select -e 'data.parse_json() | [_.name, _.meta[2].age] as (name, age)' file.csv > result.csv

如果表达式变得太复杂,您可以将其写入文件并使用 -f/--evaluate-file 标志:

  $ xan select -f selection.moonblade

要快速了解表达式语言的功能,请查看 `xan help cheatsheet` 命令.

要获取可用函数列表,请使用 `xan help functions`.

Usage:
    xan select [options] [--] <selection> [<input>]
    xan select --help

select options:
    -e, --evaluate       切换到表达式求值模式,而非使用简写选择符号.
    -f, --evaluate-file  从文件中读取求值表达式.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会被视为表头.(即,它们不会被搜索、分析、切片等.)
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
