<!-- Generated -->
# xan sort

```txt
对 CSV 数据进行排序,按升序字典顺序.

要按降序排序,请使用 -R, --reverse 标志.

如果需要数值顺序,请使用 -N, --numeric 标志.

这需要将所有数据读入内存,除非使用 -e/--external 标志,这将较慢并回退到使用磁盘空间.

Usage:
    xan sort [options] [<input>]

sort options:
    --check                   验证文件是否已经排序.
    -s, --select <arg>        选择要排序的列子集.有关格式详情,请参阅 'xan select --help'.
    -N, --numeric             根据单元格的数值而非默认的字典顺序进行比较.
    -R, --reverse             反转排序顺序,即降序排列.
    -c, --count <name>        行连续重复的次数.需要列名.只能与 --uniq 一起使用.
    -u, --uniq                设置后,连续相同的行将被丢弃,每个排序值只保留一行.
    -p, --parallel            是否使用并行化来提高性能.
    -e, --external            当无法将整个文件放入内存时,是否使用外部排序.
    --tmp-dir <arg>           外部排序分块的写入目录.默认为 "/tmp" 或等效目录.
    -m, --memory-limit <arg>  使用外部排序时允许的最大内存,单位为兆字节.[default: 512].
    -z, --compress            使用 -e/--external 时,压缩磁盘上的临时分块.当输入非常大时很有用,但会减慢处理速度.
    --columns                 按名称字母顺序排序选定的列.以常量内存运行,支持流式处理.
    --cells                   排序选定的单元格值而非文件本身,不重新排列列.以常量内存运行,
                              支持流式处理,可用于确保边列表始终具有一致顺序的 source & target 键.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会被视为表头.也就是说,它将与其余行一起排序.
                           否则,第一行将始终作为标题行出现在输出中.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
