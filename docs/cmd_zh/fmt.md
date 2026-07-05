<!-- Generated -->
# xan fmt

```txt
使用自定义分隔符或 CRLF 行尾格式化 CSV 数据.

通常,xan 中的所有命令都以默认格式输出 CSV 数据,这与读取 CSV 数据的默认格式相同.这使得可以轻松地将多个 xan 命令管道连接在一起.
但是,您可能希望最终结果具有特定的分隔符或记录分隔符,这就是 'xan fmt' 的用处.

Usage:
    xan fmt [options] [<input>]

fmt options:
    -i, --in-place             将结果写入临时文件,完成后用其替换输入文件.
    -t, --out-delimiter <arg>  写入 CSV 数据时的字段分隔符.
                               [default: ,]
    --crlf                     在输出中使用 '\r\n' 行尾.
    --ascii                    使用 ASCII 字段和记录分隔符.
    --tabs                     -t '\t' 的简写.
    --quote <arg>              要使用的引号字符.[default: "]
    --quote-always             在每个值周围加引号.
    --quote-never              永远不在值周围加引号,即使这会产生无效的 CSV 数据.
    --escape <arg>             要使用的转义字符.未指定时,引号通过加倍来转义.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
