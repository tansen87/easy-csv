<!-- Generated -->
# xan dedup

```txt
对 CSV 文件的行进行去重.运行时间为 O(n),消耗 O(c) 内存,c 是不同行标识符的数量.

如果您的文件已经按去重选择排序,请使用 -S/--sorted 标志以 O(1) 内存运行.

请注意,默认情况下,此命令会将具有特定标识符的第一行写入输出,除非使用 -l/--keep-last.

该命令还可以仅使用 --keep-duplicates 写入重复行.

您还可以选择使用 -f/--flag <name> 添加一列来指示每行是否为重复项.您甚至可以将结果管道传输到
`xan partition` 以将文件拆分为去重后的文件和仅包含丢弃的重复项的文件:

    $ xan dedup -f duplicated file.csv | xan partition -s duplicated

最后,还可以通过评估表达式来指定要保留的行(有关表达式语言的文档,请参阅 `xan help cheatsheet` 和 `xan help functions`).

例如,如果您想按 `id` 列对事件 CSV 进行去重,但想保留 `count` 列中具有最大值的行,而不是找到的任何给定标识符的第一行:

    $ xan dedup -s id --choose 'new_count > current_count' events.csv > deduped.csv

请注意,当前保留的行的列名以 "current_" 为前缀,而新行的列名以 "new_" 为前缀.

请注意,如果您需要聚合重复行的单元格值,您可能应该查看 `xan groupby`,它可用于此目的,特别是使用 --keep 标志.

Usage:
    xan dedup [options] [<input>]
    xan dedup --help

dedup options:
    --check                验证选定项是否有重复,即选定的列是否满足唯一性约束.
    -s, --select <arg>     选择要对其进行去重的列子集.有关格式详细信息,请参阅 'xan select --help'.
    -S, --sorted           如果您知道文件已经按去重选择排序,请使用此选项以避免需要在内存中保留哈希映射.
    -l, --keep-last        保留具有特定标识的最后一行,而不是第一行.请注意,这将消耗更多内存,并且如果未使用
                           -S/--sorted,在读取整个文件之前不会刷新任何行.
    -e, --external         使用外部 btree 索引将索引保留在磁盘上以避免内存溢出.不能与 -l/--keep-last 和
                           -k/--keep-duplicates 一起使用.
    -k, --keep-duplicates  仅输出重复行.
    -C, --choose <expr>    评估必须返回是否保留新看到的行的表达式.给定表达式中的列名将为当前保留的行添加
                           "current_" 前缀,为要考虑的新行添加 "new_" 前缀.
    -f, --flag <name>      不是过滤重复行,而是添加一个具有给定 <name> 的列,指示行是否重复.当使用 -l/--keep-last
                           或 -C/--choose 时,文件顺序可能会被修改以保持适当的性能.
    --u32                  指示去重键是 32 位无符号整数.这对于节省内存和提高性能非常有用.这只能在选择最多两列时使用.
                           仅适用于命令的默认操作.

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而非stdout.
    -n, --no-headers         设置后,第一行将不会被视为表头.
    -d, --delimiter <arg>    读取 CSV 数据时的字段分隔符.必须是单个字符.
```
