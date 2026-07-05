<!-- Generated -->
# xan input

```txt
读取格式异常的 CSV 数据.

这意味着能够使用 --quote 或 --no-quoting 处理具有特殊引号规则的 CSV 数据,或者使用 --escape 处理字符转义,
通常是具有反斜杠转义的文件.这也意味着使用 -T/--tolerant 使用较慢的 CSV 解析器处理引号错误的单元格.

此命令还能够使用 -L/--skip-lines、-U/--skip-until 和 -W/--skip-while 标志跳过有时在 CSV 相关格式开头找到的元数据标题.

最后,您还可以使用此命令处理压缩流和已知的 CSV 相关格式流(请注意,如果文件已在磁盘上且具有预期的扩展名,则不需要使用 `xan input`,
因为 xan 知道如何开箱即用地处理其中一些格式).一个显著的例外是 GFF 文件,需要 `xan input` 来读取.

Usage:
    xan input [options] [<input>]

formatting options:
    --tabs            等同于 -d '\t',即使用制表符作为分隔符.
    --quote <char>    要使用的引号字符.[默认: "]
    --escape <char>   要使用的转义字符.未指定时,引号通过加倍来转义.
    --no-quoting      完全禁用引号.
    --comment <char>  跳过以该字符开头的记录.
    --trim            是否修剪单元格值.
    -T, --tolerant    是否使用较慢但更宽容的 CSV 解析器,能够处理引号错误的单元格.也可用于解析具有仅 CR 换行符的旧 macOS 文件.

header skipping options:
    -L, --skip-lines <n>        跳过文件的前 <n> 行.
    -U, --skip-until <pattern>  跳过行直到 <pattern> 匹配.
    -W, --skip-while <pattern>  在 <pattern> 匹配时跳过行.

CSV-adjacent data format options:
    --vcf  指示给定流应被理解为生物信息学中的 VCF("Variant Call Format")文件.当在具有 `.vcf` 扩展名的文件上使用 xan 时
           不需要此选项,因为 xan 已经知道如何处理它们.
           https://en.wikipedia.org/wiki/Variant_Call_Format
    --gtf  指示给定流应被理解为生物信息学中的 GTF("Gene Transfer Format")文件.当在具有 `.gtf` 或 `.gff2`
           扩展名的文件上使用 xan 时不需要此选项,因为 xan 已经知道如何处理它们.
           https://en.wikipedia.org/wiki/Gene_transfer_format
    --gff  指示给定流应被理解为生物信息学中的 GFF("General Feature Format")文件.如果目标文件具有 `.gff` 或
           `.gff3` 扩展名,则隐含此标志.
           https://en.wikipedia.org/wiki/General_feature_format
    --sam  指示给定流应被理解为生物信息学中的 SAM("Sequence Alignment Map")文件.当在具有 `.sam` 扩展名的文件上
           使用 xan 时不需要此选项,因为 xan 已经知道如何处理它们.
           https://en.wikipedia.org/wiki/SAM_(file_format)
    --bed  指示给定流应被理解为生物信息学中的 BED("Browser Extensible Data")文件.当在具有 `.bed` 扩展名的文件上
           使用 xan 时不需要此选项,因为 xan 已经知道如何处理它们.请注意,文件将被视为制表符分隔,而不是空格分隔！
           https://en.wikipedia.org/wiki/BED_(file_format)
    --cdx  指示给定流应被理解为网络归档中的 CDX 索引文件.当在具有 `.cdx` 扩展名的文件上使用 xan 时不需要此选项,
           因为 xan 已经知道如何处理它们.
           https://iipc.github.io/warc-specifications/specifications/cdx-format/cdx-2015/

compression options:
    --gzip  读取 gzip 压缩流或没有标准 `.gz` 扩展名的 gzip 压缩文件.
    --zstd  读取 zstd 压缩流或没有标准 `.zst` 扩展名的 zstd 压缩文件.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符,必须是单个字符
```
