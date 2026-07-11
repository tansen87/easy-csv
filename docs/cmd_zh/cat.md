<!-- Generated -->
# xan cat

```txt
按列或按行连接 CSV 数据.

按列连接时,列将按给定输入的相同顺序写入.结果中的行数始终等于所有给定 CSV 数据中的最小行数.
(可以使用 `--pad` 标志反转此行为.)

按行连接时,所有 CSV 数据必须具有相同的列数.如果需要重新排列列或修复记录长度,请使用 `select` 或 `fixlengths` 命令.
此外,仅使用*第一个*给定 CSV 数据的标题.后续输入中的标题将被忽略.(可以使用 --no-headers 禁用此行为.)

此外,您可以使用 -I/--intersection 或 -U/--union 重新排列列并填充行.这在处理具有相似但不完全相同模式的多个文件时很有用.

当连接的 CSV 文件数量超过 shell 的命令参数限制时,建议使用 --paths 标志从输入行或包含路径的 CSV 文件中读取要连接的 CSV 文件列表.

喂入 --paths 行:

    $ xan cat rows --paths paths.txt > concatenated.csv

喂入 --paths CSV 文件:

    $ xan cat rows --paths files.csv --path-column path > concatenated.csv

将 stdin ("-") 喂入 --paths:

    $ find . -name '*.csv' | xan cat rows --paths - > concatenated.csv

将 CSV 作为 stdin ("-") 喂入 --paths:

    $ cat filelist.csv | xan cat rows --paths - --path-column path > concatenated.csv

您还可以使用 --glob 标志为命令提供 glob 模式(例如,如果您的 shell 不支持该模式或文件数量超过参数限制):

    $ xan cat rows --glob '*.csv' > concatenated.csv

Usage:
    xan cat rows [options] [<inputs>...]
    xan cat (cols|columns) [options] [<inputs>...]
    xan cat --help

cat cols/columns options:
    -p, --pad                   连接列时,此标志将导致所有记录出现.如果其他 CSV 数据不够长,它将填充每一行.

cat rows options:
    -I, --intersection           计算所有连接文件标题的交集,并相应地重新排列连接文件的列.
                                 与 -U/--union、预处理和 -n/--no-headers 不兼容.
    -U, --union                  计算所有连接文件标题的并集,并相应地重新排列连接文件的列.
                                 与 -I/--intersection、预处理和 -n/--no-headers 不兼容.
    --paths <input>              连接行时,提供一个文本文件(使用 "-" 表示标准输入),其中每行包含一个要连接的 CSV 文件路径.
    --path-column <name>         给定列名时,--paths 将被视为 CSV,要连接的 CSV 文件路径将从选定列中提取.
    --glob <pattern>             使用给定的 glob <pattern> 收集要连接的文件.
    -S, --source-column <name>   在 "cat rows" 输出中添加的列名,指示源文件的路径.
    -P, --preprocess <op>        仅使用 `xan` 子命令进行预处理.
                                 有关预处理的更多信息,请参阅 `xan parallel -h`.
    --run <path>                 在给定 <path> 运行 xan 脚本作为预处理.
                                 有关更多信息,请参阅 `xan run -h`.
    -H, --shell-preprocess <op>  直接在您自己的 shell 中使用 -c 标志运行的预处理命令.
                                 有关预处理的更多信息,请参阅 `xan parallel -h`.
    --raw                        尽可能快地连接文件,同时跳过后续文件的标题.这样做时不会规范化 CSV 流,也不会验证列对齐.
                                 仅用于性能,如果您知道自己在做什么.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会被设置为表头.请注意,连接列时此设置无效.
    -d, --delimiter <arg>  读取CSV数据时的字段分隔符.必须是单个字符.
```
