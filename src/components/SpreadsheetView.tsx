import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  Table,
  Play,
  Columns,
  Filter,
  SortAsc,
  Search,
  ChevronRight,
  X,
  GripVertical,
  Eye,
  Hash,
  Scissors,
  ChevronsDown,
  ChevronsUp,
  FileSearch,
  Shuffle,
  Copy,
  BarChart3,
  Table2,
  TrendingUp,
  PieChart,
  LayoutGrid,
  List,
  Layers,
  BarChart2,
  Trash2,
  FunctionSquare,
  ArrowRightLeft,
  ListOrdered,
  Plus,
  Move,
  Grid3X3,
  Split,
  ArrowUp,
  ArrowDown,
  FileUp,
  ArrowRight,
  ArrowLeft,
  ArrowDownUp,
  GitMerge,
  GitBranch,
  Edit,
  Ruler,
} from "lucide-react";
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
import { PipelineStep, XanCommand } from "@/types/xan";
import { xanCommands } from "@/data/commands";

interface SpreadsheetViewProps {
  data: string[][];
  headers: string[];
  onAddCommand: (command: XanCommand, initialParameters?: Record<string, any>) => void;
  pipeline: PipelineStep[];
  onStepClick?: (step: PipelineStep) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  onStepDelete?: (stepId: string) => void;
  onPipelineReorder?: (newPipeline: PipelineStep[]) => void;
  onExecute: () => void;
  isExecuting: boolean;
  inputFile: string;
}

interface SortableStepProps {
  step: PipelineStep;
  onStepClick: (step: PipelineStep) => void;
  onStepDelete: (stepId: string) => void;
  index: number;
  isLast: boolean;
  headers: string[];
  setCommandDialog: (dialog: any) => void;
}

