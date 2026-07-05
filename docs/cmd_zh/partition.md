<!-- Generated -->
# xan partition

```txt
根据列的值将给定的 CSV 数据分区为块.

文件将写入输出目录,文件名基于分区列中的值和 `--filename` 标志.

默认情况下,此命令将假定它在不区分大小写的文件系统上工作(例如在 macOS 上).这可能会影响创建的文件的名称.如果您事先知道文件系统区分大小写,
并且希望文件名与原始值更好地对齐,请使用 -C/--case-sensitive 标志.

请注意,大多数操作系统避免一次打开超过 1024 个文件,因此如果您知道分区列的基数非常高,请先按此列对文件排序并使用 -S/--sorted 标志.

Usage:
    xan partition [options] <column> [<input>]
    xan partition --help

partition options:
    -O, --out-dir <dir>        写入分块的目录.默认为当前工作目录.
    -f, --filename <filename>  构造输出文件名时使用的文件名模板.字符串 '{}' 将被基于字段值的值替换,但会为 shell 安全进行清理.
                               [default: {}.csv]
    -p, --prefix-length <n>    在创建输出文件时,在指定字节数后截断分区列.
    -S, --sorted               如果您事先知道文件已按分区列排序,请使用此标志,这样命令可以运行得更快,并且使用更少的内存和资源.
    --drop                     从结果中删除分区列.
    -C, --case-sensitive       在看到新值时不要执行大小写规范化来评估是否需要创建新文件.
                               仅在区分大小写的文件系统上使用,否则可能会产生不良影响！

Common options:
    -h, --help             显示帮助
    -n, --no-headers       设置后,第一行将不会被视为表头.否则,第一行将作为标题行出现在所有分块中.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符.
```
