import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { highlightExpression } from "@/components/expression/highlight";
import {
  getAutocompleteSuggestions,
  insertAutocomplete,
  AutocompleteItem,
} from "@/components/expression/autocomplete";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getFunctionByName } from "@/data/functions";

interface ExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  columns?: string[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function ExpressionEditor({
  value,
  onChange,
  columns = [],
  placeholder = "Enter expression...",
  className,
  autoFocus = false,
}: ExpressionEditorProps) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autocompleteStart, setAutocompleteStart] = useState(0);
  const [autocompleteEnd, setAutocompleteEnd] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState(0);

  // Detect current function context and parameter index
  const functionContext = useMemo(() => {
    return detectFunctionContext(value, cursorPos);
  }, [value, cursorPos]);

  // Sync scroll between textarea and highlight layer
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Track cursor position on click/key events
  const handleCursorMove = useCallback(() => {
    if (textareaRef.current) {
      setCursorPos(textareaRef.current.selectionStart);
    }
  }, []);

  // Handle input changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const newCursorPos = e.target.selectionStart;

      onChange(newValue);
      setCursorPos(newCursorPos);

      // Check for autocomplete
      const result = getAutocompleteSuggestions(newValue, cursorPos, columns);
      if (result.items.length > 0) {
        setAutocompleteItems(result.items);
        setAutocompleteStart(result.start);
        setAutocompleteEnd(result.end);
        setShowAutocomplete(true);
        setSelectedIndex(0);
      } else {
        setShowAutocomplete(false);
      }
    },
    [onChange, columns]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showAutocomplete) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < autocompleteItems.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : autocompleteItems.length - 1
          );
          break;
        case "Enter":
        case "Tab":
          if (autocompleteItems.length > 0) {
            e.preventDefault();
            selectAutocompleteItem(autocompleteItems[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowAutocomplete(false);
          break;
      }
    },
    [showAutocomplete, autocompleteItems, selectedIndex]
  );

  // Select an autocomplete item
  const selectAutocompleteItem = useCallback(
    (item: AutocompleteItem) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { newExpression, newCursorPos } = insertAutocomplete(
        value,
        autocompleteStart,
        autocompleteEnd,
        item.value
      );

      onChange(newExpression);
      setShowAutocomplete(false);

      // Set cursor position after React re-render
      requestAnimationFrame(() => {
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;
        textarea.focus();
      });
    },
    [value, autocompleteStart, autocompleteEnd, onChange]
  );

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(e.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        150
      )}px`;
    }
  }, [value]);

  const highlighted = highlightExpression(value);

  return (
    <div className={cn("relative", className)}>
      {/* Highlight layer (behind textarea, no own scrollbar) */}
      <div
        ref={highlightRef}
        className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words font-mono text-sm p-2 bg-background border rounded-md z-0 overflow-hidden"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: highlighted + "\n" }}
        style={{
          minHeight: "38px",
          maxHeight: "150px",
        }}
      />

      {/* Textarea (on top, so caret is visible) */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        onClick={handleCursorMove}
        onKeyUp={handleCursorMove}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          "relative z-10 w-full min-h-[38px] max-h-[150px] p-2 font-mono text-sm",
          "bg-transparent border border-transparent rounded-md resize-none",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          "text-transparent caret-black dark:caret-white",
          "expr-editor-scrollbar"
        )}
      />

      {/* Autocomplete dropdown */}
      {showAutocomplete && autocompleteItems.length > 0 && (
        <div
          ref={autocompleteRef}
          className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md"
        >
          <ScrollArea className="h-60">
            <div className="p-1">
              {autocompleteItems.map((item, index) => (
                <div
                  key={`${item.type}-${item.label}`}
                  className={cn(
                    "px-3 py-2 cursor-pointer flex items-center gap-2 rounded-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    index === selectedIndex && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => selectAutocompleteItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-xs rounded",
                      item.type === "function" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                      item.type === "keyword" && "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                      item.type === "column" && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                      item.type === "operator" && "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                    )}
                  >
                    {item.type}
                  </span>
                  <span className="font-mono font-medium">{item.label}</span>
                  {item.type === "function" && item.params && item.params.length > 0 && (
                    <span className="font-mono text-xs text-muted-foreground">
                      ({item.params.join(", ")})
                    </span>
                  )}
                  {item.description && (
                    <span className="text-muted-foreground text-xs ml-auto truncate">
                      {item.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Parameter hint bar */}
      {functionContext && (
        <div className="mt-1 px-2 py-1 text-xs font-mono bg-muted rounded-md flex items-center gap-2">
          <span className="text-muted-foreground">{functionContext.funcName}(</span>
          {functionContext.params.map((param, i) => (
            <span key={i}>
              <span className={cn(
                i === functionContext.paramIndex
                  ? "text-foreground font-bold underline"
                  : "text-muted-foreground"
              )}>
                {param}
              </span>
              {i < functionContext.params.length - 1 && (
                <span className="text-muted-foreground">, </span>
              )}
            </span>
          ))}
          <span className="text-muted-foreground">)</span>
        </div>
      )}
    </div>
  );
}

interface FunctionContext {
  funcName: string;
  params: string[];
  paramIndex: number;
}

function detectFunctionContext(expression: string, cursorPos: number): FunctionContext | null {
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
