<!-- Generated -->
# xan matrix

```txt
将 CSV 数据转换为矩阵数据.

支持的模式:
    adj   - 将源列和目标列转换为邻接矩阵.
    count - 将一对列转换为完整计数矩阵(二部邻接矩阵,或共现矩阵).
    corr  - 将选定列转换为完整相关矩阵.

请注意,`adj` 和 `count` 模式之间的区别在于 `count` 将其 `x` 和 `y` 标签视为两个独立的集合,
而 `adj` 将 `source` 和 `target` 标签视为同一集合的一部分.这也意味着 `adj` 生成方阵,而 `count` 生成矩形矩阵.

Usage:
    xan matrix adj [options] <source> <target> [<input>]
    xan matrix count [options] <x> <y> [<input>]
    xan matrix corr [options] [<input>]
    xan matrix --help

matrix adj/count options:
    -w, --weight <column>  可选列,包含边的权重.

matrix adj options:
    -U, --undirected  指示边是无向的,生成的矩阵应该是对称的.

matrix corr options:
    -s, --select <columns>  相关矩阵要考虑的列.
    -D, --fill-diagonal     是否用 1 填充对角线.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,文件将被视为没有标题行.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
