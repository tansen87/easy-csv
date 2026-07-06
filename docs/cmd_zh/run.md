<!-- Generated -->
# xan run

```txt
运行给定的 xan 管道或执行 xan 脚本.

示例:

    $ xan run 'search -s category tape | count' data.csv

# 脚本文件

此命令还能够运行写在文件中的脚本,如下所示:

*script.xan*

```
# 这可以包含注释
search -s Category -e Tape |
count
```

    $ xan run -f script.xan data.csv

此脚本也可以使用通常的 "-" 代替从 stdin 喂入,在这种情况下,您可以放弃通过 stdin 为命令提供输入数据的可能性:

    $ echo 'search -r john | count' | xan run -f - data.csv

这些脚本的语法可以被认为是 POSIX shell,它将首先通过将 CRLF 换行符规范化为 LF 来解析,然后使用 `shlex`.

您可以以 `#` 开头的注释.您不需要 `\` 来在新行上继续编写管道.

您可以在命令之前省略 `xan`(或者您也可以保留它,这无关紧要).

请注意,为确保您的脚本在不同操作系统之间兼容,您应该在路径中使用 `/`(正斜杠),
因为大多数现代 Windows shell 知道如何处理路径中的正斜杠和反斜杠,并且此命令不会对路径进行任何规范化.

# 关于输入

如果您不给此命令提供 <input> 路径,给定管道的第一个命令将被提供与 `xan run` 调用相同的 stdin.

这最终意味着您可以根据需要在脚本中硬编码管道第一个命令的输入路径.

如果您确实提供了 <input> 路径,它将作为最后一个参数转发给管道的第一个命令.

Usage:
    xan run [options] <pipeline> [<input>]
    xan run --help

run options:
    -f, --file  改为从脚本文件运行 <pipeline>.
    -T, --tee   在给定管道的每个步骤之间穿插调用 `xan view -T`,从而打印每个传递步骤的简短视图.
                不适用于非 CSV 输入,也不适用于管道第一个命令中的硬编码路径.

Common options:
    -h, --help             显示帮助
```
