<!-- Generated -->
# xan map

```txt
map 命令为给定 CSV 文件的每一行评估表达式,并输出相同的行,并添加包含前述表达式结果的列.

例如,给定以下 CSV 文件:

a,b
1,4
5,2

以下命令:

    $ xan map 'a + b as c' file.csv > result.csv

将产生以下结果:

a,b,c
1,4,5
5,2,7

您也可以一次创建多个列:

    $ xan map 'a + b as c, a * b as d' file.csv > result.csv

将产生以下结果:

a,b,c,d
1,4,5,4
5,2,7,10

表达式子句也可以一次返回多个项以避免重复计算,例如:

拆分全名:

    $ xan map 'full_name.split(" ") as (first_name, last_name)' file.csv > result.csv

从 JSON 单元格中提取数据:

    $ xan map 'data.parse_json() | [_.name, _.meta[2].age] as (name, age)' file.csv > result.csv

您还可以使用 -O/--overwrite 标志覆盖已存在的列:

    $ xan map -O 'b * 10 as b, a * b as c' file.csv > result.csv

将产生:

a,b,c
1,40,4
5,20,10

# 按列映射

有时您可能想以相同的方式为给定的列选择添加一列或多列.

您可以使用 -C/--along-columns <cols> 标志执行此操作.在这种情况下,`_` 占位符可用于表达式中以表示当前列.

例如,给定以下数据:

a,b
4,5
1,7

以下命令(注意我们可以如何模板化添加的列名):

    $ xan map -C a,b '_ + 10 as "{}_add", _ - 10 as "{}_sub"' file.csv

将产生以下内容:

a,a_add,a_sub,b,b_add,b_sub
4,14,-6,5,15,-5
1,11,-9,7,17,-3

这也可以与 -O/--overwrite 标志一起使用:

    $ xan map -OC a,b '_ + 10 as "{}_add", _ - 10 as "{}_sub"' file.csv

产生:

a_add,a_sub,b_add,b_sub
14,-6,15,-5
11,-9,17,-3

---

表达式可以使用 -f/--evaluate-file 标志从文件中读取:

    $ xan map -f expr.moonblade file.csv > result.csv

要快速了解表达式语言的功能,请查看 `xan help cheatsheet` 命令.

要获取可用函数列表,请使用 `xan help functions`.

---

其他技巧:

1. 复制列:

    $ xan map 'column_name as copy_name' file.csv > result.csv

2. 创建包含常量值的列:

    $ xan map '"john" as from' file.csv > result.csv

Usage:
    xan map [options] <expression> [<input>]
    xan map --help

map options:
    -f, --evaluate-file         从文件中读取求值表达式.
    -O, --overwrite             设置后,与文件中已存在列同名的表达式将被覆盖为
                                表达式的结果,而不是在末尾添加新列.这意味着您可以
                                同时转换和添加列.
    -F, --filter                如果给出,当所有求值表达式的结果为假值时,
                                不会将行写入输出.
    -C, --along-columns <cols>  对一组列重复相同的表达式.
    -p, --parallel              是否使用并行化来加速计算.将根据核心数自动选择
                                合适的线程数.如果要自己指定线程数,请使用 -t, --threads.
    -t, --threads <threads>     使用指定数量的线程进行并行计算.如果要自动选择线程数,
                                请使用 -p, --parallel.

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而非stdout.
    -n, --no-headers         设置后,第一行将不会被视为表头.
    -d, --delimiter <arg>    读取 CSV 数据时的字段分隔符.必须是单个字符.
```
