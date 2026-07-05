<!-- Generated -->
# xan shuffle

```txt
打乱给定 CSV 文件的行.这需要将整个文件加载到内存中.如果内存不足且目标文件可搜索(不是 stdin,也不是未索引的压缩文件),
您也可以使用 -e/--external 标志,它只需要与文件行数成比例的内存.

Usage:
    xan shuffle [options] [<input>]
    xan shuffle --help

shuffle options:
    --seed <number>  随机数生成器种子.
    -e, --external   无需将文件缓冲到内存中即可打乱文件.仅在目标可搜索时有效(不支持 stdin 等).

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会包含在计数中.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
