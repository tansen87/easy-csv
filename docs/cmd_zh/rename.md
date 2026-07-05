<!-- Generated -->
# xan rename

```txt
重命名 CSV 文件的列.也可用于为无标题的 CSV 文件添加标题.新名称必须以 CSV 格式传递给列参数,
如果所需的列名包含实际的逗号和/或双引号,这可能很有用.

请注意,为了尽可能提高性能,此命令不会尝试智能处理,只解析第一行 CSV 行并将其删除.文件的其余部分将按原样刷新到输出,不进行任何规范化.

重命名所有列:

    $ xan rename NAME,SURNAME,AGE file.csv

重命名选定的列:

    $ xan rename NAME,SURNAME -s name,surname file.csv
    $ xan rename NAME,SURNAME -s '0-1' file.csv

为无标题文件添加标题:

    $ xan rename -n name,surname file.csv
    $ xan rename -n --prefix col_ file.csv
    $ xan rename -n --suffix _col file.csv

为列名添加前缀:

    $ xan rename --prefix university_ file.csv

包含需要转义字符的列名:

    $ xan rename 'NAME OF PERSON,"AGE, ""OF"" PERSON"' file.csv

Usage:
    xan rename [options] --replace <pattern> <replacement> [<input>]
    xan rename [options] --prefix <prefix> [<input>]
    xan rename [options] --suffix <suffix> [<input>]
    xan rename [options] --slugify [<input>]
    xan rename [options] <columns> [<input>]
    xan rename --help

rename options:
    -s, --select <arg>     选择要重命名的列.有关完整语法,请参阅 'xan select -h'.请注意,给定的选择不能包含同一列多次.
    -p, --prefix <prefix>  添加到所有列名的前缀.当与 -n/--no-headers 一起使用时,将使用基于 0 的列索引.
    -x, --suffix <suffix>  添加到所有列名的后缀.当与 -n/--no-headers 一起使用时,将使用基于 0 的列索引.
    -S, --slugify          转换列名,使其可以安全地用作标识符.通常会将空格和连字符替换为下划线,删除重音符号等.
    -R, --replace          在列名中用给定的替换项替换模式的匹配项.
    -f, --force            忽略要重命名的未知列.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会被视为表头.(即,它们不会被搜索、分析、切片等.)
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符.
```
