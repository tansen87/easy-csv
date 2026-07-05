<!-- Generated -->
# xan transform

```txt
transform 命令可用于使用自定义表达式编辑 CSV 文件每一行的选定列.

例如,给定以下 CSV 文件:

name,surname
john,davis
mary,sue

以下命令(注意 `_` 如何用作当前编辑列的引用):

    $ xan transform surname 'upper(_)'

将产生以下结果:

name,surname
john,DAVIS
mary,SUE

以上示例适用于单列,但该命令完全能够一次转换多个列:

    $ xan transform name,surname,fullname 'upper(_)'

可以使用 -f/--evaluate-file 标志从文件中读取表达式:

    $ xan transform name -f expr.moonblade file.csv > result.csv

要快速了解表达式语言的功能,请查看 `xan help cheatsheet` 命令.

要获取可用函数列表,请使用 `xan help functions`.

Usage:
    xan transform [options] <column> <expression> [<input>]
    xan transform --help

transform options:
    -f, --evaluate-file        从文件中读取求值表达式
    -r, --rename <name>        转换后列的新名称
    -p, --parallel             是否使用并行化来加速计算
                               将根据核心数自动选择合适的线程数
                               如需手动指定线程数,请使用 -t, --threads
    -t, --threads <threads>    使用指定数量的线程进行并行计算
                               如需自动选择线程数,请使用 -p, --parallel

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而非stdout
    -n, --no-headers         设置后,第一行将不会被视为表头
    -d, --delimiter <arg>    读取 CSV 数据时的字段分隔符,必须是单个字符
```
