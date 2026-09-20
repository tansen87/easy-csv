import { Checkbox, TextField, PatternListInput } from "./_shared";
import { CommandFormProps } from "@/types/dialog";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function SearchForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { t, effectiveLanguage } = useLanguage();

  const rawAddPattern = commandDialog.params["add-pattern"];
  const hasMultiPattern = Array.isArray(rawAddPattern)
    ? rawAddPattern.some((v) => v !== "" && v != null)
    : !!rawAddPattern;
  const hasPatternsFile = !!commandDialog.params["patterns"];

  return (
    <CommandFormShell {...props} scrollHeight="28vh">
      {hasMultiPattern && hasPatternsFile && (
        <div className="text-xs text-amber-600 dark:text-amber-400 border border-amber-300 rounded-md px-2 py-1.5">
          {t.searchPatternConflictWarning}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <TextField
          name="select"
          placeholder={getParameterDescription(
            "search",
            "select",
            effectiveLanguage,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="pattern"
          placeholder={getParameterDescription(
            "search",
            "pattern",
            effectiveLanguage,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
      </div>
      <PatternListInput
        commandDialog={commandDialog}
        setCommandDialog={setCommandDialog}
      />
      <div className="grid grid-cols-5 gap-2">
        {[
          "ignore-case",
          "invert-match",
          "exact",
          "regex",
          "url-prefix",
          "non-empty",
          "empty",
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
          placeholder={getParameterDescription(
            "search",
            "boolean",
            effectiveLanguage,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="count"
          placeholder={getParameterDescription(
            "search",
            "count",
            effectiveLanguage,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          name="limit"
          type="number"
          placeholder={getParameterDescription(
            "search",
            "limit",
            effectiveLanguage,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="threads"
          type="number"
          placeholder={getParameterDescription(
            "search",
            "threads",
            effectiveLanguage,
          )}
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
            effectiveLanguage,
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
            effectiveLanguage,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          name="replace"
          placeholder={getParameterDescription(
            "search",
            "replace",
            effectiveLanguage,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="patterns"
          placeholder={getParameterDescription(
            "search",
            "patterns",
            effectiveLanguage,
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
            effectiveLanguage,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="sep"
          placeholder={getParameterDescription(
            "search",
            "sep",
            effectiveLanguage,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          name="pattern-column"
          placeholder={getParameterDescription(
            "search",
            "pattern-column",
            effectiveLanguage,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
        <TextField
          name="replacement-column"
          placeholder={getParameterDescription(
            "search",
            "replacement-column",
            effectiveLanguage,
          )}
          commandDialog={commandDialog}
          setCommandDialog={setCommandDialog}
        />
      </div>
      <TextField
        name="name-column"
        placeholder={getParameterDescription(
          "search",
          "name-column",
          effectiveLanguage,
        )}
        commandDialog={commandDialog}
        setCommandDialog={setCommandDialog}
      />
    </CommandFormShell>
  );
}
