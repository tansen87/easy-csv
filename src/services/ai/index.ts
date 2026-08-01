import { invoke } from "@tauri-apps/api/core";
import {
  AIConfig,
  AIMessage,
  AIResponse,
  AIContext,
  DEFAULT_AI_CONFIG,
} from "./types";
import { buildFullPrompt } from "./context";
import { callAI } from "./huggingface";

let currentConfig: AIConfig = { ...DEFAULT_AI_CONFIG };

export function setAIConfig(config: AIConfig): void {
  currentConfig = config;
}

export function getAIConfig(): AIConfig {
  return { ...currentConfig };
}

export async function loadAIConfig(): Promise<AIConfig> {
  try {
    const saved = await invoke<string>("get_ai_config");
    if (saved) {
      const parsed = JSON.parse(saved);
      currentConfig = { ...DEFAULT_AI_CONFIG, ...parsed };
    }
  } catch (error) {
    console.warn("Failed to load AI config:", error);
  }
  return { ...currentConfig };
}

export async function saveAIConfig(config: AIConfig): Promise<void> {
  currentConfig = config;
  try {
    await invoke("set_ai_config", { config: JSON.stringify(config) });
  } catch (error) {
    console.warn("Failed to save AI config:", error);
  }
}

export async function sendAIMessage(
  userMessage: string,
  context: AIContext,
  history: AIMessage[] = [],
): Promise<AIResponse> {
  if (!currentConfig.apiKey) {
    return {
      content: "",
      error: "Please configure the API Key in the settings first",
    };
  }

  const systemAndUserMessages = await buildFullPrompt(userMessage, context);

  const allMessages: AIMessage[] = [
    ...history.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    })),
    ...systemAndUserMessages.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
      timestamp: Date.now(),
    })),
  ];

  const response = await callAI(allMessages, currentConfig);

  return response;
}

export function isAIConfigured(): boolean {
  return !!currentConfig.apiKey;
}

export type { AIConfig, AIMessage, AIResponse, AIContext };
