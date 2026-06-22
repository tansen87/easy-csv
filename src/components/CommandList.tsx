import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronDown,
  Terminal,
  Sparkles,
  HelpCircle,
  Eye,
  List,
  Hash,
  ArrowDown,
  BarChart3,
  CheckCheck,
  Trash2,
  SquareFunction,
  RefreshCw,
  ListOrdered,
  PaintBucket,
  CheckCircle,
  Columns3,
  Search,
  Filter,
  ArrowUp,
  Scissors,
  Trophy,
  Dices,
  ArrowUpDown,
  Rows3,
  Shuffle,
  BarChart2,
  Group,
  Activity,
  Sigma,
  LayoutGrid,
  PanelLeft,
  Files,
  GitMerge,
  Merge,
  Type,
  Minus,
  Ruler,
  FileText,
  MoveRight,
  MoveLeft,
  Repeat,
  Repeat2,
  Grid3X3,
  Table2,
  TableRowsSplit,
  Grid3x3,
  Table,
  Calculator,
  Download,
  X,
  History,
  LayersPlus,
  LayersMinus,
  FileInput,
  ScanSearch,
  Pickaxe,
  ChartBar,
  type LucideIcon,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { XanCommand } from "@/types/xan";
import { commandCategories } from "@/data/commands";

const commandIconMap: Record<string, LucideIcon> = {
  // Output
  output: Download,

  // Explore & visualize
  view: Eye,
  headers: List,
  count: Hash,
  flatten: Minus,
  hist: BarChart3,
  plot: ChartBar,

  // Add, transform, drop and move columns
  select: CheckCheck,
  drop: Trash2,
  map: SquareFunction,
  transform: RefreshCw,
  enum: ListOrdered,
  fill: PaintBucket,
  complete: CheckCircle,
  separate: Columns3,

  // Search & filter
  search: Search,
  filter: Filter,
  head: ArrowUp,
  tail: ArrowDown,
  slice: Scissors,
  top: Trophy,
  sample: Dices,
  bisect: ScanSearch,

  // Sort & deduplicate
  sort: ArrowUpDown,
  dedup: Rows3,
  shuffle: Shuffle,

  // Aggregate
  frequency: BarChart2,
  groupby: Group,
  stats: Activity,
  agg: Sigma,
  bins: LayoutGrid,
  window: PanelLeft,

  // Combine multiple CSV files
  cat: Files,
  join: GitMerge,
  merge: Merge,

  // Format, convert & recombobulate
  rename: Type,
  behead: Minus,
  input: FileInput,
  fixlengths: Ruler,
  fmt: FileText,
  explode: LayersPlus,
  implode: LayersMinus,
  scrape: Pickaxe,
  to: MoveRight,
  from: MoveLeft,
  reverse: Repeat,
  transpose: Repeat2,

  // Transpose & pivot
  pivot: Grid3X3,
  unpivot: Table2,

  // Split a CSV file into multiple
  split: TableRowsSplit,
  partition: Grid3x3,

  // Generate CSV files
  range: Table,

  // Scripting
  run: Terminal,
  eval: Calculator,
};

interface CommandListProps {
  commands: XanCommand[];
  onCommandClick: (command: XanCommand) => void;
  onHelpClick?: (command: XanCommand) => void;
  selectedCommandId?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isVisible: boolean;
  onClose: () => void;
  activePanel: "commands" | "history";
  onActivePanelChange: (panel: "commands" | "history") => void;
  historicalPipelines: any[];
  onLoadHistory: (history: any) => void;
  onNewTabFromHistory: (history: any) => void;
  onDeleteHistory: (history: any) => void;
  onLoadCsvData: (tabId: string, filePath: string) => void;
  onDefaultDelimiterChange: (delimiter: string) => void;
  selectedTabId: string;
}

