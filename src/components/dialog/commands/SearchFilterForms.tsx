import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";
import { getParameterDescription } from "@/components/dialog/commands/parameterDescriptions";
import { CommandDialogState } from "@/components/dialog/CommandDialog";
import { useLanguage } from "@/i18n";

function Checkbox({
  name,
  commandDialog,
  setCommandDialog,
}: {
  name: string;
  commandDialog: CommandDialogState;
  setCommandDialog: (d: CommandDialogState | null) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={commandDialog.params[name]}
        onChange={(e) =>
          updateParam(commandDialog, setCommandDialog, name, e.target.checked)
        }
        className="h-3.5 w-3.5 accent-foreground"
      />
      {name}
    </label>
  );
}

function TextField({
  name,
  placeholder,
  type = "text",
  commandDialog,
  setCommandDialog,
}: {
  name: string;
  placeholder?: string;
  type?: string;
  commandDialog: CommandDialogState;
  setCommandDialog: (d: CommandDialogState | null) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{name}</label>
      <input
        type={type}
        value={commandDialog.params[name] || ""}
        onChange={(e) =>
          updateParam(commandDialog, setCommandDialog, name, e.target.value)
        }
        placeholder={placeholder}
        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
      />
    </div>
  );
}

export function SearchForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();

  return (
    <CommandFormWrapper {...props} scrollHeight="28vh">
      <div className="grid grid-cols-2 gap-2">
        <TextField
          name="select"
          placeholder={getParameterDescription("search", "select", language)}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="pattern"
          placeholder={getParameterDescription("search", "pattern", language)}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
      </div>
      <div className="grid grid-cols-5 gap-2">
        {["keep", "lines", "exact", "regex", "url-prefix"].map((n) => (
          <Checkbox
            key={n}
            name={n}
            commandDialog={commandDialog}
            setCommandDialog={setCommandDialog}
          />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[
          "non-empty",
          "empty",
          "ignore-case",
          "parallel",
          "fast-parser",
          "every-column",
          "overlapping",
          "left",
          "breakdown",
        ].map((n) => (
          <Checkbox
            key={n}
            name={n}
            commandDialog={commandDialog}
            setCommandDialog={setCommandDialog}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          name="flag"
          placeholder={getParameterDescription("search", "boolean", language)}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="count"
          placeholder={getParameterDescription("search", "count", language)}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          name="limit"
          type="number"
          placeholder={getParameterDescription("search", "limit", language)}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="threads"
          type="number"
          placeholder={getParameterDescription("search", "threads", language)}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          name="levenshtein"
          type="number"
          placeholder={getParameterDescription(
            "search",
            "levenshtein",
            language,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="damerau-levenshtein"
          type="number"
          placeholder={getParameterDescription(
            "search",
            "damerau-levenshtein",
            language,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          name="replace"
          placeholder={getParameterDescription("search", "replace", language)}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="add-pattern"
          placeholder={getParameterDescription(
            "search",
            "add-pattern",
            language,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          name="unique-matches"
          placeholder={getParameterDescription(
            "search",
            "unique-matches",
            language,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="sep"
          placeholder={getParameterDescription("search", "sep", language)}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
      </div>
      <TextField
        name="patterns"
        placeholder={getParameterDescription("search", "patterns", language)}
        commandDialog={commandDialog}
        setCommandDialog={setCommandDialog}
      />
      <div className="grid grid-cols-2 gap-2">
        <TextField
          name="pattern-column"
          placeholder={getParameterDescription(
            "search",
            "pattern-column",
            language,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="replacement-column"
          placeholder={getParameterDescription(
            "search",
            "replacement-column",
            language,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
      </div>
      <TextField
        name="name-column"
        placeholder={getParameterDescription("search", "name-column", language)}
        commandDialog={commandDialog}
        setCommandDialog={setCommandDialog}
      />
    </CommandFormWrapper>
  );
}

export function FilterForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props} disabled={!commandDialog.params.expression}>
      <div>
        <label className="text-sm font-medium">expression</label>
        <input
          type="text"
          value={commandDialog.params.expression}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "expression",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "filter",
            "expression",
            language,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="flex gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["invert-match"]}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "invert-match",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          invert-match
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.parallel}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "parallel",
                e.target.checked,
              )
            }
          />
          parallel
        </label>
        <input
          type="number"
          min={0}
          value={commandDialog.params.threads || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "threads",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("filter", "threads", language)}
          className="h-8 px-1 text-sm border rounded-md bg-background"
        />
        <input
          type="number"
          min={1}
          value={commandDialog.params.limit || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "limit",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("filter", "limit", language)}
          className="h-8 px-1 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function HeadForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">limit</label>
        <input
          type="number"
          min={1}
          value={commandDialog.params.limit || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "limit",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("head", "limit", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function TailForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">limit</label>
        <input
          type="number"
          min={1}
          value={commandDialog.params.limit || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "limit",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("tail", "limit", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function SliceForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">start</label>
          <input
            type="number"
            value={commandDialog.params.start || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "start",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("slice", "start", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">skip</label>
          <input
            type="number"
            value={commandDialog.params.skip || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "skip",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("slice", "skip", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">end</label>
          <input
            type="number"
            value={commandDialog.params.end || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "end",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("slice", "end", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">len</label>
          <input
            type="number"
            min={1}
            value={commandDialog.params.len || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "len",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("slice", "len", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">index</label>
          <input
            type="number"
            value={commandDialog.params.index || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "index",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("slice", "index", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">indices</label>
          <input
            type="number"
            min={1}
            value={commandDialog.params.indices || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "indices",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("slice", "indices", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">last</label>
          <input
            type="number"
            min={1}
            value={commandDialog.params.last || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "last",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("slice", "last", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormWrapper>
  );
}

export function TopForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">column</label>
          <input
            type="text"
            value={commandDialog.params.column ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "column",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("top", "column", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium">limit</label>
          <input
            type="number"
            value={commandDialog.params.limit ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "limit",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("top", "limit", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">groupby</label>
          <input
            type="text"
            value={commandDialog.params.groupby ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "groupby",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("top", "groupby", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">rank</label>
          <input
            type="text"
            value={commandDialog.params.rank ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "rank",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("top", "rank", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {["reverse", "lexicographic", "sorted", "ties"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={commandDialog.params[n] ?? false}
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

export function SampleForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">sample-size</label>
          <input
            type="number"
            min={1}
            value={commandDialog.params["sample-size"] ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "sample-size",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "sample",
              "sample-size",
              language,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium">seed</label>
          <input
            type="number"
            value={commandDialog.params.seed ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "seed",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("sample", "seed", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">weight</label>
          <input
            type="text"
            value={commandDialog.params.weight ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "weight",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("sample", "weight", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">groupby</label>
          <input
            type="text"
            value={commandDialog.params.groupby ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "groupby",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("sample", "groupby", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {["sorted", "cursed"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={commandDialog.params[n] ?? false}
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

export function BisectForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper
      {...props}
      disabled={!commandDialog.params.column || !commandDialog.params.value}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">column</label>
          <input
            type="text"
            value={commandDialog.params.column || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "column",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("bisect", "column", language)}
            className="w-full h-8 px-3 text-sm border rounded-md"
          />
        </div>
        <div>
          <label className="text-sm font-medium">value</label>
          <input
            type="text"
            value={commandDialog.params.value || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "value",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("bisect", "value", language)}
            className="w-full h-8 px-3 text-sm border rounded-md"
          />
        </div>
      </div>
      <div className="flex gap-16">
        {["search", "reverse", "numeric", "exclude", "verbose"].map((n) => (
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
