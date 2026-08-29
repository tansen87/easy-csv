import { invoke } from "@tauri-apps/api/core";
import {
  AICommand,
  AIConfig,
  AIMessage,
  AIResponse,
  TokenUsage,
} from "./types";

interface BackendAIRequest {
  messages: { role: string; content: string }[];
  model: string;
  api_key: string;
  provider: string;
  base_url?: string;
  /** Correlates the `ai-stream` events with this request. */
  request_id?: string;
}

interface BackendAIResponse {
  content: string;
  error: string | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Payload of the `ai-stream` event emitted by the Rust backend. */
interface AIStreamEvent {
  request_id: string;
  delta?: string | null;
  done: boolean;
  error?: string | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
}

export async function callAI(
  messages: AIMessage[],
  config: AIConfig,
  onChunk?: (delta: string) => void,
): Promise<AIResponse> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  let unlisten: (() => void) | undefined;

  // Subscribe before sending so no chunk is missed. The listener is optional:
  // if event support is unavailable we simply fall back to a single response.
  if (onChunk) {
    try {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<AIStreamEvent>("ai-stream", (event) => {
        const payload = event.payload;
        if (!payload || payload.request_id !== requestId) return;
        if (payload.delta) onChunk(payload.delta);
      });
    } catch {
      // ignore: streaming is an enhancement, not a requirement
    }
  }

