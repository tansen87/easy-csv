export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface AICommand {
  command: string;
  parameters: Record<string, any>;
  explanation?: string;
}

export interface AIResponse {
  content: string;
  commands?: AICommand[];
  error?: string;
}

export interface AIConfig {
  provider: "huggingface" | "deepseek" | "qwen";
  apiKey: string;
  model: string;
}

export interface AIContext {
  headers: string[];
  pipelineSteps: number;
  inputFile?: string;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: "deepseek",
  apiKey: "",
  model: "deepseek-v4-flash",
};

export const PROVIDERS = [
  { id: "deepseek" as const, name: "DeepSeek" },
  { id: "huggingface" as const, name: "Hugging Face" },
  { id: "qwen" as const, name: "Qwen" },
];

export const AVAILABLE_MODELS = {
  deepseek: [
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
  ],
  huggingface: [
    { id: "TinyLlama/TinyLlama-1.1B-Chat-v1.0", name: "TinyLlama 1.1B" },
    { id: "Qwen/Qwen2.5-3B-Instruct", name: "Qwen 2.5 3B" },
    { id: "microsoft/Phi-3.5-mini-instruct", name: "Phi-3.5 Mini" },
  ],
  qwen: [
    { id: "qwen-turbo", name: "Qwen Turbo" },
    { id: "qwen-max", name: "Qwen Max" },
    { id: "qwen3.7-plus", name: "Qwen3.7-plus" },
    { id: "qwen3.6-plus", name: "Qwen3.6-plus" },
    { id: "qwen3.6-flash", name: "Qwen3.6-flash" }
  ],
};
