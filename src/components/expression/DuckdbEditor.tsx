import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  duckdbKeywords,
  duckdbFunctions,
  duckdbTableFunctions,
  duckdbTemplates,
} from "@/data/duckdb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";

interface DuckdbEditorProps {
  value: string;
  onChange: (value: string) => void;
  columns?: string[];
  placeholder?: string;
  autoFocus?: boolean;
}

interface Suggestion {
  label: string;
  insert: string;
  badge: "keyword" | "function" | "column" | "table";
  description?: string;
  signature?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function DuckdbEditor({
  value,
  onChange,
  columns = [],
  placeholder = "SELECT ... FROM input ...",
  autoFocus = false,
}: DuckdbEditorProps) {
  const { language } = useLanguage();
  const isZh = language === "zh";

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const highlightInnerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selIndex, setSelIndex] = useState(0);
  const [range, setRange] = useState({ start: 0, end: 0 });

  const vocabulary = useMemo<Suggestion[]>(() => {
    const kw: Suggestion[] = [...duckdbKeywords]
      .filter((k) => !k.includes("-"))
      .map((k) => ({
        label: k,
        insert: `${k} `,
        badge: "keyword" as const,
      }));
    const fn: Suggestion[] = duckdbFunctions.map((f) => ({
      label: f.name,
      insert: `${f.name}(`,
      badge: "function" as const,
      signature: f.signature,
      description: f.description,
    }));
    const tf: Suggestion[] = duckdbTableFunctions.map((f) => ({
      label: f.name,
      insert: `${f.name}(`,
      badge: "table" as const,
      signature: f.signature,
      description: f.description,
    }));
    const col: Suggestion[] = columns.map((c) => ({
      label: c,
      insert: c,
      badge: "column" as const,
    }));
    return [...fn, ...tf, ...kw, ...col];
  }, [columns]);

