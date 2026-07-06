<!-- Generated -->
# xan network

```txt
处理 CSV 数据以构建网络(节点和边),以便您可以生成各种输出,从图形数据格式(例如 json 或 gexf)或其他 CSV 输出,
当管道传输到其他 xan 命令时可以轻松解释网络信息.

支持的输入模式:
    `edgelist`:  将具有表示源的列和另一个表示目标的列的边 CSV 转换为
                  边列表.
    `nodelist`:  将具有表示节点键的列的节点 CSV 转换为空图.
    `bipartite`: 将具有表示二部图两部分之间边的两列的 CSV 转换为
                  二部图.

支持的输出格式(-f, --format):
    `json`       - Graphology JSON 序列化格式
                   参考:https://graphology.github.io/serialization.html
    `gexf`       - 图交换 XML 格式
                   参考:https://gexf.net/
    `nodelist`   - CSV 节点列表,如果使用 -D/--degrees 则包含可选度数
    `components` - CSV 列出连接组件大小和任意代表节点
    `stats`      - 有用图统计信息的单行 CSV(节点数、边数、图类型、密度等)

提示和技巧:

您可以通过在此命令之前使用 `xan select` 来限制节点和/或边属性:

    $ xan select source,target,weight edges.csv | xan network edgelist source target

您可以使用 `xan groubpy` 等合并多个图的边:

    $ xan groupby source,target 'sum(weight) as weight' edges.csv | xan network edgelist source target

您可以使用 `xan dedup` 轻松查找重复的 (source, target) 对:

    $ xan dedup -s source,target --keep-duplicates edges.csv

Usage:
    xan network nodelist [options] <node> [<input>]
    xan network edgelist [options] <source> <target> [<input>]
    xan network bipartite [options] <part1> <part2> [<input>]
    xan network --help

output format options:
    -f, --format <format>     "json"、"gexf"、"stats"、"components"
                              或 "nodelist" 之一.[默认: json]
    --gexf-version <version>  要输出的 GEXF 版本.可以是 "1.2" 或 "1.3".
                              [默认: 1.2]
    --minify                  是否压缩 json 或 gexf 输出.

xan network options:
    -L, --largest-component  仅保留结果图中最大的连通分量.
    -S, --simple             用于指示您事先知道处理后的图是简单的,即不包含
                             同一个 (source, target) 对的多条边.这可以提高
                             整个过程的性能.
    --sample-size <n>        用于节点或边类型推断的采样记录数.设置为 -1
                             以采样所有记录.这会消耗大量内存,但可以确保
                             输出类型更合适.[默认: 64]

edgelist options:
    -U, --undirected       图是否为无向图.
    --nodes <path>         包含节点元数据的 CSV 文件路径(使用 "-" 从 stdin 读取).
    --node-column <name>   包含节点键的列名.[默认: node]
    --range <n>            指示给定图包含 <n> 个节点,ID 范围从 0 到 <n> - 1.
                           这可以用作提高性能的一种手段.

bipartite options:
    --disjoint-keys  如果您知道图的两个分区使用不相交的键集(即它们没有
                      共同的键),请传递此选项.如果某些键被两个分区使用,
                      将产生不正确的图！

xan network -f "nodelist" options:
    -D, --degrees  是否计算节点度数以便添加到相关输出.目前仅在使用
                   -f "nodelist" 时相关.
    --union-find   是否在输出中添加 "component" 列,指示每个节点所属
                   的分量标签.

Common options:
    -h, --help             显示帮助
    -o, --output <file>    将输出写入<file>而非stdout.
    -n, --no-headers       设置后,文件将被视为没有标题行.
    -d, --delimiter <arg>  读取 CSV 数据时的字段分隔符.必须是单个字符.
```
