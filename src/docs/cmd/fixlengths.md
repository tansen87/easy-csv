<!-- Generated -->
# xan fixlengths

```txt
Transforms CSV data so that all rows have the same number of columns. The number
of columns will be inferred to be the maximum number of columns seen for any row
in the input data by default. Unfortunately, for this to work, all data must be
buffered into memory.

Else, you can also indicate a number of columns to force with the -l/--length
flag (longer rows will get truncated, shorted rows will get padded with empty
columns).

You can also use the -H/--trust-header to trust that the file's first row has
the correct number of columns.

When using -l/--length or -H/--trust-header, the data will be streamed and does
not need to be buffered into memory.

Usage:
    xan fixlengths [options] [<input>]

fixlengths options:
    -l, --length <arg>     Forcefully set the length of each record. If a
                           record is not the size given, then it is truncated
                           or padded as appropriate.
    -H, --trust-header     Trust that the first row indicates the correct
                           number of columns of the file.

Common options:
    -h, --help             Display this message
    -o, --output <file>    Write output to <file> instead of stdout.
    -d, --delimiter <arg>  The field delimiter for reading CSV data.
                           Must be a single character.
```
