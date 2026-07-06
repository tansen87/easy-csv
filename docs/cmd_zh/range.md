<!-- Generated -->
# xan range

```txt
创建一个包含表示数值范围的单列的 CSV 文件.
当管道传输到 `map`、`transform` 或 `select -e` 命令以轻松从头生成 CSV 文件时,这主要很有用.

默认情况下,输出列将命名为 "n",但可以使用 -c, --column-name 标志重命名.

请注意,与大多数编程语言一样,范围的末尾是排他的,但可以使用 -i, --inclusive 包含.

示例:

    通过将 `range` 管道传输到 `transform` 来创建 URL 文件范围:
        $ xan range 100 | xan select -e '"somewebsite.com?id=" ++ n as url'

Usage:
    xan range [options] <end> [<input>]
    xan range --help

range options:
    -s, --start <n>           范围的起始值.[default: 0]
    --step <n>                范围的步长.[default: 1]
    -c, --column-name <name>  包含范围的列的名称.[default: n]
    -i, --inclusive           包含结束边界.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
```
