<!-- Generated -->
# xan split

```txt
将给定的 CSV 数据拆分为具有固定行数的较小文件,该行数由 -S, --size 给出.

目标文件也可以拆分为给定数量的 -c/--chunks.

默认情况下,文件将写入当前工作目录,或写入 -O/--out-dir 给出的任何目录(必要时将为您创建).

Usage:
    xan split [options] [<input>]
    xan split --help

split options:
    -O, --out-dir <dir>        分块文件的写入目录.默认为当前工作目录.
    -S, --size <arg>           每个分块写入的记录数.[default: 4096]
    -c, --chunks <n>           将文件拆分为最多 <n> 个具有大致相同记录数的分块.目标文件必须可搜索
                               (例如,不支持 stdin 或 gzipped 文件).
    --segments                 与 -c/--chunks 一起使用时,输出找到的分段的字节偏移量.
    -f, --filename <filename>  用于构建输出文件名的文件名模板.字符串 '{}' 将被替换为
                               使用 -S/--size 时原始文件中第一行的索引,或使用 -c/--chunks 时的分块索引.
                               [default: {}.csv]

Common options:
    -h, --help             显示帮助
    -n, --no-headers       设置后,第一行将不会被解释为列名.否则,第一行将作为标题行出现在所有分块中.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
