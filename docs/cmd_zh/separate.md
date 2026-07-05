<!-- Generated -->
# xan separate

```txt
通过根据某种拆分方法拆分单元格,将单列拆分为多列,拆分方法可以是以下之一:

    *(默认):按单个子字符串拆分
    * -r, --regex:使用正则表达式拆分
    * -m, --match:分解为正则表达式匹配
    * -c, --captures:分解为正则表达式第一个匹配的捕获组
    * -C, --all-captures:分解为正则表达式所有匹配的捕获组
    * --fixed-width:每 <n> 字节切割一次
    * --widths:按连续宽度列表拆分
    * --cuts:在预定义的字节偏移处切割
    * --offsets:提取字节切片

此命令还可以处理任意文本流,将每行视为包含单列的临时 CSV 记录.这对于将基于行的数据(如日志)解析为正确的表格数据非常有用.

可以使用 --into 标志为创建的列命名,否则它们将根据原始列名获得通用名称.
例如,拆分名为 "text" 的列将生成名为 "text1"、"text2"... 的列.--prefix 标志也可用于选择不同的名称.

请注意,使用 -c/--captures 时,列名可以从正则表达式捕获组名称中推断,如以下模式所示:(?<year>\d{4})-(?<day>\d{2}).

也可以使用 --max 标志限制拆分数量.

如果事先知道拆分数量(即使用 --into 或 --max、--widths、--cuts、--offsets 或 --captures 时),命令将能够流式传输数据.
否则,它将不得不将整个文件缓冲到内存中以记录所选方法产生的最大拆分数.

最后,请注意默认情况下,拆分的列将从输出中删除,除非使用 -k/--keep 标志.

示例:

  拆分全名
    $ xan separate fullname ' ' data.csv
    $ xan separate --into first_name,last_name ' ' data.csv

  处理文本行
    $ xan separate --txt ' ' --into first_name,last_name names.txt

  使用正则表达式拆分全名
    $ xan separate -r fullname '\s+' data.csv

  使用正则表达式从名为 'birthdate' 的列中提取数字序列:
    $ xan separate -rm birthdate '\d+' data.csv

  使用捕获组从名为 'date' 的列中提取年、月和日:
    $ xan separate -rc date '(\d{4})-(\d{2})-(\d{2})' data.csv --into year,month,day

  将名为 'code' 的列拆分为 3 字节的序列:
    $ xan separate code --fixed-width 3 data.csv

  将名为 'code' 的列拆分为宽度为 2、4 和 3 的部分:
    $ xan separate code --widths 2,4,3 data.csv

  在字节 2 和 6 处拆分名为 'code' 的列:
    $ xan separate code --cuts 2,6 data.csv

  将名为 'code' 的列拆分为由字节偏移 [0, 2)、[2, 6) 和 [6, 9) 定义的段:
    $ xan separate code --offsets 0,2,6,9 data.csv

  将空列名提供给 --into 以跳过输出中的某些列:
    $ xan separate date - --into year,,day dates.csv

Usage:
    xan separate --txt [options] <separator> [<input>]
    xan separate [options] <column> <separator> [<input>]
    xan separate --help

separate mode options:
    -r, --regex         使用正则表达式而非简单子字符串拆分单元格.
    -m, --match         使用 -r/--regex 时,提取与正则表达式模式匹配的单元格部分.
    -c, --captures      使用 -r/--regex 时,查找给定正则表达式模式的第一个匹配项并提取其捕获组.
    -C, --all-captures  使用 -r/--regex 时,查找给定正则表达式模式的所有匹配项并提取其捕获组.
    --fixed-width       每隔 <separator> 个字节拆分单元格.
    --widths            使用给定宽度拆分单元格(以逗号分隔的整数列表给出).
    --cuts              在给定字节处拆分单元格(以递增、不重复的整数逗号分隔列表给出).
    --offsets           根据指定的字节偏移量拆分单元格(以递增、不重复的整数逗号分隔列表给出).

separate options:
    -T, --txt              指示输入应被视为文本行而非 CSV 数据.如果使用 -k/--keep,
                           该行将保留在名为 "line" 的输出列中.
    -M, --max <n>          限制拆分的单元格数量最多为 <n>.默认进行所有可能的拆分.
    --into <column-names>  为拆分创建的新列指定名称.如果未提供,新列将按原始列名命名
                           ('text' 列将被拆分为 'text1'、'text2' 等).如果与 --max 一起使用,
                           提供的名称数量必须等于或小于 <n>.不能与 --prefix 一起使用.
                           请注意,您可以给某些输出列一个空名称以完全跳过它们.
    --prefix <prefix>      为拆分创建的新列指定前缀.默认不使用前缀,新列按原始列名命名
                           ('text' 列将被拆分为 'text1'、'text2' 等).不能与 --into 一起使用.
    --too-many <option>    指定当拆分的单元格数量超过 --max 或 --into 提供的名称数量时如何处理额外单元格.
                           必须是以下之一:
                                - 'error':在产生不一致的拆分数时立即停止.
                                - 'drop':丢弃超过预期最大值的拆分.
                                - 'merge':将单元格的其余部分附加到最后一个产生的拆分.
                           请注意,'merge' 不能与 -m/--match 或 -c/--captures 一起使用.
                           [default: error]
    -k, --keep             拆分后保留被分离的列,而非丢弃它.
    --trim                 是否修剪拆分值的前导/尾随空白.
    -F, --filter           当单元格无法被分离时从输出中删除行.根据使用的模式,这可能意味着各种情况.

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而非stdout.
    -n, --no-headers         设置后,第一行将不会被视为表头.
    -d, --delimiter <arg>    读取 CSV 数据时的字段分隔符.必须是单个字符.
```
