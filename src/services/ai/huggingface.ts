import { invoke } from "@tauri-apps/api/core";
import { AIConfig, AIMessage, AIResponse } from "./types";

interface BackendAIRequest {
  messages: { role: string; content: string }[];
  model: string;
  api_key: string;
  provider: string;
}

interface BackendAIResponse {
  content: string;
  error: string | null;
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
      return { content: "", error: response.error };
    }

    return parseAIResponse(response.content);
  } catch (error) {
    console.error("AI API call failed:", error);
    return {
      content: "",
      error: `network error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

function parseAIResponse(content: string): AIResponse {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed)) {
        return {
          content: content.replace(/```json\s*[\s\S]*?\s*```/, "").trim(),
          commands: parsed.map((item) => ({
            command: item.command,
            parameters: item.parameters || {},
            explanation: item.explanation,
          })),
        };
      } else if (parsed.command) {
        return {
          content: content.replace(/```json\s*[\s\S]*?\s*```/, "").trim(),
          commands: [
            {
              command: parsed.command,
              parameters: parsed.parameters || {},
              explanation: parsed.explanation,
            },
          ],
        };
      }
    } catch (e) {
      console.warn("Failed to parse JSON from AI response:", e);
    }
  }

  return { content, commands: [] };
}
