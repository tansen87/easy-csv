import { invoke } from "@tauri-apps/api/core";
import { AICommand, AIConfig, AIMessage, AIResponse, TokenUsage } from "./types";

interface BackendAIRequest {
  messages: { role: string; content: string }[];
  model: string;
  api_key: string;
  provider: string;
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

export async function callAI(
  messages: AIMessage[],
  config: AIConfig,
): Promise<AIResponse> {
  try {
    const request: BackendAIRequest = {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      model: config.model,
      api_key: config.apiKey,
      provider: config.provider,
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
  }
}

function parseJSONBlock(text: string): { parsed: any[]; endIndex: number } | null {
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

function parseAIResponse(content: string, usage?: TokenUsage): AIResponse {
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
        const cmds = Array.isArray(parsed.commands) ? parsed.commands : [parsed.commands];
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
    return { content: remaining, commands, suggestion, usage };
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
      return { content: remaining, commands, suggestion, usage };
    }
  }

  return { content, commands: [], suggestion, usage };
}
