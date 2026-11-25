import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { highlightExpression } from "@/components/expression/highlight";
import {
  getAutocompleteSuggestions,
  AutocompleteItem,
} from "@/components/expression/autocomplete";
import { measurePopover, type PopoverPlacement } from "@/components/expression/popover";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { getFunctionByName } from "@/data/functions";
import { useLanguage } from "@/i18n";
import type { Translations } from "@/i18n/translations";

interface ExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  columns?: string[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

/** Quiet code shown in the suggestion list's first column. */
const TYPE_CODES: Record<AutocompleteItem["type"], string> = {
  column: "col",
  function: "fn",
  keyword: "kw",
  operator: "op",
};

const KBD_CLASS =
  "rounded border border-border bg-card px-1 py-px font-mono text-[10px] leading-4 text-muted-foreground";

const MIN_EDITOR_HEIGHT = 210;
const MAX_EDITOR_HEIGHT = 330;

/**
 * xan expression editor (design 056). Mirrors the DuckDB editor: a 240px
 * bordered area (210px of code + a 28px signature strip), syntax highlight
 * behind a transparent textarea, and an autocomplete popover anchored to the
 * word being typed instead of hanging below the whole editor.
 */
export function ExpressionEditor({
  value,
  onChange,
  columns = [],
  placeholder = "Enter expression...",
  className,
  autoFocus = false,
}: ExpressionEditorProps) {
  const { t } = useLanguage();
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [range, setRange] = useState({ start: 0, end: 0 });
  /** Current word when nothing matched, so the popover can say so. */
  const [noMatch, setNoMatch] = useState<string | null>(null);
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null);
  const [cursorPos, setCursorPos] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const highlightInnerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const functionContext = useMemo(
    () => detectFunctionContext(value, cursorPos),
    [value, cursorPos],
  );

  const rangeRef = useRef(range);
  rangeRef.current = range;

  const syncHighlight = useCallback(() => {
    const ta = textareaRef.current;
    const outer = highlightRef.current;
    const inner = highlightInnerRef.current;
    if (!ta || !outer || !inner) return;
    // The textarea's scrollbar narrows its content box; match it so wrapped
    // lines stay under the caret.
    const width = `${ta.clientWidth}px`;
    if (inner.style.width !== width) inner.style.width = width;
    outer.scrollTop = ta.scrollTop;
    outer.scrollLeft = ta.scrollLeft;
  }, []);

  const placeSuggestions = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    setPlacement(measurePopover(ta, rangeRef.current.start));
  }, []);

  const closeSuggestions = useCallback(() => {
    setSuggestions([]);
    setNoMatch(null);
  }, []);

  /** Suggestions need at least one typed character, and duplicate labels
   * (e.g. two `count` entries) collapse into one row. */
  const updateSuggestions = useCallback(
    (text: string, pos: number) => {
      const result = getAutocompleteSuggestions(text, pos, columns);
      const word = text.slice(result.start, result.end);
      setRange({ start: result.start, end: result.end });
      if (!word) {
        closeSuggestions();
        return;
      }
      const seen = new Set<string>();
      const items = result.items.filter((item) => {
        if (seen.has(item.label)) return false;
        seen.add(item.label);
        return true;
      });
      if (items.length === 0) {
        setSuggestions([]);
        setNoMatch(word);
        return;
      }
      setSuggestions(items);
      setSelectedIndex(0);
      setNoMatch(null);
    },
    [columns, closeSuggestions],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const newCursorPos = e.target.selectionStart || 0;
      onChange(newValue);
      setCursorPos(newCursorPos);
      updateSuggestions(newValue, newCursorPos);
    },
    [onChange, updateSuggestions],
  );

  const syncCursor = useCallback(() => {
    if (textareaRef.current) {
      setCursorPos(textareaRef.current.selectionStart || 0);
    }
  }, []);

  const insertAt = useCallback(
    (text: string, start: number, end: number, insert: string) => {
      const next = text.slice(0, start) + insert + text.slice(end);
      onChange(next);
      setCursorPos(start + insert.length);
      closeSuggestions();
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.selectionStart = ta.selectionEnd = start + insert.length;
          ta.focus();
        }
      });
    },
    [onChange, closeSuggestions],
  );

  const selectSuggestion = useCallback(
    (item: AutocompleteItem) => {
      insertAt(value, range.start, range.end, item.value);
    },
    [value, range, insertAt],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter is always a newline and never bubbles: the dialog must not add a
      // step while the caret is in the expression.
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const ta = e.currentTarget;
        const start = ta.selectionStart ?? value.length;
        const end = ta.selectionEnd ?? value.length;
        onChange(value.slice(0, start) + "\n" + value.slice(end));
        setCursorPos(start + 1);
        closeSuggestions();
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
        e.stopPropagation();
        closeSuggestions();
        return;
      }

      // Tab belongs to the editor: accept the highlighted suggestion when the
      // popover is open, otherwise indent by two spaces. Without this, an empty
      // editor lets Tab bubble to the dialog and push focus out of the field.
      // Shift+Tab is left alone so the keyboard can still move backwards out.
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (suggestions.length > 0) {
          selectSuggestion(suggestions[selectedIndex]);
        } else {
          const ta = e.currentTarget;
          const start = ta.selectionStart ?? value.length;
          const end = ta.selectionEnd ?? value.length;
          insertAt(value, start, end, "  ");
        }
        return;
      }

      if (suggestions.length === 0) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % suggestions.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(
            (i) => (i - 1 + suggestions.length) % suggestions.length,
          );
          break;
      }
    },
    [
      value,
      suggestions,
      selectedIndex,
      noMatch,
      onChange,
      selectSuggestion,
      insertAt,
      closeSuggestions,
    ],
  );

  // Grow the code area from 210px up to 330px, then scroll internally. Runs
  // before the placement effect below so the caret is measured at the final
  // height.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(
      Math.max(ta.scrollHeight, MIN_EDITOR_HEIGHT),
      MAX_EDITOR_HEIGHT,
    )}px`;
  }, [value]);

  useEffect(() => {
    if (suggestions.length === 0 && !noMatch) {
      setPlacement(null);
      return;
    }
    placeSuggestions();
  }, [suggestions, noMatch, value, range.start, placeSuggestions]);

  useEffect(() => {
    syncHighlight();
  }, [value, syncHighlight]);

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

  // Keep the highlighted row inside the 3–6 row viewport as ↑↓ walk.
  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-suggestion-index="${selectedIndex}"]`,
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
  }, [selectedIndex, suggestions]);

  const highlighted = highlightExpression(value);
  const activeSuggestion = suggestions[selectedIndex];
  const typedWord = value.slice(range.start, range.end).toLowerCase();

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background transition-[border-color,box-shadow] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/20",
        className,
      )}
    >
      <div className="relative">
        <div
          ref={highlightRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
          <div
            ref={highlightInnerRef}
            className="whitespace-pre-wrap break-words px-3 py-3 font-mono text-[13px] leading-[22px] tab-2"
            dangerouslySetInnerHTML={{ __html: highlighted + "\n" }}
          />
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={syncCursor}
          onScroll={() => {
            syncHighlight();
            placeSuggestions();
          }}
          onMouseUp={() => {
            syncCursor();
            closeSuggestions();
          }}
          onBlur={() =>
            setTimeout(() => {
              closeSuggestions();
            }, 120)
          }
          placeholder={placeholder}
          autoFocus={autoFocus}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className={cn(
            "expr-editor-scrollbar relative z-10 block min-h-[210px] w-full resize-none whitespace-pre-wrap break-words tab-2",
            "border-0 bg-transparent px-3 py-3 font-mono text-[13px] leading-[22px]",
            "text-transparent caret-black outline-none placeholder:text-muted-foreground/50 dark:caret-white",
          )}
        />

        {/* Popover anchored to the word being typed; flips above the caret
            when the editor bottom is close. */}
        {(suggestions.length > 0 || noMatch) && placement && (
          <div
            ref={listRef}
            role="listbox"
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
                    {suggestions.map((item, index) => {
                      const active = index === selectedIndex;
                      const prefixLength = item.label
                        .toLowerCase()
                        .startsWith(typedWord)
                        ? typedWord.length
                        : 0;
                      const signature =
                        item.type === "function" &&
                        item.params &&
                        item.params.length > 0
                          ? `(${item.params.join(", ")})`
                          : undefined;
                      return (
                        <div
                          key={`${item.type}-${item.label}`}
                          role="option"
                          aria-label={item.label}
                          aria-selected={active}
                          data-suggestion-index={index}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectSuggestion(item);
                          }}
                          onMouseEnter={() => setSelectedIndex(index)}
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
                            {TYPE_CODES[item.type]}
                          </span>
                          <span className="min-w-0 truncate font-mono text-[13px] font-medium">
                            <span className="text-primary">
                              {item.label.slice(0, prefixLength)}
                            </span>
                            {item.label.slice(prefixLength)}
                          </span>
                          {signature && (
                            <span className="max-w-[200px] justify-self-end truncate font-mono text-[11.5px] text-muted-foreground">
                              {signature}
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
                      {suggestionKindLabel(t, activeSuggestion?.type)}
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
                  {t.exprNoMatch}{" "}
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

      {/* Signature strip: parameters of the function under the caret, or a
          quiet hint when the caret is outside a function call. */}
      <div className="flex h-7 items-center gap-3 border-t border-border-soft px-3 font-mono text-[11.5px] text-muted-foreground">
        {functionContext ? (
          <span className="flex min-w-0 items-center">
            <span>{functionContext.funcName}(</span>
            {functionContext.params.map((param, i) => (
              <span key={i} className="whitespace-nowrap">
                {i > 0 && ", "}
                <span
                  className={cn(
                    i === functionContext.paramIndex &&
                      "font-medium text-primary underline decoration-primary decoration-2 underline-offset-[3px]",
                  )}
                >
                  {param}
                </span>
              </span>
            ))}
            <span>)</span>
          </span>
        ) : (
          <span className="font-sans text-[11.5px] text-muted-foreground/70">
            {t.exprHint}
          </span>
        )}
        <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/60">
          {functionContext
            ? `${functionContext.paramIndex + 1} / ${functionContext.params.length}`
            : "xan"}
        </span>
      </div>
    </div>
  );
}

interface FunctionContext {
  funcName: string;
  params: string[];
  paramIndex: number;
}

/** Full name of a suggestion kind, used by the popover footer. */
function suggestionKindLabel(
  t: Translations,
  type: AutocompleteItem["type"] | undefined,
): string {
  switch (type) {
    case "column":
      return t.exprKindColumn;
    case "function":
      return t.exprKindFunction;
    case "keyword":
      return t.exprKindKeyword;
    case "operator":
      return t.exprKindOperator;
    default:
      return "";
  }
}

function detectFunctionContext(
  expression: string,
  cursorPos: number,
): FunctionContext | null {
  // Walk backwards from cursor to find the function call context
  let depth = 0;
  let paramCount = 0;
  let pos = cursorPos - 1;

  while (pos >= 0) {
    const ch = expression[pos];
    if (ch === ")") {
      depth++;
    } else if (ch === "(") {
      if (depth === 0) {
        // Found the opening paren of the current function
        // Now find the function name before it
        let funcStart = pos - 1;
        while (funcStart >= 0 && /[a-zA-Z0-9_?.]/.test(expression[funcStart])) {
          funcStart--;
        }
        funcStart++;
        const funcName = expression.slice(funcStart, pos);
        const func = getFunctionByName(funcName);
        if (func && func.params.length > 0) {
          return {
            funcName,
            params: func.params,
            paramIndex: Math.min(paramCount, func.params.length - 1),
          };
        }
        return null;
      }
      depth--;
    } else if (ch === "," && depth === 0) {
      paramCount++;
    }
    pos--;
  }
  return null;
}
