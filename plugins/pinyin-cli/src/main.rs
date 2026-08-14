use std::io::{Read, Write};
use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::Parser;
use csv::{ReaderBuilder, WriterBuilder};
use pinyin::ToPinyin;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Style {
  Plain,
  Upper,
  Lower,
}

#[derive(Debug)]
struct Config {
  columns: String,
  style: Style,
  delimiter: u8,
  no_headers: bool,
  suffix: Option<String>,
}

#[derive(Parser, Debug)]
#[command(
  name = "pinyin",
  version,
  about = "Convert Chinese characters in CSV columns to pinyin.",
  long_about = "A small CLI plugin that reads CSV from stdin (or a file) and replaces Chinese\ncharacters in the given columns with pinyin, writing the result as CSV to stdout.\nIt is designed to be chained with xan commands."
)]
struct Cli {
  /// Columns to convert, as names or 0-based indices (comma-separated)
  #[arg(short = 'c', long = "columns", value_name = "COLUMNS")]
  columns: String,

  /// Pinyin style: plain (capitalized initial per Chinese character),
  /// upper or lower (default: plain)
  #[arg(
    short = 's',
    long = "style",
    default_value = "plain",
    value_name = "STYLE"
  )]
  style: String,

  /// Field delimiter, a single character (use \t for tab)
  #[arg(
    short = 'd',
    long = "delimiter",
    default_value = ",",
    value_name = "ARG"
  )]
  delimiter: String,

  /// Treat the first row as data instead of headers
  #[arg(short = 'n', long = "no-headers")]
  no_headers: bool,

  /// Keep the original columns and append new ones named <col><SUFFIX>
  #[arg(long = "suffix", value_name = "SUFFIX")]
  suffix: Option<String>,

  /// Write output to FILE instead of stdout
  #[arg(short = 'o', long = "output", value_name = "FILE")]
  output: Option<PathBuf>,

  /// Input CSV file (reads from stdin when omitted)
  #[arg(value_name = "INPUT")]
  input: Option<PathBuf>,
}

impl Config {
  fn from_cli(cli: &Cli) -> Result<Self> {
    Ok(Config {
      columns: cli.columns.clone(),
      style: parse_style(&cli.style)?,
      delimiter: parse_delimiter(&cli.delimiter)?,
      no_headers: cli.no_headers,
      suffix: cli.suffix.clone(),
    })
  }
}

fn parse_style(s: &str) -> Result<Style> {
  Ok(match s {
    "upper" => Style::Upper,
    "lower" => Style::Lower,
    "plain" => Style::Plain,
    other => anyhow::bail!("unknown pinyin style: {other} (expected plain, upper or lower)"),
  })
}

fn parse_delimiter(s: &str) -> Result<u8> {
  let c = match s {
    "\\t" | "TAB" => '\t',
    _ => s
      .chars()
      .next()
      .context("delimiter must be a single character")?,
  };
  let b = c as u32;
  if b > 255 {
    anyhow::bail!("delimiter must be an ASCII character");
  }
  Ok(b as u8)
}

fn to_pinyin_str(input: &str, style: &Style) -> String {
  input
    .chars()
    .map(|c| {
      c.to_pinyin().map_or_else(
        || c.to_string(),
        |py| match style {
          // plain: uppercase first letter of each Chinese character's pinyin
          Style::Plain => py
            .plain()
            .chars()
            .next()
            .map_or_else(String::new, |ch| ch.to_uppercase().collect()),
          Style::Upper => py.plain().to_uppercase(),
          Style::Lower => py.plain().to_lowercase(),
        },
      )
    })
    .collect()
}

fn resolve_columns(spec: &str, headers: &[String], no_headers: bool) -> Result<Vec<usize>> {
  let mut indices = Vec::new();
  for token in spec.split(',') {
    let token = token.trim();
    if token.is_empty() {
      continue;
    }
    if no_headers {
      let i: usize = token.parse().with_context(|| {
        format!("'{token}' is not a column index (--no-headers requires indices)")
      })?;
      indices.push(i);
    } else if let Some(i) = headers.iter().position(|h| h == token) {
      indices.push(i);
    } else if let Ok(i) = token.parse::<usize>() {
      indices.push(i);
    } else {
      anyhow::bail!("column '{token}' not found in headers");
    }
  }
  if indices.is_empty() {
    anyhow::bail!("no columns specified");
  }
  indices.sort_unstable();
  indices.dedup();
  Ok(indices)
}

fn process<R: Read, W: Write>(input: R, output: W, config: &Config) -> Result<()> {
  let mut rdr = ReaderBuilder::new()
    .has_headers(!config.no_headers)
    .delimiter(config.delimiter)
    .from_reader(input);

  let headers: Vec<String> = if config.no_headers {
    Vec::new()
  } else {
    rdr.headers()?.iter().map(|s| s.to_string()).collect()
  };

  if config.suffix.is_some() && config.no_headers {
    anyhow::bail!("--suffix requires headers (remove --no-headers)");
  }

  let indices = resolve_columns(&config.columns, &headers, config.no_headers)?;

  let mut wtr = WriterBuilder::new()
    .delimiter(config.delimiter)
    .from_writer(output);

  if !config.no_headers {
    if let Some(suffix) = &config.suffix {
      let mut new_headers = headers.clone();
      for &i in &indices {
        new_headers.push(format!("{}{}", headers[i], suffix));
      }
      wtr.write_record(&new_headers)?;
    } else {
      wtr.write_record(headers.iter())?;
    }
  }

  let mut record = csv::StringRecord::new();
  while rdr.read_record(&mut record)? {
    for &i in &indices {
      if i >= record.len() {
        anyhow::bail!(
          "column index {i} out of bounds (row has {} fields)",
          record.len()
        );
      }
    }

    let mut new_record = csv::StringRecord::new();
    if config.suffix.is_some() {
      for field in record.iter() {
        new_record.push_field(field);
      }
      for &i in &indices {
        new_record.push_field(&to_pinyin_str(record.get(i).unwrap_or(""), &config.style));
      }
    } else {
      for (i, field) in record.iter().enumerate() {
        if indices.contains(&i) {
          new_record.push_field(&to_pinyin_str(field, &config.style));
        } else {
          new_record.push_field(field);
        }
      }
    }

    wtr.write_record(&new_record)?;
  }

  Ok(wtr.flush()?)
}

