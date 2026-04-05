import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Settings2, Info } from "lucide-react";
import { PipelineStep } from "@/types/xan";

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
      <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/10 border-l border-border/50">
        <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
              <Settings2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Parameters
              </h2>
              <p className="text-xs text-muted-foreground">
                Select a step to edit parameters
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center px-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
              <Settings2 className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">No step selected</p>
            <p className="text-xs text-muted-foreground/70">
              Click on a pipeline step to edit its parameters
            </p>
          </div>
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
    <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/10 border-l border-border/50">
      <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
              <Settings2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Parameters
              </h2>
              <p className="text-xs text-muted-foreground">
                {step.command.name}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="px-4 py-2 border-b bg-background/50">
        <div className="flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            {step.command.description}
          </p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                Command Parameters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {step.command.parameters.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 bg-muted/50 rounded-xl flex items-center justify-center">
                      <Info className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">No parameters</p>
                    <p className="text-xs text-muted-foreground/70">
                      This command has no configurable parameters
                    </p>
                  </div>
                ) : (
                  step.command.parameters.map((param) => (
                    <div key={param.name} className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold">
                          {param.name}
                        </label>
                        {param.required && (
                          <span className="text-xs text-destructive font-medium">
                            *
                          </span>
                        )}
                      </div>
                      {renderParameterInput(
                        param,
                        step.parameters[param.name]
                      )}
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
