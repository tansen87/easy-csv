<!-- Generated -->
# xan filter

```txt
filter 命令为给定 CSV 文件的每一行评估表达式,仅在前述表达式的结果为真时输出该行.

例如,给定以下 CSV 文件:

a
1
2
3

以下命令:

    $ xan filter 'a > 1'

将产生以下结果:

a
2
3

可以使用 -f/--evaluate-file 标志从文件中读取表达式:

    $ xan filter -f expr.moonblade file.csv > result.csv

要快速了解表达式语言的功能,请查看 `xan help cheatsheet` 命令.

要获取可用函数列表,请使用 `xan help functions`.

Usage:
    xan filter [options] <expression> [<input>]
    xan filter --help

filter options:
    -f, --evaluate-file       改为从文件读取计算表达式.
    -v, --invert-match        如果设置,将反转结果.
    -l, --limit <n>           要返回的最大行数.有时可以避免下游缓冲(例如,在管道连接到`view`或`flatten`之前,
                              在大文件中搜索很少的行时).
    -B, --before-context <n>  在匹配行之前要保留的行数.
    -A, --after-context <n>   匹配行后要保留的行数.
    -p, --parallel            是否使用并行化来加速计算.将根据您的内核数量自动选择合适数量的线程来使用.
    						  如果你想自己指示线程的数量,请使用-t,--threads.
    -t, --threads <threads>   使用这么多线程对计算进行重新排列.如果希望自动选择线程数,请使用-p,--parallel.

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而不是stdout.
    -n, --no-headers         设置后,第一行将不会被视为表头.
    -d, --delimiter <arg>    用于读取CSV数据的字段分隔符,必须是单个字符.
```
