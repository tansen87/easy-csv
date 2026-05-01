import {
  Filter,
  Search,
  SortAsc,
  Columns,
  Eye,
  Trash2,
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
import { ScrollArea } from "@/components/ui/scroll-area";

interface ContextMenuState {
  x: number;
  y: number;
  row: number | null;
  col: number;
}

interface ContextMenuProps {
  contextMenu: ContextMenuState;
  contextMenuSearch: string;
  headers: string[];
  onSearchChange: (value: string) => void;
  onClose: () => void;
  onSetCommandDialog: (dialog: any) => void;
}

export function ContextMenu({
  contextMenu,
  contextMenuSearch,
  headers,
  onSearchChange,
  onClose,
  onSetCommandDialog,
}: ContextMenuProps) {
  return (
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
          onChange={(e) => onSearchChange(e.target.value)}
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
                type: 'sort',
                params: {
                  select: columnName,
                  reverse: false,
                  numeric: false,
                },
              });
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
                type: 'select',
                params: {
                  selection: columnName,
                  evaluate: false,
                },
              });
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
                type: 'drop',
                params: {
                  selection: columnName,
                  output: '',
                },
              });
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
                type: 'transform',
                params: {
                  column: columnName,
                  expression: '',
                  output: '',
                },
              });
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
                type: 'fill',
                params: {
                  select: columnName,
                  value: '',
                  output: '',
                },
              });
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
                type: 'separate',
                params: {
                  column: columnName,
                  separator: ',',
                  output: '',
                },
              });
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
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
              onClose();
              onSetCommandDialog({
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
              onClose();
              const columnName = headers[contextMenu.col];
              onSetCommandDialog({
                type: 'fuzzy-join',
                params: {
                  columns: columnName,
                  input: '',
                },
              });
            }}
          >
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            Fuzzy Join
          </button>
        )}
      </ScrollArea>
    </div>
  );
}
