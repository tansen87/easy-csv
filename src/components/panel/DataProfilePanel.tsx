import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BarChart3, Hash, Search, Type, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n";

interface ColumnStat {
  field: string;
  count: string;
  count_empty: string;
  types: string;
  sum: string;
  mean: string;
  min: string;
  max: string;
  min_length: string;
  max_length: string;
  [key: string]: string;
}

interface DataProfilePanelProps {
  filePath: string;
  delimiter: string;
  isVisible: boolean;
  onClose: () => void;
}

const typeColors: Record<
  string,
  { bg: string; text: string; icon: typeof Hash }
> = {
  Float: { bg: "bg-purple-500/10", text: "text-purple-600", icon: Hash },
  Integer: { bg: "bg-blue-500/10", text: "text-blue-600", icon: Hash },
  Text: { bg: "bg-green-500/10", text: "text-green-600", icon: Type },
  Mixed: { bg: "bg-orange-500/10", text: "text-orange-600", icon: Type },
  Empty: { bg: "bg-gray-500/10", text: "text-gray-600", icon: Type },
};

function parseXanStatsCsv(raw: string): ColumnStat[] {
  const lines = raw.trim().split("\n");
  if (lines.length < 2) return [];

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCsvLine(lines[0]);
  const rows: ColumnStat[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row as ColumnStat);
  }

  return rows;
}

function fmt(val: string | undefined): string {
  if (!val || val === "") return "—";
  return val;
}

function fmtNum(val: string | undefined, decimals = 2): string {
  if (!val || val === "") return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function DataProfilePanel({
  filePath,
  delimiter,
  isVisible,
  onClose,
}: DataProfilePanelProps) {
  const { t } = useLanguage();
  const [columns, setColumns] = useState<ColumnStat[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredColumns = search
    ? columns.filter((c) =>
        c.field.toLowerCase().includes(search.toLowerCase()),
      )
    : columns;

  useEffect(() => {
    if (!isVisible || !filePath) return;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try cache first
        const cached = await invoke<string | null>("load_profile_cache", {
          filePath,
          delimiter,
        });
        if (cached) {
          const parsed = parseXanStatsCsv(cached);
          setColumns(parsed);
          return;
        }

        // Fall back to profiling
        const raw = await invoke<string>("profile_csv", {
          filePath,
          delimiter,
        });
        const parsed = parseXanStatsCsv(raw);
        setColumns(parsed);

        // Save to cache
        await invoke("save_profile_cache", {
          filePath,
          delimiter,
          stats: raw,
        });
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [filePath, delimiter, isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed right-2 top-19 w-[340px] h-[calc(100vh-86px)] bg-background border border-border/50 rounded-lg shadow-xl z-40 flex flex-col">
      <div className="p-3 border-b bg-card/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">{t.dataProfile}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 px-2"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {columns.length > 0 && !loading && (
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder={t.searchFields}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-7 pl-7 pr-2 text-xs bg-muted/50 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-xs text-muted-foreground mt-2">
                {t.analyzingData}
              </p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {columns.length > 0 && !loading && (
            <>
              <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t.columns}</span>
                  <span className="font-semibold">{columns.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-muted-foreground">{t.rows}</span>
                  <span className="font-semibold">
                    {fmt(columns[0]?.count)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {filteredColumns.map((col) => {
                  const typeStyle = typeColors[col.types] || typeColors.Text;
                  const TypeIcon = typeStyle.icon;
                  const emptyCount = parseInt(col.count_empty || "0", 10);

                  return (
                    <Card key={col.field} className="p-3 bg-card/80">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center ${typeStyle.bg}`}
                          >
                            <TypeIcon className={`h-3 w-3 ${typeStyle.text}`} />
                          </div>
                          <span className="font-semibold text-xs truncate">
                            {col.field}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${typeStyle.bg} ${typeStyle.text}`}
                        >
                          {col.types}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        {emptyCount > 0 && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {t.count}
                              </span>
                              <span className="font-medium">
                                {fmt(col.count)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {t.empty}
                              </span>
                              <span className="font-medium text-orange-500">
                                {emptyCount.toLocaleString()}
                              </span>
                            </div>
                          </>
                        )}
                        {col.min && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t.min}
                            </span>
                            <span className="font-medium truncate ml-2">
                              {fmt(col.min)}
                            </span>
                          </div>
                        )}
                        {col.max && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t.max}
                            </span>
                            <span className="font-medium truncate ml-2">
                              {fmt(col.max)}
                            </span>
                          </div>
                        )}
                        {col.mean && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t.mean}
                            </span>
                            <span className="font-medium">
                              {fmtNum(col.mean)}
                            </span>
                          </div>
                        )}
                        {col.sum && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t.sum}
                            </span>
                            <span className="font-medium">
                              {fmtNum(col.sum, 4)}
                            </span>
                          </div>
                        )}
                        {col.min_length && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t.minLen}
                            </span>
                            <span className="font-medium">
                              {fmt(col.min_length)}
                            </span>
                          </div>
                        )}
                        {col.max_length && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t.maxLen}
                            </span>
                            <span className="font-medium">
                              {fmt(col.max_length)}
                            </span>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
                {filteredColumns.length === 0 && search && (
                  <div className="text-center py-6">
                    <p className="text-xs text-muted-foreground">
                      {t.noFieldsMatch} "{search}"
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
