<!-- Generated -->
# xan bisect

```txt
对已排序的 CSV 数据执行二分查找.

此命令比使用 `xan filter` 或 `xan search` 快一个数量级,但仅在目标文件按搜索列排序、存在于磁盘上且未压缩时有效
(除非压缩文件保持可搜索性,通常可以在旁边找到 `.gzi` 索引).

如果 CSV 数据未正确排序,结果将不正确！

默认情况下,此命令执行所谓的"下界"操作:它会定位到文件中插入搜索值的位置,然后从此点开始刷新文件.
当管道传输到其他命令以执行范围查询时,这可能很有用,例如,或枚举以某些前缀开头的值.

如果只想返回与查询完全匹配的行,请使用 -S/--search 标志.

最后,如果数据按降序排序,请使用 -R/--reverse 标志；如果数据按数字排序而非字典顺序排序,请使用 -N/--numeric 标志.

示例:

在 "name" 列中搜索与 "Anna" 完全匹配的行:

    $ xan bisect -S name Anna people.csv

查找所有以字母 A 开头的名称:

    $ xan bisect name A people.csv | xan slice -E '!name.startswith("A")'

Usage:
    xan bisect [options] [--] <column> <value> <input>
    xan bisect --help

bisect options:
    -S, --search   执行精确搜索,仅输出与查询匹配的行,而不是从找到的位置刷新所有行.
    -R, --reverse  指示文件按 <column> 降序排序,而非默认的升序排序.
    -N, --numeric  指示搜索值是数字,文件顺序是数字顺序而非默认的字典顺序.
    -E, --exclude  设置后,与查询完全匹配的行将被过滤掉.它等同于执行"上界"操作,但在包含许多搜索值行的情况下不保证相同的性能.
                   不能与 -S/--search 一起使用.
    -v, --verbose  在 stderr 中打印一些详细说明搜索过程的日志,主要用于调试目的.

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而非stdout.
    -n, --no-headers         设置后,第一行将不会被视为表头.
    -d, --delimiter <arg>    读取CSV数据时的字段分隔符.必须是单个字符.
```
