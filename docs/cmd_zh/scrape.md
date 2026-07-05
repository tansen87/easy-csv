<!-- Generated -->
# xan scrape

```txt
抓取 HTML 文件(或任何类型的 XML 文件)并从结果中返回结构化的表格数据.

此命令可以处理各种不同的源:

默认情况下,磁盘上 HTML 文档的路径
    $ xan scrape head page1.html page2.html page3.html > result.csv
    $ xan scrape head **/*.html > result.csv

使用 --glob 收集的 HTML 文档路径
    $ xan scrape head --glob '*.csv' > result.csv

包含每行一个 HTML 文档路径的文本文件,使用 --paths
    $ xan scrape head --paths paths.txt > result.csv

包含 HTML 文档路径列的 CSV 文件,使用 --paths 和 --path-column
    $ xan scrape head --paths path.csv --path-column path > result.csv

包含内联 HTML 文档列的 CSV 文件,使用 --docs 和 --doc-column
    $ xan scrape head --docs documents.csv --doc-column html > result.csv

通过 stdin 喂入的单个 HTML 文档,使用 -D/--stdin-doc
    $ curl -L https://www.lemonde.fr/ | xan scrape head -D > result.csv

现在关于我们可以抓取什么,该命令知道如何从 HTML 文档中提取典型内容,例如标题、url 和其他元数据,使用非常优化的例程.

或者您可以自由定义自定义抓取器,可以通过 -e/--evaluate 或 -f/--evaluate-file 标志提供.

还请知道此命令能够使用多个 CPU 通过 -p/--parallel 或 -t/--threads 加速.

# 内置抓取器

以下是 `xan scrape` 内置抓取器的列表以及它们将添加到输出的列:

"head":将抓取 <head> 标签中找到的典型元数据.每个输入行输出一行,包含以下列:
    - title
    - canonical_url

"urls":将抓取文档中 <a> 标签中找到的所有 url.每个抓取的 url 每个输入行输出一行,包含以下列:
    - url

"images":将抓取 <img> 标签中找到的所有可下载图像 url.每个抓取的图像每个输入行输出一行,包含以下列:
    - src

"article":通过分析 <head> 标签和 JSON-LD 数据来抓取典型的新闻文章元数据
(请注意,您可以将此与 -e/-f 标志结合使用以向输出添加自定义数据,例如抓取文章文本).
每个输入行输出一行,包含以下列:
    - canonical_url
    - headline
    - description
    - date_created
    - date_published
    - date_modified
    - section
    - keywords
    - authors
    - image
    - image_caption
    - free

# 自定义抓取器

使用 -e/--evaluate 或 -f/--evaluate-file 时,此命令能够利用自定义的类 CSS 语言来准确描述您想要抓取的内容.

给定的抓取器将对每个 HTML 文档运行一次,或对与 -F/--foreach 给出的 CSS 选择器匹配的每个元素运行一次.

从 HTML 文档中抓取第一个 h2 标题的示例:

    $ xan scrape -e 'h2 > a {title: text; url: attr("href");}' page.html

从 HTML 文档中抓取所有 h2 标题的示例:

    $ xan scrape --foreach 'h2 > a' -e '& {title: text; url: attr("href");}' page.html

可以使用 `xan help scraping` 找到此语言的完整参考.

# 每个输入行有多少输出行？

抓取器可以对每个输入行输出恰好一行,或输出 0 到 n 行.

对每个输入行输出恰好一行的抓取器:"head"、"article"、任何通过 -e/-f 给出但没有 -F/--foreach 的抓取器.

对每个输入行输出 0 到 n 行的抓取器:"urls"、"images"、任何通过 -e/-f 给出且带有 -F/--foreach 的抓取器.

有时使用 -k/--keep 标志选择要保留在输出中的输入列可能很有用.请注意,使用空选择 (-k '') 意味着仅输出抓取的列.

Usage:
    xan scrape (head|urls|article|images) [options] [<inputs>...]
    xan scrape -e <expr> [options] [<inputs>...]
    xan scrape -f <path> [options] [<inputs>...]
    xan scrape --help

scrape options:
    -e, --evaluate <expr>       如果提供,评估给定的抓取表达式.
    -f, --evaluate-file <path>  如果提供,评估在 <path> 文件中找到的抓取表达式.
    --paths <input>             如果提供,读取 <input> 并将其视为包含每行一个文档路径.
    --path-column <name>        如果与 --paths 一起提供,将 <input> 视为 CSV 文件,并从选定列读取文档路径.
    --docs <input>              如果提供,读取 <input> 并将其视为包含内联文档列的 CSV 文件.需要提供 --doc-column.
    --doc-column <name>         选择通过 --docs 给出的包含内联文档的列.
    -D, --stdin-doc             设置后,命令将把 stdin 的内容作为单个文档读取.
                                当直接将 `curl` 或 `wget` 的结果管道传输到命令时,这可能很有用.
    --glob <pattern>            如果提供,通过应用给定的 glob 模式收集要处理的文档路径.
    -E, --encoding <name>       读取磁盘时的编码.默认为 utf-8.
    -k, --keep <column>         从输入中选择要保留在输出中的列.默认为保留输入的所有列.
    -I, --input-dir <path>      设置后,处理的路径将相对于给定的基准 <path> 读取.
    -p, --parallel              是否使用并行化来加速计算.将根据核心数自动选择合适的线程数.
                                如果您想自己指定线程数,请使用 -t, --threads.
    -t, --threads <threads>     使用指定数量的线程进行并行计算.如果您想自动选择线程数,请使用 -p, --parallel.

scrape url, links, images options:
    -u, --url-column <column>  包含给定 HTML 基础 url 的列.

scrape -e/--evaluate & -f/--evaluate-file options:
    -F, --foreach <css>  如果提供,将为目标文档中每个匹配 CSS 选择器的元素返回一行,而不是每个文档返回一行.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,第一行将不会被视为表头.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符.
```
