import { xanKeywords } from "@/data/functions";

export type TokenType =
  | "keyword"
  | "function"
  | "string"
  | "number"
  | "operator"
  | "column"
  | "comment"
  | "whitespace"
  | "punctuation"
  | "unknown";

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

const keywords = new Set(xanKeywords);

export function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const char = expression[i];

    // Whitespace
    if (/\s/.test(char)) {
      const start = i;
      while (i < expression.length && /\s/.test(expression[i])) {
        i++;
      }
      tokens.push({ type: "whitespace", value: expression.slice(start, i), start, end: i });
      continue;
    }

    // Comments
    if (char === "#") {
      const start = i;
      while (i < expression.length && expression[i] !== "\n") {
        i++;
      }
      tokens.push({ type: "comment", value: expression.slice(start, i), start, end: i });
      continue;
    }

    // Strings
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      const start = i;
      i++; // skip opening quote
      while (i < expression.length && expression[i] !== quote) {
        if (expression[i] === "\\") {
          i++; // skip escape character
        }
        i++;
      }
      if (i < expression.length) {
        i++; // skip closing quote
      }
      tokens.push({ type: "string", value: expression.slice(start, i), start, end: i });
      continue;
    }

    // Binary strings
    if (char === "b" && i + 1 < expression.length && (expression[i + 1] === '"' || expression[i + 1] === "'" || expression[i + 1] === "`")) {
      const quote = expression[i + 1];
      const start = i;
      i += 2; // skip b and opening quote
      while (i < expression.length && expression[i] !== quote) {
        if (expression[i] === "\\") {
          i++;
        }
        i++;
      }
      if (i < expression.length) {
        i++;
      }
      tokens.push({ type: "string", value: expression.slice(start, i), start, end: i });
      continue;
    }

    // Numbers
    if (/\d/.test(char) || (char === "." && i + 1 < expression.length && /\d/.test(expression[i + 1]))) {
      const start = i;
      while (i < expression.length && /[\d._]/.test(expression[i])) {
        i++;
      }
      if (i < expression.length && expression[i] === ".") {
        i++;
        while (i < expression.length && /[\d_]/.test(expression[i])) {
          i++;
        }
      }
      // Scientific notation
      if (i < expression.length && (expression[i] === "e" || expression[i] === "E")) {
        i++;
        if (i < expression.length && (expression[i] === "+" || expression[i] === "-")) {
          i++;
        }
        while (i < expression.length && /\d/.test(expression[i])) {
          i++;
        }
      }
      tokens.push({ type: "number", value: expression.slice(start, i), start, end: i });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_$@?]/.test(char)) {
      const start = i;
      while (i < expression.length && /[a-zA-Z0-9_$]/.test(expression[i])) {
        i++;
      }
      const word = expression.slice(start, i);

      // Check for column references (@column)
      if (word.startsWith("@")) {
        tokens.push({ type: "column", value: word, start, end: i });
        continue;
      }

      // Check for unsure identifiers (word?)
      if (i < expression.length && expression[i] === "?") {
        const unsure = word + "?";
        i++;
        tokens.push({ type: "column", value: unsure, start, end: i });
        continue;
      }

      // Check if it's a keyword
      if (keywords.has(word)) {
        tokens.push({ type: "keyword", value: word, start, end: i });
        continue;
      }

      // Check if it's followed by ( - it's a function call
      if (i < expression.length && expression[i] === "(") {
        tokens.push({ type: "function", value: word, start, end: i });
        continue;
      }

      // Otherwise it's a column reference
      tokens.push({ type: "column", value: word, start, end: i });
      continue;
    }

    // Regex literals
    if (char === "/") {
      const start = i;
      i++; // skip opening /
      while (i < expression.length && expression[i] !== "/") {
        if (expression[i] === "\\") {
          i++;
        }
        i++;
      }
      if (i < expression.length) {
        i++; // skip closing /
      }
      // Check for regex flags
      while (i < expression.length && /[ims]/.test(expression[i])) {
        i++;
      }
      tokens.push({ type: "string", value: expression.slice(start, i), start, end: i });
      continue;
    }

    // Operators
    if ("+-*/%=<>!&|^?:.".includes(char)) {
      const start = i;
      // Handle multi-character operators
      if (i + 1 < expression.length) {
        const two = char + expression[i + 1];
        if (["==", "!=", "<=", ">=", "&&", "||", "**", "..", "++"].includes(two)) {
          i += 2;
          tokens.push({ type: "operator", value: expression.slice(start, i), start, end: i });
          continue;
        }
      }
      i++;
      tokens.push({ type: "operator", value: char, start, end: i });
      continue;
    }

    // Punctuation
    if ("()[]{},;".includes(char)) {
      tokens.push({ type: "punctuation", value: char, start: i, end: i + 1 });
      i++;
      continue;
    }

    // Unknown character
    tokens.push({ type: "unknown", value: char, start: i, end: i + 1 });
    i++;
  }

  return tokens;
}

export function highlightExpression(expression: string): string {
  const tokens = tokenize(expression);
  let result = "";

  for (const token of tokens) {
    const escaped = escapeHtml(token.value);
    switch (token.type) {
      case "keyword":
        result += `<span class="expr-keyword">${escaped}</span>`;
        break;
      case "function":
        result += `<span class="expr-function">${escaped}</span>`;
        break;
      case "string":
        result += `<span class="expr-string">${escaped}</span>`;
        break;
      case "number":
        result += `<span class="expr-number">${escaped}</span>`;
        break;
      case "operator":
        result += `<span class="expr-operator">${escaped}</span>`;
        break;
      case "column":
        result += `<span class="expr-column">${escaped}</span>`;
        break;
      case "comment":
        result += `<span class="expr-comment">${escaped}</span>`;
        break;
      default:
        result += escaped;
    }
  }

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getTokenAtPosition(expression: string, position: number): Token | null {
  const tokens = tokenize(expression);
  for (const token of tokens) {
    if (position >= token.start && position < token.end) {
      return token;
    }
  }
  return null;
}

export function getCurrentWord(expression: string, position: number): { word: string; start: number; end: number } {
  // Find the word at the given position
  let start = position;
  while (start > 0 && /[a-zA-Z0-9_$@?]/.test(expression[start - 1])) {
    start--;
  }
  let end = position;
  while (end < expression.length && /[a-zA-Z0-9_$]/.test(expression[end])) {
    end++;
  }
  return { word: expression.slice(start, end), start, end };
}
