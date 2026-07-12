import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { getParameterDescription } from "@/components/dialog/commands/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function BeheadForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.append}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "append",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          append
        </label>
      </div>
    </CommandFormWrapper>
  );
}

export function RenameForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">select (optional)</label>
        <input
          type="text"
          value={commandDialog.params.select || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "select",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("rename", "select", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">columns</label>
        <input
          type="text"
          value={commandDialog.params.columns || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "columns",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("rename", "columns", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">prefix</label>
          <input
            type="text"
            value={commandDialog.params.prefix || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "prefix",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("rename", "prefix", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">suffix</label>
          <input
            type="text"
            value={commandDialog.params.suffix || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "suffix",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("rename", "suffix", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {["slugify", "replace", "force"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={commandDialog.params[n]}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  n,
                  e.target.checked,
                )
              }
              className="h-3.5 w-3.5 accent-foreground"
            />
            {n}
          </label>
        ))}
      </div>
    </CommandFormWrapper>
  );
}

export function InputForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-sm font-medium">quote</label>
          <input
            type="text"
            value={commandDialog.params.quote || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "quote",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("input", "quote", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">escape</label>
          <input
            type="text"
            value={commandDialog.params.escape || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "escape",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("input", "escape", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">comment</label>
          <input
            type="text"
            value={commandDialog.params.comment || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "comment",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("input", "comment", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-sm font-medium">skip-lines</label>
          <input
            type="number"
            min={0}
            value={commandDialog.params["skip-lines"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "skip-lines",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("input", "skip-lines", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">skip-until</label>
          <input
            type="text"
            value={commandDialog.params["skip-until"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "skip-until",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("input", "skip-until", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">skip-while</label>
          <input
            type="text"
            value={commandDialog.params["skip-while"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "skip-while",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("input", "skip-while", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {["tabs", "no-quoting", "trim", "tolerant", "gzip", "zstd"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={commandDialog.params[n]}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  n,
                  e.target.checked,
                )
              }
              className="h-3.5 w-3.5 accent-foreground"
            />
            {n}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-2">
        {["vcf", "gtf", "gff", "sam", "bed", "cdx"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={commandDialog.params[n]}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  n,
                  e.target.checked,
                )
              }
              className="h-3.5 w-3.5 accent-foreground"
            />
            .{n}
          </label>
        ))}
      </div>
    </CommandFormWrapper>
  );
}

export function FixlengthsForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">length</label>
        <input
          type="number"
          value={commandDialog.params.length || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "length",
              e.target.value,
            )
          }
          placeholder="Forcefully set the length of each record"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["trust-header"]}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "trust-header",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          trust-header
        </label>
      </div>
    </CommandFormWrapper>
  );
}

export function FmtForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">out-delimiter</label>
          <SearchableSelect
            value={commandDialog.params["out-delimiter"] || ","}
            onChange={(value) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "out-delimiter",
                value,
              )
            }
            options={[
              { label: "Comma (,)", value: "," },
              { label: "Tab (\\t)", value: "\t" },
              { label: "Semicolon (;)", value: ";" },
              { label: "Pipe (|)", value: "|" },
              { label: "Caret (^)", value: "^" },
            ]}
            placeholder="Search or select..."
            size="md"
          />
        </div>
        <div>
          <label className="text-sm font-medium">quote</label>
          <input
            type="text"
            value={commandDialog.params.quote || '"'}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "quote",
                e.target.value,
              )
            }
            placeholder="Quote character"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">escape</label>
          <input
            type="text"
            value={commandDialog.params.escape || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "escape",
                e.target.value,
              )
            }
            placeholder="Escape character"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {[
          "in-place",
          "tabs",
          "crlf",
          "ascii",
          "quote-always",
          "quote-never",
        ].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={commandDialog.params[n]}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  n,
                  e.target.checked,
                )
              }
              className="h-3.5 w-3.5 accent-foreground"
            />
            {n}
          </label>
        ))}
      </div>
    </CommandFormWrapper>
  );
}

export function ExplodeForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">columns</label>
          <input
            type="text"
            value={commandDialog.params.columns || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "columns",
                e.target.value,
              )
            }
            placeholder="Columns to explode"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">sep</label>
          <input
            type="text"
            value={commandDialog.params.sep || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "sep",
                e.target.value,
              )
            }
            placeholder="Separator to split the cells"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">evaluate-file</label>
        <input
          type="text"
          value={commandDialog.params["evaluate-file"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "evaluate-file",
              e.target.value,
            )
          }
          placeholder="Read splitting expression from a file instead"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">evaluate</label>
          <input
            type="text"
            value={commandDialog.params.evaluate || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "evaluate",
                e.target.value,
              )
            }
            placeholder="Expression to split cells"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">rename</label>
          <input
            type="text"
            value={commandDialog.params.rename || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "rename",
                e.target.value,
              )
            }
            placeholder="New names for the exploded columns"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {["singularize", "keep", "drop-empty", "pad"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={commandDialog.params[n]}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  n,
                  e.target.checked,
                )
              }
              className="h-3.5 w-3.5 accent-foreground"
            />
            {n}
          </label>
        ))}
      </div>
    </CommandFormWrapper>
  );
}

