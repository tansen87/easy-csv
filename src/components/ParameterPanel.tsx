import { PipelineStep } from "@/types/xan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";

interface ParameterPanelProps {
  step: PipelineStep | null;
  onStepUpdate: (stepId: string, parameters: Record<string, any>) => void;
  onClose: () => void;
}

export function ParameterPanel({
  step,
  onStepUpdate,
  onClose,
}: ParameterPanelProps) {
  if (!step) {
    return (
      <div className="h-full flex flex-col bg-background border-l">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Parameters</h2>
          <p className="text-sm text-muted-foreground">
            Select a step to edit parameters
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">No step selected</p>
        </div>
      </div>
    );
  }

  const handleParameterChange = (
    paramName: string,
    value: any
  ) => {
    onStepUpdate(step.id, {
      ...step.parameters,
      [paramName]: value,
    });
  };

  const renderParameterInput = (
    param: any,
    value: any
  ) => {
    switch (param.type) {
      case "string":
      case "file":
        return (
          <Input
            type="text"
            value={value || ""}
            onChange={(e) =>
              handleParameterChange(param.name, e.target.value)
            }
            placeholder={param.description}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={value || ""}
            onChange={(e) =>
              handleParameterChange(param.name, Number(e.target.value))
            }
            placeholder={param.description}
          />
        );
      case "boolean":
      case "flag":
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={param.name}
              checked={value || false}
              onChange={(e) =>
                handleParameterChange(param.name, e.target.checked)
              }
              className="h-4 w-4"
            />
            <label
              htmlFor={param.name}
              className="text-sm text-muted-foreground"
            >
              {param.description}
            </label>
          </div>
        );
      case "select":
        return (
          <select
            value={value || param.default || ""}
            onChange={(e) =>
              handleParameterChange(param.name, e.target.value)
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {param.options?.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      default:
        return (
          <Input
            type="text"
            value={value || ""}
            onChange={(e) =>
              handleParameterChange(param.name, e.target.value)
            }
            placeholder={param.description}
          />
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-background border-l">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Parameters</h2>
            <p className="text-sm text-muted-foreground">
              {step.command.name} - {step.command.description}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Command Parameters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {step.command.parameters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This command has no parameters
                  </p>
                ) : (
                  step.command.parameters.map((param) => (
                    <div key={param.name} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">
                          {param.name}
                        </label>
                        {param.required && (
                          <span className="text-xs text-destructive">
                            *
                          </span>
                        )}
                      </div>
                      {renderParameterInput(
                        param,
                        step.parameters[param.name]
                      )}
                      <p className="text-xs text-muted-foreground">
                        {param.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
