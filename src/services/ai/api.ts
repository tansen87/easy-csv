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
    console.error("AI API call failed:", error);
    return {
      content: "",
      error: `network error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
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
      // JSON.parse failed, try parsing numbered lines inside the code block
      const blockContent = match[1];
      const numberedLineRegex = /^\d+\.\s*(\{.*\})\s*$/gm;
      let numberedMatch;
      while ((numberedMatch = numberedLineRegex.exec(blockContent)) !== null) {
        try {
          const parsedItem = JSON.parse(numberedMatch[1]);
          if (parsedItem.command) {
            commands.push({
              command: parsedItem.command,
              parameters: parsedItem.parameters || {},
              explanation: parsedItem.explanation,
            });
          }
        } catch (e2) {
          console.warn("Failed to parse numbered line in code block:", e2);
        }
      }
    }
    lastIndex = match.index + match[0].length;
  }

  if (commands.length > 0) {
    const remaining = content.slice(lastIndex).trim();
    return { content: remaining, commands, suggestion, usage };
  }

  // Parse numbered format outside code blocks: 1. {"command":...}
  const numberedLineRegex = /^\d+\.\s*(\{.*\})\s*$/gm;
  let numberedMatch;
  let lastNumberedMatch: RegExpExecArray | null = null;
  const numberedContent = content.slice(lastIndex);
  const parsedNumbered: any[] = [];

  while ((numberedMatch = numberedLineRegex.exec(numberedContent)) !== null) {
    lastNumberedMatch = numberedMatch;
    try {
      parsedNumbered.push(JSON.parse(numberedMatch[1]));
    } catch (e) {
      console.warn("Failed to parse numbered line:", e);
    }
  }

  if (parsedNumbered.length > 0 && lastNumberedMatch) {
    parsedNumbered.forEach((item) => {
      if (item.command) {
        commands.push({
          command: item.command,
          parameters: item.parameters || {},
          explanation: item.explanation,
        });
      }
    });
    if (commands.length > 0) {
      const remaining = numberedContent.slice(lastNumberedMatch.index + lastNumberedMatch[0].length).trim();
      return { content: remaining, commands, suggestion, usage };
    }
  }

  return { content, commands: [], suggestion, usage };
}