export function ImplodeForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props} disabled={!commandDialog.params.columns}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">columns</label>
          <input
            type="text"
            value={commandDialog.params.columns || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "columns",
                e.target.value,
              )
            }
            placeholder="Columns to implode"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">sep</label>
          <input
            type="text"
            value={commandDialog.params.sep || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "sep",
                e.target.value,
              )
            }
            placeholder="Separator for joining cells"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">rename</label>
          <input
            type="text"
            value={commandDialog.params.rename || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "rename",
                e.target.value,
              )
            }
            placeholder="New name for the diverging column"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">cmp</label>
          <input
            type="text"
            value={commandDialog.params.cmp || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "cmp",
                e.target.value,
              )
            }
            placeholder="Columns to compare for merging"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.pluralize}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "pluralize",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          pluralize
        </label>
      </div>
    </CommandFormWrapper>
  );
}

export function FromForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">format</label>
          <SearchableSelect
            value={commandDialog.params.format || ""}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "format", value)
            }
            options={[
              { label: "ODS", value: "ods" },
              { label: "XLS", value: "xls" },
              { label: "XLSB", value: "xlsb" },
              { label: "XLSX", value: "xlsx" },
              { label: "JSON", value: "json" },
              { label: "JSONL", value: "jsonl" },
              { label: "NDJSON", value: "ndjson" },
              { label: "Text", value: "txt" },
              { label: "NPY", value: "npy" },
              { label: "TAR", value: "tar" },
              { label: "Markdown (.md)", value: "md" },
              { label: "Markdown (.markdown)", value: "markdown" },
            ]}
            placeholder="Search or select..."
            size="md"
          />
        </div>
      </div>
      {(commandDialog.params.format === "ods" ||
        commandDialog.params.format === "xls" ||
        commandDialog.params.format === "xlsb" ||
        commandDialog.params.format === "xlsx") && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">sheet-index</label>
              <input
                type="number"
                min={0}
                value={commandDialog.params["sheet-index"] || ""}
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "sheet-index",
                    e.target.value,
                  )
                }
                placeholder="0-based index"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">sheet-name</label>
              <input
                type="text"
                value={commandDialog.params["sheet-name"] || ""}
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "sheet-name",
                    e.target.value,
                  )
                }
                placeholder="Name of the sheet"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            {["no-infer", "strip-empty"].map((n) => (
              <label
                key={n}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={commandDialog.params[n]}
                  onChange={(e) =>
                    updateParam(
                      commandDialog,
                      setCommandDialog,
                      n,
                      e.target.checked,
                    )
                  }
                  className="h-3.5 w-3.5 accent-foreground"
                />
                {n}
              </label>
            ))}
          </div>
        </div>
      )}
      {(commandDialog.params.format === "json" ||
        commandDialog.params.format === "jsonl" ||
        commandDialog.params.format === "ndjson") && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            {["explode-arrays", "json"].map((n) => (
              <label
                key={n}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={commandDialog.params[n]}
                  onChange={(e) =>
                    updateParam(
                      commandDialog,
                      setCommandDialog,
                      n,
                      e.target.checked,
                    )
                  }
                  className="h-3.5 w-3.5 accent-foreground"
                />
                {n}
              </label>
            ))}
          </div>
        </div>
      )}
      {commandDialog.params.format === "npy" && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">select</label>
            <input
              type="text"
              value={commandDialog.params.select || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "select",
                  e.target.value,
                )
              }
              placeholder="Numerical columns to read"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
      )}
      {commandDialog.params.format === "tar" && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">glob</label>
            <input
              type="text"
              value={commandDialog.params.glob || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "glob",
                  e.target.value,
                )
              }
              placeholder="Glob pattern to filter"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">skip</label>
            <input
              type="number"
              min={0}
              value={commandDialog.params.skip || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "skip",
                  e.target.value,
                )
              }
              placeholder="Number of entries to skip"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">limit</label>
            <input
              type="number"
              min={0}
              value={commandDialog.params.limit || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "limit",
                  e.target.value,
                )
              }
              placeholder="Maximum number of entries to read"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
      )}
    </CommandFormWrapper>
  );
}

