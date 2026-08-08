<!-- Generated -->
# chart

```txt
Create interactive charts using recharts.

Supported chart types:
  line        - Line chart for trends over time or ordered data
  scatter     - Scatter plot for correlation analysis
  bar         - Bar chart for categorical comparisons
  histogram   - Histogram for distribution visualization
  pie         - Pie chart for proportional data
  wordcloud   - Word cloud for text frequency visualization
  heatmap     - Heatmap for matrix-like data visualization

Usage:
    chart --chart-type <type> <x> <y> [options]
    chart --chart-type pie <x> [options]
    chart --chart-type histogram <x> [options]
    chart --chart-type wordcloud <x> [options]
    chart --help

Required parameters:
    --chart-type <type>   Type of chart to create. Can be "line", "scatter",
                          "bar", "histogram", "pie", "wordcloud", or "heatmap"
                          [default: line]
    <x>                   Column name for X axis

Optional parameters:
    <y>                   Column name for Y axis (required for line, scatter,
                          bar; optional for histogram; used as weight for wordcloud)
    -c, --category <col>  Column name for grouping data into multiple series
    --title <text>        Chart title
    --x-label <text>      Label for X axis
    --y-label <text>      Label for Y axis
    --bins <n>            Number of bins for histogram [default: 10]
    --color <hex>         Primary color for the chart [default: #8884d8]
    --width <n>           Chart width in pixels [default: 600]
    --height <n>          Chart height in pixels [default: 400]

Chart-specific behavior:

  line/scatter/bar:
    - Uses both x and y columns for data points
    - Optional category column for multi-series display
    - Legend toggle to show/hide individual series

  histogram:
    - Uses x column for data distribution
    - Optional y column for weighting
    - Bins parameter controls number of buckets
    - Shows frequency counts

  pie:
    - Uses x column for slice labels
    - Values are automatically aggregated if x has duplicates
    - Optional category for multiple pie charts
    - Click legend to show/hide slices

  wordcloud:
    - Uses x column as text source (splits by spaces)
    - Optional y column for word weighting
    - Font size indicates frequency/importance
    - Maximum 200 words displayed

  heatmap:
    - Uses both x and y columns for matrix dimensions
    - Cell color intensity based on count of x-y combinations
    - Click cells to show/hide
    - Hover for detailed tooltip

Examples:

  Create a line chart:

    $ chart --chart-type line --x date --y revenue sales.csv

  Create a scatter plot with category grouping:

    $ chart --chart-type scatter --x temperature --y sales --category store sales.csv

  Create a bar chart:

    $ chart --chart-type bar --x category --y count --title "Sales by Category" data.csv

  Create a histogram:

    $ chart --chart-type histogram --x age --bins 20 --title "Age Distribution" users.csv

  Create a pie chart:

    $ chart --chart-type pie --x category --title "Market Share" data.csv

  Create a word cloud:

    $ chart --chart-type wordcloud --x description --title "Product Keywords" products.csv

  Create a heatmap:

    $ chart --chart-type heatmap --x day --y hour --title "Activity Heatmap" logs.csv
```
