<!-- Generated -->
# xan tokenize

```txt
通过将给定的文本列拆分为单词、句子或段落来对其进行分词.

# tokenize words

通过将给定的文本列拆分为单词片段(想想单词、数字、标签等)来对其进行分词.

此分词器能够区分以下类型的令牌(您可以使用 --keep 和 --drop 进行过滤):
    "word"、"number"、"hashtag"、"mention"、"emoji"、
    "punct"、"url" 和 "email"

默认情况下,该命令将为输入文件中的每一行输出一行,令牌添加在新的 "tokens" 列中,包含经过处理和过滤的令牌,由空格(或 --sep 给出的任何字符)连接.

但是,当给 -T, --token-type 提供列名时,该命令将改为每令牌输出一行,令牌在新的 "token" 列中,以及一个包含令牌类型的新列.

此子命令还提供了许多过滤和处理结果令牌的方法,以及与 "xan vocab" 命令协同迭代细化词汇表的方法.

最后,如果您仍然需要一些命令标志未涵盖的处理,您可以使用 -F/--flatmap,它允许您对每个令牌评估表达式以过滤、转换或拆分它们:

过滤令牌:

    $ xan tokenize words text -F 'token.startswith("Dé") && token'

拆分令牌:

    $ xan tokenize words text -F 'token.split("-")'

转换令牌:

    $ xan tokenize words text -F 'replace(_, /é/, "e")'

# tokenize sentences

通过将给定文本拆分为句子来对其进行分词,每行输出一个句子,末尾有一个新的 "sentence" 列.

# tokenize paragraphs

通过将给定文本拆分为段落来对其进行分词,每行输出一个段落,末尾有一个新的 "paragraph" 列.

---

请注意,除非您向命令传递 --keep-text,否则该命令将始终从输出中删除文本列.

提示:

您可以轻松地将命令管道传输到 "xan vocab" 以创建词汇表:
    $ xan tokenize words text file.csv | xan vocab doc-token > vocab.csv

您可以使用 "tee" 命令轻松地将令牌保留在单独的文件中:
    $ xan tokenize words text file.csv | tee tokens.csv | xan vocab doc-token > vocab.csv

Usage:
    xan tokenize words [options] <column> [<input>]
    xan tokenize sentences [options] <column> [<input>]
    xan tokenize paragraphs [options] <column> [<input>]
    xan tokenize --help

tokenize options:
    -c, --column <name>      令牌列的名称.默认为 "tokens",提供 -T/--token-type 时
                             为 "token"、"paragraphs" 或 "sentences"
    -p, --parallel           是否使用并行化来加速计算
                             将根据核心数自动选择合适的线程数
                             如需手动指定线程数,请使用 -t, --threads
    -t, --threads <threads>  使用指定数量的线程进行并行计算
                             如需自动选择线程数,请使用 -p, --parallel
    --keep-text              强制在输出中保留文本列

tokenize words options:
    -S, --simple             使用更简单、性能更好的分词器变体,但无法推断令牌类型
                             也无法处理细微情况
    -N, --ngrams <n>         如果指定,将输出令牌 ngram,使用给定的 n 值或以逗号分隔
                             的 n 值范围,例如 "1,3"
                             不能与 -T, --token-type 同时使用
    -T, --token-type <name>  要添加的包含令牌类型的列名
                             不能与 -N, --ngrams 同时使用
    -D, --drop <types>       要从结果中删除的令牌类型,以逗号分隔,例如 "word,number"
                             不能与 -k, --keep 同时使用
                             参见上面的识别类型列表
    -k, --keep <types>       要在结果中保留的令牌类型,以逗号分隔,例如 "word,number"
                             不能与 -d, --drop 同时使用
                             参见上面的识别类型列表
    -m, --min-token <n>      令牌要包含在输出中的最小字符数
    -M, --max-token <n>      令牌要包含在输出中的最大字符数
    --stoplist <path>        包含每行一个单词的 .txt 停用词表路径
    -J, --filter-junk        是否应用启发式方法过滤看起来像垃圾的单词
    -L, --lower              是否使用小写规范化令牌大小写
    -U, --unidecode          是否将令牌文本规范化为 ASCII
    --split-hyphens          是否按连字符拆分令牌
    --stemmer <name>         用于规范化令牌的词干提取器,可选值:
                                - "s":基本词干提取器,移除大多数欧洲语言中的典型复数变体
                                - "carry":针对法语的词干提取器
    -V, --vocab <name>       包含允许词汇的 CSV 文件路径(或 "-" 表示标准输入)
    --vocab-token <col>      词汇文件中包含允许令牌的列
                             [默认值:token]
    --vocab-token-id <col>   词汇文件中包含令牌 ID 的列,将输出该 ID 而非令牌本身
    --sep <delim>            用于在输出单元格中连接令牌的字符,默认为空格
    --ngrams-sep <delim>     用于连接 ngram 令牌的分隔符
                             [默认值:§]
    -u, --uniq               对令牌进行排序和去重
    -F, --flatmap <expr>     对每个提取的令牌评估表达式,返回空值、转换后的令牌
                             或令牌列表.评估的表达式将把 "token" 标识符理解为当前
                             处理的令牌,"token_type" 理解为其类型.表达式将在命令的
                             任何预处理之后、去重之前运行

tokenize paragraphs options:
    -A, --aerated  强制段落之间用空行分隔,而非仅用单个换行符

tokenize sentences options:
    --squeeze  折叠连续的空白字符以生成整洁的输出

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout
    -n, --no-headers       设置后,第一行将不会被视为表头
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符
```
