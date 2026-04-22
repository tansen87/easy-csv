import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronDown, ChevronUp, Terminal, Sparkles, HelpCircle } from "lucide-react";
import { useState } from "react";
import { XanCommand } from "@/types/xan";
import { commandCategories } from "@/data/commands";

interface CommandListProps {
  commands: XanCommand[];
  onCommandClick: (command: XanCommand) => void;
  onHelpClick?: (command: XanCommand) => void;
  selectedCommandId?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function CommandList({
  commands,
  onCommandClick,
  onHelpClick,
  selectedCommandId,
  searchQuery,
}: CommandListProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    commandCategories.reduce((acc, category) => {
      acc[category] = true;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const toggleAllCategories = () => {
    const allExpanded = Object.values(expandedCategories).every(value => value);
    const newState = commandCategories.reduce((acc, category) => {
      acc[category] = !allExpanded;
      return acc;
    }, {} as Record<string, boolean>);
    setExpandedCategories(newState);
  };

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

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/10 border-r border-border/50">
      <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
              <Terminal className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Commands
              </h2>
              <p className="text-xs text-muted-foreground">
                Click to add to pipeline
              </p>
            </div>
          </div>
          <button
            className="p-1 hover:bg-accent/30 transition-colors rounded-md flex items-center justify-center"
            onClick={toggleAllCategories}
          >
            {Object.values(expandedCategories).every(value => value) ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {commandCategories.map((category) => {
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
                    {categoryCommands.map((command) => (
                      <Card
                        key={command.id}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${selectedCommandId === command.id
                            ? "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/50 shadow-sm"
                            : "bg-card/80 backdrop-blur-sm hover:bg-accent/30 border-border/50"
                          }`}
                      >
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0" onClick={() => onCommandClick(command)}>
                              <div className="font-semibold text-sm">{command.name}</div>
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
                              <div
                                className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center cursor-pointer"
                                onClick={() => onCommandClick(command)}
                              >
                                <ChevronRight className="h-3.5 w-3.5 text-primary/70" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filteredCommands.length === 0 && (
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
