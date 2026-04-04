import { PipelineStep } from "@/types/xan";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GripVertical, X, Play, Trash2, Download, Upload } from "lucide-react";
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
}

function SortableStep({
  step,
  onStepClick,
  onStepRemove,
  isSelected,
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

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`mb-2 cursor-pointer transition-colors ${
          isSelected ? "bg-accent border-primary" : "hover:bg-accent/50"
        }`}
      >
        <div className="p-3">
          <div className="flex items-center gap-2">
            <button
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div
              className="flex-1 min-w-0"
              onClick={() => onStepClick(step)}
            >
              <div className="font-medium text-sm truncate">
                {step.command.name}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-1">
                {Object.entries(step.parameters)
                  .filter(([, value]) => value !== undefined && value !== "" && value !== false)
                  .map(([key, value]) => (
                    <span key={key} className="bg-muted px-1.5 py-0.5 rounded">
                      {key}={String(value)}
                    </span>
                  ))}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onStepRemove(step.id);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
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
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pipeline</h2>
            <p className="text-sm text-muted-foreground">
              Drag to reorder, click to edit
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              disabled={steps.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onImportWorkspace}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportWorkspace}
              disabled={steps.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              size="sm"
              onClick={onExecute}
              disabled={steps.length === 0 || isExecuting}
            >
              {isExecuting ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
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
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No steps in pipeline</p>
              <p className="text-xs mt-1">
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
                {steps.map((step) => (
                  <SortableStep
                    key={step.id}
                    step={step}
                    onStepClick={onStepClick}
                    onStepRemove={onStepRemove}
                    isSelected={selectedStepId === step.id}
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
