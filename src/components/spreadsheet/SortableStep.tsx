import { useMemo } from "react";
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

type CommandType = 'search' | 'filter' | 'sort' | 'select' | 'view' | 'count' | 'slice' | 'head' | 'tail' | 'grep' | 'sample' | 'dedup' | 'shuffle' | 'frequency' | 'groupby' | 'stats' | 'agg' | 'bins' | 'window' | 'headers' | 'flatten' | 'hist' | 'drop' | 'map' | 'enum' | 'rename' | 'behead' | 'fixlengths' | 'explode' | 'fmt' | 'to' | 'from' | 'top' | 'reverse' | 'transpose' | 'pivot' | 'unpivot' | 'split' | 'partition' | 'range' | 'eval' | 'cat' | 'join' | 'merge' | 'fuzzy-join' | 'transform' | 'fill' | 'complete' | 'flatmap' | 'separate';

const commandIds: CommandType[] = [
  'search', 'filter', 'sort', 'select', 'view', 'count', 'slice', 'head', 'tail', 'grep', 
  'sample', 'dedup', 'shuffle', 'frequency', 'groupby', 'stats', 'agg', 'bins', 'window', 
  'headers', 'flatten', 'hist', 'drop', 'map', 'enum', 'rename', 'behead', 'fixlengths', 
  'explode', 'fmt', 'to', 'from', 'top', 'reverse', 'transpose', 'pivot', 'unpivot', 
  'split', 'partition', 'range', 'eval', 'cat', 'join', 'merge', 'fuzzy-join', 'transform', 
  'fill', 'complete', 'flatmap', 'separate'
];

