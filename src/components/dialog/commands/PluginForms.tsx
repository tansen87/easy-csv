import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useLanguage } from "@/i18n";

export function PinyinForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  const isZh = language === "zh";

  return (
    <CommandFormWrapper {...props} disabled={!commandDialog.params.columns}>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">
            {isZh ? "要转换的列" : "Columns"}
          </label>
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
            placeholder={isZh ? "如 name 或 0,2" : "e.g. name or 0,2"}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            autoFocus
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            {isZh ? "拼音风格" : "Style"}
          </label>
          <SearchableSelect
            value={commandDialog.params.style}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "style", value)
            }
            options={[
              { label: "upper", value: "upper" },
              { label: "lower", value: "lower" },
              { label: "plain", value: "plain" },
            ]}
            placeholder={isZh ? "选择风格" : "Select style"}
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            {isZh ? "后缀(可选)" : "Suffix (optional)"}
          </label>
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
            placeholder={isZh ? "如 _py(保留原列并追加新列)" : "e.g. _py"}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormWrapper>
  );
}
