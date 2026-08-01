# split

Purpose: Split CSV data into chunks

Parameters:
- out-dir: Where to write the chunks. Defaults to current working directory
- size: The number of records to write into each chunk
- chunks: Divide the file into at most <n> chunks having roughly the same number of records
- filename: A filename template to use when constructing the names of the output files
