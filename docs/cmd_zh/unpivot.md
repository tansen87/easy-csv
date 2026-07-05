<!-- Generated -->
# xan unpivot

```txt
通过允许多列堆叠到更少的列中来取消透视 CSV 文件.

例如,给定以下文件:

dept,jan,feb,mar
electronics,1,2,3
clothes,10,20,30
cars,100,200,300

以下命令:

    $ xan unpivot jan: -N month -V sales file.csv

将产生以下结果:

dept,month,sales
electronics,jan,1
electronics,feb,2
electronics,mar,3
clothes,jan,10
clothes,feb,20
clothes,mar,30
cars,jan,100
cars,feb,200
cars,mar,300

Usage:
    xan unpivot [options] <columns> [<input>]
    xan pivot-longer [options] <columns> [<input>]
    xan unpivot --help
    xan pivot-longer --help

unpivot options:
    -N, --name-column <name>   用于包含取消透视后列名称的列名称.[默认值:name]
    -V, --value-column <name>  用于包含取消透视后列值的列名称.[默认值:value]

Common options:
    -h, --help               显示帮助
    -o, --output <file>      将输出写入<file>而非stdout
    -n, --no-headers         设置后,第一行将不会被视为表头
    -d, --delimiter <arg>    读取 CSV 数据时的字段分隔符,必须是单个字符
```