export function ToForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">format</label>
          <SearchableSelect
            value={commandDialog.params.format || "xlsx"}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "format", value)
            }
            options={[
              { label: "XLSX", value: "xlsx" },
              { label: "HTML", value: "html" },
              { label: "JSON", value: "json" },
              { label: "JSONL", value: "jsonl" },
              { label: "Markdown", value: "md" },
              { label: "NDJSON", value: "ndjson" },
              { label: "NPY", value: "npy" },
              { label: "Text", value: "txt" },
            ]}
            placeholder="Search or select..."
            size="md"
          />
        </div>
      </div>
      {(commandDialog.params.format === "json" ||
        commandDialog.params.format === "jsonl" ||
        commandDialog.params.format === "ndjson") && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">sample-size</label>
              <input
                type="number"
                min={1}
                value={commandDialog.params["sample-size"] || ""}
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "sample-size",
                    e.target.value,
                  )
                }
                placeholder="Number of rows to sample"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">strings</label>
              <input
                type="text"
                value={commandDialog.params.strings || ""}
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "strings",
                    e.target.value,
                  )
                }
                placeholder="Force as raw strings"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {["nulls", "omit"].map((n) => (
              <label
                key={n}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={commandDialog.params[n]}
                  onChange={(e) =>
                    updateParam(
                      commandDialog,
                      setCommandDialog,
                      n,
                      e.target.checked,
                    )
                  }
                  className="h-3.5 w-3.5 accent-foreground"
                />
                {n}
              </label>
            ))}
          </div>
        </div>
      )}
      {commandDialog.params.format === "npy" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">dtype</label>
              <select
                value={commandDialog.params.dtype || "f64"}
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "dtype",
                    e.target.value,
                  )
                }
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              >
                <option value="f32">f32</option>
                <option value="f64">f64</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">select</label>
              <input
                type="text"
                value={commandDialog.params.select || ""}
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "select",
                    e.target.value,
                  )
                }
                placeholder="Numerical columns to emit"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
          </div>
        </div>
      )}
      {commandDialog.params.format === "txt" && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">select</label>
            <input
              type="text"
              value={commandDialog.params.select || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "select",
                  e.target.value,
                )
              }
              placeholder="Column to emit as text"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
      )}
      {commandDialog.params.format === "md" && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">limit</label>
            <input
              type="number"
              min={0}
              value={commandDialog.params.limit || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "limit",
                  e.target.value,
                )
              }
              placeholder="Maximum number of rows"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
      )}
    </CommandFormWrapper>
  );
}

export function ScrapeForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props} scrollHeight="30vh">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">evaluate</label>
          <input
            type="text"
            value={commandDialog.params.evaluate || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "evaluate",
                e.target.value,
              )
            }
            placeholder="Scraping expression"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">evaluate-file</label>
          <input
            type="text"
            value={commandDialog.params["evaluate-file"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "evaluate-file",
                e.target.value,
              )
            }
            placeholder="Path to expression file"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">paths</label>
          <input
            type="text"
            value={commandDialog.params.paths || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "paths",
                e.target.value,
              )
            }
            placeholder="Input file with document paths"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">path-column</label>
          <input
            type="text"
            value={commandDialog.params["path-column"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "path-column",
                e.target.value,
              )
            }
            placeholder="Column name containing paths"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">docs</label>
          <input
            type="text"
            value={commandDialog.params.docs || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "docs",
                e.target.value,
              )
            }
            placeholder="CSV file with inline documents"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">doc-column</label>
          <input
            type="text"
            value={commandDialog.params["doc-column"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "doc-column",
                e.target.value,
              )
            }
            placeholder="Column name containing documents"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">glob</label>
          <input
            type="text"
            value={commandDialog.params.glob || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "glob",
                e.target.value,
              )
            }
            placeholder="Glob pattern"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">input-dir</label>
          <input
            type="text"
            value={commandDialog.params["input-dir"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "input-dir",
                e.target.value,
              )
            }
            placeholder="Base path for document paths"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {["stdin-doc", "parallel"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={commandDialog.params[n]}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  n,
                  e.target.checked,
                )
              }
              className="h-3.5 w-3.5 accent-foreground"
            />
            {n}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">encoding</label>
          <input
            type="text"
            value={commandDialog.params.encoding || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "encoding",
                e.target.value,
              )
            }
            placeholder="File encoding"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">threads</label>
          <input
            type="number"
            value={commandDialog.params.threads || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "threads",
                e.target.value,
              )
            }
            placeholder="Number of threads"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">keep</label>
          <input
            type="text"
            value={commandDialog.params.keep || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "keep",
                e.target.value,
              )
            }
            placeholder="Columns to keep in output"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">url-column</label>
          <input
            type="text"
            value={commandDialog.params["url-column"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "url-column",
                e.target.value,
              )
            }
            placeholder="Column containing base URL"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">foreach</label>
        <input
          type="text"
          value={commandDialog.params.foreach || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "foreach",
              e.target.value,
            )
          }
          placeholder="CSS selector for iteration"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function ReverseForm(props: CommandFormProps) {
  return (
    <CommandFormWrapper {...props}>
      <></>
    </CommandFormWrapper>
  );
}