function SortableStep({
  step,
  onStepClick,
  onStepDelete,
  index,
  isLast,
  headers,
  setCommandDialog,
}: SortableStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = () => {
    const cmdId = step.command.id;

    if (['search', 'filter', 'sort', 'select', 'view', 'count', 'slice', 'head', 'tail', 'grep', 'sample', 'dedup', 'shuffle', 'frequency', 'groupby', 'stats', 'agg', 'bins', 'window', 'headers', 'flatten', 'hist', 'drop', 'map', 'enum', 'rename', 'behead', 'fixlengths', 'explode', 'fmt', 'to', 'from', 'reverse', 'transpose', 'pivot', 'unpivot', 'split', 'partition', 'range', 'eval'].includes(cmdId)) {
      let initialParams: Record<string, any> = {};

      if (cmdId === 'search') {
        initialParams = {
          select: step.parameters.select || headers[0] || '',
          pattern: step.parameters.pattern || '',
          'ignore-case': step.parameters['ignore-case'] || false,
          exact: step.parameters.exact || false,
          regex: step.parameters.regex || false,
          'url-prefix': step.parameters['url-prefix'] || false,
          'non-empty': step.parameters['non-empty'] || false,
          empty: step.parameters.empty || false,
          'invert-match': step.parameters['invert-match'] || false,
          parallel: step.parameters.parallel || false,
          flag: step.parameters.flag || '',
          count: step.parameters.count || '',
          limit: step.parameters.limit || undefined,
          threads: step.parameters.threads || undefined,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'filter') {
        initialParams = {
          expression: step.parameters.expression || '',
          'invert-match': step.parameters['invert-match'] || false,
          parallel: step.parameters.parallel || false,
          threads: step.parameters.threads || undefined,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'sort') {
        initialParams = {
          select: step.parameters.select || headers[0] || '',
          reverse: step.parameters.reverse || false,
          numeric: step.parameters.numeric || false,
        };
      } else if (cmdId === 'select') {
        initialParams = {
          selection: step.parameters.selection || '',
          evaluate: step.parameters.evaluate || false,
        };
      } else if (cmdId === 'view') {
        initialParams = {
          limit: step.parameters.limit || 10,
        };
      } else if (cmdId === 'count') {
        initialParams = {
          parallel: step.parameters.parallel || false,
          approx: step.parameters.approx || false,
        };
      } else if (cmdId === 'slice') {
        initialParams = {
          start: step.parameters.start || undefined,
          end: step.parameters.end || undefined,
          len: step.parameters.len || undefined,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'head') {
        initialParams = {
          limit: step.parameters.limit || 10,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'tail') {
        initialParams = {
          limit: step.parameters.limit || 10,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'grep') {
        initialParams = {
          pattern: step.parameters.pattern || '',
          'ignore-case': step.parameters['ignore-case'] || false,
          'invert-match': step.parameters['invert-match'] || false,
          count: step.parameters.count || false,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'sample') {
        initialParams = {
          'sample-size': step.parameters['sample-size'] || 10,
          seed: step.parameters.seed || undefined,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'dedup') {
        initialParams = {
          select: step.parameters.select || '',
          check: step.parameters.check || false,
          sorted: step.parameters.sorted || false,
          'keep-last': step.parameters['keep-last'] || false,
          external: step.parameters.external || false,
          'keep-duplicates': step.parameters['keep-duplicates'] || false,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'shuffle') {
        initialParams = {
          seed: step.parameters.seed || undefined,
          external: step.parameters.external || false,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'frequency') {
        initialParams = {
          select: step.parameters.select || '',
          sep: step.parameters.sep || '',
          groupby: step.parameters.groupby || '',
          all: step.parameters.all || false,
          limit: step.parameters.limit || 10,
          approx: step.parameters.approx || false,
          'no-extra': step.parameters['no-extra'] || false,
          parallel: step.parameters.parallel || false,
          threads: step.parameters.threads || undefined,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'groupby') {
        initialParams = {
          columns: step.parameters.columns || '',
          keep: step.parameters.keep || '',
          'along-cols': step.parameters['along-cols'] || '',
          'along-matrix': step.parameters['along-matrix'] || '',
          total: step.parameters.total || '',
          sorted: step.parameters.sorted || false,
          parallel: step.parameters.parallel || false,
          threads: step.parameters.threads || undefined,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'stats') {
        initialParams = {
          select: step.parameters.select || '',
          groupby: step.parameters.groupby || '',
          all: step.parameters.all || false,
          cardinality: step.parameters.cardinality || false,
          quartiles: step.parameters.quartiles || false,
          approx: step.parameters.approx || false,
          nulls: step.parameters.nulls || false,
          parallel: step.parameters.parallel || false,
          threads: step.parameters.threads || undefined,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'agg') {
        initialParams = {
          expression: step.parameters.expression || '',
          'along-rows': step.parameters['along-rows'] || '',
          'along-cols': step.parameters['along-cols'] || '',
          'along-matrix': step.parameters['along-matrix'] || '',
          parallel: step.parameters.parallel || false,
          threads: step.parameters.threads || undefined,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'bins') {
        initialParams = {
          column: step.parameters.column || '',
          select: step.parameters.select || '',
          bins: step.parameters.bins || 10,
          heuristic: step.parameters.heuristic || '',
          'max-bins': step.parameters['max-bins'] || undefined,
          exact: step.parameters.exact || false,
          label: step.parameters.label || 'full',
          min: step.parameters.min || undefined,
          max: step.parameters.max || undefined,
          'no-extra': step.parameters['no-extra'] || false,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'window') {
        initialParams = {
          expression: step.parameters.expression || '',
          groupby: step.parameters.groupby || '',
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'drop') {
        initialParams = {
          selection: step.parameters.selection || '',
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'map') {
        initialParams = {
          expression: step.parameters.expression || '',
          'evaluate-file': step.parameters['evaluate-file'] || '',
          overwrite: step.parameters.overwrite || false,
          filter: step.parameters.filter || false,
          parallel: step.parameters.parallel || false,
          threads: step.parameters.threads || undefined,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'enum') {
        initialParams = {
          'column-name': step.parameters['column-name'] || '',
          start: step.parameters.start || 0,
          'byte-offset': step.parameters['byte-offset'] || false,
          accumulate: step.parameters.accumulate || false,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'rename') {
        initialParams = {
          select: step.parameters.select || '',
          columns: step.parameters.columns || '',
          prefix: step.parameters.prefix || '',
          suffix: step.parameters.suffix || '',
          slugify: step.parameters.slugify || false,
          replace: step.parameters.replace || false,
          force: step.parameters.force || false,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'behead') {
        initialParams = {
          append: step.parameters.append || false,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'fixlengths') {
        initialParams = {
          length: step.parameters.length || undefined,
          'trust-header': step.parameters['trust-header'] || false,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'explode') {
        initialParams = {
          columns: step.parameters.columns || '',
          sep: step.parameters.sep || '|',
          singularize: step.parameters.singularize || false,
          rename: step.parameters.rename || '',
          'drop-empty': step.parameters['drop-empty'] || false,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'fmt') {
        initialParams = {
          'out-delimiter': step.parameters['out-delimiter'] || ',',
          tabs: step.parameters.tabs || false,
          crlf: step.parameters.crlf || false,
          ascii: step.parameters.ascii || false,
          quote: step.parameters.quote || '"',
          'quote-always': step.parameters['quote-always'] || false,
          'quote-never': step.parameters['quote-never'] || false,
          escape: step.parameters.escape || '',
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'to') {
        initialParams = {
          format: step.parameters.format || 'json',
          'sample-size': step.parameters['sample-size'] || 512,
          nulls: step.parameters.nulls || false,
          omit: step.parameters.omit || false,
          strings: step.parameters.strings || '',
          dtype: step.parameters.dtype || 'f64',
          select: step.parameters.select || '',
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'from') {
        initialParams = {
          format: step.parameters.format || '',
          'sheet-index': step.parameters['sheet-index'] || 0,
          'sheet-name': step.parameters['sheet-name'] || '',
          'sample-size': step.parameters['sample-size'] || 64,
          'sort-keys': step.parameters['sort-keys'] || false,
          column: step.parameters.column || 'value',
          'nth-table': step.parameters['nth-table'] || 0,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'reverse') {
        initialParams = {
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'transpose') {
        initialParams = {
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'pivot') {
        initialParams = {
          columns: step.parameters.columns || '',
          expr: step.parameters.expr || '',
          groupby: step.parameters.groupby || '',
          'column-sep': step.parameters['column-sep'] || '_',
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'unpivot') {
        initialParams = {
          columns: step.parameters.columns || '',
          'name-column': step.parameters['name-column'] || 'name',
          'value-column': step.parameters['value-column'] || 'value',
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'split') {
        initialParams = {
          'out-dir': step.parameters['out-dir'] || '',
          size: step.parameters.size || 4096,
          chunks: step.parameters.chunks || undefined,
          segments: step.parameters.segments || false,
          filename: step.parameters.filename || '{}.csv',
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'partition') {
        initialParams = {
          column: step.parameters.column || '',
          'out-dir': step.parameters['out-dir'] || '',
          filename: step.parameters.filename || '{}.csv',
          'prefix-length': step.parameters['prefix-length'] || undefined,
          sorted: step.parameters.sorted || false,
          drop: step.parameters.drop || false,
          'case-sensitive': step.parameters['case-sensitive'] || false,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'range') {
        initialParams = {
          end: step.parameters.end,
          start: step.parameters.start ?? 0,
          step: step.parameters.step ?? 1,
          'column-name': step.parameters['column-name'] || 'n',
          inclusive: step.parameters.inclusive || false,
          output: step.parameters.output || '',
        };
      } else if (cmdId === 'eval') {
        initialParams = {
          expr: step.parameters.expr || '',
          serialize: step.parameters.serialize || false,
          explain: step.parameters.explain || false,
          headers: step.parameters.headers || '',
          row: step.parameters.row || '',
        };
      } else if (cmdId === 'headers') {
        initialParams = {
          'just-names': step.parameters['just-names'] || false,
        };
      }

      setCommandDialog({
        type: cmdId as 'search' | 'filter' | 'sort' | 'select' | 'view' | 'count' | 'slice' | 'head' | 'tail' | 'grep' | 'sample' | 'dedup' | 'shuffle' | 'frequency' | 'groupby' | 'stats' | 'agg' | 'bins' | 'window' | 'headers' | 'drop' | 'map' | 'enum' | 'rename' | 'behead' | 'fixlengths' | 'explode' | 'fmt' | 'to' | 'from' | 'reverse' | 'transpose' | 'pivot' | 'unpivot' | 'split' | 'partition' | 'range' | 'eval',
        params: initialParams,
        isUpdate: true,
        stepId: step.id,
      });
    } else {
      onStepClick(step);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 transition-shadow ${isDragging ? 'z-50 shadow-lg scale-105' : ''}`}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground/70 hover:text-foreground transition-colors p-1 rounded hover:bg-accent"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border cursor-pointer transition-colors whitespace-nowrap ${isDragging ? 'bg-primary/10 border-primary/30 shadow-md' : 'bg-muted/60 border-border/30 hover:bg-muted'}`}
        onClick={handleClick}
      >
        <span className="w-5 h-5 bg-primary/20 rounded text-xs font-bold text-primary/70 flex items-center justify-center mr-1">
          {index + 1}
        </span>
        <span className="font-medium">{step.command.name}</span>
        {!isLast && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
      </div>
      <button
        className="p-1 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onStepDelete(step.id);
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function SpreadsheetView({
  data,
  headers,
  onAddCommand,
  pipeline,
  onStepClick,
  onStepUpdate,
  onStepDelete,
  onPipelineReorder,
  onExecute,
  isExecuting,
  inputFile,
}: SpreadsheetViewProps) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [columnWidths] = useState<Record<number, number>>({});
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    row: number | null;
    col: number;
  } | null>(null);
  const [contextMenuSearch, setContextMenuSearch] = useState("");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [commandDialog, setCommandDialog] = useState<{
    type: 'search' | 'filter' | 'sort' | 'select' | 'view' | 'count' | 'slice' | 'head' | 'tail' | 'grep' | 'sample' | 'dedup' | 'shuffle' | 'frequency' | 'groupby' | 'stats' | 'agg' | 'bins' | 'window' | 'headers' | 'flatten' | 'hist' | 'drop' | 'map' | 'transform' | 'enum' | 'fill' | 'complete' | 'flatmap' | 'separate' | 'top' | 'cat' | 'join' | 'merge' | 'fuzzy-join' | 'rename' | 'behead' | 'fixlengths' | 'explode' | 'fmt' | 'to' | 'from' | 'reverse' | 'transpose' | 'pivot' | 'unpivot' | 'split' | 'partition' | 'range' | 'eval';
    params: Record<string, any>;
    isUpdate?: boolean;
    stepId?: string;
  } | null>(null);

  const tableRef = useRef<HTMLTableElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onPipelineReorder) {
      const oldIndex = pipeline.findIndex((step) => step.id === active.id);
      const newIndex = pipeline.findIndex((step) => step.id === over.id);
      const newPipeline = arrayMove(pipeline, oldIndex, newIndex);
      onPipelineReorder(newPipeline);
    }
  };

  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
  }, []);

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    setEditingCell({ row, col });
    setEditingValue(data[row]?.[col] || "");
  }, [data]);

  const handleEditBlur = useCallback(() => {
    setEditingCell(null);
    setEditingValue("");
  }, []);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        setEditingCell(null);
        setEditingValue("");
      } else if (e.key === "Escape") {
        setEditingCell(null);
        setEditingValue("");
      }
    },
    []
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, row, col });
    },
    []
  );

  const handleHeaderContextMenu = useCallback(
    (e: React.MouseEvent, col: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, row: null, col });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setContextMenuSearch("");
  }, []);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [closeContextMenu]);

  if (!inputFile || data.length === 0) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/10">
        <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
              <Table className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Spreadsheet View
              </h2>
              <p className="text-xs text-muted-foreground">
                Select a CSV file to view
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
              <Table className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              No file selected
            </p>
            <p className="text-xs text-muted-foreground/70">
              Select a CSV file from the top bar to view it
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/10">
      {/* Toolbar */}
      <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
              <Table className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Spreadsheet View
              </h2>
              <p className="text-xs text-muted-foreground">
                {inputFile.split("\\").pop()} - {data.length - 1} rows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onExecute}
              disabled={pipeline.length === 0 || isExecuting}
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
                  Execute {pipeline.length > 0 && `(${pipeline.length})`}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Pipeline Preview */}
      {pipeline.length > 0 && (
        <div className="px-4 py-2 border-b bg-background/50">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pipeline.map((step) => step.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex items-center gap-2 overflow-x-auto">
                {pipeline.map((step, index) => (
                  <SortableStep
                    key={step.id}
                    step={step}
                    index={index}
                    isLast={index === pipeline.length - 1}
                    headers={headers}
                    onStepClick={(s) => {
                      setSelectedStepId(s.id);
                      if (onStepClick) {
                        onStepClick(s);
                      }
                    }}
                    onStepDelete={onStepDelete || (() => { })}
                    setCommandDialog={setCommandDialog}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Parameter Panel for selected step */}
      {selectedStepId && (() => {
        const selectedStep = pipeline.find(s => s.id === selectedStepId);
        if (!selectedStep) return null;

        return (
          <div className="px-4 py-3 border-b bg-card/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">{selectedStep.command.name} Parameters</h4>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (onStepDelete) {
                      onStepDelete(selectedStep.id);
                    }
                    setSelectedStepId(null);
                  }}
                  className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
                  title="Delete step"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSelectedStepId(null)}
                  className="p-1 hover:bg-accent rounded transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {selectedStep.command.parameters.map((param) => (
                <div key={param.name} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {param.name}
                  </label>
                  {param.type === 'flag' || param.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={selectedStep.parameters[param.name] || false}
                      onChange={(e) => {
                        if (onStepUpdate) {
                          onStepUpdate(selectedStep.id, {
                            ...selectedStep.parameters,
                            [param.name]: e.target.checked
                          });
                        }
                      }}
                      className="h-4 w-4"
                    />
                  ) : param.type === 'select' ? (
                    <select
                      value={selectedStep.parameters[param.name] || param.default || ''}
                      onChange={(e) => {
                        if (onStepUpdate) {
                          onStepUpdate(selectedStep.id, {
                            ...selectedStep.parameters,
                            [param.name]: e.target.value
                          });
                        }
                      }}
                      className="w-full h-8 px-2 text-xs border rounded bg-background"
                    >
                      {param.options?.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={param.type === 'number' ? 'number' : 'text'}
                      value={selectedStep.parameters[param.name] || param.default || ''}
                      onChange={(e) => {
                        if (onStepUpdate) {
                          onStepUpdate(selectedStep.id, {
                            ...selectedStep.parameters,
                            [param.name]: param.type === 'number' ? Number(e.target.value) : e.target.value
                          });
                        }
                      }}
                      placeholder={param.description}
                      className="w-full h-8 px-2 text-xs border rounded bg-background"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Main Table */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
            <div className="overflow-auto">
              <table ref={tableRef} className="w-full border-collapse">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="w-10 min-w-[40px] border border-border/50 px-2 py-2 text-xs font-semibold text-muted-foreground bg-muted/70 sticky left-0 z-20">
                      #
                    </th>
                    {headers.map((header, colIndex) => (
                      <th
                        key={colIndex}
                        className={`border border-border/50 px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/70 text-left min-w-[100px] ${selectedCell?.col === colIndex ? "bg-primary/10" : ""
                          }`}
                        style={{
                          width: columnWidths[colIndex] || 120,
                        }}
                        onContextMenu={(e) => handleHeaderContextMenu(e, colIndex)}
                      >
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{header}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={`hover:bg-muted/30 transition-colors ${selectedCell?.row === rowIndex ? "bg-primary/5" : ""
                        }`}
                    >
                      <td
                        className="border border-border/50 px-2 py-1.5 text-xs text-muted-foreground bg-muted/30 font-medium sticky left-0 z-10"
                      >
                        {rowIndex + 1}
                      </td>
                      {headers.map((_, colIndex) => (
                        <td
                          key={colIndex}
                          className={`border border-border/50 px-3 py-1.5 text-sm cursor-cell ${selectedCell?.row === rowIndex &&
                            selectedCell?.col === colIndex
                            ? "bg-primary/10 outline outline-2 outline-primary/50"
                            : ""
                            }`}
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                          onDoubleClick={() =>
                            handleCellDoubleClick(rowIndex, colIndex)
                          }
                          onContextMenu={(e) =>
                            handleContextMenu(e, rowIndex, colIndex)
                          }
                          style={{
                            width: columnWidths[colIndex] || 120,
                            maxWidth: columnWidths[colIndex] || 120,
                          }}
                        >
                          {editingCell?.row === rowIndex &&
                            editingCell?.col === colIndex ? (
                            <input
                              ref={inputRef}
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={handleEditBlur}
                              onKeyDown={handleEditKeyDown}
                              className="w-full h-full bg-transparent border-none outline-none text-sm"
                            />
                          ) : (
                            <div className="truncate">
                              {row[colIndex] || ""}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </ScrollArea>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-card border rounded-lg shadow-lg z-50 py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="px-3 py-1 text-xs font-semibold text-muted-foreground border-b mb-1">
            Quick Actions
          </div>
          <div className="px-3 py-1">
            <input
              type="text"
              value={contextMenuSearch}
              onChange={(e) => setContextMenuSearch(e.target.value)}
              placeholder="Search commands..."
              className="w-full h-7 px-2 text-xs border rounded bg-background"
              autoFocus
            />
          </div>
          <ScrollArea className="h-[220px]">
            {(contextMenuSearch === "" || "Filter".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'filter',
                    params: {
                      expression: '',
                      'invert-match': false,
                      parallel: false,
                      threads: undefined,
                      output: '',
                    },
                  });
                }}
              >
                <Filter className="h-4 w-4 text-muted-foreground" />
                Filter
              </button>
            )}
            {(contextMenuSearch === "" || "Search".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'search',
                      params: {
                        select: columnName,
                        pattern: '',
                        'ignore-case': false,
                        exact: false,
                        regex: false,
                        'url-prefix': false,
                        'non-empty': false,
                        empty: false,
                        'invert-match': false,
                        parallel: false,
                      },
                    });
                  }
                }}
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                Search
              </button>
            )}
            {(contextMenuSearch === "" || "Sort".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'sort',
                      params: {
                        select: columnName,
                        reverse: false,
                        numeric: false,
                      },
                    });
                  }
                }}
              >
                <SortAsc className="h-4 w-4 text-muted-foreground" />
                Sort
              </button>
            )}
            {(contextMenuSearch === "" || "Select".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'select',
                      params: {
                        selection: columnName,
                        evaluate: false,
                      },
                    });
                  }
                }}
              >
                <Columns className="h-4 w-4 text-muted-foreground" />
                Select
              </button>
            )}
            {(contextMenuSearch === "" || "View".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'view',
                    params: {
                      limit: 10,
                    },
                  });
                }}
              >
                <Eye className="h-4 w-4 text-muted-foreground" />
                View
              </button>
            )}
            {(contextMenuSearch === "" || "Drop".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'drop',
                      params: {
                        selection: columnName,
                        output: '',
                      },
                    });
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
                Drop
              </button>
            )}
            {(contextMenuSearch === "" || "Count".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'count',
                    params: {
                      parallel: false,
                      approx: false,
                    },
                  });
                }}
              >
                <Hash className="h-4 w-4 text-muted-foreground" />
                Count
              </button>
            )}
            {(contextMenuSearch === "" || "Slice".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'slice',
                    params: {
                      start: undefined,
                      end: undefined,
                      len: undefined,
                      output: '',
                    },
                  });
                }}
              >
                <Scissors className="h-4 w-4 text-muted-foreground" />
                Slice
              </button>
            )}
            {(contextMenuSearch === "" || "Head".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'head',
                    params: {
                      limit: 10,
                      output: '',
                    },
                  });
                }}
              >
                <ChevronsDown className="h-4 w-4 text-muted-foreground" />
                Head
              </button>
            )}
            {(contextMenuSearch === "" || "Tail".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'tail',
                    params: {
                      limit: 10,
                      output: '',
                    },
                  });
                }}
              >
                <ChevronsUp className="h-4 w-4 text-muted-foreground" />
                Tail
              </button>
            )}
            {(contextMenuSearch === "" || "Grep".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'grep',
                    params: {
                      pattern: '',
                      'ignore-case': false,
                      'invert-match': false,
                      count: false,
                      output: '',
                    },
                  });
                }}
              >
                <FileSearch className="h-4 w-4 text-muted-foreground" />
                Grep
              </button>
            )}
            {(contextMenuSearch === "" || "Sample".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'sample',
                    params: {
                      'sample-size': 10,
                      seed: undefined,
                      output: '',
                    },
                  });
                }}
              >
                <Shuffle className="h-4 w-4 text-muted-foreground" />
                Sample
              </button>
            )}
            {(contextMenuSearch === "" || "Dedup".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'dedup',
                    params: {
                      select: '',
                      check: false,
                      sorted: false,
                      'keep-last': false,
                      external: false,
                      'keep-duplicates': false,
                      output: '',
                    },
                  });
                }}
              >
                <Copy className="h-4 w-4 text-muted-foreground" />
                Dedup
              </button>
            )}
            {(contextMenuSearch === "" || "Shuffle".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'shuffle',
                    params: {
                      seed: undefined,
                      external: false,
                      output: '',
                    },
                  });
                }}
              >
                <Shuffle className="h-4 w-4 text-muted-foreground" />
                Shuffle
              </button>
            )}
            {(contextMenuSearch === "" || "Frequency".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'frequency',
                    params: {
                      select: '',
                      sep: '',
                      groupby: '',
                      all: false,
                      limit: 10,
                      approx: false,
                      'no-extra': false,
                      parallel: false,
                      threads: undefined,
                      output: '',
                    },
                  });
                }}
              >
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Frequency
              </button>
            )}
            {(contextMenuSearch === "" || "Group By".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'groupby',
                    params: {
                      columns: '',
                      keep: '',
                      'along-cols': '',
                      'along-matrix': '',
                      total: '',
                      sorted: false,
                      parallel: false,
                      threads: undefined,
                      output: '',
                    },
                  });
                }}
              >
                <Table2 className="h-4 w-4 text-muted-foreground" />
                Group By
              </button>
            )}
            {(contextMenuSearch === "" || "Stats".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'stats',
                    params: {
                      select: '',
                      groupby: '',
                      all: false,
                      cardinality: false,
                      quartiles: false,
                      approx: false,
                      nulls: false,
                      parallel: false,
                      threads: undefined,
                      output: '',
                    },
                  });
                }}
              >
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Stats
              </button>
            )}
            {(contextMenuSearch === "" || "Agg".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'agg',
                    params: {
                      expression: '',
                      'along-rows': '',
                      'along-cols': '',
                      'along-matrix': '',
                      parallel: false,
                      threads: undefined,
                      output: '',
                    },
                  });
                }}
              >
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Agg
              </button>
            )}
            {(contextMenuSearch === "" || "Bins".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'bins',
                    params: {
                      column: '',
                      select: '',
                      bins: 10,
                      heuristic: '',
                      'max-bins': undefined,
                      exact: false,
                      label: 'full',
                      min: undefined,
                      max: undefined,
                      'no-extra': false,
                      output: '',
                    },
                  });
                }}
              >
                <PieChart className="h-4 w-4 text-muted-foreground" />
                Bins
              </button>
            )}
            {(contextMenuSearch === "" || "Window".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'window',
                    params: {
                      expression: '',
                      groupby: '',
                      output: '',
                    },
                  });
                }}
              >
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                Window
              </button>
            )}
            {(contextMenuSearch === "" || "Headers".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'headers',
                    params: {
                      'just-names': false,
                    },
                  });
                }}
              >
                <List className="h-4 w-4 text-muted-foreground" />
                Headers
              </button>
            )}
            {(contextMenuSearch === "" || "Behead".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'behead',
                    params: {
                      append: false,
                      output: '',
                    },
                  });
                }}
              >
                <Scissors className="h-4 w-4 text-muted-foreground" />
                Behead
              </button>
            )}
            {(contextMenuSearch === "" || "Fix Lengths".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'fixlengths',
                    params: {
                      length: undefined,
                      'trust-header': false,
                      output: '',
                    },
                  });
                }}
              >
                <Ruler className="h-4 w-4 text-muted-foreground" />
                Fix Lengths
              </button>
            )}
            {(contextMenuSearch === "" || "Explode".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'explode',
                    params: {
                      columns: '',
                      sep: '|',
                      singularize: false,
                      rename: '',
                      'drop-empty': false,
                      output: '',
                    },
                  });
                }}
              >
                <Split className="h-4 w-4 text-muted-foreground" />
                Explode
              </button>
            )}
            {(contextMenuSearch === "" || "Format".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'fmt',
                    params: {
                      'out-delimiter': ',',
                      tabs: false,
                      crlf: false,
                      ascii: false,
                      quote: '"',
                      'quote-always': false,
                      'quote-never': false,
                      escape: '',
                      output: '',
                    },
                  });
                }}
              >
                <List className="h-4 w-4 text-muted-foreground" />
                Format
              </button>
            )}
            {(contextMenuSearch === "" || "Convert To".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'to',
                    params: {
                      format: 'json',
                      'sample-size': 512,
                      nulls: false,
                      omit: false,
                      strings: '',
                      dtype: 'f64',
                      select: '',
                      output: '',
                    },
                  });
                }}
              >
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                Convert To
              </button>
            )}
            {(contextMenuSearch === "" || "Convert From".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'from',
                    params: {
                      format: '',
                      'sheet-index': 0,
                      'sheet-name': '',
                      'sample-size': 64,
                      'sort-keys': false,
                      column: 'value',
                      'nth-table': 0,
                      output: '',
                    },
                  });
                }}
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                Convert From
              </button>
            )}
            {(contextMenuSearch === "" || "Reverse".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'reverse',
                    params: {
                      output: '',
                    },
                  });
                }}
              >
                <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
                Reverse
              </button>
            )}
            {(contextMenuSearch === "" || "Transpose".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'transpose',
                    params: {
                      output: '',
                    },
                  });
                }}
              >
                <Columns className="h-4 w-4 text-muted-foreground" />
                Transpose
              </button>
            )}
            {(contextMenuSearch === "" || "Pivot".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'pivot',
                    params: {
                      columns: '',
                      expr: '',
                      groupby: '',
                      'column-sep': '_',
                      output: '',
                    },
                  });
                }}
              >
                <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                Pivot
              </button>
            )}
            {(contextMenuSearch === "" || "Unpivot".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'unpivot',
                    params: {
                      columns: '',
                      'name-column': 'name',
                      'value-column': 'value',
                      output: '',
                    },
                  });
                }}
              >
                <ArrowDown className="h-4 w-4 text-muted-foreground" />
                Unpivot
              </button>
            )}
            {(contextMenuSearch === "" || "Split".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'split',
                    params: {
                      'out-dir': '',
                      size: 4096,
                      chunks: undefined,
                      segments: false,
                      filename: '{}.csv',
                      output: '',
                    },
                  });
                }}
              >
                <Split className="h-4 w-4 text-muted-foreground" />
                Split
              </button>
            )}
            {(contextMenuSearch === "" || "Partition".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'partition',
                    params: {
                      column: '',
                      'out-dir': '',
                      filename: '{}.csv',
                      'prefix-length': undefined,
                      sorted: false,
                      drop: false,
                      'case-sensitive': false,
                      output: '',
                    },
                  });
                }}
              >
                <ListOrdered className="h-4 w-4 text-muted-foreground" />
                Partition
              </button>
            )}
            {(contextMenuSearch === "" || "Range".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'range',
                    params: {
                      end: undefined,
                      start: 0,
                      step: 1,
                      'column-name': 'n',
                      inclusive: false,
                      output: '',
                    },
                  });
                }}
              >
                <Hash className="h-4 w-4 text-muted-foreground" />
                Range
              </button>
            )}
            {(contextMenuSearch === "" || "Eval".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'eval',
                    params: {
                      expr: '',
                      serialize: false,
                      explain: false,
                      headers: '',
                      row: '',
                    },
                  });
                }}
              >
                <FunctionSquare className="h-4 w-4 text-muted-foreground" />
                Eval
              </button>
            )}
            {(contextMenuSearch === "" || "Flatten".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'flatten',
                    params: {
                      select: '',
                      limit: undefined,
                      condense: false,
                      wrap: false,
                      flatter: false,
                      'row-separator': '',
                      csv: false,
                      cols: '',
                      rainbow: false,
                      color: 'auto',
                      split: '',
                      sep: '|',
                      highlight: '',
                      'ignore-case': false,
                      'non-empty': false,
                      output: '',
                    },
                  });
                }}
              >
                <Layers className="h-4 w-4 text-muted-foreground" />
                Flatten
              </button>
            )}
            {(contextMenuSearch === "" || "Hist".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'hist',
                    params: {
                      name: 'unknown',
                      field: 'field',
                      label: 'value',
                      value: 'count',
                      'bar-size': 'medium',
                      cols: '',
                      rainbow: false,
                      'domain-max': 'max',
                      category: '',
                      color: 'auto',
                      'hide-percent': false,
                      unit: '',
                      dates: false,
                      'compress-gaps': undefined,
                      scale: 'lin',
                      output: '',
                    },
                  });
                }}
              >
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
                Hist
              </button>
            )}
            {(contextMenuSearch === "" || "Map".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'map',
                    params: {
                      expression: '',
                      'evaluate-file': '',
                      overwrite: false,
                      filter: false,
                      parallel: false,
                      threads: undefined,
                      output: '',
                    },
                  });
                }}
              >
                <FunctionSquare className="h-4 w-4 text-muted-foreground" />
                Map
              </button>
            )}
            {(contextMenuSearch === "" || "Rename".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'rename',
                      params: {
                        select: columnName,
                        columns: '',
                        prefix: '',
                        suffix: '',
                        slugify: false,
                        replace: false,
                        force: false,
                        output: '',
                      },
                    });
                  }
                }}
              >
                <Edit className="h-4 w-4 text-muted-foreground" />
                Rename
              </button>
            )}
            {(contextMenuSearch === "" || "Transform".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'transform',
                      params: {
                        column: columnName,
                        expression: '',
                        output: '',
                      },
                    });
                  }
                }}
              >
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                Transform
              </button>
            )}
            {(contextMenuSearch === "" || "Enum".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'enum',
                    params: {
                      'column-name': '',
                      start: 0,
                      'byte-offset': false,
                      accumulate: false,
                      output: '',
                    },
                  });
                }}
              >
                <ListOrdered className="h-4 w-4 text-muted-foreground" />
                Enum
              </button>
            )}
            {(contextMenuSearch === "" || "Fill".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'fill',
                      params: {
                        select: columnName,
                        value: '',
                        output: '',
                      },
                    });
                  }
                }}
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
                Fill
              </button>
            )}
            {(contextMenuSearch === "" || "Complete".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'complete',
                      params: {
                        column: columnName,
                        check: false,
                        min: '',
                        max: '',
                        dates: false,
                        sorted: false,
                        reverse: false,
                        groupby: '',
                        output: '',
                      },
                    });
                  }
                }}
              >
                <Move className="h-4 w-4 text-muted-foreground" />
                Complete
              </button>
            )}
            {(contextMenuSearch === "" || "Flatmap".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'flatmap',
                      params: {
                        expression: '',
                        column: columnName,
                        'evaluate-file': '',
                        replace: '',
                        parallel: false,
                        threads: undefined,
                        output: '',
                      },
                    });
                  }
                }}
              >
                <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                Flatmap
              </button>
            )}
            {(contextMenuSearch === "" || "Separate".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'separate',
                      params: {
                        column: columnName,
                        separator: ',',
                        output: '',
                      },
                    });
                  }
                }}
              >
                <Split className="h-4 w-4 text-muted-foreground" />
                Separate
              </button>
            )}
            {(contextMenuSearch === "" || "Top".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'top',
                      params: {
                        column: columnName,
                        limit: 10,
                        reverse: false,
                        groupby: '',
                        rank: '',
                        output: '',
                      },
                    });
                  }
                }}
              >
                <ArrowUp className="h-4 w-4 text-muted-foreground" />
                Top
              </button>
            )}
            {(contextMenuSearch === "" || "Cat".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'cat',
                    params: {
                      mode: 'rows',
                      pad: false,
                      paths: '',
                      'path-column': '',
                      'source-column': '',
                      output: '',
                    },
                  });
                }}
              >
                <FileUp className="h-4 w-4 text-muted-foreground" />
                Cat
              </button>
            )}
            {(contextMenuSearch === "" || "Join".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'join',
                      params: {
                        columns: columnName,
                        input1: '',
                        columns2: '',
                        input2: '',
                        'join-type': 'inner',
                        'ignore-case': false,
                        nulls: false,
                        'drop-key': 'none',
                        'prefix-left': '',
                        'prefix-right': '',
                        output: '',
                      },
                    });
                  }
                }}
              >
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                Join
              </button>
            )}
            {(contextMenuSearch === "" || "Merge".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  setCommandDialog({
                    type: 'merge',
                    params: {
                      inputs: '',
                      select: '',
                      numeric: false,
                      reverse: false,
                      uniq: false,
                      'source-column': '',
                      paths: '',
                      'path-column': '',
                      output: '',
                    },
                  });
                }}
              >
                <GitMerge className="h-4 w-4 text-muted-foreground" />
                Merge
              </button>
            )}
            {(contextMenuSearch === "" || "Fuzzy Join".toLowerCase().includes(contextMenuSearch.toLowerCase())) && (
              <button
                className="w-full px-3 py-1 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  closeContextMenu();
                  if (contextMenu) {
                    const columnName = headers[contextMenu.col];
                    setCommandDialog({
                      type: 'fuzzy-join',
                      params: {
                        columns: columnName,
                        input: '',
                      },
                    });
                  }
                }}
              >
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                Fuzzy Join
              </button>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Command Dialog */}
      {commandDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {commandDialog.type === 'search' && 'Search'}
                {commandDialog.type === 'filter' && 'Filter'}
                {commandDialog.type === 'sort' && 'Sort'}
                {commandDialog.type === 'select' && 'Select'}
                {commandDialog.type === 'view' && 'View'}
                {commandDialog.type === 'count' && 'Count'}
                {commandDialog.type === 'slice' && 'Slice'}
                {commandDialog.type === 'head' && 'Head'}
                {commandDialog.type === 'tail' && 'Tail'}
                {commandDialog.type === 'grep' && 'Grep'}
                {commandDialog.type === 'sample' && 'Sample'}
                {commandDialog.type === 'dedup' && 'Dedup'}
                {commandDialog.type === 'shuffle' && 'Shuffle'}
                {commandDialog.type === 'frequency' && 'Frequency'}
                {commandDialog.type === 'groupby' && 'Group By'}
                {commandDialog.type === 'stats' && 'Stats'}
                {commandDialog.type === 'agg' && 'Agg'}
                {commandDialog.type === 'bins' && 'Bins'}
                {commandDialog.type === 'window' && 'Window'}
                {commandDialog.type === 'headers' && 'Headers'}
                {commandDialog.type === 'flatten' && 'Flatten'}
                {commandDialog.type === 'hist' && 'Hist'}
                {commandDialog.type === 'drop' && 'Drop'}
                {commandDialog.type === 'map' && 'Map'}
                {commandDialog.type === 'transform' && 'Transform'}
                {commandDialog.type === 'enum' && 'Enum'}
                {commandDialog.type === 'fill' && 'Fill'}
                {commandDialog.type === 'complete' && 'Complete'}
                {commandDialog.type === 'flatmap' && 'Flatmap'}
                {commandDialog.type === 'separate' && 'Separate'}
                {commandDialog.type === 'top' && 'Top'}
                {commandDialog.type === 'cat' && 'Cat'}
                {commandDialog.type === 'join' && 'Join'}
                {commandDialog.type === 'merge' && 'Merge'}
                {commandDialog.type === 'fuzzy-join' && 'Fuzzy Join'}
                {commandDialog.type === 'rename' && 'Rename'}
                {commandDialog.type === 'behead' && 'Behead'}
                {commandDialog.type === 'fixlengths' && 'Fix Lengths'}
                {commandDialog.type === 'explode' && 'Explode'}
                {commandDialog.type === 'fmt' && 'Format'}
                {commandDialog.type === 'to' && 'Convert To'}
                {commandDialog.type === 'from' && 'Convert From'}
                {commandDialog.type === 'reverse' && 'Reverse'}
                {commandDialog.type === 'transpose' && 'Transpose'}
                {commandDialog.type === 'pivot' && 'Pivot'}
                {commandDialog.type === 'unpivot' && 'Unpivot'}
                {commandDialog.type === 'split' && 'Split'}
                {commandDialog.type === 'partition' && 'Partition'}
                {commandDialog.type === 'range' && 'Range'}
                {commandDialog.type === 'eval' && 'Eval'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCommandDialog(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {commandDialog.type === 'search' && (
              <><ScrollArea className="h-[40vh]">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column</label>
                  <select
                    value={commandDialog.params.select}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value }
                    })}
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  >
                    {headers.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pattern</label>
                  <input
                    type="text"
                    value={commandDialog.params.pattern}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, pattern: e.target.value }
                    })}
                    placeholder="Enter search pattern"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['invert-match']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'invert-match': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Invert Match
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.exact}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, exact: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Exact Match
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.regex}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, regex: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Regex
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['url-prefix']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'url-prefix': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    URL Prefix
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['non-empty']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'non-empty': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Non-Empty
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.empty}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, empty: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Empty
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['ignore-case']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'ignore-case': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Ignore Case
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, parallel: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Parallel
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Flag Column</label>
                  <input
                    type="text"
                    value={commandDialog.params.flag || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, flag: e.target.value }
                    })}
                    placeholder="Column name to report match status"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Count Column</label>
                  <input
                    type="text"
                    value={commandDialog.params.count || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, count: e.target.value }
                    })}
                    placeholder="Column name to report match count"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Limit</label>
                  <input
                    type="number"
                    value={commandDialog.params.limit || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, limit: e.target.value ? Number(e.target.value) : undefined }
                    })}
                    placeholder="Maximum rows to return"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Threads</label>
                  <input
                    type="number"
                    value={commandDialog.params.threads || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, threads: e.target.value ? Number(e.target.value) : undefined }
                    })}
                    placeholder="Number of threads"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
              </ScrollArea><div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const searchCmd = xanCommands.find((c) => c.id === "search");
                        if (searchCmd) {
                          const params = {
                            ...searchCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(searchCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                    disabled={!commandDialog.params.pattern && !commandDialog.params['non-empty'] && !commandDialog.params.empty}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div></>
            )}

            {commandDialog.type === 'filter' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expression</label>
                  <input
                    type="text"
                    value={commandDialog.params.expression}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, expression: e.target.value }
                    })}
                    placeholder="e.g. column_name > 100"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['invert-match']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'invert-match': e.target.checked }
                      })}
                      className="h-4 w-4"
                    />
                    Invert Match
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, parallel: e.target.checked }
                      })}
                      className="h-4 w-4"
                    />
                    Parallel
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Threads</label>
                  <input
                    type="number"
                    value={commandDialog.params.threads || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, threads: e.target.value ? Number(e.target.value) : undefined }
                    })}
                    placeholder="Number of threads"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const filterCmd = xanCommands.find((c) => c.id === "filter");
                        if (filterCmd) {
                          const params = {
                            ...filterCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(filterCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                    disabled={!commandDialog.params.expression}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'sort' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column</label>
                  <select
                    value={commandDialog.params.select}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value }
                    })}
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  >
                    {headers.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.reverse}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, reverse: e.target.checked }
                      })}
                      className="h-4 w-4"
                    />
                    Reverse Order
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.numeric}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, numeric: e.target.value }
                      })}
                      className="h-4 w-4"
                    />
                    Numeric Sort
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const sortCmd = xanCommands.find((c) => c.id === "sort");
                        if (sortCmd) {
                          const params = {
                            ...sortCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(sortCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                    disabled={!commandDialog.params.select}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'select' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Selection</label>
                  <input
                    type="text"
                    value={commandDialog.params.selection}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, selection: e.target.value }
                    })}
                    placeholder="e.g. column1,column2 or column1:column5"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.evaluate}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, evaluate: e.target.checked }
                      })}
                      className="h-4 w-4"
                    />
                    Evaluate Expression
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const selectCmd = xanCommands.find((c) => c.id === "select");
                        if (selectCmd) {
                          const params = {
                            ...selectCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(selectCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                    disabled={!commandDialog.params.selection}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'view' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Limit</label>
                  <input
                    type="number"
                    value={commandDialog.params.limit}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, limit: parseInt(e.target.value) || 10 }
                    })}
                    placeholder="Number of rows to display"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const viewCmd = xanCommands.find((c) => c.id === "view");
                        if (viewCmd) {
                          const params = {
                            ...viewCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(viewCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'count' && (
              <div className="space-y-4">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, parallel: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Parallel
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.approx}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, approx: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Approximate
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const countCmd = xanCommands.find((c) => c.id === "count");
                        if (countCmd) {
                          const params = {
                            ...countCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(countCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'slice' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start</label>
                    <input
                      type="number"
                      value={commandDialog.params.start || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, start: e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="Start index"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End</label>
                    <input
                      type="number"
                      value={commandDialog.params.end || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, end: e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="End index"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Length</label>
                    <input
                      type="number"
                      value={commandDialog.params.len || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, len: e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="Length"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const sliceCmd = xanCommands.find((c) => c.id === "slice");
                        if (sliceCmd) {
                          const params = {
                            ...sliceCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(sliceCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'head' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Limit</label>
                  <input
                    type="number"
                    value={commandDialog.params.limit || 10}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, limit: parseInt(e.target.value) || 10 }
                    })}
                    placeholder="Number of rows to return"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const headCmd = xanCommands.find((c) => c.id === "head");
                        if (headCmd) {
                          const params = {
                            ...headCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(headCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'tail' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Limit</label>
                  <input
                    type="number"
                    value={commandDialog.params.limit || 10}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, limit: parseInt(e.target.value) || 10 }
                    })}
                    placeholder="Number of rows to return"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const tailCmd = xanCommands.find((c) => c.id === "tail");
                        if (tailCmd) {
                          const params = {
                            ...tailCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(tailCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'sample' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sample Size</label>
                  <input
                    type="number"
                    value={commandDialog.params['sample-size'] || 10}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'sample-size': parseInt(e.target.value) || 10 }
                    })}
                    placeholder="Number of rows to sample"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Seed (Optional)</label>
                  <input
                    type="number"
                    value={commandDialog.params.seed || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, seed: e.target.value ? Number(e.target.value) : undefined }
                    })}
                    placeholder="Random seed for reproducibility"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const sampleCmd = xanCommands.find((c) => c.id === "sample");
                        if (sampleCmd) {
                          const params = {
                            ...sampleCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(sampleCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'dedup' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Columns (Optional)</label>
                  <input
                    type="text"
                    value={commandDialog.params.select || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value }
                    })}
                    placeholder="Column(s) to deduplicate on"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.check}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, check: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Check
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.sorted}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, sorted: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Sorted
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.external}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, external: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    External
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['keep-last']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'keep-last': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Keep Last
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['keep-duplicates']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'keep-duplicates': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Keep Duplicates
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const dedupCmd = xanCommands.find((c) => c.id === "dedup");
                        if (dedupCmd) {
                          const params = {
                            ...dedupCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(dedupCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'shuffle' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Seed (Optional)</label>
                  <input
                    type="number"
                    value={commandDialog.params.seed || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, seed: e.target.value ? Number(e.target.value) : undefined }
                    })}
                    placeholder="RNG seed"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.external}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, external: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    External
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const shuffleCmd = xanCommands.find((c) => c.id === "shuffle");
                        if (shuffleCmd) {
                          const params = {
                            ...shuffleCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(shuffleCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'frequency' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Columns</label>
                    <input
                      type="text"
                      value={commandDialog.params.select || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, select: e.target.value }
                      })}
                      placeholder="Column(s) to compute frequencies"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Separator</label>
                    <input
                      type="text"
                      value={commandDialog.params.sep || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, sep: e.target.value }
                      })}
                      placeholder="Split cells by separator"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Group By</label>
                  <input
                    type="text"
                    value={commandDialog.params.groupby || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, groupby: e.target.value }
                    })}
                    placeholder="Compute frequencies per group"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="grid grid-cols-5 gap-0">
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.all}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, all: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    All
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.approx}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, approx: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Approx
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['no-extra']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'no-extra': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    No Extra
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, parallel: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Parallel
                  </label>
                  <div></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Limit</label>
                    <input
                      type="number"
                      value={commandDialog.params.limit || 10}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, limit: parseInt(e.target.value) || 10 }
                      })}
                      placeholder="Top N items"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Threads</label>
                    <input
                      type="number"
                      value={commandDialog.params.threads || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, threads: e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="Number of threads"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const frequencyCmd = xanCommands.find((c) => c.id === "frequency");
                        if (frequencyCmd) {
                          const params = {
                            ...frequencyCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(frequencyCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'groupby' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Columns</label>
                    <input
                      type="text"
                      value={commandDialog.params.columns || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, columns: e.target.value }
                      })}
                      placeholder="Columns to group by"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Keep</label>
                    <input
                      type="text"
                      value={commandDialog.params.keep || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, keep: e.target.value }
                      })}
                      placeholder="Keep these columns"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Along Columns</label>
                    <input
                      type="text"
                      value={commandDialog.params['along-cols'] || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'along-cols': e.target.value }
                      })}
                      placeholder="Aggregate over columns"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Along Matrix</label>
                    <input
                      type="text"
                      value={commandDialog.params['along-matrix'] || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'along-matrix': e.target.value }
                      })}
                      placeholder="Aggregate all values"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Total</label>
                  <input
                    type="text"
                    value={commandDialog.params.total || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, total: e.target.value }
                    })}
                    placeholder="Aggregation over whole file"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="grid grid-cols-3 gap-0">
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.sorted}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, sorted: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Sorted
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, parallel: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Parallel
                  </label>
                  <div></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Threads</label>
                    <input
                      type="number"
                      value={commandDialog.params.threads || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, threads: e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="Number of threads"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const groupbyCmd = xanCommands.find((c) => c.id === "groupby");
                        if (groupbyCmd) {
                          const params = {
                            ...groupbyCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(groupbyCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'stats' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Columns</label>
                    <input
                      type="text"
                      value={commandDialog.params.select || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, select: e.target.value }
                      })}
                      placeholder="Column(s) to compute stats"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Group By</label>
                    <input
                      type="text"
                      value={commandDialog.params.groupby || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, groupby: e.target.value }
                      })}
                      placeholder="Group by column(s)"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-0">
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.all}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, all: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    All
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.cardinality}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, cardinality: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Cardinality
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.quartiles}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, quartiles: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Quartiles
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.approx}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, approx: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Approx
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.nulls}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, nulls: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Nulls
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-0">
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, parallel: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Parallel
                  </label>
                  <div></div>
                  <div></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Threads</label>
                    <input
                      type="number"
                      value={commandDialog.params.threads || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, threads: e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="Number of threads"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const statsCmd = xanCommands.find((c) => c.id === "stats");
                        if (statsCmd) {
                          const params = {
                            ...statsCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(statsCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'agg' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expression</label>
                  <input
                    type="text"
                    value={commandDialog.params.expression || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, expression: e.target.value }
                    })}
                    placeholder="Aggregation expression (e.g., sum:col1)"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Along Rows</label>
                    <input
                      type="text"
                      value={commandDialog.params['along-rows'] || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'along-rows': e.target.value }
                      })}
                      placeholder="Aggregate per row"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Along Columns</label>
                    <input
                      type="text"
                      value={commandDialog.params['along-cols'] || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'along-cols': e.target.value }
                      })}
                      placeholder="Aggregate per column"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Along Matrix</label>
                  <input
                    type="text"
                    value={commandDialog.params['along-matrix'] || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'along-matrix': e.target.value }
                    })}
                    placeholder="Aggregate all values"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="grid grid-cols-3 gap-0">
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, parallel: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Parallel
                  </label>
                  <div></div>
                  <div></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Threads</label>
                    <input
                      type="number"
                      value={commandDialog.params.threads || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, threads: e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="Number of threads"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const aggCmd = xanCommands.find((c) => c.id === "agg");
                        if (aggCmd) {
                          const params = {
                            ...aggCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(aggCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'bins' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Column</label>
                    <input
                      type="text"
                      value={commandDialog.params.column || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, column: e.target.value }
                      })}
                      placeholder="Column to bin"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Columns</label>
                    <input
                      type="text"
                      value={commandDialog.params.select || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, select: e.target.value }
                      })}
                      placeholder="Subset of columns"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bins</label>
                    <input
                      type="number"
                      value={commandDialog.params.bins || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, bins: e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="Number of bins"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Heuristic</label>
                    <select
                      value={commandDialog.params.heuristic || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, heuristic: e.target.value }
                      })}
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    >
                      <option value="">None</option>
                      <option value="freedman-diaconis">Freedman-Diaconis</option>
                      <option value="sqrt">Sqrt</option>
                      <option value="sturges">Sturges</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max Bins</label>
                    <input
                      type="number"
                      value={commandDialog.params['max-bins'] || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'max-bins': e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="Maximum bins"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Label</label>
                    <select
                      value={commandDialog.params.label || 'full'}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, label: e.target.value }
                      })}
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    >
                      <option value="full">Full</option>
                      <option value="lower">Lower</option>
                      <option value="upper">Upper</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-0">
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.exact}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, exact: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Exact
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['no-extra']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'no-extra': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    No Extra
                  </label>
                  <div></div>
                  <div></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Min</label>
                    <input
                      type="number"
                      value={commandDialog.params.min || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, min: e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="Override min value"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max</label>
                    <input
                      type="number"
                      value={commandDialog.params.max || ''}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, max: e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="Override max value"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const binsCmd = xanCommands.find((c) => c.id === "bins");
                        if (binsCmd) {
                          const params = {
                            ...binsCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(binsCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'window' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expression</label>
                  <input
                    type="text"
                    value={commandDialog.params.expression || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, expression: e.target.value }
                    })}
                    placeholder="Window expression (e.g., lag:col1)"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Group By</label>
                  <input
                    type="text"
                    value={commandDialog.params.groupby || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, groupby: e.target.value }
                    })}
                    placeholder="Reset aggregation on column(s)"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const windowCmd = xanCommands.find((c) => c.id === "window");
                        if (windowCmd) {
                          const params = {
                            ...windowCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(windowCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'grep' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pattern</label>
                  <input
                    type="text"
                    value={commandDialog.params.pattern}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, pattern: e.target.value }
                    })}
                    placeholder="Pattern to match"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['ignore-case']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'ignore-case': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Ignore Case
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['invert-match']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'invert-match': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Invert Match
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.count}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, count: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Count
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const grepCmd = xanCommands.find((c) => c.id === "grep");
                        if (grepCmd) {
                          const params = {
                            ...grepCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(grepCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'headers' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['just-names']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'just-names': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Just Names
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const headersCmd = xanCommands.find((c) => c.id === "headers");
                        if (headersCmd) {
                          const params = {
                            ...headersCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(headersCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'flatten' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Columns</label>
                  <input
                    type="text"
                    value={commandDialog.params.select || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value }
                    })}
                    placeholder="Column(s) to visualize"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Limit</label>
                  <input
                    type="number"
                    value={commandDialog.params.limit || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, limit: parseInt(e.target.value) || undefined }
                    })}
                    placeholder="Maximum number of rows to read"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.condense}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, condense: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Condense
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.wrap}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, wrap: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Wrap
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.flatter}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, flatter: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Flatter
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.csv}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, csv: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    CSV
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.rainbow}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, rainbow: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Rainbow
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['non-empty']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'non-empty': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Non Empty
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Separator</label>
                  <input
                    type="text"
                    value={commandDialog.params.sep || '|'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sep: e.target.value }
                    })}
                    placeholder="Delimiter for split values"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const flattenCmd = xanCommands.find((c) => c.id === "flatten");
                        if (flattenCmd) {
                          const params = {
                            ...flattenCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(flattenCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'hist' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <input
                    type="text"
                    value={commandDialog.params.name || 'unknown'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, name: e.target.value }
                    })}
                    placeholder="Name of the represented field"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Field</label>
                  <input
                    type="text"
                    value={commandDialog.params.field || 'field'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, field: e.target.value }
                    })}
                    placeholder="Name of the field column"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Label</label>
                  <input
                    type="text"
                    value={commandDialog.params.label || 'value'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, label: e.target.value }
                    })}
                    placeholder="Name of the label column"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Value</label>
                  <input
                    type="text"
                    value={commandDialog.params.value || 'count'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, value: e.target.value }
                    })}
                    placeholder="Name of the count column"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.rainbow}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, rainbow: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Rainbow
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.dates}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, dates: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Dates
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['hide-percent']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'hide-percent': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Hide Percent
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const histCmd = xanCommands.find((c) => c.id === "hist");
                        if (histCmd) {
                          const params = {
                            ...histCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(histCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'drop' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Selection</label>
                  <input
                    type="text"
                    value={commandDialog.params.selection || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, selection: e.target.value }
                    })}
                    placeholder="Columns to drop (comma-separated)"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const dropCmd = xanCommands.find((c) => c.id === "drop");
                        if (dropCmd) {
                          const params = {
                            ...dropCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(dropCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'map' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expression</label>
                  <input
                    type="text"
                    value={commandDialog.params.expression || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, expression: e.target.value }
                    })}
                    placeholder="Expression to evaluate"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.overwrite}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, overwrite: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Overwrite
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.filter}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, filter: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Filter
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, parallel: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Parallel
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Threads</label>
                  <input
                    type="number"
                    value={commandDialog.params.threads || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, threads: parseInt(e.target.value) || undefined }
                    })}
                    placeholder="Number of threads to use"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const mapCmd = xanCommands.find((c) => c.id === "map");
                        if (mapCmd) {
                          const params = {
                            ...mapCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(mapCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'transform' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column</label>
                  <input
                    type="text"
                    value={commandDialog.params.column || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value }
                    })}
                    placeholder="Column to transform"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expression</label>
                  <input
                    type="text"
                    value={commandDialog.params.expression || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, expression: e.target.value }
                    })}
                    placeholder="Expression to evaluate"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const transformCmd = xanCommands.find((c) => c.id === "transform");
                        if (transformCmd) {
                          const params = {
                            ...transformCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(transformCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'enum' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column Name</label>
                  <input
                    type="text"
                    value={commandDialog.params['column-name'] || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'column-name': e.target.value }
                    })}
                    placeholder="Name of the column to prepend"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start</label>
                  <input
                    type="number"
                    value={commandDialog.params.start || 0}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, start: parseInt(e.target.value) || 0 }
                    })}
                    placeholder="Number to count from"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['byte-offset']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'byte-offset': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Byte Offset
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.accumulate}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, accumulate: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Accumulate
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const enumCmd = xanCommands.find((c) => c.id === "enum");
                        if (enumCmd) {
                          const params = {
                            ...enumCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(enumCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'fill' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select</label>
                  <input
                    type="text"
                    value={commandDialog.params.select || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value }
                    })}
                    placeholder="Selection of columns to fill"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Value</label>
                  <input
                    type="text"
                    value={commandDialog.params.value || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, value: e.target.value }
                    })}
                    placeholder="Fill empty cells using provided value"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const fillCmd = xanCommands.find((c) => c.id === "fill");
                        if (fillCmd) {
                          const params = {
                            ...fillCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(fillCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'complete' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column</label>
                  <input
                    type="text"
                    value={commandDialog.params.column || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value }
                    })}
                    placeholder="Column to complete"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.check}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, check: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Check
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.dates}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, dates: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Dates
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.sorted}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, sorted: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Sorted
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.reverse}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, reverse: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Reverse
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const completeCmd = xanCommands.find((c) => c.id === "complete");
                        if (completeCmd) {
                          const params = {
                            ...completeCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(completeCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'flatmap' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expression</label>
                  <input
                    type="text"
                    value={commandDialog.params.expression || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, expression: e.target.value }
                    })}
                    placeholder="Expression to evaluate"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column</label>
                  <input
                    type="text"
                    value={commandDialog.params.column || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value }
                    })}
                    placeholder="Column to apply expression to"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Replace</label>
                  <input
                    type="text"
                    value={commandDialog.params.replace || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, replace: e.target.value }
                    })}
                    placeholder="Name of the column to replace"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, parallel: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Parallel
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const flatmapCmd = xanCommands.find((c) => c.id === "flatmap");
                        if (flatmapCmd) {
                          const params = {
                            ...flatmapCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(flatmapCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'separate' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column</label>
                  <input
                    type="text"
                    value={commandDialog.params.column || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value }
                    })}
                    placeholder="Column to split"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Separator</label>
                  <input
                    type="text"
                    value={commandDialog.params.separator || ','}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, separator: e.target.value }
                    })}
                    placeholder="Separator to use"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const separateCmd = xanCommands.find((c) => c.id === "separate");
                        if (separateCmd) {
                          const params = {
                            ...separateCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(separateCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'top' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column</label>
                  <input
                    type="text"
                    value={commandDialog.params.column || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value }
                    })}
                    placeholder="Column to sort by"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Limit</label>
                  <input
                    type="number"
                    value={commandDialog.params.limit || 10}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, limit: parseInt(e.target.value) || 10 }
                    })}
                    placeholder="Number of rows to return"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Group By</label>
                  <input
                    type="text"
                    value={commandDialog.params.groupby || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, groupby: e.target.value }
                    })}
                    placeholder="Return top n values per group"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rank</label>
                  <input
                    type="text"
                    value={commandDialog.params.rank || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, rank: e.target.value }
                    })}
                    placeholder="Name of a rank column to prepend"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.reverse}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, reverse: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Reverse
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const topCmd = xanCommands.find((c) => c.id === "top");
                        if (topCmd) {
                          const params = {
                            ...topCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(topCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'cat' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mode</label>
                  <select
                    value={commandDialog.params.mode || 'rows'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, mode: e.target.value }
                    })}
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  >
                    <option value="rows">Rows</option>
                    <option value="columns">Columns</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Paths</label>
                  <input
                    type="text"
                    value={commandDialog.params.paths || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, paths: e.target.value }
                    })}
                    placeholder="Text file containing paths to CSV files"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Path Column</label>
                  <input
                    type="text"
                    value={commandDialog.params['path-column'] || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'path-column': e.target.value }
                    })}
                    placeholder="Extract paths from this column"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Source Column</label>
                  <input
                    type="text"
                    value={commandDialog.params['source-column'] || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'source-column': e.target.value }
                    })}
                    placeholder="Name of source file column"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.pad}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, pad: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Pad
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const catCmd = xanCommands.find((c) => c.id === "cat");
                        if (catCmd) {
                          const params = {
                            ...catCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(catCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'join' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Columns</label>
                  <input
                    type="text"
                    value={commandDialog.params.columns || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, columns: e.target.value }
                    })}
                    placeholder="Columns to join on"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Input 1</label>
                  <input
                    type="text"
                    value={commandDialog.params.input1 || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, input1: e.target.value }
                    })}
                    placeholder="First input file path"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Columns 2</label>
                  <input
                    type="text"
                    value={commandDialog.params.columns2 || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, columns2: e.target.value }
                    })}
                    placeholder="Right columns to join on"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Input 2</label>
                  <input
                    type="text"
                    value={commandDialog.params.input2 || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, input2: e.target.value }
                    })}
                    placeholder="Second input file path"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Join Type</label>
                  <select
                    value={commandDialog.params['join-type'] || 'inner'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'join-type': e.target.value }
                    })}
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  >
                    <option value="inner">Inner</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                    <option value="full">Full</option>
                    <option value="semi">Semi</option>
                    <option value="anti">Anti</option>
                    <option value="cross">Cross</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Drop Key</label>
                  <select
                    value={commandDialog.params['drop-key'] || 'none'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'drop-key': e.target.value }
                    })}
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                    <option value="none">None</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prefix Left</label>
                  <input
                    type="text"
                    value={commandDialog.params['prefix-left'] || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'prefix-left': e.target.value }
                    })}
                    placeholder="Prefix for left columns"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prefix Right</label>
                  <input
                    type="text"
                    value={commandDialog.params['prefix-right'] || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'prefix-right': e.target.value }
                    })}
                    placeholder="Prefix for right columns"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['ignore-case']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'ignore-case': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Ignore Case
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.nulls}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, nulls: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Nulls
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const joinCmd = xanCommands.find((c) => c.id === "join");
                        if (joinCmd) {
                          const params = {
                            ...joinCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(joinCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'merge' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Inputs</label>
                  <input
                    type="text"
                    value={commandDialog.params.inputs || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, inputs: e.target.value }
                    })}
                    placeholder="Input files to merge"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select</label>
                  <input
                    type="text"
                    value={commandDialog.params.select || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value }
                    })}
                    placeholder="Select a subset of columns to sort"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Paths</label>
                  <input
                    type="text"
                    value={commandDialog.params.paths || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, paths: e.target.value }
                    })}
                    placeholder="Text file containing paths"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Path Column</label>
                  <input
                    type="text"
                    value={commandDialog.params['path-column'] || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'path-column': e.target.value }
                    })}
                    placeholder="Extract paths from this column"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Source Column</label>
                  <input
                    type="text"
                    value={commandDialog.params['source-column'] || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'source-column': e.target.value }
                    })}
                    placeholder="Name of source file column"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.numeric}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, numeric: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Numeric
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.reverse}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, reverse: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Reverse
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.uniq}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, uniq: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Uniq
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const mergeCmd = xanCommands.find((c) => c.id === "merge");
                        if (mergeCmd) {
                          const params = {
                            ...mergeCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(mergeCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'fuzzy-join' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Columns</label>
                  <input
                    type="text"
                    value={commandDialog.params.columns || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, columns: e.target.value }
                    })}
                    placeholder="Columns to join on"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Input</label>
                  <input
                    type="text"
                    value={commandDialog.params.input || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, input: e.target.value }
                    })}
                    placeholder="Input file path"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const fuzzyJoinCmd = xanCommands.find((c) => c.id === "fuzzy-join");
                        if (fuzzyJoinCmd) {
                          const params = {
                            ...fuzzyJoinCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(fuzzyJoinCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'rename' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select</label>
                  <input
                    type="text"
                    value={commandDialog.params.select || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value }
                    })}
                    placeholder="Columns to rename"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Columns</label>
                  <input
                    type="text"
                    value={commandDialog.params.columns || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, columns: e.target.value }
                    })}
                    placeholder="Column mappings (e.g., old1:new1,old2:new2)"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prefix</label>
                  <input
                    type="text"
                    value={commandDialog.params.prefix || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, prefix: e.target.value }
                    })}
                    placeholder="Prefix to add to all column names"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Suffix</label>
                  <input
                    type="text"
                    value={commandDialog.params.suffix || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, suffix: e.target.value }
                    })}
                    placeholder="Suffix to add to all column names"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.slugify}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, slugify: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Slugify
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.replace}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, replace: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Replace
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.force}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, force: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Force
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const renameCmd = xanCommands.find((c) => c.id === "rename");
                        if (renameCmd) {
                          const params = {
                            ...renameCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(renameCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'behead' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.append}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, append: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Append
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const beheadCmd = xanCommands.find((c) => c.id === "behead");
                        if (beheadCmd) {
                          const params = {
                            ...beheadCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(beheadCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'fixlengths' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Length</label>
                  <input
                    type="number"
                    value={commandDialog.params.length || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, length: parseInt(e.target.value) || undefined }
                    })}
                    placeholder="Forcefully set the length of each record"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['trust-header']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'trust-header': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Trust Header
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const fixlengthsCmd = xanCommands.find((c) => c.id === "fixlengths");
                        if (fixlengthsCmd) {
                          const params = {
                            ...fixlengthsCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(fixlengthsCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'explode' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Columns</label>
                  <input
                    type="text"
                    value={commandDialog.params.columns || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, columns: e.target.value }
                    })}
                    placeholder="Columns to explode"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Separator</label>
                  <input
                    type="text"
                    value={commandDialog.params.sep || '|'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sep: e.target.value }
                    })}
                    placeholder="Separator to split the cells"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rename</label>
                  <input
                    type="text"
                    value={commandDialog.params.rename || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, rename: e.target.value }
                    })}
                    placeholder="New names for the exploded columns"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.singularize}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, singularize: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Singularize
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['drop-empty']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'drop-empty': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Drop Empty
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const explodeCmd = xanCommands.find((c) => c.id === "explode");
                        if (explodeCmd) {
                          const params = {
                            ...explodeCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(explodeCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'fmt' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output Delimiter</label>
                  <select
                    value={commandDialog.params['out-delimiter'] || ','}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'out-delimiter': e.target.value }
                    })}
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  >
                    <option value=",">Comma (,)</option>
                    <option value="\t">Tab (\t)</option>
                    <option value=";">Semicolon (;)</option>
                    <option value="|">Pipe (|)</option>
                    <option value="^">Caret (^)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quote Character</label>
                  <input
                    type="text"
                    value={commandDialog.params.quote || '"'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, quote: e.target.value }
                    })}
                    placeholder="Quote character to use"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Escape Character</label>
                  <input
                    type="text"
                    value={commandDialog.params.escape || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, escape: e.target.value }
                    })}
                    placeholder="Escape character to use"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.tabs}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, tabs: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Tabs
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.crlf}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, crlf: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    CRLF
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.ascii}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, ascii: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    ASCII
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['quote-always']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'quote-always': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Quote Always
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['quote-never']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'quote-never': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Quote Never
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const fmtCmd = xanCommands.find((c) => c.id === "fmt");
                        if (fmtCmd) {
                          const params = {
                            ...fmtCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(fmtCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'to' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Format</label>
                  <select
                    value={commandDialog.params.format || 'json'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, format: e.target.value }
                    })}
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  >
                    <option value="html">HTML</option>
                    <option value="json">JSON</option>
                    <option value="jsonl">JSONL</option>
                    <option value="md">Markdown</option>
                    <option value="ndjson">NDJSON</option>
                    <option value="npy">NPY</option>
                    <option value="txt">Text</option>
                    <option value="xlsx">XLSX</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sample Size</label>
                  <input
                    type="number"
                    value={commandDialog.params['sample-size'] || 512}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'sample-size': parseInt(e.target.value) || 512 }
                    })}
                    placeholder="Number of rows to sample for JSON type inference"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Strings</label>
                  <input
                    type="text"
                    value={commandDialog.params.strings || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, strings: e.target.value }
                    })}
                    placeholder="Force selected columns as raw strings (JSON)"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select (Text)</label>
                  <input
                    type="text"
                    value={commandDialog.params.select || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value }
                    })}
                    placeholder="Column to emit as text (txt)"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Number Type (NPY)</label>
                  <select
                    value={commandDialog.params.dtype || 'f64'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, dtype: e.target.value }
                    })}
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  >
                    <option value="f32">f32</option>
                    <option value="f64">f64</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.nulls}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, nulls: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Nulls
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.omit}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, omit: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Omit Empty
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const toCmd = xanCommands.find((c) => c.id === "to");
                        if (toCmd) {
                          const params = {
                            ...toCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(toCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'from' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Format</label>
                  <select
                    value={commandDialog.params.format || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, format: e.target.value }
                    })}
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  >
                    <option value="">Auto-detect</option>
                    <option value="ods">ODS</option>
                    <option value="xls">XLS</option>
                    <option value="xlsb">XLSB</option>
                    <option value="xlsx">XLSX</option>
                    <option value="json">JSON</option>
                    <option value="jsonl">JSONL</option>
                    <option value="ndjson">NDJSON</option>
                    <option value="txt">Text</option>
                    <option value="npy">NPY</option>
                    <option value="tar"> TAR</option>
                    <option value="md">Markdown</option>
                    <option value="markdown">Markdown (full)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sheet Index</label>
                  <input
                    type="number"
                    value={commandDialog.params['sheet-index'] || 0}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'sheet-index': parseInt(e.target.value) || 0 }
                    })}
                    placeholder="0-based index of the sheet to convert"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sheet Name</label>
                  <input
                    type="text"
                    value={commandDialog.params['sheet-name'] || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'sheet-name': e.target.value }
                    })}
                    placeholder="Name of the sheet to convert"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sample Size</label>
                  <input
                    type="number"
                    value={commandDialog.params['sample-size'] || 64}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'sample-size': parseInt(e.target.value) || 64 }
                    })}
                    placeholder="Number of records to sample (JSON)"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column Name (Text)</label>
                  <input
                    type="text"
                    value={commandDialog.params.column || 'value'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value }
                    })}
                    placeholder="Name of the column to create"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nth Table (Markdown)</label>
                  <input
                    type="number"
                    value={commandDialog.params['nth-table'] || 0}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'nth-table': parseInt(e.target.value) || 0 }
                    })}
                    placeholder="Select nth table in Markdown document"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['sort-keys']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'sort-keys': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Sort Keys
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const fromCmd = xanCommands.find((c) => c.id === "from");
                        if (fromCmd) {
                          const params = {
                            ...fromCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(fromCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'reverse' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const reverseCmd = xanCommands.find((c) => c.id === "reverse");
                        if (reverseCmd) {
                          const params = {
                            ...reverseCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(reverseCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'transpose' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const transposeCmd = xanCommands.find((c) => c.id === "transpose");
                        if (transposeCmd) {
                          const params = {
                            ...transposeCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(transposeCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'pivot' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Columns</label>
                  <input
                    type="text"
                    value={commandDialog.params.columns || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, columns: e.target.value }
                    })}
                    placeholder="Columns to pivot"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expression</label>
                  <input
                    type="text"
                    value={commandDialog.params.expr || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, expr: e.target.value }
                    })}
                    placeholder="Aggregation expression"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Group By</label>
                  <input
                    type="text"
                    value={commandDialog.params.groupby || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, groupby: e.target.value }
                    })}
                    placeholder="Group results by given selection of columns"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column Separator</label>
                  <input
                    type="text"
                    value={commandDialog.params['column-sep'] || '_'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'column-sep': e.target.value }
                    })}
                    placeholder="Separator used to join column names"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const pivotCmd = xanCommands.find((c) => c.id === "pivot");
                        if (pivotCmd) {
                          const params = {
                            ...pivotCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(pivotCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'unpivot' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Stack multiple columns into fewer columns.</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Columns</label>
                  <input
                    type="text"
                    value={commandDialog.params.columns || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, columns: e.target.value }
                    })}
                    placeholder="Columns to unpivot (required)"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name Column</label>
                  <input
                    type="text"
                    value={commandDialog.params['name-column'] || 'name'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'name-column': e.target.value }
                    })}
                    placeholder="Name for the column containing unpivoted column names"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Value Column</label>
                  <input
                    type="text"
                    value={commandDialog.params['value-column'] || 'value'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'value-column': e.target.value }
                    })}
                    placeholder="Name for the column containing unpivoted column values"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const unpivotCmd = xanCommands.find((c) => c.id === "unpivot");
                        if (unpivotCmd) {
                          const params = {
                            ...unpivotCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(unpivotCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'split' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Split CSV data into chunks.</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output Directory</label>
                  <input
                    type="text"
                    value={commandDialog.params['out-dir'] || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'out-dir': e.target.value }
                    })}
                    placeholder="Where to write the chunks"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Size (records per chunk)</label>
                  <input
                    type="number"
                    value={commandDialog.params.size || 4096}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, size: parseInt(e.target.value) || 4096 }
                    })}
                    placeholder="Number of records per chunk"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Chunks (max number)</label>
                  <input
                    type="number"
                    value={commandDialog.params.chunks || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, chunks: e.target.value ? parseInt(e.target.value) : undefined }
                    })}
                    placeholder="Divide into at most n chunks"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filename Template</label>
                  <input
                    type="text"
                    value={commandDialog.params.filename || '{}.csv'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, filename: e.target.value }
                    })}
                    placeholder="Filename template for output files"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.segments}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, segments: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Segments
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const splitCmd = xanCommands.find((c) => c.id === "split");
                        if (splitCmd) {
                          const params = {
                            ...splitCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(splitCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'partition' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Partition CSV data based on a column value.</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column</label>
                  <input
                    type="text"
                    value={commandDialog.params.column || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value }
                    })}
                    placeholder="Column to partition by (required)"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output Directory</label>
                  <input
                    type="text"
                    value={commandDialog.params['out-dir'] || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'out-dir': e.target.value }
                    })}
                    placeholder="Where to write the chunks"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filename Template</label>
                  <input
                    type="text"
                    value={commandDialog.params.filename || '{}.csv'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, filename: e.target.value }
                    })}
                    placeholder="Filename template for output files"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prefix Length</label>
                  <input
                    type="number"
                    value={commandDialog.params['prefix-length'] || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'prefix-length': e.target.value ? parseInt(e.target.value) : undefined }
                    })}
                    placeholder="Truncate partition column after n bytes"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.sorted}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, sorted: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Sorted
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.drop}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, drop: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Drop Partition Column
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params['case-sensitive']}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, 'case-sensitive': e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Case Sensitive
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const partitionCmd = xanCommands.find((c) => c.id === "partition");
                        if (partitionCmd) {
                          const params = {
                            ...partitionCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(partitionCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'range' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Create a CSV file from a numerical range.</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End</label>
                  <input
                    type="number"
                    value={commandDialog.params.end || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, end: e.target.value ? parseInt(e.target.value) : undefined }
                    })}
                    placeholder="End of the range (required)"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start</label>
                  <input
                    type="number"
                    value={commandDialog.params.start ?? 0}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, start: e.target.value ? parseInt(e.target.value) : 0 }
                    })}
                    placeholder="Start of the range"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Step</label>
                  <input
                    type="number"
                    value={commandDialog.params.step ?? 1}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, step: e.target.value ? parseInt(e.target.value) : 1 }
                    })}
                    placeholder="Step of the range"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column Name</label>
                  <input
                    type="text"
                    value={commandDialog.params['column-name'] || 'n'}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, 'column-name': e.target.value }
                    })}
                    placeholder="Name of the column containing the range"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.inclusive}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, inclusive: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Inclusive
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, output: e.target.value }
                    })}
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const rangeCmd = xanCommands.find((c) => c.id === "range");
                        if (rangeCmd) {
                          const params = {
                            ...rangeCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(rangeCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}

            {commandDialog.type === 'eval' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Evaluate/debug a single expression.</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expression</label>
                  <input
                    type="text"
                    value={commandDialog.params.expr || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, expr: e.target.value }
                    })}
                    placeholder="Expression to evaluate (required)"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Headers</label>
                  <input
                    type="text"
                    value={commandDialog.params.headers || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, headers: e.target.value }
                    })}
                    placeholder="Pretend headers, separated by commas"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Row</label>
                  <input
                    type="text"
                    value={commandDialog.params.row || ''}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, row: e.target.value }
                    })}
                    placeholder="Pretend row with comma-separated cells"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.serialize}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, serialize: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Serialize
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.explain}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, explain: e.target.checked }
                      })}
                      className="h-4 w-4" />
                    Explain
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCommandDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
                        onStepUpdate(commandDialog.stepId, commandDialog.params);
                      } else {
                        const evalCmd = xanCommands.find((c) => c.id === "eval");
                        if (evalCmd) {
                          const params = {
                            ...evalCmd.parameters.reduce((acc, param) => {
                              acc[param.name] = param.default;
                              return acc;
                            }, {} as Record<string, any>),
                            ...commandDialog.params,
                          };
                          onAddCommand(evalCmd, params);
                        }
                      }
                      setCommandDialog(null);
                    }}
                  >
                    {commandDialog.isUpdate ? 'Update Command' : 'Add to Pipeline'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
