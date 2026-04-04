import { XanCommand } from "@/types/xan";
import { commandCategories } from "@/data/commands";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, Search } from "lucide-react";
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
    <div className="h-full flex flex-col bg-background border-r">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Xan Commands</h2>
        <p className="text-sm text-muted-foreground">
          Click to add to pipeline
        </p>
      </div>
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {commandCategories.map((category) => {
            const categoryCommands = groupedCommands[category];
            if (categoryCommands.length === 0) return null;

            return (
              <div key={category} className="mb-4">
                <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                  {category}
                </h3>
                {categoryCommands.map((command) => (
                  <Card
                    key={command.id}
                    className={`mb-1 cursor-pointer transition-colors hover:bg-accent ${
                      selectedCommandId === command.id ? "bg-accent" : ""
                    }`}
                    onClick={() => onCommandClick(command)}
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{command.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {command.description}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            );
          })}
          {filteredCommands.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No commands found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
