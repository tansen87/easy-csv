<!-- Generated -->
# xan merge

```txt
合并多个已按相同方式排序的 CSV 文件.这些文件必须:

1. 具有相同顺序的相同列.
2. 具有相同的行顺序,关于 -s/--select、-R/--reverse 和 -N/--numeric

如果不满足这些条件,结果将是任意顺序.

此命令消耗与每个文件一行 CSV 成比例的内存.

当合并的 CSV 文件数量超过 shell 的命令参数限制时,建议使用 --paths 标志从输入行或包含路径的 CSV 文件中读取要合并的 CSV 文件列表.

请注意,所有文件将需要同时打开,因此您可能会达到操作系统最大打开文件数.

喂入 --paths 行:

    $ xan merge --paths paths.txt > merged.csv

喂入 --paths CSV 文件:

    $ xan merge --paths files.csv --path-column path > merged.csv

将 stdin ("-") 喂入 --paths:

    $ find . -name '*.csv' | xan merge --paths - > merged.csv

将 CSV 作为 stdin ("-") 喂入 --paths:

    $ cat filelist.csv | xan merge --paths - --path-column path > merged.csv

您还可以使用 --glob 标志为命令提供 glob 模式(例如,如果您的 shell 不支持该模式或文件数量超过参数限制):

    $ xan merge --glob '*.csv' > merged.csv

Usage:
    xan merge [options] [<inputs>...]
    xan merge --help

merge options:
    -s, --select <arg>          选择要排序的列子集.有关格式详情,请参见 'xan select --help'.
    -N, --numeric               根据字符串数值进行比较
    -R, --reverse               反转顺序
    -u, --uniq                  设置后,将删除相同的连续行,每个排序值只保留一行.
    -S, --source-column <name>  要在命令输出中前置的列名,指示源文件的路径.
    --paths <input>             提供一个文本文件(使用 "-" 表示 stdin),每行包含一个
                                要连接的 CSV 文件路径,而不是通过命令参数提供路径.
    --path-column <name>        当给出列名时,--paths 将被视为 CSV,并从选定列中
                                提取要合并的 CSV 文件路径.
    --glob <pattern>            使用给定的 glob <pattern> 收集要合并的文件.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会被视为列名.请注意,连接列时
                           此选项无效.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
