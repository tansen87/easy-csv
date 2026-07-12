<!-- Generated -->
# batch-filter

```txt
批量过滤: 搜索多个值并输出单独文件.

此命令根据列值将CSV文件拆分为多个输出文件.对于每个唯一值(或手动指定的值),它会创建一个单独的CSV文件,仅包含匹配该值的行.

batch-filter options:
    --column <column>          要过滤的列(必填).
    --filter-type <type>       过滤类型: "text" 或 "number"(必填).
                               [default: text]
    --text-operator <op>       文本过滤运算符.可选: equals, not_equals,
                               starts_with, not_starts_with, ends_with, not_ends_with,
                               contains, not_contains, regex, is_null, is_not_null.
                               [default: equals]
    --number-operator <op>     数字过滤运算符.可选: equals, not_equals,
                               greater_than, less_than, greater_or_equal, less_or_equal.
                               [default: equals]
    --value-mode <mode>        值来源: "manual" 或 "column"(必填).
                               [default: manual]
    --manual-values <values>   手动模式下的值,以换行分隔.
    --extract-column <col>     用于提取唯一值的列(列模式).
    --case-insensitive         不区分大小写匹配.
    --output-dir <dir>         自定义输出目录.默认与源文件相同目录.

输出文件命名格式: {源文件名}_{清理后的值}.csv
```
