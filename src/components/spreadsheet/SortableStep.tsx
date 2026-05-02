import { GripVertical, X, ChevronRight } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PipelineStep } from "@/types/xan";

interface SortableStepProps {
  step: PipelineStep;
  onStepClick: (step: PipelineStep) => void;
  onStepDelete: (stepId: string) => void;
  index: number;
  isLast: boolean;
  headers: string[];
  setCommandDialog: (dialog: any) => void;
}

export function SortableStep({
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

  const activeParams = Object.entries(step.parameters)
    .filter(([, value]) => value !== undefined && value !== "" && value !== false);

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
          expression: step.parameters.expression || '',
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
      className={`flex items-start gap-1 transition-shadow ${isDragging ? 'z-50 shadow-lg scale-105' : ''}`}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground/70 hover:text-foreground transition-colors p-1 rounded hover:bg-accent mt-1"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className={`flex flex-col gap-1 px-3 py-1.5 rounded-lg text-xs border cursor-pointer transition-colors min-w-[80px] ${isDragging ? 'bg-primary/10 border-primary/30 shadow-md' : 'bg-muted/60 border-border/30 hover:bg-muted'}`}
        onClick={handleClick}
      >
        <div className="flex items-center gap-1 whitespace-nowrap">
          <span className="w-5 h-5 bg-primary/20 rounded text-xs font-bold text-primary/70 flex items-center justify-center mr-1 shrink-0">
            {index + 1}
          </span>
          <span className="font-medium">{step.command.name}</span>
          {!isLast && <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
        </div>
        {activeParams.length > 0 && (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {activeParams.slice(0, 3).map(([key, value]) => (
              <span key={key} className="bg-background/70 px-1.5 py-0.5 rounded text-[10px] border border-border/20 truncate">
                <span className="text-muted-foreground/70">{key}=</span>
                <span className="font-medium">{String(value)}</span>
              </span>
            ))}
            {activeParams.length > 3 && (
              <span className="text-[10px] text-muted-foreground/60 px-1">
                +{activeParams.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
      <button
        className="p-1 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded transition-colors mt-1"
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