  try {
    const request: BackendAIRequest = {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      model: config.model,
      api_key: config.apiKey,
      provider: config.provider,
      base_url: config.baseUrl || undefined,
      request_id: requestId,
    };

    const response = await invoke<BackendAIResponse>("call_ai", {
      request,
    });

    if (response.error) {
      return { content: "", error: response.error, usage: response.usage };
    }

    return parseAIResponse(response.content, response.usage);
  } catch (error) {
    return {
      content: "",
      error: `network error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  } finally {
    unlisten?.();
  }
}

function parseJSONBlock(
  text: string,
): { parsed: any[]; endIndex: number } | null {
  const parsed: any[] = [];
  let lastIndex = 0;
  let pos = 0;

  while (pos < text.length) {
    const numMatch = text.slice(pos).match(/^(\d+)\.\s*\{/m);
    if (!numMatch) break;

    const startIdx = pos + numMatch.index! + numMatch[0].length - 1;
    let depth = 0;
    let endIdx = startIdx;
    let found = false;

    for (let i = startIdx; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i + 1;
          found = true;
          break;
        }
      }
    }

    if (!found) break;

    const jsonStr = text.slice(startIdx, endIdx);
    try {
      const item = JSON.parse(jsonStr);
      parsed.push(item);
      lastIndex = endIdx;
    } catch {
      // skip unparseable block
    }

    pos = endIdx;
  }

  return parsed.length > 0 ? { parsed, endIndex: lastIndex } : null;
}

/** Split on commas that are not nested inside parentheses or quotes. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  let quote: string | null = null;

  for (const ch of input) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

/**
 * Matches `sum(col("x") as total)` — an alias wrongly placed inside the call.
 * A correctly written `sum(col("x")) as total` does NOT match, because the
 * string then ends with the alias rather than with a closing parenthesis.
 */
const MISPLACED_ALIAS =
  /^([A-Za-z_]\w*)\(((?:\([^()]*\)|[^()])*)\s+as\s+([^()]+)\)$/;

/**
 * An alias only needs quotes when it is not a plain identifier: Chinese
 * names, spaces or punctuation all require them (`xan agg 'sum(n) as sum,
 * max(x) as "Max Replies"'`).
 */
function quoteAlias(alias: string): string {
  if (!alias) return alias;
  const alreadyQuoted =
    (alias.startsWith('"') && alias.endsWith('"')) ||
    (alias.startsWith("'") && alias.endsWith("'"));
  if (alreadyQuoted) return alias;
  return /[^A-Za-z0-9_]/.test(alias) ? `"${alias}"` : alias;
}

/** Index of the top-level ` as ` (ignoring nested calls and string literals). */
function findTopLevelAs(segment: string): number {
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "(") {
      depth++;
      continue;
    }
    if (ch === ")") {
      depth--;
      continue;
    }
    if (depth === 0 && ch === " " && /^as\s/.test(segment.slice(i + 1))) {
      return i;
    }
  }
  return -1;
}

function normalizeSegment(segment: string): string {
  // 1. Move an alias that was written inside the function call back out.
  const misplaced = segment.match(MISPLACED_ALIAS);
  const fixed = misplaced
    ? `${misplaced[1]}(${misplaced[2]}) as ${misplaced[3]}`
    : segment;

  // 2. Quote the alias when it is not a plain identifier.
  const asIndex = findTopLevelAs(fixed);
  if (asIndex === -1) return fixed;
  const match = fixed.slice(asIndex).match(/^\s+as\s+(.+)$/);
  if (!match) return fixed;
  return `${fixed.slice(0, asIndex)} as ${quoteAlias(match[1].trim())}`;
}

/**
 * Repairs `as` aliases in an expression:
 * - `sum(col("x") as total)`  -> `sum(col("x")) as total`
 * - `sum(col("x")) as 销售额`  -> `sum(col("x")) as "销售额"`
 */
export function normalizeExpressionAliases(expression: string): string {
  if (!expression) return expression;

  return splitTopLevel(expression)
    .map((part) => normalizeSegment(part.trim()))
    .join(", ");
}

/** Applies alias repair to every command carrying an expression. */
function withNormalizedExpressions(commands: AICommand[]): AICommand[] {
  return commands.map((cmd) => {
    const expression = cmd.parameters?.expression;
    if (typeof expression !== "string") return cmd;
    const normalized = normalizeExpressionAliases(expression);
    return normalized === expression
      ? cmd
      : { ...cmd, parameters: { ...cmd.parameters, expression: normalized } };
  });
}

export function parseAIResponse(
  content: string,
  usage?: TokenUsage,
): AIResponse {
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
  const commands: AICommand[] = [];
  let lastIndex = 0;
  let suggestion: string | undefined;

  let match;
  while ((match = jsonBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.suggestion && parsed.commands) {
        suggestion = parsed.suggestion;
        const cmds = Array.isArray(parsed.commands)
          ? parsed.commands
          : [parsed.commands];
        cmds.forEach((item: any) => {
          if (item.command) {
            commands.push({
              command: item.command,
              parameters: item.parameters || {},
              explanation: item.explanation,
            });
          }
        });
      } else if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item.command) {
            commands.push({
              command: item.command,
              parameters: item.parameters || {},
              explanation: item.explanation,
            });
          }
        });
      } else if (parsed.command) {
        commands.push({
          command: parsed.command,
          parameters: parsed.parameters || {},
          explanation: parsed.explanation,
        });
      }
    } catch (e) {
      const blockContent = match[1];
      const result = parseJSONBlock(blockContent);
      if (result) {
        result.parsed.forEach((item) => {
          if (item.command) {
            commands.push({
              command: item.command,
              parameters: item.parameters || {},
              explanation: item.explanation,
            });
          }
        });
      }
    }
    lastIndex = match.index + match[0].length;
  }

  if (commands.length > 0) {
    const remaining = content.slice(lastIndex).trim();
    return {
    content: remaining,
    commands: withNormalizedExpressions(commands),
    suggestion,
    usage,
  };
  }

  // Parse numbered format outside code blocks
  const numberedContent = content.slice(lastIndex);
  const result = parseJSONBlock(numberedContent);

  if (result) {
    result.parsed.forEach((item) => {
      if (item.command) {
        commands.push({
          command: item.command,
          parameters: item.parameters || {},
          explanation: item.explanation,
        });
      }
    });
    if (commands.length > 0) {
      const remaining = numberedContent.slice(result.endIndex).trim();
      return {
    content: remaining,
    commands: withNormalizedExpressions(commands),
    suggestion,
    usage,
  };
    }
  }

  return { content, commands: [], suggestion, usage };
}
