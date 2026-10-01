import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { Select } from "@/components/ui/Select";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function ChartForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage, t } = useLanguage();
  const chartType = (commandDialog.params["chart-type"] as string) || "line";

  // Localised names: the picker used to show raw ids such as `histogram`,
  // which told a Chinese user nothing.
  const chartTypeOptions = [
    { label: t.chartTypeLine, value: "line" },
    { label: t.chartTypeScatter, value: "scatter" },
    { label: t.chartTypeBar, value: "bar" },
    { label: t.chartTypeHistogram, value: "histogram" },
    { label: t.chartTypePie, value: "pie" },
    { label: t.chartTypeWordcloud, value: "wordcloud" },
    { label: t.chartTypeHeatmap, value: "heatmap" },
  ];

  const desc = (name: string) =>
    getParameterDescription("chart", name, effectiveLanguage);

  return (
    <CommandFormShell {...props} scrollHeight="26vh">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-sm font-medium">{t.chartType}</label>
          <Select
            value={commandDialog.params["chart-type"] ?? "line"}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "chart-type", value)
            }
            options={chartTypeOptions}
            placeholder={t.chartType}
            size="md"
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t.xAxis} *</label>
          <input
            type="text"
            value={commandDialog.params.x ?? ""}
            onChange={(e) =>
              updateParam(commandDialog, setCommandDialog, "x", e.target.value)
            }
            placeholder={desc("x")}
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
            <label className="text-sm font-medium">{t.yAxis}</label>
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
              placeholder={desc("y")}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          {chartType !== "histogram" && (
            <div>
              <label className="text-sm font-medium">{t.category}</label>
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
                placeholder={desc("category")}
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
          )}
        </div>
      )}
      {chartType === "histogram" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm font-medium">{t.bins}</label>
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
              placeholder={desc("bins")}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-sm font-medium">{t.title}</label>
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
            placeholder={desc("title")}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        {chartType !== "pie" && chartType !== "wordcloud" && (
          <div>
            <label className="text-sm font-medium">{t.xAxisLabel}</label>
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
              placeholder={desc("x-label")}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        )}
      </div>
      {chartType !== "pie" && chartType !== "wordcloud" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm font-medium">{t.yAxisLabel}</label>
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
              placeholder={desc("y-label")}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-sm font-medium">{t.color}</label>
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
          <label className="text-sm font-medium">{t.width}</label>
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
          <label className="text-sm font-medium">{t.height}</label>
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
