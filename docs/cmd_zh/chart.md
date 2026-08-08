<!-- Generated -->
# chart

```txt
使用 recharts 创建交互式图表.

支持的图表类型:
  line        - 折线图,用于显示趋势变化或有序数据
  scatter     - 散点图,用于相关性分析
  bar         - 柱状图,用于分类比较
  histogram   - 直方图,用于分布可视化
  pie         - 饼图,用于比例数据
  wordcloud   - 词云,用于文本频率可视化
  heatmap     - 热力图,用于矩阵数据可视化

用法:
    chart --chart-type <type> <x> <y> [options]
    chart --chart-type pie <x> [options]
    chart --chart-type histogram <x> [options]
    chart --chart-type wordcloud <x> [options]
    chart --help

必需参数:
    --chart-type <type>   要创建的图表类型,可以是 "line"、"scatter"、
                          "bar"、"histogram"、"pie"、"wordcloud" 或 "heatmap"
                          [默认: line]
    <x>                   X轴的列名

可选参数:
    <y>                   Y轴的列名(折线图、散点图、柱状图必填;直方图可选;词云中用作权重)
    -c, --category <col>  用于将数据分组为不同系列的列名
    --title <text>        图表标题
    --x-label <text>      X轴标签
    --y-label <text>      Y轴标签
    --bins <n>            直方图的分箱数量 [默认: 10]
    --color <hex>         图表的主色调 [默认: #8884d8]
    --width <n>           图表宽度(像素) [默认: 600]
    --height <n>          图表高度(像素) [默认: 400]

图表特定行为:

  line/scatter/bar:
    - 使用 x 和 y 列绘制数据点
    - 可选 category 列用于多系列显示
    - 图例切换显示/隐藏各个系列

  histogram:
    - 使用 x 列绘制数据分布
    - 可选 y 列用于加权
    - bins 参数控制分箱数量
    - 显示频率计数

  pie:
    - 使用 x 列作为切片标签
    - 如果 x 有重复值会自动聚合
    - 可选 category 生成多个饼图
    - 点击图例显示/隐藏切片

  wordcloud:
    - 使用 x 列作为文本源(按空格分词)
    - 可选 y 列用于词频加权
    - 字体大小表示频率/重要性
    - 最多显示 200 个词

  heatmap:
    - 使用 x 和 y 列定义矩阵维度
    - 单元格颜色强度基于 x-y 组合的计数
    - 点击单元格显示/隐藏
    - 悬停显示详细提示

示例:

  创建折线图:

    $ chart --chart-type line --x date --y revenue sales.csv

  创建带分类的散点图:

    $ chart --chart-type scatter --x temperature --y sales --category store sales.csv

  创建柱状图:

    $ chart --chart-type bar --x category --y count --title "Sales by Category" data.csv

  创建直方图:

    $ chart --chart-type histogram --x age --bins 20 --title "Age Distribution" users.csv

  创建饼图:

    $ chart --chart-type pie --x category --title "Market Share" data.csv

  创建词云:

    $ chart --chart-type wordcloud --x description --title "Product Keywords" products.csv

  创建热力图:

    $ chart --chart-type heatmap --x day --y hour --title "Activity Heatmap" logs.csv
```
