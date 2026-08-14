<!-- Generated -->
# pinyin

```txt
Convert Chinese characters in selected columns to pinyin.

This is a plugin command: it pipes CSV through the external `pinyin`
executable and composes with xan commands in the same pipeline. The delimiter
and --no-headers are injected automatically for the first command.

Usage:
    pinyin -c <columns> [options] [<input>]

pinyin options:
    -c, --columns <cols>   Columns to convert, comma-separated names or
                           0-based indices. [required]
    -s, --style <style>    Pinyin style: plain (capitalized initial per Chinese
                           character), upper or lower. [default: plain]
    --suffix <suffix>      Keep the original columns and append new ones
                           named <col><suffix>. [default: _py]

Common options:
    -n, --no-headers       Treat the first row as data instead of headers.
    -d, --delimiter <arg>  Field delimiter, a single character.
                           [default: ,]
    -o, --output <file>    Write output to <file> instead of stdout.

Examples:
    pinyin -c name,company
    pinyin -c name --style upper
```
