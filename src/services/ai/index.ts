import { invoke } from "@tauri-apps/api/core";
import {
  AIConfig,
  AIMessage,
  AIResponse,
  AIContext,
  AIFeedback,
  CorrectionRule,
  DEFAULT_AI_CONFIG,
} from "./types";
import { buildFullPrompt, detectClarificationNeed } from "./context";
import { callAI } from "./api";

let currentConfig: AIConfig = { ...DEFAULT_AI_CONFIG };

// Session ID for conversation tracking
const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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
      currentConfig = {
        ...DEFAULT_AI_CONFIG,
        provider: parsed.provider || DEFAULT_AI_CONFIG.provider,
        model: parsed.model || DEFAULT_AI_CONFIG.model,
        apiKey: "",
      };
    }
  } catch (error) {
    console.warn("Failed to load AI config:", error);
  }

  // Load API key for the current provider
  try {
    const key = await invoke<string>("load_api_key", {
      provider: currentConfig.provider,
    });
    currentConfig.apiKey = key;
  } catch (error) {
    console.warn("Failed to load API key:", error);
  }

  return { ...currentConfig };
}

export async function saveAIConfig(config: AIConfig): Promise<void> {
  currentConfig = config;
  try {
    // Save provider + model (no key)
    await invoke("set_ai_config", {
      config: JSON.stringify({
        provider: config.provider,
        model: config.model,
      }),
    });
    // Save encrypted API key per provider
    if (config.apiKey) {
      await invoke("save_api_key", {
        provider: config.provider,
        apiKey: config.apiKey,
      });
    }
  } catch (error) {
    console.warn("Failed to save AI config:", error);
  }
}

export async function loadProviderApiKey(provider: string): Promise<string> {
  try {
    return await invoke<string>("load_api_key", { provider });
  } catch (error) {
    console.warn("Failed to load API key:", error);
    return "";
  }
}

export async function saveProviderApiKey(
  provider: string,
  apiKey: string,
): Promise<void> {
  try {
    await invoke("save_api_key", { provider, apiKey });
  } catch (error) {
    console.warn("Failed to save API key:", error);
  }
}

export async function loadConversationHistory(): Promise<AIMessage[]> {
  try {
    const history = await invoke<string>("load_conversation_history", {
      sessionId: SESSION_ID,
      limit: 10,
    });
    return JSON.parse(history) || [];
  } catch (error) {
    console.warn("Failed to load conversation history:", error);
    return [];
  }
}

export async function saveConversationHistory(
  messages: AIMessage[],
): Promise<void> {
  try {
    await invoke("save_conversation", {
      sessionId: SESSION_ID,
      messages: JSON.stringify(messages),
    });
  } catch (error) {
    console.warn("Failed to save conversation history:", error);
  }
}

export async function loadCorrectionRules(): Promise<CorrectionRule[]> {
  try {
    const rules = await invoke<string>("load_feedback_rules");
    return JSON.parse(rules) || [];
  } catch (error) {
    console.warn("Failed to load correction rules:", error);
    return [];
  }
}

export async function saveFeedback(feedback: AIFeedback): Promise<void> {
  try {
    await invoke("save_feedback", {
      feedback: JSON.stringify(feedback),
    });
  } catch (error) {
    console.warn("Failed to save feedback:", error);
  }
}

export async function saveCorrection(
  pattern: string,
  wrongCommand: string,
  correctCommand: string,
): Promise<void> {
  try {
    const correction = {
      pattern,
      wrongCommand,
      correctCommand,
      timesApplied: 0,
      createdAt: new Date().toISOString(),
    };
    await invoke("save_correction", {
      correction: JSON.stringify(correction),
    });
  } catch (error) {
    console.warn("Failed to save correction:", error);
  }
}

export async function sendAIMessage(
  userMessage: string,
  context: AIContext,
  conversationHistory: AIMessage[] = [],
): Promise<AIResponse> {
  if (!currentConfig.apiKey) {
    return {
      content: "",
      error: "Please configure the API Key in the settings first",
    };
  }

  // Load correction rules
  const correctionRules = await loadCorrectionRules();

  // Enhanced context with history and rules
  const enhancedContext: AIContext = {
    ...context,
    conversationHistory,
    correctionRules,
  };

  // Check if clarification is needed (only for new queries, not clarification responses)
  if (
    !context.pendingClarification &&
    (!context.clarificationRound || context.clarificationRound === 0)
  ) {
    const clarificationCheck = detectClarificationNeed(
      userMessage,
      enhancedContext,
    );
    if (clarificationCheck.needed && clarificationCheck.question) {
      return {
        content: clarificationCheck.question,
        clarification: clarificationCheck.question,
        clarificationOptions: clarificationCheck.options,
      };
    }
  }

  const messages = await buildFullPrompt(userMessage, enhancedContext);

  const allMessages = messages.map((m) => ({
    role: m.role as "system" | "user" | "assistant",
    content: m.content,
    timestamp: Date.now(),
  }));

  return await callAI(allMessages, currentConfig);
}

export function isAIConfigured(): boolean {
  return !!currentConfig.apiKey;
}

export type {
  AIConfig,
  AIMessage,
  AIResponse,
  AIContext,
  AIFeedback,
  CorrectionRule,
};