const getInitialParams = (cmdId: string, step: PipelineStep, headers: string[]): Record<string, any> => {
  const params: Record<string, any> = {};
  
  switch (cmdId) {
    case 'search':
      return {
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
        replace: step.parameters.replace || '',
        'add-pattern': step.parameters['add-pattern'] || '',
        'unique-matches': step.parameters['unique-matches'] || '',
        sep: step.parameters.sep || '',
        patterns: step.parameters.patterns || '',
        'pattern-column': step.parameters['pattern-column'] || '',
        'replacement-column': step.parameters['replacement-column'] || '',
        'name-column': step.parameters['name-column'] || '',
        overlapping: step.parameters.overlapping || false,
        left: step.parameters.left || false,
        breakdown: step.parameters.breakdown || false,
        levenshtein: step.parameters.levenshtein || undefined,
        'damerau-levenshtein': step.parameters['damerau-levenshtein'] || undefined,
      };
    case 'filter':
      return {
        expression: step.parameters.expression || '',
        'invert-match': step.parameters['invert-match'] || false,
        parallel: step.parameters.parallel || false,
        threads: step.parameters.threads || undefined,
        output: step.parameters.output || '',
      };
    case 'sort':
      return {
        select: step.parameters.select || headers[0] || '',
        reverse: step.parameters.reverse ?? false,
        numeric: step.parameters.numeric ?? false,
        check: step.parameters.check ?? false,
        count: step.parameters.count,
        uniq: step.parameters.uniq ?? false,
        unstable: step.parameters.unstable ?? false,
        parallel: step.parameters.parallel ?? false,
        threads: step.parameters.threads,
        external: step.parameters.external ?? false,
        'tmp-dir': step.parameters['tmp-dir'],
        'memory-limit': step.parameters['memory-limit'] ?? 512,
        columns: step.parameters.columns ?? false,
        cells: step.parameters.cells ?? false,
        output: step.parameters.output,
      };
    case 'select':
      return {
        selection: step.parameters.selection || '',
        evaluate: step.parameters.evaluate || false,
      };
    case 'view':
      return { limit: step.parameters.limit || 10 };
    case 'cat':
      return {
        mode: step.parameters.mode || 'rows',
        pad: step.parameters.pad || false,
        paths: step.parameters.paths || '',
        'path-column': step.parameters['path-column'] || '',
        'source-column': step.parameters['source-column'] || '',
        output: step.parameters.output || '',
      };
    case 'join':
      return {
        columns: step.parameters.columns || '',
        input1: step.parameters.input1 || '',
        columns2: step.parameters.columns2 || '',
        input2: step.parameters.input2 || '',
        'join-type': step.parameters['join-type'] || 'inner',
        'ignore-case': step.parameters['ignore-case'] || false,
        nulls: step.parameters.nulls || false,
        'drop-key': step.parameters['drop-key'] || 'none',
        'prefix-left': step.parameters['prefix-left'] || '',
        'prefix-right': step.parameters['prefix-right'] || '',
        output: step.parameters.output || '',
      };
    case 'merge':
      return {
        inputs: step.parameters.inputs || '',
        select: step.parameters.select || '',
        numeric: step.parameters.numeric || false,
        reverse: step.parameters.reverse || false,
        uniq: step.parameters.uniq || false,
        'source-column': step.parameters['source-column'] || '',
        paths: step.parameters.paths || '',
        'path-column': step.parameters['path-column'] || '',
        output: step.parameters.output || '',
      };
    case 'fuzzy-join':
      return {
        columns: step.parameters.columns || '',
        input: step.parameters.input || '',
        'pattern-column': step.parameters['pattern-column'] || '',
        patterns: step.parameters.patterns || '',
        regex: step.parameters.regex || false,
        'url-prefix': step.parameters['url-prefix'] || false,
        'ignore-case': step.parameters['ignore-case'] || false,
        simplified: step.parameters.simplified || false,
        left: step.parameters.left || false,
        parallel: step.parameters.parallel || false,
        threads: step.parameters.threads || undefined,
        'drop-key': step.parameters['drop-key'] || 'none',
        'prefix-left': step.parameters['prefix-left'] || '',
        'prefix-right': step.parameters['prefix-right'] || '',
        output: step.parameters.output || '',
      };
    case 'transform':
      return {
        column: step.parameters.column || '',
        expression: step.parameters.expression || '',
        output: step.parameters.output || '',
      };
    case 'fill':
      return {
        select: step.parameters.select || '',
        value: step.parameters.value || '',
        output: step.parameters.output || '',
      };
    case 'complete':
      return {
        column: step.parameters.column || '',
        check: step.parameters.check || false,
        min: step.parameters.min || '',
        max: step.parameters.max || '',
        dates: step.parameters.dates || false,
        sorted: step.parameters.sorted || false,
        reverse: step.parameters.reverse || false,
        groupby: step.parameters.groupby || '',
        output: step.parameters.output || '',
      };
    case 'flatmap':
      return {
        expression: step.parameters.expression || '',
        column: step.parameters.column || '',
        'evaluate-file': step.parameters['evaluate-file'] || '',
        replace: step.parameters.replace || '',
        parallel: step.parameters.parallel || false,
        threads: step.parameters.threads || undefined,
        output: step.parameters.output || '',
      };
    case 'separate':
      return {
        column: step.parameters.column || '',
        separator: step.parameters.separator || '',
        regex: step.parameters.regex || false,
        match: step.parameters.match || false,
        captures: step.parameters.captures || false,
        'all-captures': step.parameters['all-captures'] || false,
        'fixed-width': step.parameters['fixed-width'] || false,
        widths: step.parameters.widths || '',
        cuts: step.parameters.cuts || '',
        offsets: step.parameters.offsets || '',
        max: step.parameters.max || undefined,
        'too-many': step.parameters['too-many'] || 'error',
        into: step.parameters.into || '',
        prefix: step.parameters.prefix || '',
        keep: step.parameters.keep || false,
        trim: step.parameters.trim || false,
        output: step.parameters.output || '',
      };
    case 'count':
      return {
        parallel: step.parameters.parallel || false,
        approx: step.parameters.approx || false,
      };
    case 'slice':
      return {
        start: step.parameters.start || undefined,
        end: step.parameters.end || undefined,
        len: step.parameters.len || undefined,
        output: step.parameters.output || '',
      };
    case 'head':
    case 'tail':
      return {
        limit: step.parameters.limit || 10,
        output: step.parameters.output || '',
      };
    case 'grep':
      return {
        pattern: step.parameters.pattern || '',
        'ignore-case': step.parameters['ignore-case'] || false,
        'invert-match': step.parameters['invert-match'] || false,
        count: step.parameters.count || false,
        output: step.parameters.output || '',
      };
    case 'sample':
      return {
        'sample-size': step.parameters['sample-size'] ?? 10,
        seed: step.parameters.seed,
        weight: step.parameters.weight,
        groupby: step.parameters.groupby,
        cursed: step.parameters.cursed,
        output: step.parameters.output,
      };
    case 'dedup':
      return {
        select: step.parameters.select || '',
        check: step.parameters.check || false,
        sorted: step.parameters.sorted || false,
        'keep-last': step.parameters['keep-last'] || false,
        external: step.parameters.external || false,
        'keep-duplicates': step.parameters['keep-duplicates'] || false,
        choose: step.parameters.choose || '',
        flag: step.parameters.flag || '',
        output: step.parameters.output || '',
      };
    case 'shuffle':
      return {
        seed: step.parameters.seed || undefined,
        external: step.parameters.external || false,
        output: step.parameters.output || '',
      };
    case 'frequency':
      return {
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
    case 'groupby':
      return {
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
    case 'stats':
      return {
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
    case 'agg':
      return {
        expression: step.parameters.expression || '',
        'along-rows': step.parameters['along-rows'] || '',
        'along-cols': step.parameters['along-cols'] || '',
        'along-matrix': step.parameters['along-matrix'] || '',
        parallel: step.parameters.parallel || false,
        threads: step.parameters.threads || undefined,
        output: step.parameters.output || '',
      };
    case 'bins':
      return {
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
    case 'window':
      return {
        expression: step.parameters.expression || '',
        groupby: step.parameters.groupby || '',
        output: step.parameters.output || '',
      };
    case 'flatten':
      return {
        select: step.parameters.select,
        limit: step.parameters.limit,
        condense: step.parameters.condense,
        wrap: step.parameters.wrap,
        flatter: step.parameters.flatter,
        csv: step.parameters.csv,
        rainbow: step.parameters.rainbow,
        'non-empty': step.parameters['non-empty'],
        sep: step.parameters.sep,
        output: step.parameters.output,
      };
    case 'drop':
      return {
        selection: step.parameters.selection || '',
        output: step.parameters.output || '',
      };
    case 'map':
      return {
        expression: step.parameters.expression || '',
        'evaluate-file': step.parameters['evaluate-file'] || '',
        overwrite: step.parameters.overwrite || false,
        filter: step.parameters.filter || false,
        parallel: step.parameters.parallel || false,
        threads: step.parameters.threads || undefined,
        output: step.parameters.output || '',
      };
    case 'enum':
      return {
        'column-name': step.parameters['column-name'] || '',
        start: step.parameters.start || 0,
        'byte-offset': step.parameters['byte-offset'] || false,
        accumulate: step.parameters.accumulate || false,
        output: step.parameters.output || '',
      };
    case 'rename':
      return {
        select: step.parameters.select || '',
        columns: step.parameters.columns || '',
        prefix: step.parameters.prefix || '',
        suffix: step.parameters.suffix || '',
        slugify: step.parameters.slugify || false,
        replace: step.parameters.replace || false,
        force: step.parameters.force || false,
        output: step.parameters.output || '',
      };
    case 'behead':
      return {
        append: step.parameters.append || false,
        output: step.parameters.output || '',
      };
    case 'fixlengths':
      return {
        length: step.parameters.length || undefined,
        'trust-header': step.parameters['trust-header'] || false,
        output: step.parameters.output || '',
      };
    case 'explode':
      return {
        columns: step.parameters.columns || '',
        sep: step.parameters.sep || '|',
        singularize: step.parameters.singularize || false,
        rename: step.parameters.rename || '',
        'drop-empty': step.parameters['drop-empty'] || false,
        output: step.parameters.output || '',
      };
    case 'fmt':
      return {
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
    case 'to':
      return {
        format: step.parameters.format || 'json',
        'sample-size': step.parameters['sample-size'] || 512,
        nulls: step.parameters.nulls || false,
        omit: step.parameters.omit || false,
        strings: step.parameters.strings || '',
        dtype: step.parameters.dtype || 'f64',
        select: step.parameters.select || '',
        output: step.parameters.output || '',
      };
    case 'from':
      return {
        format: step.parameters.format || '',
        'sheet-index': step.parameters['sheet-index'] || 0,
        'sheet-name': step.parameters['sheet-name'] || '',
        'sample-size': step.parameters['sample-size'] || 64,
        'sort-keys': step.parameters['sort-keys'] || false,
        column: step.parameters.column || 'value',
        'nth-table': step.parameters['nth-table'] || 0,
        output: step.parameters.output || '',
      };
    case 'top':
      return {
        column: step.parameters.column,
        limit: step.parameters.limit,
        reverse: step.parameters.reverse,
        lexicographic: step.parameters.lexicographic,
        groupby: step.parameters.groupby,
        ties: step.parameters.ties,
        rank: step.parameters.rank,
        output: step.parameters.output,
      };
    case 'reverse':
    case 'transpose':
      return { output: step.parameters.output || '' };
    case 'pivot':
      return {
        columns: step.parameters.columns || '',
        expr: step.parameters.expr || '',
        groupby: step.parameters.groupby || '',
        'column-sep': step.parameters['column-sep'] || '_',
        output: step.parameters.output || '',
      };
    case 'unpivot':
      return {
        columns: step.parameters.columns || '',
        'name-column': step.parameters['name-column'] || 'name',
        'value-column': step.parameters['value-column'] || 'value',
        output: step.parameters.output || '',
      };
    case 'split':
      return {
        'out-dir': step.parameters['out-dir'] || '',
        size: step.parameters.size || 4096,
        chunks: step.parameters.chunks || undefined,
        segments: step.parameters.segments || false,
        filename: step.parameters.filename || '{}.csv',
        output: step.parameters.output || '',
      };
    case 'partition':
      return {
        column: step.parameters.column || '',
        'out-dir': step.parameters['out-dir'] || '',
        filename: step.parameters.filename || '{}.csv',
        'prefix-length': step.parameters['prefix-length'] || undefined,
        sorted: step.parameters.sorted || false,
        drop: step.parameters.drop || false,
        'case-sensitive': step.parameters['case-sensitive'] || false,
        output: step.parameters.output || '',
      };
    case 'range':
      return {
        end: step.parameters.end,
        start: step.parameters.start ?? 0,
        step: step.parameters.step ?? 1,
        'column-name': step.parameters['column-name'] || 'n',
        inclusive: step.parameters.inclusive || false,
        output: step.parameters.output || '',
      };
    case 'eval':
      return {
        expr: step.parameters.expr || '',
        serialize: step.parameters.serialize || false,
        explain: step.parameters.explain || false,
        headers: step.parameters.headers || '',
        row: step.parameters.row || '',
      };
    case 'hist':
      return {
        name: step.parameters.name,
        field: step.parameters.field,
        label: step.parameters.label,
        value: step.parameters.value,
        rainbow: step.parameters.rainbow,
        dates: step.parameters.dates,
        'hide-percent': step.parameters['hide-percent'],
      };
    case 'headers':
      return { 'just-names': step.parameters['just-names'] || false };
    default:
      return params;
  }
};

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

  const activeParams = useMemo(() => {
    return Object.entries(step.parameters).filter(
      ([, value]) => value !== undefined && value !== "" && value !== false
    );
  }, [step.parameters]);

  const handleClick = () => {
    const cmdId = step.command.id;
    
    if (commandIds.includes(cmdId as CommandType)) {
      const initialParams = getInitialParams(cmdId, step, headers);
      setCommandDialog({
        type: cmdId as CommandType,
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
      className={`flex items-center gap-1.5 transition-all duration-200 ease-out ${isDragging ? 'z-50 shadow-xl scale-105' : ''}`}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground transition-all duration-200 p-1 rounded-lg hover:bg-accent/50 mt-0.5 hover:scale-110"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className={`flex flex-col gap-1.5 px-3.5 py-2 rounded-xl text-xs border cursor-pointer transition-all duration-200 min-w-[90px] ${isDragging 
          ? 'bg-primary/15 border-primary/40 shadow-lg brightness-105' 
          : 'bg-gradient-to-br from-muted/70 to-muted/40 border-border/30 hover:from-muted hover:to-muted/60 hover:shadow-md hover:border-border/50 hover:-translate-y-0.5'}`}
        onClick={handleClick}
      >
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="w-5 h-5 bg-gradient-to-br from-primary/30 to-primary/10 rounded-full text-xs font-semibold text-primary/80 flex items-center justify-center mr-0.5 shrink-0 shadow-sm">
            {index + 1}
          </span>
          <span className="font-medium text-foreground/90">{step.command.name}</span>
          {!isLast && <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0 ml-1" />}
        </div>
        {activeParams.length > 0 && (
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {activeParams.slice(0, 3).map(([key, value]) => (
              <span key={key} className="bg-background/60 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[10px] border border-border/20 truncate shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                <span className="text-muted-foreground/60">{key}=</span>
                <span className="font-medium text-foreground/80">{String(value)}</span>
              </span>
            ))}
            {activeParams.length > 3 && (
              <span className="text-[10px] text-muted-foreground/50 px-1">
                +{activeParams.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
      <button
        className="p-1.5 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all duration-200 mt-0.5 hover:scale-110 dark:text-muted-foreground/80"
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