export function CommandList({
  commands,
  onCommandClick,
  onHelpClick,
  searchQuery,
  onSearchChange,
  isVisible,
  onClose,
  activePanel,
  onActivePanelChange,
  historicalPipelines,
  onLoadHistory,
  onNewTabFromHistory,
  onDeleteHistory,
  onLoadCsvData,
  onDefaultDelimiterChange,
  selectedTabId,
}: CommandListProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    commandCategories.reduce((acc, category) => {
      acc[category] = true;
      return acc;
    }, {} as Record<string, boolean>)
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const panelRef = useRef<HTMLDivElement>(null);

  const filteredCommands = commands.filter((command) => {
    const query = searchQuery.toLowerCase();
    return (
      command.name.toLowerCase().includes(query) ||
      command.description.toLowerCase().includes(query) ||
      command.category.toLowerCase().includes(query)
    );
  });

  const groupedCommands = commandCategories.reduce((acc, category) => {
    acc[category] = filteredCommands.filter((cmd) => cmd.category === category);
    return acc;
  }, {} as Record<string, XanCommand[]>);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: rect.left,
        offsetY: rect.top,
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !panelRef.current) return;

      const deltaX = e.clientX - dragStateRef.current.startX;
      const deltaY = e.clientY - dragStateRef.current.startY;

      const toolbarHeight = 56;
      const panelWidth = panelRef.current.offsetWidth;
      const panelHeight = panelRef.current.offsetHeight;

      let newX = dragStateRef.current.offsetX + deltaX;
      let newY = dragStateRef.current.offsetY + deltaY;

      newX = Math.max(0, Math.min(window.innerWidth - panelWidth, newX));
      newY = Math.max(toolbarHeight, Math.min(window.innerHeight - panelHeight, newY));

      panelRef.current.style.left = `${newX}px`;
      panelRef.current.style.top = `${newY}px`;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "move";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  useEffect(() => {
    if (isVisible && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      const newX = Math.min(rect.left, window.innerWidth - 280);
      const newY = Math.max(rect.top, 100);
      panelRef.current.style.left = `${newX}px`;
      panelRef.current.style.top = `${newY}px`;
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const filteredHistory = historicalPipelines.filter(
    (history) =>
      history.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      ref={panelRef}
      style={{
        left: 0,
        top: 100
      }}
      className={`fixed w-[280px] h-[500px] flex flex-col bg-background border border-border/50 rounded-lg shadow-xl z-40 ${isDragging ? "shadow-2xl" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="p-2 border-b bg-card/80 cursor-move flex items-center justify-between"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
            <button
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all ${activePanel === "commands"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              onClick={() => onActivePanelChange("commands")}
            >
              <Terminal className="h-3.5 w-3.5" />
              Cmds
            </button>
            <button
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all ${activePanel === "history"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              onClick={() => onActivePanelChange("history")}
            >
              <History className="h-3.5 w-3.5" />
              History
            </button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 px-2 text-xs font-medium hover:bg-accent hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 z-10 pointer-events-none" />
          <input
            type="text"
            placeholder={
              activePanel === "commands"
                ? "Search command"
                : "Search history"
            }
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-border/50 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {activePanel === "commands" ? (
            commandCategories.map((category) => {
              const categoryCommands = groupedCommands[category];
              if (categoryCommands.length === 0) return null;

              return (
                <div key={category} className="mb-4">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg hover:bg-accent/30 transition-colors"
                    onClick={() => toggleCategory(category)}
                  >
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </h3>
                    <div className="text-muted-foreground/70">
                      {expandedCategories[category] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </button>

                  {expandedCategories[category] && (
                    <div className="mt-2 space-y-1.5 px-1">
                      {categoryCommands.map((command) => {
                        const CommandIcon = commandIconMap[command.name] || Terminal;
                        return (
                          <Card
                            key={command.id}
                            className="cursor-pointer transition-all duration-200 hover:shadow-md bg-card/80 hover:bg-accent/30 border-border/50"
                          >
                            <div className="p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0" onClick={() => onCommandClick(command)}>
                                  <div className="flex items-center gap-2">
                                    <CommandIcon className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
                                    <span className="font-semibold text-sm">{command.name}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2 mt-1">
                                    {command.description}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {onHelpClick && (
                                    <div
                                      className="w-6 h-6 bg-blue-500/10 hover:bg-blue-500/20 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onHelpClick(command);
                                      }}
                                    >
                                      <HelpCircle className="h-3.5 w-3.5 text-blue-500/70" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <>
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 mx-auto mb-3 bg-muted/50 rounded-xl flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">No history found</p>
                  <p className="text-xs text-muted-foreground/70">
                    {searchQuery
                      ? "Try a different search term"
                      : "Execute pipelines to see them here"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((history) => (
                    <div
                      key={history.id}
                      className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-xs truncate">
                          {history.name}
                        </h4>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => onDeleteHistory(history)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {new Date(history.executedAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2 truncate">
                        {history.inputFile.split("\\").pop()}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              onLoadHistory(history);
                              onLoadCsvData(selectedTabId, history.inputFile);
                              onDefaultDelimiterChange(history.defaultDelimiter);
                            }}
                          >
                            Load
                          </Button>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              onNewTabFromHistory(history);
                            }}
                          >
                            New Tab
                          </Button>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${history.success ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
                        >
                          {history.success ? "Success" : "Failed"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {activePanel === "commands" && filteredCommands.length === 0 && (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-muted/50 rounded-xl flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">No commands found</p>
              <p className="text-xs text-muted-foreground/70">
                Try a different search term
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
