<!-- Generated -->
# duckdb

```txt
Run a DuckDB SQL query inside the pipeline.

This is a plugin command: it invokes the external `duckdb` executable, so the
DuckDB CLI plugin must be installed first (see Settings → Plugins). It composes
with xan commands in the same pipeline.

The pipeline's upstream data is exposed to the query as the virtual relation
`input`, so most queries simply read from `input`. When the opened input is a
`.duckdb` file, its selected table can also be referenced through the attached
`src` schema (e.g. `src.orders`). Queries that do not mention `input` run
standalone, which is useful to read external files with `read_csv_auto`,
`read_parquet` or `read_json_auto`.

Results are always emitted as CSV with a header row. The field delimiter is the
app's default delimiter setting.

Usage:
    duckdb <sql>

duckdb options:
    <sql>                  SQL query to execute. [required]

Pipeline notes:
    - Consecutive duckdb steps run in a single process and hand intermediate
      results over without a CSV round-trip.
    - Every duckdb step except the last one must be a single query; multiple
      statements separated by `;` are rejected. Move such SQL to the last step
      or split it into several steps.
    - A trailing semicolon is allowed and is stripped automatically.

Examples:
    duckdb 'SELECT * FROM input LIMIT 100'
    duckdb 'SELECT region, sum(amount) AS total FROM input GROUP BY region'
    duckdb 'SELECT * FROM input WHERE amount > 0 ORDER BY amount DESC'
    duckdb 'SELECT * FROM read_csv_auto(''other.csv'', header = true)'
    duckdb 'SELECT * FROM src.orders LIMIT 100'
```
