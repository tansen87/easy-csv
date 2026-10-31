<!-- Generated -->
# duckdb

```txt
在管道中执行 DuckDB SQL 查询.

这是一个插件命令: 通过外部 `duckdb` 可执行文件运行, 因此需要先安装
DuckDB CLI 插件(见 设置 → 插件). 它可与 xan 命令组合在同一管道中.

管道上游数据会以虚拟关系 `input` 暴露给查询, 因此大多数查询直接从
`input` 读取即可. 当打开的输入是 `.duckdb` 文件时, 选中的表还可以通过
挂载的 `src` schema 访问(例如 `src.orders`). 未引用 `input` 的查询会独立
执行, 适合用 `read_csv_auto`、`read_parquet` 或 `read_json_auto` 直接读取
外部文件.

结果始终以带表头的 CSV 输出, 字段定界符取应用设置中的默认分隔符.

用法:
    duckdb <sql>

duckdb 选项:
    <sql>                  要执行的 SQL 查询. [必填]

管道说明:
    - 连续的 duckdb 步骤在同一个进程中运行, 中间结果无需经过 CSV 中转.
    - 除最后一步外, 每个 duckdb 步骤必须是单条查询; 用 `;` 分隔的多条语句
      会被拒绝. 请把这类 SQL 放到最后一步, 或拆成多个步骤.
    - 允许语句末尾带分号, 会自动去除.

示例:
    duckdb 'SELECT * FROM input LIMIT 100'
    duckdb 'SELECT region, sum(amount) AS total FROM input GROUP BY region'
    duckdb 'SELECT * FROM input WHERE amount > 0 ORDER BY amount DESC'
    duckdb 'SELECT * FROM read_csv_auto(''other.csv'', header = true)'
    duckdb 'SELECT * FROM src.orders LIMIT 100'
```