  const findSuggestions = useCallback(
    (
      text: string,
      pos: number,
    ): { items: Suggestion[]; start: number; end: number } => {
      let start = pos;
      while (start > 0 && /[a-zA-Z0-9_$]/.test(text[start - 1])) start--;
      const word = text.slice(start, pos).toLowerCase();
      if (!word) return { items: [], start, end: pos };
      const items = vocabulary
        .filter((s) => s.label.toLowerCase().startsWith(word))
        .slice(0, 12);
      return { items, start, end: pos };
    },
    [vocabulary],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const el = e.target;
      const v = el.value;
      const pos = el.selectionStart || 0;
      onChange(v);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart =
            textareaRef.current.selectionEnd = pos;
        }
      });

      const res = findSuggestions(v, pos);
      if (res.items.length > 0) {
        setSuggestions(res.items);
        setRange(res);
        setSelIndex(0);
      } else {
        setSuggestions([]);
      }
    },
    [onChange, findSuggestions],
  );

  const insertAt = useCallback(
    (text: string, start: number, end: number, insert: string) => {
      const next = text.slice(0, start) + insert + text.slice(end);
      onChange(next);
      setSuggestions([]);
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.selectionStart = ta.selectionEnd = start + insert.length;
          ta.focus();
        }
      });
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter always inserts a literal newline and is fully consumed here
      // (preventDefault + stopPropagation), so it can never bubble to the
      // dialog/window or be interpreted as a submit — no accidental add.
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const ta = e.currentTarget;
        const start = ta.selectionStart ?? value.length;
        const end = ta.selectionEnd ?? value.length;
        onChange(value.slice(0, start) + "\n" + value.slice(end));
        setSuggestions([]);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart =
              textareaRef.current.selectionEnd = start + 1;
          }
        });
        return;
      }

      if (suggestions.length === 0) return;
      switch (e.key) {
        case "Tab":
          // Accept the highlighted autocomplete item.
          e.preventDefault();
          e.stopPropagation();
          insertAt(value, range.start, range.end, suggestions[selIndex].insert);
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelIndex((i) => (i + 1) % suggestions.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          break;
        case "Escape":
          e.preventDefault();
          setSuggestions([]);
          break;
      }
    },
    [suggestions, selIndex, value, range, insertAt, onChange],
  );

  const highlighted = useMemo(() => highlightSql(value), [value]);

  const syncHighlight = useCallback(() => {
    const ta = textareaRef.current;
    const outer = highlightRef.current;
    const inner = highlightInnerRef.current;
    if (!ta || !outer || !inner) return;
    const width = `${ta.clientWidth}px`;
    if (inner.style.width !== width) {
      inner.style.width = width;
    }
    outer.scrollTop = ta.scrollTop;
    outer.scrollLeft = ta.scrollLeft;
  }, []);

  useEffect(() => {
    syncHighlight();
  }, [value, highlighted, syncHighlight]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => syncHighlight());
    ro.observe(ta);
    return () => ro.disconnect();
  }, [syncHighlight]);

  // Auto-resize: grow the textarea from its content height up to `max` px,
  // after which it scrolls internally. CSS `min-h` still enforces the 160px floor.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 400)}px`;
  }, [value]);

  const handleScroll = syncHighlight;

  return (
    <div className="space-y-2">
      {/* Quick template toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground select-none">
          {isZh ? "插入模板" : "Insert template"}
        </span>
        {duckdbTemplates.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() =>
              insertAt(
                value,
                value.length,
                value.length,
                t.sql.replace(/\n+$/, ""),
              )
            }
            className="px-2 py-0.5 text-[11px] font-medium rounded border border-border/60 bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <div
          ref={highlightRef}
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-md border bg-background dark:border-neutral-500"
        >
          <div
            ref={highlightInnerRef}
            className="whitespace-pre-wrap break-all font-mono text-sm leading-relaxed p-2 tab-2"
            dangerouslySetInnerHTML={{ __html: highlighted + "\n" }}
          />
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onMouseUp={() => setSuggestions([])}
          onBlur={() => setTimeout(() => setSuggestions([]), 120)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className="relative z-10 block w-full min-h-[240px] p-2 font-mono text-sm leading-relaxed resize-none bg-transparent text-transparent caret-black dark:caret-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-ring whitespace-pre-wrap break-all expr-editor-scrollbar"
        />

        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <div
            ref={listRef}
            className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border rounded-md shadow-md"
          >
            <ScrollArea className="h-40">
              <div className="p-1">
                {suggestions.map((s, i) => (
                  <div
                    key={`${s.badge}-${s.label}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertAt(value, range.start, range.end, s.insert);
                    }}
                    onMouseEnter={() => setSelIndex(i)}
                    className={cn(
                      "px-3 py-1.5 cursor-pointer flex items-center gap-2 text-sm rounded-sm",
                      "hover:bg-accent hover:text-accent-foreground",
                      i === selIndex && "bg-accent text-accent-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-[10px] uppercase rounded shrink-0",
                        s.badge === "function" &&
                          "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                        s.badge === "table" &&
                          "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
                        s.badge === "keyword" &&
                          "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                        s.badge === "column" &&
                          "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                      )}
                    >
                      {s.badge}
                    </span>
                    <span className="font-mono font-medium truncate">
                      {s.label}
                      {s.signature && (
                        <span className="text-xs text-muted-foreground ml-1">
                          {s.signature}
                        </span>
                      )}
                    </span>
                    {s.description && (
                      <span className="text-muted-foreground text-xs ml-auto truncate">
                        {s.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

function isIdentChar(ch: string): boolean {
  return /[a-zA-Z0-9_$]/.test(ch);
}

function highlightSql(sql: string): string {
  let out = "";
  let i = 0;
  const n = sql.length;

  const append = (text: string) => {
    out += escapeHtml(text);
  };

  while (i < n) {
    const ch = sql[i];

    // Line comment
    if (ch === "-" && sql[i + 1] === "-") {
      const start = i;
      while (i < n && sql[i] !== "\n") i++;
      out += `<span class="expr-comment">${escapeHtml(sql.slice(start, i))}</span>`;
      continue;
    }
    // Block comment
    if (ch === "/" && sql[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i = Math.min(i + 2, n);
      out += `<span class="expr-comment">${escapeHtml(sql.slice(start, i))}</span>`;
      continue;
    }

    // Strings
    if (ch === "'" || ch === '"') {
      const quote = ch;
      const start = i;
      i++;
      while (i < n && sql[i] !== quote) {
        if (sql[i] === "\\") i++;
        i++;
      }
      i = Math.min(i + 1, n);
      out += `<span class="expr-string">${escapeHtml(sql.slice(start, i))}</span>`;
      continue;
    }

    // Numbers
    if (/\d/.test(ch) || (ch === "." && i + 1 < n && /\d/.test(sql[i + 1]))) {
      const start = i;
      while (i < n && /[\d._eE+-]/.test(sql[i])) i++;
      out += `<span class="expr-number">${escapeHtml(sql.slice(start, i))}</span>`;
      continue;
    }

    // Identifiers / keywords / functions
    if (/[a-zA-Z]/.test(ch)) {
      const start = i;
      while (i < n && isIdentChar(sql[i])) i++;
      const word = sql.slice(start, i);
      if (word.toLowerCase() === "input") {
        out += `<span class="expr-column">${escapeHtml(word)}</span>`;
      } else if (duckdbKeywords.has(word.toLowerCase())) {
        out += `<span class="expr-keyword">${escapeHtml(word)}</span>`;
      } else if (i < n && sql[i] === "(") {
        out += `<span class="expr-function">${escapeHtml(word)}</span>`;
      } else {
        out += escapeHtml(word);
      }
      continue;
    }

    // Operators
    if ("+-*/=<>!|&~%".includes(ch)) {
      out += `<span class="expr-operator">${escapeHtml(ch)}</span>`;
      i++;
      continue;
    }

    append(ch);
    i++;
  }
  return out;
}
