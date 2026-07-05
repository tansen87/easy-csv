<!-- Generated -->
# xan search

```txt
在 CSV 数据中搜索(或替换)模式.

此命令有多个标志来选择执行匹配的方式:

    *(默认):匹配子字符串(例如 "john" in "My name is john")
    * -e, --exact:精确匹配
    * -r, --regex:使用正则表达式
    * -u, --url-prefix:按 url 前缀匹配(例如 "lemonde.fr/business")
    * -L, --levenshtein <k>:使用 Levenshtein 距离匹配
    * -D, --damerau-levenshtein <k>:使用 Damerau-Levenshtein 距离匹配
    * -N, --non-empty:查找非空单元格(不需要模式)
    * -E, --empty:查找空单元格(不需要模式)

搜索任何列包含 "john" 的行:

    $ xan search "john" file.csv > matches.csv

搜索任何列*恰好*具有值 "john" 的行:

    $ xan search -e "john" file.csv > matches.csv

仅保留选择不完全为空的行:

    $ xan search -s user_id --non-empty file.csv > users-with-id.csv

仅保留选择有任何空列的行:

    $ xan search -s user_id --empty file.csv > users-without-id.csv

使用正则表达式时,请注意 bash 转义规则(在表达式周围使用单引号,需要时不要忘记使用反斜杠):

    $ xan search -r '\bfran[cç]' file.csv

要限制将被搜索的列,可以使用 -s, --select 标志.

所有搜索模式(除了 -u/--url-prefix)也可以使用 -i, --ignore-case 进行不区分大小写的搜索.

# 一次搜索多个模式

此命令还能够一次搜索多个模式.为此,您可以使用 -P, --add-pattern 标志或将包含每行一个模式的文本文件喂入 --patterns 标志.
您还可以将 CSV 文件喂入 --patterns 标志,在这种情况下,您需要使用 --pattern-column 标志指示包含模式的列.

提供附加模式:

    $ xan search disc -P tape -P vinyl file.csv > matches.csv

文本文件每行一个模式:

    $ xan search --patterns patterns.txt file.csv > matches.csv

包含模式的 CSV 列:

    $ xan search --patterns people.csv --pattern-column name tweets.csv > matches.csv

通过 stdin 喂入模式(使用 "-"):

    $ cat patterns.txt | xan search --patterns - file.csv > matches.csv

通过 stdin 将 CSV 列作为模式喂入(使用 "-"):

    $ xan slice -l 10 people.csv | xan search --patterns - --pattern-column name file.csv > matches.csv

# 不仅仅是过滤

现在此命令还能够执行搜索相关操作:

    - 使用 -R/--replace 或 --replacement-column 替换匹配项
    - 使用 -f/--flag 在新列中报告是否找到匹配项
    - 使用 -c/--count 在新列中报告匹配总数
    - 使用 -b/--breakdown 报告通过 --patterns 给出的每个查询的匹配数细分
    - 使用 -U/--unique-matches 报告通过 --patterns 给出的多个查询的唯一匹配项

例如:

报告是否找到匹配项(而不是过滤):

    $ xan search -s headline -i france -f france_match file.csv

报告匹配数:

    $ xan search -s headline -i france -c france_count file.csv

从数值列中清除千位分隔符(通常是英文中的逗号 ","):

    $ xan search , --replace . -s 'count_*' file.csv

将颜色名称替换为对应的法语:

    $ echo 'english,french\nred,rouge\ngreen,vert' | \
    $ xan search -e \
    $   --patterns - --pattern-column english --replacement-column french \
    $   -s color file.csv > translated.csv

计算每个查询的匹配细分:

    $ xan search -b -s headline --patterns queries.csv \
    $   --pattern-column query --name-column name file.csv > breakdown.csv

在新列中报告每个查询的唯一匹配项:

    $ xan search -U matches -s headline,text --patterns queries.csv \
    $   --pattern-column query --name-column name file.csv > matches.csv

# 关于性能

*解析*

请注意,此命令有一个 -Z/--fast-parser,能够利用更快的零拷贝解析器.但是,此解析器不会费心取消 CSV 单元格的转义,
在编写模式时您需要注意 CSV 分隔符和/或引号(别担心,大多数时候这是无关紧要的).

实际使用的解析器将取决于您是否通过 -s/--select 标志针对列选择.
这里的平衡点是在较长字符串上执行匹配的成本与解析 CSV 流的成本之间取得平衡.

最终您的里程可能有所不同,因此请进行基准测试并查看对于您的实际用例哪个更快.

此外,这可能看起来违反直觉,但如果您的 CSV 数据从不被引用且您的行足够小,专用工具如 `ripgrep` 应该更快:

https://github.com/burntsushi/ripgrep

*多个模式*

此命令非常努力地确保多个模式搜索不是简单地循环测试每个模式.以下是每种模式的使用方式:

    *(默认):单个 Aho-Corasick 自动机
    * -e, --exact:哈希映射
    * -r, --regex:单个正则表达式自动机
    * -u, --url-prefix:专用 trie
    * -L, --levenshtein <k>:一组 levenshtein 自动机
    * -D, --damerau-levenshtein <k>:同上

这也意味着,即使 Rust 的正则表达式引擎非常聪明,有时搜索一组子字符串比搜索正则表达式模式更快.

*并行化*

最后,此命令可以利用多线程通过 -p/--parallel 或 -t/--threads 标志运行得更快.
也就是说,并行化带来的提升可能差异很大,取决于模式的复杂性和数量,以及 haystack 的大小.
也就是说,`xan search --empty` 在并行化时不会明显更快,而 `xan search -i eternity` 肯定会.

此外,您可能想要尝试 `xan parallel cat` 代替,因为它在某些情况下可能更快,但代价是增加内存使用
(但有一个注意事项,它不能处理单个压缩文件或流).

例如,以下 `search` 命令:

    $ xan search -i eternity -p file.csv

将直接转换为:

    $ xan parallel cat -P 'search -i eternity' file.csv

# 关于编码

此命令通常不关心输入的编码.但是,某些搜索模式需要直接操作 unicode 字符,因此需要有效的 UTF-8.
这仅适用于 -u/--url-prefix、-L/--levenshtein 和 -D/--damerau-levenshtein.

Usage:
    xan search [options] --non-empty [<input>]
    xan search [options] --empty [<input>]
    xan search [options] --pattern-file <path> [<input>]
    xan search [options] --patterns <index> [<input>]
    xan search [options] <pattern> [-P <pattern>...] [<input>]
    xan search --help

search mode options:
    -e, --exact            执行精确匹配.
    -r, --regex            使用正则表达式执行匹配.
    -E, --empty            搜索空单元格,即过滤掉任何完全非空的选择.
    -N, --non-empty        搜索非空单元格,即过滤掉任何完全为空的选择.
    -u, --url-prefix       按 url 前缀匹配,即单元格必须包含与搜索的 url 前缀匹配的 url.Url 首先使用称为 LRU 的方案重新排序,
                           您可以在此处了解:https://github.com/medialab/ural?tab=readme-ov-file#about-lrus
    -L, --levenshtein <k>  如果单元格与模式之间的 Levenshtein 距离小于或等于给定的 <k> 阈值,则匹配.
                           出于性能原因并避免不合理的内存消耗,<k> 不允许大于 5.
    -D, --damerau-levenshtein <k>
                           与 -L/--levenshtein 相同,但将转置成本设置为 1 而不是 2.可用于匹配更常见的拼写错误,而无需过多增加 <k>.

search options:
    -i, --ignore-case          不区分大小写的搜索.
    -v, --invert-match         仅选择未匹配的行.
    -s, --select <arg>         选择要搜索的列.有关完整语法,请参阅 'xan select -h'.
    --every-column             仅当每个选定列都匹配模式时才输出一行,而不是默认行为(如果任何选定列匹配则输出一行).
    -f, --flag <column>        不过滤行,而是添加一个新列,指示是否找到任何匹配项.
    -c, --count <column>       在具有给定名称的新列中报告不重叠模式匹配的数量.仍将过滤掉具有 0 个匹配项的行,除非使用 --left.
                               不适用于 -v/--invert-match.
    --overlapping              与 -c/--count 或 -b/--breakdown 一起使用时,返回重叠匹配的计数.
                               请注意,这有时可能比计算非重叠匹配慢一个数量级.
    -R, --replace <with>       如果提供,命令将不会过滤行,而是将匹配项替换为给定的替换项.不适用于 --replacement-column.
                               正则表达式替换字符串语法可在此处找到:
                               https://docs.rs/regex/latest/regex/struct.Regex.html#replacement-string-syntax
    -l, --limit <n>            要返回的最大行数.有时可用于避免下游缓冲(例如,在将大文件管道传输到 `view` 或 `flatten` 之前搜索很少的行).
    -B, --before-context <n>   在匹配行之前保留的行数.
    -A, --after-context <n>    在匹配行之后保留的行数.
    --left                     使用 -U/--unique-matches 或 -b/--breakdown 或 -c/--count 时,没有匹配项的行将保留在输出中.
    -x, --pattern-file <path>  从给定文件 <path> 读取模式并修剪它,或在使用 -r/--regex 时切换详细模式 `(?x)`
                               (这意味着正则表达式可以使用空格和注释).当您的模式复杂且难以处理时,这可能很有用.
                               不要与应用于多个模式的 --patterns 混淆.
    -Z, --fast-parser          搜索文件时使用更快的零拷贝解析器.请注意,当不使用 -s/--select 时,不会对输入格式进行规范化.
                               此外,这只能使用此命令的默认模式(即过滤),不能与并行化一起使用.请注意,此解析器也无法取消 CSV 单元格的转义.
                               这意味着您必须注意将引号视为加倍,并且当不使用 -s/--select 使用此标志时,命令将尝试一次匹配整行,
                               因此它可能包含原始分隔符和换行符.
    -p, --parallel             是否使用并行化来加速计算.将根据核心数自动选择合适的线程数.如果您想自己指定线程数,请使用 -t, --threads.
    -t, --threads <threads>    使用指定数量的线程进行并行计算.如果您想自动选择线程数,请使用 -p, --parallel.

multiple patterns options:
    -P, --add-pattern <pattern>  手动向查询添加模式,无需向 --patterns 标志提供文件.
    -b, --breakdown              与 --patterns 一起使用时,将计算每个模式的不重叠匹配总数,并将此计数写入每个模式的一个附加列中.
                                 添加的列将以模式作为名称,除非您提供 --name-column 标志.
                                 不会在输出中包含没有匹配项的行,除非使用 --left 标志.
                                 当您的模式本身重叠时,您可能想要将其与 --overlapping 一起使用,否则您可能会对计数感到惊讶.
    -U, --unique-matches <name>  与 --patterns 一起使用时,将添加一个列,其中包含每行的唯一匹配模式列表,由 --sep 字符分隔.
                                 不会在输出中包含没有匹配项的行,除非使用 --left 标志.模式也可以通过 --name-column 标志指定名称.
    --sep <char>                 使用 -U/--unique-matches 时用于连接模式匹配的字符.[default: |]
    --patterns <path>            文本文件的路径(使用 "-" 表示 stdin),包含多个模式,每行一个,一次搜索.
    --pattern-column <name>      当给定列名时,--patterns 文件将被视为 CSV,并将从给定列中提取要搜索的模式.
    --replacement-column <name>  当与 --patterns 和 --pattern-column 一起给定时,指示发生匹配时包含替换项的列.
                                 不适用于 -R/--replace.
                                 正则表达式替换字符串语法可在此处找到:
                                 https://docs.rs/regex/latest/regex/struct.Regex.html#replacement-string-syntax
    --name-column <name>         当与 -b/--breakdown、--patterns 和 --pattern-column 一起给定时,
                                 指示包含模式名称的列,该列将用作附加细分中的列名.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会被视为表头.(即,它们不会被搜索、分析、切片等.)
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符.
```
