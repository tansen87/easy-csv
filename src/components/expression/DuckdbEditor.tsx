import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  duckdbKeywords,
  duckdbFunctions,
  duckdbTableFunctions,
  duckdbTemplates,
} from "@/data/duckdb";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import type { Translations } from "@/i18n/translations";

interface DuckdbEditorProps {
  value: string;
  onChange: (value: string) => void;
  columns?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  /**
   * The selected table of a `.duckdb` input: substituted into
   * templates at the `table_name` placeholder, e.g. the SRC TABLE template
   * becomes `SELECT * FROM src.<table> LIMIT 100;`.
   */
  sourceTable?: string;
}

interface Suggestion {
  label: string;
  insert: string;
  badge: "keyword" | "function" | "column" | "table";
  description?: string;
  signature?: string;
}

/** Rank of each kind in the list: columns first, table functions last. */
const KIND_ORDER: Record<Suggestion["badge"], number> = {
  column: 0,
  function: 1,
  keyword: 2,
  table: 3,
};

/** Quiet three-letter code shown in the list's first column. */
const TYPE_CODES: Record<Suggestion["badge"], string> = {
  column: "col",
  function: "fn",
  keyword: "kw",
  table: "tbl",
};

/** Only used for scrolling; the popover shows at most 6 rows at a time. */
const MAX_SUGGESTIONS = 40;
const MAX_ROWS = 6;
const MIN_ROWS = 3;
const ROW_HEIGHT = 28;
/** 4px list padding above + below, plus the 32px footer. */
const POPOVER_CHROME = 40;
const POPOVER_WIDTH = 420;

