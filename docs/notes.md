### date format

* expression

```easy-csv
strftime(datetime(col("date 1"), "%Y%m%d"), "%d/%m/%Y") as "date fmt"
```

* demo output

```demo
idx,date 1,date fmt
1,20250301,01/03/2025
2,20250202,02/02/2025
3,20250303,03/03/2025
4,20250404,04/04/2025
```

### string

* expression

```easy-csv
split(col("date fmt"), "/")[1] ++ "_" ++ col("date 1")[2:4] as res
```

* demo output

```demo
idx,date 1,date fmt,res
123,20250301,01/03/2025,03_25
2,20250202,02/02/2025,02_25
3,20250303,03/03/2025,03_25
4,20250404,04/04/2025,04_25
```

