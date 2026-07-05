<!-- Generated -->
# xan vocab

```txt
计算分词文档的词汇统计信息(通常由 "xan tokenize words" 子命令生成),即包含 "tokens" 列的 CSV 数据行,
其中包含由单个空格(或 --sep 标志给出的任何分隔符)分隔的单词令牌.

默认情况下,该命令将文档视为输入的单行,但也可以由 -D/--doc 给出的列选择的值表示.

此命令可以计算 5 种不同的词汇统计信息:

1. 语料库级统计信息(使用 "corpus" 子命令):
    - doc_count:语料库中的文档数量
    - token_count:语料库中的令牌总数
    - distinct_token_count:语料库中的不同令牌数量
    - average_doc_len:每个文档的平均令牌数

2. 令牌级统计信息(使用 "token" 子命令):
    - token:某个不同的令牌(该列将与输入同名)
    - gf:令牌在整个语料库中的全局频率
    - df:令牌的文档频率
    - df_ratio:包含令牌的文档比例
    - idf:令牌的逆文档频率的对数
    - gfidf:令牌的全局频率 * idf
    - pigeon:df 与随机分布中预期 df 的比率

3. 文档级统计信息(使用 "doc" 子命令):
    - (*doc):表示文档的列(与输入同名)
    - token_count:文档中的令牌总数
    - distinct_token_count:文档中的不同令牌数量

4. 文档-令牌级统计信息(使用 "doc-token" 子命令):
    - (*doc):表示文档的列(与输入同名)
    - token:某个不同的文档令牌(该列将与输入同名)
    - tf:令牌在文档中的词频
    - expected_tf:预期的绝对词频(不遵循 --tf-weight)
    - tfidf:令牌在文档中的词频 * idf
    - bm25:令牌在文档中的 BM25 分数
    - chi2:令牌在文档中的 chi2 分数

5. 令牌共现级统计信息(使用 "cooc" 子命令):
    - token1:第一个令牌
    - token2:第二个令牌
    - count:共现次数
    - expected_count:预期共现次数
    - chi2:chi2 分数(没有 --complete 标志时为近似值)
    - G2:G2 分数(没有 --complete 标志时为近似值)
    - pmi:逐点互信息
    - npmi:归一化逐点互信息

    或者,使用 --distrib 标志:

    - token1:第一个令牌
    - token2:第二个令牌
    - count:共现次数
    - expected_count:预期共现次数
    - sd_I:基于 PMI 的分布分数
    - sd_G2:基于 G2 的分布分数

    或者,使用 --specificity 标志(尚未正确！请勿使用！):

    - token:令牌
    - count:共现总数
    - lgl:特异性分数(统计相关共现的比率)

请注意,当考虑少于 5 个项(绝对词频或共现计数)时,您通常应该避免对 chi2 和 G2 分数的统计相关性给予太多重视.

Usage:
    xan vocab corpus [options] [<input>]
    xan vocab token [options] [<input>]
    xan vocab doc [options] [<input>]
    xan vocab doc-token [options] [<input>]
    xan vocab cooc [options] [<input>]
    xan vocab --help

vocab options:
    -T, --token <token-col>  包含令牌的列名称.如果提供 --implode 则默认为
                             "tokens" 或 "token"
    -D, --doc <doc-cols>     表示行文档的列可选选择
                             如果未提供该标志,输入的每一行将被视为其自身的文档
    --sep <delim>            用于在一行的令牌单元格中分隔令牌的分隔符
                             默认为空格
    --implode                如果指定,将对令牌列进行折叠,从而可以处理每行仅包含
                             一个令牌的文件.不能在没有 -D, --doc 的情况下使用

vocab doc-token options:
    --tf-weight <weight>         TF 加权方案.可选值:"count"、"binary"、"ratio"
                                 或 "log-normal".[默认值:count]
    --k1-value <value>           BM25 计算的 "k1" 因子.[默认值:1.2]
    --b-value <value>            BM25 计算的 "b" 因子.[默认值:0.75]
    --chi2-significance <value>  仅保留与其 chi2 分数相关且高于给定显著性水平的
                                 显著文档-令牌对.接受的水平包括 "0.5"、"0.1"、
                                 "0.05"、"0.025"、"0.01"、"0.005" 和 "0.001"

vocab cooc options:
    -w, --window <n>             共现窗口大小,以当前考虑令牌周围的令牌数表示.
                                 如果未指定,将使用词袋模型计算共现,其中令牌被视为
                                 与同一文档中的每个其他令牌共现.
                                 将窗口设置为 "1" 以计算二元组搭配.
                                 设置更大的窗口以获得与 word2vec 类似的结果
    -F, --forward                遍历令牌上下文时是否仅考虑前向窗口
    --distrib                    改为计算有向分布相似度度量
    --specificity                改为计算每个令牌的 lgl 特异性分数
    --min-count <n>              结果中包含的最小共现计数.[默认值:1]
    --chi2-significance <value>  仅保留与其 chi2 分数相关且高于给定显著性水平的
                                 显著文档-令牌对.接受的水平包括 "0.5"、"0.1"、
                                 "0.05"、"0.025"、"0.01"、"0.005" 和 "0.001"
    --G2-significance <value>    仅保留与其 G2 分数相关且高于给定显著性水平的
                                 显著文档-令牌对.接受的水平包括 "0.5"、"0.1"、
                                 "0.05"、"0.025"、"0.01"、"0.005" 和 "0.001"

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout
    -n, --no-headers       设置后,第一行将不会被视为表头
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符
```
