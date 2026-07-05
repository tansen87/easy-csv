<!-- Generated -->
# xan drop

```txt
使用与 "xan select" 相同的 DSL 删除 CSV 文件的列.

基本上是 "xan select" 的反向选择的简写.

Usage:
    xan drop [options] [--] <selection> [<input>]
    xan drop --help

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入 <file> 而非stdout.
    -n, --no-headers       设置后,第一行将不会被解释为标题.(即不被搜索、分析、切片等)
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
