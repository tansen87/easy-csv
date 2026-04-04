import { PipelineStep } from "@/types/xan";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GripVertical, X, Play, Trash2, Download, Upload, Sparkles } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableStepProps {
  step: PipelineStep;
  onStepClick: (step: PipelineStep) => void;
  onStepRemove: (stepId: string) => void;
  isSelected: boolean;
  index: number;
  isLast: boolean;
}

function SortableStep({
  step,
  onStepClick,
  onStepRemove,
  isSelected,
  index,
  isLast,
}: SortableStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const activeParams = Object.entries(step.parameters)
    .filter(([, value]) => value !== undefined && value !== "" && value !== false);

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Card
        className={`mb-3 cursor-pointer transition-all duration-200 hover:shadow-md ${
          isSelected 
            ? "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/50 shadow-sm" 
            : "bg-card/80 backdrop-blur-sm hover:bg-accent/30 border-border/50"
        }`}
      >
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                className="cursor-grab active:cursor-grabbing text-muted-foreground/70 hover:text-foreground transition-colors p-1 rounded hover:bg-accent"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <div className="w-7 h-7 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center text-xs font-bold text-primary/70">
                {index + 1}
              </div>
            </div>
            <div
              className="flex-1 min-w-0"
              onClick={() => onStepClick(step)}
            >
              <div className="font-semibold text-sm truncate mb-1.5">
                {step.command.name}
              </div>
              {activeParams.length > 0 && (
                <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5">
                  {activeParams.map(([key, value]) => (
                    <span key={key} className="bg-muted/60 px-2 py-0.5 rounded-md border border-border/30">
                      <span className="text-muted-foreground/70">{key}=</span>
                      <span className="font-medium">{String(value)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onStepRemove(step.id);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>
      {!isLast && (
        <div className="flex justify-center -mt-1.5 mb-1.5">
          <div className="w-0.5 h-4 bg-gradient-to-b from-primary/30 to-transparent" />
        </div>
      )}
    </div>
  );
}

interface PipelineBuilderProps {
  steps: PipelineStep[];
  onStepsChange: (steps: PipelineStep[]) => void;
  onStepClick: (step: PipelineStep) => void;
  onStepRemove: (stepId: string) => void;
  selectedStepId?: string;
  onExecute: () => void;
  onClear: () => void;
  isExecuting?: boolean;
  onExportWorkspace?: () => void;
  onImportWorkspace?: () => void;
}

export function PipelineBuilder({
  steps,
  onStepsChange,
  onStepClick,
  onStepRemove,
  selectedStepId,
  onExecute,
  onClear,
  isExecuting,
  onExportWorkspace,
  onImportWorkspace,
}: PipelineBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex((step) => step.id === active.id);
      const newIndex = steps.findIndex((step) => step.id === over.id);

      onStepsChange(arrayMove(steps, oldIndex, newIndex));
    }
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/10">
      <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Pipeline
              </h2>
              <p className="text-xs text-muted-foreground">
                Drag to reorder, click to edit
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              disabled={steps.length === 0}
              className="h-8 px-3 text-xs font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onImportWorkspace}
              className="h-8 px-3 text-xs font-medium"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportWorkspace}
              disabled={steps.length === 0}
              className="h-8 px-3 text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
            <Button
              size="sm"
              onClick={onExecute}
              disabled={steps.length === 0 || isExecuting}
              className="h-8 px-4 text-xs font-medium bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-sm"
            >
              {isExecuting ? (
                <>
                  <div className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Execute
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          {steps.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">No steps in pipeline</p>
              <p className="text-xs text-muted-foreground/70">
                Click commands from the left panel to add them
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={steps.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {steps.map((step, index) => (
                  <SortableStep
                    key={step.id}
                    step={step}
                    onStepClick={onStepClick}
                    onStepRemove={onStepRemove}
                    isSelected={selectedStepId === step.id}
                    index={index}
                    isLast={index === steps.length - 1}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
