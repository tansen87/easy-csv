import { xanFunctions, XanFunction } from "@/data/functions";

export interface AutocompleteItem {
  label: string;
  value: string;
  type: "function" | "column" | "keyword" | "operator";
  description?: string;
  params?: string[];
}

export interface AutocompleteResult {
  items: AutocompleteItem[];
  start: number;
  end: number;
}

const keywordSuggestions: AutocompleteItem[] = [
  { label: "true", value: "true", type: "keyword", description: "Boolean true" },
  { label: "false", value: "false", type: "keyword", description: "Boolean false" },
  { label: "null", value: "null", type: "keyword", description: "Null value" },
  { label: "as", value: "as ", type: "keyword", description: "Alias expression" },
  { label: "if", value: "if ", type: "keyword", description: "Conditional" },
  { label: "else", value: "else ", type: "keyword", description: "Else branch" },
  { label: "and", value: "and ", type: "keyword", description: "Logical AND" },
  { label: "or", value: "or ", type: "keyword", description: "Logical OR" },
  { label: "not", value: "not ", type: "keyword", description: "Logical NOT" },
  { label: "in", value: "in ", type: "keyword", description: "Membership test" },
  { label: "is", value: "is ", type: "keyword", description: "Identity test" },
];

const operatorSuggestions: AutocompleteItem[] = [
  { label: "==", value: "== ", type: "operator", description: "Equal" },
  { label: "!=", value: "!= ", type: "operator", description: "Not equal" },
  { label: "<", value: "< ", type: "operator", description: "Less than" },
  { label: ">", value: "> ", type: "operator", description: "Greater than" },
  { label: "<=", value: "<= ", type: "operator", description: "Less than or equal" },
  { label: ">=", value: ">= ", type: "operator", description: "Greater than or equal" },
  { label: "&&", value: "&& ", type: "operator", description: "Logical AND" },
  { label: "||", value: "|| ", type: "operator", description: "Logical OR" },
  { label: "++", value: "++ ", type: "operator", description: "String concatenation" },
  { label: "..", value: ".. ", type: "operator", description: "Range" },
  { label: "|", value: "| ", type: "operator", description: "Pipeline" },
  { label: "?", value: "?", type: "operator", description: "Unsure identifier" },
];

export function getAutocompleteSuggestions(
  expression: string,
  position: number,
  columns: string[] = []
): AutocompleteResult {
  // Find the current word being typed
  let wordStart = position;
  while (wordStart > 0 && /[a-zA-Z0-9_$@]/.test(expression[wordStart - 1])) {
    wordStart--;
  }
  const word = expression.slice(wordStart, position).toLowerCase();

  // If the word is empty, show recent/common suggestions
  if (!word) {
    return {
      items: [
        ...keywordSuggestions.slice(0, 5),
        ...xanFunctions.slice(0, 5).map((f) => ({
          label: f.name,
          value: f.name + "(",
          type: "function" as const,
          description: f.description,
          params: f.params,
        })),
        ...columns.slice(0, 5).map((c) => ({
          label: c,
          value: c,
          type: "column" as const,
        })),
      ],
      start: wordStart,
      end: position,
    };
  }

  const items: AutocompleteItem[] = [];

  // Search functions
  const matchingFunctions = xanFunctions
    .filter((f) => f.name.toLowerCase().startsWith(word))
    .map((f) => ({
      label: f.name,
      value: f.name + "(",
      type: "function" as const,
      description: f.description,
      params: f.params,
    }));
  items.push(...matchingFunctions);

  // Search keywords
  const matchingKeywords = keywordSuggestions.filter((k) =>
    k.label.toLowerCase().startsWith(word)
  );
  items.push(...matchingKeywords);

  // Search operators
  const matchingOperators = operatorSuggestions.filter((o) =>
    o.label.toLowerCase().startsWith(word)
  );
  items.push(...matchingOperators);

  // Search columns
  const matchingColumns = columns
    .filter((c) => c.toLowerCase().startsWith(word))
    .map((c) => ({
      label: c,
      value: c,
      type: "column" as const,
    }));
  items.push(...matchingColumns);

  // Sort: functions first, then keywords, then columns
  items.sort((a, b) => {
    const typeOrder = { function: 0, keyword: 1, column: 2, operator: 3 };
    const typeDiff = typeOrder[a.type] - typeOrder[b.type];
    if (typeDiff !== 0) return typeDiff;
    return a.label.localeCompare(b.label);
  });

  return {
    items: items.slice(0, 20), // Limit to 20 suggestions
    start: wordStart,
    end: position,
  };
}

export function insertAutocomplete(
  expression: string,
  start: number,
  end: number,
  value: string
): { newExpression: string; newCursorPos: number } {
  const before = expression.slice(0, start);
  const after = expression.slice(end);
  const newExpression = before + value + after;
  const newCursorPos = start + value.length;
  return { newExpression, newCursorPos };
}

export function getFunctionSignature(func: XanFunction): string {
  return `${func.name}(${func.params.join(", ")})`;
}

export function getParamHint(func: XanFunction, paramIndex: number): string {
  if (paramIndex < func.params.length) {
    return `Parameter ${paramIndex + 1}: ${func.params[paramIndex]}`;
  }
  return "";
}