const KBD_CLASS =
  "rounded border border-border bg-card px-1 py-px font-mono text-[10px] leading-4 text-muted-foreground";

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
  sourceTable,
}: DuckdbEditorProps) {
  const { effectiveLanguage, t } = useLanguage();
  const isZh = effectiveLanguage === "zh";

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const highlightInnerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selIndex, setSelIndex] = useState(0);
  const [range, setRange] = useState({ start: 0, end: 0 });
  /** Current word when nothing matched, so the list can say so instead of vanishing. */
  const [noMatch, setNoMatch] = useState<string | null>(null);
  // Where to draw the popover: pinned to the word being typed instead of the
  // bottom of the (240–400px tall) editor, so it stays in view without
  // scrolling the dialog.
  const [placement, setPlacement] = useState<{
    above: boolean;
    offset: number;
    left: number;
    width: number;
    listHeight: number;
  } | null>(null);

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
    return [...col, ...fn, ...tf, ...kw];
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
      // Columns first (typing a column name is the common case in a GROUP BY
      // or a SELECT list), then functions, keywords and table functions;
      // shorter names win inside a kind so the likely pick stays on top.
      const items = vocabulary
        .filter((s) => s.label.toLowerCase().startsWith(word))
        .sort(
          (a, b) =>
            KIND_ORDER[a.badge] - KIND_ORDER[b.badge] ||
            a.label.length - b.label.length ||
            a.label.localeCompare(b.label),
        )
        .slice(0, MAX_SUGGESTIONS);
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
        setNoMatch(null);
      } else {
        setSuggestions([]);
        setRange(res);
        const word = v.slice(res.start, res.end);
        setNoMatch(word.length >= 2 ? word : null);
      }
    },
    [onChange, findSuggestions],
  );

  const insertAt = useCallback(
    (text: string, start: number, end: number, insert: string) => {
      const next = text.slice(0, start) + insert + text.slice(end);
      onChange(next);
      setSuggestions([]);
      setNoMatch(null);
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
        setNoMatch(null);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart =
              textareaRef.current.selectionEnd = start + 1;
          }
        });
        return;
      }

      if (e.key === "Escape" && (suggestions.length > 0 || noMatch)) {
        e.preventDefault();
        // Dismiss the popover only; a second Esc closes the dialog.
        e.stopPropagation();
        setSuggestions([]);
        setNoMatch(null);
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
      }
    },
    [suggestions, selIndex, value, range, insertAt, onChange, noMatch],
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

  // Read through a ref so `placeSuggestions` stays stable while still seeing
  // the latest word boundaries.
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const placeSuggestions = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = caretPosition(ta, ta.selectionStart ?? ta.value.length);
    const wordStart = caretPosition(ta, rangeRef.current.start);
    const visibleTop = caret.top - ta.scrollTop;
    const boxHeight = ta.offsetHeight;
    const gap = 4;
    // Stay inside the dialog's scroll viewport too, not just the editor box.
    const viewport = ta.closest<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    const caretPageTop = ta.getBoundingClientRect().top + visibleTop;
    const pageBottom = viewport
      ? viewport.getBoundingClientRect().bottom
      : window.innerHeight;
    const pageTop = viewport ? viewport.getBoundingClientRect().top : 0;
    const below = Math.min(
      boxHeight - visibleTop - caret.lineHeight - gap,
      pageBottom - caretPageTop - caret.lineHeight - gap,
    );
    const above = Math.min(visibleTop - gap, caretPageTop - pageTop - gap);

    const width = Math.min(POPOVER_WIDTH, ta.clientWidth - 8);
    const left = Math.max(
      0,
      Math.min(wordStart.left - ta.scrollLeft, ta.clientWidth - width),
    );
    const aboveCaret = !(below >= MIN_ROWS * ROW_HEIGHT + POPOVER_CHROME || below >= above);
    const available = aboveCaret ? above : below;
    // 3–6 full rows; never a half row.
    const rows = Math.max(
      MIN_ROWS,
      Math.min(MAX_ROWS, Math.floor((available - POPOVER_CHROME) / ROW_HEIGHT)),
    );

    setPlacement({
      above: aboveCaret,
      offset: aboveCaret ? boxHeight - visibleTop + gap : visibleTop + caret.lineHeight + gap,
      left,
      width,
      listHeight: rows * ROW_HEIGHT + 8,
    });
  }, []);

  useEffect(() => {
    syncHighlight();
  }, [value, highlighted, syncHighlight]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      syncHighlight();
      placeSuggestions();
    });
    ro.observe(ta);
    return () => ro.disconnect();
  }, [syncHighlight, placeSuggestions]);

  // Auto-resize: grow the textarea from its content height up to `max` px,
  // after which it scrolls internally. CSS `min-h` still enforces the 160px floor.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 400)}px`;
  }, [value]);

  // Runs after the auto-resize effect so the caret is measured against the
  // editor's final height.
  useEffect(() => {
    if (suggestions.length > 0 || noMatch) placeSuggestions();
  }, [suggestions, noMatch, value, placeSuggestions]);

  // Keep the highlighted row inside the list's scroll viewport as ↑↓ walk
  // past the visible rows (the list shows 3–6 rows, matches often exceed it).
  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-suggestion-index="${selIndex}"]`,
    );
    const viewport = row?.closest<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    if (!row || !viewport) return;
    const rowRect = row.getBoundingClientRect();
    const viewRect = viewport.getBoundingClientRect();
    if (rowRect.top < viewRect.top) {
      viewport.scrollTop += rowRect.top - viewRect.top;
    } else if (rowRect.bottom > viewRect.bottom) {
      viewport.scrollTop += rowRect.bottom - viewRect.bottom;
    }
  }, [selIndex, suggestions]);

  const handleScroll = useCallback(() => {
    syncHighlight();
    placeSuggestions();
  }, [syncHighlight, placeSuggestions]);

  const activeSuggestion = suggestions[selIndex];
  const typedWord = value.slice(range.start, range.end).toLowerCase();

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
                t.sql
                  .replace(/\n+$/, "")
                  .replace("table_name", sourceTable || "table_name"),
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
          className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-md border border-input bg-background"
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
          onMouseUp={() => {
            setSuggestions([]);
            setNoMatch(null);
          }}
          onBlur={() =>
            setTimeout(() => {
              setSuggestions([]);
              setNoMatch(null);
            }, 120)
          }
          placeholder={placeholder}
          autoFocus={autoFocus}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className="relative z-10 block w-full min-h-[240px] p-2 font-mono text-sm leading-relaxed resize-none bg-transparent text-transparent caret-black dark:caret-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-ring whitespace-pre-wrap break-all expr-editor-scrollbar"
        />

        {/* Autocomplete popover — pinned to the word being typed, flipping
            above the caret when the editor bottom is close. */}
        {(suggestions.length > 0 || noMatch) && placement && (
          <div
            ref={listRef}
            className="absolute z-50 overflow-hidden rounded-lg border bg-popover shadow-md"
            style={{
              left: placement.left,
              width: placement.width,
              ...(placement.above
                ? { bottom: placement.offset }
                : { top: placement.offset }),
            }}
          >
            {suggestions.length > 0 ? (
              <>
                <ScrollArea
                  style={{ height: placement.listHeight }}
                  hideHorizontalScrollbar
                >
                  <div className="p-1">
                    {suggestions.map((s, i) => {
                      const active = i === selIndex;
                      const prefixLength = s.label
                        .toLowerCase()
                        .startsWith(typedWord)
                        ? typedWord.length
                        : 0;
                      return (
                        <div
                          key={`${s.badge}-${s.label}`}
                          data-suggestion-index={i}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertAt(
                              value,
                              range.start,
                              range.end,
                              s.insert,
                            );
                          }}
                          onMouseEnter={() => setSelIndex(i)}
                          className={cn(
                            "relative grid h-7 cursor-pointer grid-cols-[24px_1fr_auto] items-center gap-x-2.5 rounded px-2",
                            "hover:bg-muted/55",
                            active && "bg-brand-soft hover:bg-brand-soft",
                          )}
                        >
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute top-1 bottom-1 left-0 w-0.5 rounded-full bg-primary"
                            />
                          )}
                          <span
                            className={cn(
                              "font-mono text-[10.5px]",
                              active
                                ? "text-primary"
                                : "text-muted-foreground/70",
                            )}
                          >
                            {TYPE_CODES[s.badge]}
                          </span>
                          <span className="min-w-0 truncate font-mono text-[13px] font-medium">
                            <span className="text-primary">
                              {s.label.slice(0, prefixLength)}
                            </span>
                            {s.label.slice(prefixLength)}
                          </span>
                          {s.signature && (
                            <span className="max-w-[200px] justify-self-end truncate font-mono text-[11.5px] text-muted-foreground">
                              {s.signature}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="flex h-8 items-center gap-2.5 border-t border-border-soft px-2.5 text-[11.5px] text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-foreground">
                      {suggestionKindLabel(t, activeSuggestion?.badge)}
                    </span>
                    {activeSuggestion?.description
                      ? ` · ${activeSuggestion.description}`
                      : ""}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className={KBD_CLASS}>↑↓</span>
                    <span className={KBD_CLASS}>Tab</span>
                    <span className={KBD_CLASS}>Esc</span>
                  </span>
                </div>
              </>
            ) : (
              <div className="flex h-8 items-center gap-2 px-2.5 text-[11.5px] text-muted-foreground">
                <span className="min-w-0 flex-1 truncate">
                  {t.duckdbSuggestionNoMatch}{" "}
                  <span className="font-mono text-foreground">
                    “{noMatch}”
                  </span>
                </span>
                <span className={KBD_CLASS}>Esc</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function isIdentChar(ch: string): boolean {
  return /[a-zA-Z0-9_$]/.test(ch);
}

/** Full name of a suggestion kind, used by the popover footer. */
function suggestionKindLabel(
  t: Translations,
  badge: Suggestion["badge"] | undefined,
): string {
  switch (badge) {
    case "column":
      return t.duckdbSuggestionKindColumn;
    case "function":
      return t.duckdbSuggestionKindFunction;
    case "keyword":
      return t.duckdbSuggestionKindKeyword;
    case "table":
      return t.duckdbSuggestionKindTable;
    default:
      return "";
  }
}

/**
 * Caret offset (from the textarea's border box) at `pos`, plus the line
 * height. Measured on a hidden mirror with the textarea's own text metrics so
 * wrapped lines are accounted for — the popover can then sit under the word
 * being typed instead of below the whole editor.
 */
function caretPosition(
  ta: HTMLTextAreaElement,
  pos: number,
): { top: number; left: number; lineHeight: number } {
  const cs = window.getComputedStyle(ta);
  const borderTop = parseFloat(cs.borderTopWidth) || 0;
  const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
  const mirror = document.createElement("div");
  mirror.style.position = "absolute";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.visibility = "hidden";
  mirror.style.boxSizing = "border-box";
  mirror.style.width = `${ta.clientWidth}px`;
  mirror.style.borderWidth = "0";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-all";
  for (const prop of [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "lineHeight",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "tabSize",
    "textIndent",
  ] as const) {
    mirror.style[prop] = cs[prop];
  }
  mirror.textContent = ta.value.slice(0, pos);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const top = marker.offsetTop + borderTop;
  const left = marker.offsetLeft + borderLeft;
  document.body.removeChild(mirror);
  return {
    top,
    left,
    lineHeight: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || 20,
  };
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