fn main() -> Result<()> {
  let cli = Cli::parse();
  let config = Config::from_cli(&cli)?;

  let input: Box<dyn Read> = match &cli.input {
    Some(path) => Box::new(
      std::fs::File::open(path).with_context(|| format!("cannot open {}", path.display()))?,
    ),
    None => Box::new(std::io::stdin()),
  };

  let output: Box<dyn Write> = match &cli.output {
    Some(path) => Box::new(
      std::fs::File::create(path).with_context(|| format!("cannot create {}", path.display()))?,
    ),
    None => Box::new(std::io::stdout()),
  };

  process(input, output, &config)
}

#[cfg(test)]
mod tests {
  use std::io::Cursor;

  use super::*;

  fn run(input: &str, config: &Config) -> String {
    let mut out = Vec::new();
    process(Cursor::new(input.as_bytes()), &mut out, config).expect("process failed");
    String::from_utf8(out).expect("output is not utf8")
  }

  #[test]
  fn converts_chinese_in_place() {
    let config = Config {
      columns: "name".into(),
      style: Style::Plain,
      delimiter: b',',
      no_headers: false,
      suffix: None,
    };
    let out = run("name,age\n张三,20\n李四,30\n", &config);
    assert_eq!(out, "name,age\nZS,20\nLS,30\n");
  }

  #[test]
  fn plain_uses_capitalized_initial_per_character() {
    let config = Config {
      columns: "name".into(),
      style: Style::Plain,
      delimiter: b',',
      no_headers: false,
      suffix: None,
    };
    assert_eq!(run("name\n张1三\n", &config), "name\nZ1S\n");
    assert_eq!(run("name\n欧阳修\n", &config), "name\nOYX\n");
  }

  #[test]
  fn supports_upper_and_lower_styles() {
    let config = Config {
      columns: "name".into(),
      style: Style::Upper,
      delimiter: b',',
      no_headers: false,
      suffix: None,
    };
    assert_eq!(run("name\n张三\n", &config), "name\nZHANGSAN\n");

    let config = Config {
      columns: "name".into(),
      style: Style::Lower,
      delimiter: b',',
      no_headers: false,
      suffix: None,
    };
    assert_eq!(run("name\n张三\n", &config), "name\nzhangsan\n");
  }

  #[test]
  fn preserves_non_chinese_characters() {
    let config = Config {
      columns: "name".into(),
      style: Style::Plain,
      delimiter: b',',
      no_headers: false,
      suffix: None,
    };
    assert_eq!(run("name\nABC-123 !@#\n", &config), "name\nABC-123 !@#\n");
  }

  #[test]
  fn multiple_columns_by_index() {
    let config = Config {
      columns: "0,2".into(),
      style: Style::Plain,
      delimiter: b',',
      no_headers: false,
      suffix: None,
    };
    assert_eq!(run("a,b,c\n张三,x,李四\n", &config), "a,b,c\nZS,x,LS\n");
  }

  #[test]
  fn no_headers_mode_uses_indices() {
    let config = Config {
      columns: "1".into(),
      style: Style::Plain,
      delimiter: b',',
      no_headers: true,
      suffix: None,
    };
    assert_eq!(run("x,张三\ny,李四\n", &config), "x,ZS\ny,LS\n");
  }

  #[test]
  fn suffix_appends_new_columns() {
    let config = Config {
      columns: "name".into(),
      style: Style::Plain,
      delimiter: b',',
      no_headers: false,
      suffix: Some("_py".into()),
    };
    assert_eq!(
      run("name,age\n张三,20\n", &config),
      "name,age,name_py\n张三,20,ZS\n"
    );
  }

  #[test]
  fn tab_delimiter() {
    let config = Config {
      columns: "name".into(),
      style: Style::Plain,
      delimiter: b'\t',
      no_headers: false,
      suffix: None,
    };
    assert_eq!(run("name\tage\n张三\t20\n", &config), "name\tage\nZS\t20\n");
  }

  #[test]
  fn unknown_column_errors() {
    let config = Config {
      columns: "nope".into(),
      style: Style::Plain,
      delimiter: b',',
      no_headers: false,
      suffix: None,
    };
    assert!(process(Cursor::new("name\n张三\n"), &mut Vec::new(), &config).is_err());
  }

  #[test]
  fn parse_tab_delimiter() {
    assert_eq!(parse_delimiter("\\t").unwrap(), b'\t');
    assert_eq!(parse_delimiter(",").unwrap(), b',');
  }
}
