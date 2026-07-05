# xan headers

`headers` 命令显示给定 CSV 文件的列名.

所以,给定这个特定文件:

*people.csv*

| name      | surname |
| --------- | ------- |
| John      | Black   |
| Lucy      | Red     |
| Guillaume | Orange  |

以下命令:

```bash
xan headers people.csv
```

将返回:

```txt
0 name
1 surname
```

请注意,该命令将用红色突出显示重复的列名,以帮助您更好地发现它们,因为它们有时可能很麻烦.

## 忽略列索引

使用 `-j/--just-names` 可以避免打印列索引:

```bash
xan headers -j people.csv
```

将返回:

```txt
name
surname
```
