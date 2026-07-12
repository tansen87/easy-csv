<!-- Generated -->
# xan count

```txt
打印给定 CSV 数据中的记录数.

请注意,计数将不包括标题行(除非给出 --no-headers).

此命令默认使用非常高效的 CSV 解析器,甚至不需要查找单元格分隔符.这意味着它不会通过检查每一行是否具有相同数量的列
来验证给定的 CSV 流.您可以随时使用 -c/--check-alignment 标志强制命令使用效率较低但会执行检查的解析器.

您还可以使用 -p/--parallel 或 -t/--threads 标志并行计算文件中的记录数以加快速度.但这不适用于流或 gzipped 文件,
除非可以找到 `.gzi` 索引(由 `bgzip -i` 创建).

Usage:
    xan count [options] [<input>]

count options:
    -H, --human-readable     格式化计数以使其更易于阅读.
    -a, --approx             通过采样前几行来近似 CSV 文件行数.目标必须是可寻址的,这意味着不能在通过 stdin
                             馈送的流或 gzipped 数据上使用.
    -c, --check-alignment    使用较慢的解析器,验证给定 CSV 流生成的行具有相同数量的列.
    -p, --parallel           是否使用并行化来加速计数.将根据核心数自动选择合适的线程数.
                             如果要自己指定线程数,请使用 -t, --threads.
    -t, --threads <threads>  使用指定数量的线程进行并行计算.如果要自动选择线程数,请使用 -p, --parallel.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会包含在计数中.
    -d, --delimiter <arg>  读取CSV数据时的字段分隔符.必须是单个字符.
```
