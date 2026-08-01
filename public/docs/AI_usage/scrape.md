# scrape

Purpose: Scrape HTML into CSV data

Parameters:
- evaluate: Evaluate the given scraping expression
- paths: Read input and consider it as containing one document path per line
- docs: Read input as CSV file with a column containing inline documents
- doc-column: Selects column containing inline documents given through --docs
- stdin-doc: Read the content of stdin as a single document
- glob: Collect document paths to process by applying the given glob pattern
- encoding: Encoding to read on disk. Will default to utf-8
- keep: Selection of columns from the input to keep in the output
- input-dir: Processed paths will be read relative to the given base path
- url-column: Column containing the base url for given HTML
- foreach: Return one row per element matching the CSS selector

Examples:
- Scrape web page with CSS selector: scrape -e '.title'
