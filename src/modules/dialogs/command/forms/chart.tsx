import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { Select } from "@/components/ui/Select";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function ChartForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  const chartType = (commandDialog.params["chart-type"] as string) || "line";
  return (
    <CommandFormShell {...props} scrollHeight="26vh">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-sm font-medium">chart-type</label>
          <Select
            value={commandDialog.params["chart-type"] ?? "line"}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "chart-type", value)
            }
            options={[
              { label: "line", value: "line" },
              { label: "scatter", value: "scatter" },
              { label: "bar", value: "bar" },
              { label: "histogram", value: "histogram" },
              { label: "pie", value: "pie" },
              { label: "wordcloud", value: "wordcloud" },
              { label: "heatmap", value: "heatmap" },
            ]}
            placeholder="Select chart type..."
            size="md"
          />
        </div>
        <div>
          <label className="text-sm font-medium">x column *</label>
          <input
            type="text"
            value={commandDialog.params.x ?? ""}
            onChange={(e) =>
              updateParam(commandDialog, setCommandDialog, "x", e.target.value)
            }
            placeholder={getParameterDescription(
              "chart",
              "x",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            autoFocus
          />
        </div>
      </div>
      {(chartType === "line" ||
        chartType === "scatter" ||
        chartType === "bar" ||
        chartType === "histogram" ||
        chartType === "wordcloud" ||
        chartType === "heatmap") && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm font-medium">y column</label>
            <input
              type="text"
              value={commandDialog.params.y ?? ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "y",
                  e.target.value,
                )
              }
              placeholder={getParameterDescription(
                "chart",
                "y",
                effectiveLanguage,
              )}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          {chartType !== "histogram" && (
            <div>
              <label className="text-sm font-medium">category</label>
              <input
                type="text"
                value={commandDialog.params.category ?? ""}
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "category",
                    e.target.value,
                  )
                }
                placeholder={getParameterDescription(
                  "chart",
                  "category",
                  effectiveLanguage,
                )}
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
          )}
        </div>
      )}
      {chartType === "histogram" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm font-medium">bins (histogram)</label>
            <input
              type="number"
              min={1}
              value={commandDialog.params.bins ?? 10}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "bins",
                  parseInt(e.target.value) || 10,
                )
              }
              placeholder={getParameterDescription(
                "chart",
                "bins",
                effectiveLanguage,
              )}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-sm font-medium">title</label>
          <input
            type="text"
            value={commandDialog.params.title ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "title",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "chart",
              "title",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        {chartType !== "pie" && chartType !== "wordcloud" && (
          <div>
            <label className="text-sm font-medium">x-label</label>
            <input
              type="text"
              value={commandDialog.params["x-label"] ?? ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "x-label",
                  e.target.value,
                )
              }
              placeholder={getParameterDescription(
                "chart",
                "x-label",
                effectiveLanguage,
              )}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        )}
      </div>
      {chartType !== "pie" && chartType !== "wordcloud" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm font-medium">y-label</label>
            <input
              type="text"
              value={commandDialog.params["y-label"] ?? ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "y-label",
                  e.target.value,
                )
              }
              placeholder={getParameterDescription(
                "chart",
                "y-label",
                effectiveLanguage,
              )}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-sm font-medium">color</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={commandDialog.params.color ?? "#8884d8"}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "color",
                  e.target.value,
                )
              }
              className="h-8 w-10 p-0 border rounded cursor-pointer"
            />
            <input
              type="text"
              value={commandDialog.params.color ?? "#8884d8"}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "color",
                  e.target.value,
                )
              }
              placeholder="#8884d8"
              className="flex-1 h-8 px-3 text-sm border rounded-md bg-background w-full"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">width</label>
          <input
            type="number"
            value={commandDialog.params.width ?? 600}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "width",
                parseInt(e.target.value) || 600,
              )
            }
            placeholder="600"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">height</label>
          <input
            type="number"
            value={commandDialog.params.height ?? 400}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "height",
                parseInt(e.target.value) || 400,
              )
            }
            placeholder="400"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormShell>
  );
}
