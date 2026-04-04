import { XanCommand } from "@/types/xan";
import { commandCategories } from "@/data/commands";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, Terminal, Sparkles } from "lucide-react";
import { useState } from "react";

interface CommandListProps {
  commands: XanCommand[];
  onCommandClick: (command: XanCommand) => void;
  selectedCommandId?: string;
}

export function CommandList({
  commands,
  onCommandClick,
  selectedCommandId,
}: CommandListProps) {
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/10 border-r border-border/50">
      <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
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
      </div>
      <div className="p-3 border-b bg-background/50">
        <input
          type="text"
          placeholder="Search commands..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-border/50 rounded-lg bg-background/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
        />
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3">
          {commandCategories.map((category) => {
            const categoryCommands = groupedCommands[category];
            if (categoryCommands.length === 0) return null;

            return (
              <div key={category} className="mb-5">
                <h3 className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  {category}
                </h3>
                {categoryCommands.map((command) => (
                  <Card
                    key={command.id}
                    className={`mb-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
                      selectedCommandId === command.id 
                        ? "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/50 shadow-sm" 
                        : "bg-card/80 backdrop-blur-sm hover:bg-accent/30 border-border/50"
                    }`}
                    onClick={() => onCommandClick(command)}
                  >
                    <div className="p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm mb-1">{command.name}</div>
                          <div className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">
                            {command.description}
                          </div>
                        </div>
                        <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                          <ChevronRight className="h-3.5 w-3.5 text-primary/70" />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
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
