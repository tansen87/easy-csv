<!-- Generated -->
# xan join

```txt
在指定列上连接两个 CSV 文件.

默认连接操作是"内部"连接.这对应于指定键上的行交集.该命令还能够使用 --left 执行左外连接,使用 --right 执行右外连接,
使用 --full 执行全外连接,使用 --semi 执行半连接,使用 --anti 执行反连接,最后使用 --cross 执行笛卡尔积/交叉连接.

默认情况下,连接是区分大小写的,但可以使用 -i, --ignore-case 标志更改.

列参数指定每个输入要连接的列.可以使用与 "xan select" 命令相同的语法选择列.两个选择必须返回相同数量的列,以便连接键正确对齐.

请注意,当显然可以从其中一个文件中安全删除连接列时,命令会自动执行.否则您可以使用 -D/--drop-key 标志调整命令的行为.

请注意,此命令能够使用 stdin 等流(在这种情况下,文件名必须为 "-" 以指示将从 stdin 读取哪个文件).

# 示例

在名称不同的列上连接两个文件:

    $ xan join user_id tweets.csv id accounts.csv > joined.csv

相同的,但列名相同:

    $ xan join user_id tweets.csv accounts.csv > joined.csv

左连接:

    $ xan join --left user_id tweets.csv id accounts.csv > joined.csv

在多列上连接:

    $ xan join media,month per-query.csv totals.csv > joined.csv

一个文件来自 stdin:

    $ xan filter 'retweets > 10' tweets.csv | xan join user_id - id accounts.csv > joined.csv

为右列名添加前缀:

    $ xan join -R user_ user_id tweets.csv id accounts.csv > joined.csv

# 已排序的输入

此命令执行通常称为"哈希连接"的操作.也就是说,其中一个文件被索引到内存哈希映射中以使连接操作能够工作.

现在,如果您知道输入文件以类似方式排序,可以使用 -S/--sorted 标志执行"合并连接",并仅使用常量内存执行操作(除非您有许多重复项).

# 模糊连接

此命令还能够使用以下标志执行所谓的"模糊"连接:

    * -c, --contains:匹配子字符串(例如 "john" in "My name is john")
    * -r, --regex:使用正则表达式
    * -u, --url-prefix:按 url 前缀匹配(例如 "lemonde.fr/business")

按照惯例,包含模式的文件应在右侧给出,而左侧文件应包含将针对这些模式进行测试的值.

这意味着 --left 仍可用于发出没有任何匹配的行.

模糊连接是一个昂贵的操作,特别是在测试大量模式时,因此可以使用 -p/--parallel 和 -t/--threads 标志使用多个 CPU 加速搜索.

此命令的典型用例是在 CSV 文件的某些文本列中使用正则表达式模式模糊搜索姓氏,同时保留模式文件中的任何匹配相关列.

也就是说,如果您只需要过滤第一个文件的行而实际上不需要模式文件的列(即执行模糊 --semi 或 --anti 连接),
您可能应该使用 `xan search --patterns` 代替.

# 内存注意事项(不使用 -S/--sorted)

    - `inner join`:命令不会尝试智能处理,始终索引左文件,而右文件被流式传输.建议将较小的文件放在左侧.
    - `left join`:命令始终索引右文件并流式传输左文件.
    - `right join`:命令始终索引左文件并流式传输右文件.
    - `full join`:命令不会尝试智能处理,始终索引左文件,而右文件被流式传输.建议将较小的文件放在左侧.
    - `semi join`:命令始终索引右文件并流式传输左文件.
    - `anti join`:命令始终索引右文件并流式传输左文件.
    - `cross join`:命令不会尝试智能处理,始终索引左文件,而右文件被流式传输.建议将较小的文件放在左侧.
    - `fuzzy join`:命令始终索引右文件的模式并流式传输左侧的文件.

Usage:
    xan join [options] <columns1> <input1> <columns2> <input2>
    xan join [options] <columns> <input1> <input2>
    xan join [options] --cross <input1> <input2>
    xan join --help

join mode options:
    --inner  执行"内部"连接.只返回两个数据集之间可以找到匹配的行.
             这是命令的默认行为,因此可以省略此标志,或为了清晰起见使用.
    --left   执行"左外"连接.返回第一个 CSV 数据集中的所有行,包括
             在第二个数据集中没有对应行的行.当没有对应行时,
             用空字段填充.这是 --right 的反向操作.
             可用于模糊连接.
    --right  执行"右外"连接.返回第二个 CSV 数据集中的所有行,包括
             在第一个数据集中没有对应行的行.当没有对应行时,
             用空字段填充.这是 --left 的反向操作.
    --full   执行"全外"连接.返回两个数据集中的所有行,匹配的记录
             进行连接.如果没有匹配,缺失的一方将用空字段填充.
    --semi   仅保留左文件中与右文件匹配的行.
    --anti   仅保留左文件中与右文件不匹配的行.
    --cross  返回给定 CSV 文件的笛卡尔积.输出的行数将等于 N * M,
             其中 N 和 M 分别对应于给定数据集中的行数.

fuzzy join mode options:
    -c, --contains    通过匹配子字符串进行连接.
    -r, --regex       通过正则表达式模式进行连接.
    -u, --url-prefix  通过 URL 前缀进行连接,即单元格必须包含与
                      搜索的 URL 前缀匹配的 URL.URL 首先使用称为
                      LRU 的方案重新排序,您可以在此处了解:
                      https://github.com/medialab/ural?tab=readme-ov-file#about-lrus

join options:
    -i, --ignore-case            设置后,连接将不区分大小写地执行.
    --nulls                      设置后,连接将作用于空字段.否则,空键将被完全
                                 忽略,即当列选择仅产生空单元格时.
    -D, --drop-key <mode>        指示是否在 `left` 或 `right` 文件中删除表示连接键的列,
                                 或 `none`,或 `both`.默认为 `none`,或在明显方便时
                                 进行相关自动选择(例如不使用 --full、-i/--ignore-case
                                 或模糊匹配时).
    -l, --prefix-left <prefix>   为第一个数据集中的列名添加前缀.
    -r, --prefix-right <prefix>  为第二个数据集中的列名添加前缀.

sorted input options:
    -S, --sorted   使用此标志表示两个输入都已按类似方式排序,以加速计算.
    -R, --reverse  反转排序顺序,即降序.
    -N, --numeric  根据数值而非默认的字典顺序比较键.

fuzzy join options:
    --simplified-urls        使用 -u/--url-prefix 时,删除 URL 的不相关部分,
                             如协议、`www.` 子域名等,以方便匹配.
    -p, --parallel           是否使用并行化来加速计算.将根据核心数自动选择
                             合适的线程数.如果要自己指定线程数,请使用 -t, --threads.
    -t, --threads <threads>  使用指定数量的线程进行并行计算.如果要自动选择线程数,
                             请使用 -p, --parallel.

Common options:
    -h, --help                  显示帮助
    -o, --output <file>         将输出写入<file>而非stdout.
    -n, --no-headers            设置后,第一行将不会被视为表头.
                                (即不进行搜索、分析、切片等操作.)
    -d, --delimiter <arg>       读取 CSV 数据时的字段分隔符.必须是单个字符.
```
