<!-- Generated -->
# pinyin

```txt
将所选列中的中文字符转换为拼音.

这是一个插件命令: 通过外部 `pinyin` 可执行文件处理 CSV,可与 xan 命令组合
在同一管道中. 首个命令的定界符和 --no-headers 会被自动注入.

用法:
    pinyin -c <columns> [options] [<input>]

pinyin 选项:
    -c, --columns <cols>   要转换的列, 逗号分隔的名称或 0 起始的索引. [必填]
    -s, --style <style>    拼音样式: plain (每个汉字拼音首字母大写), upper 或
                           lower. [默认: plain]
    --suffix <suffix>      保留原列并追加名为 <col><suffix> 的新列. [默认: _py]

通用选项:
    -n, --no-headers       将首行视为数据而不是表头.
    -d, --delimiter <arg>  字段定界符, 单个字符. [默认: ,]
    -o, --output <file>    将输出写入 <file> 而不是 stdout.

示例:
    pinyin -c name,company
    pinyin -c name --style upper
```