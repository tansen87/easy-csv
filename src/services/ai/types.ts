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
  suggestion?: string;
  error?: string;
  usage?: TokenUsage;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AIConfig {
  provider: "deepseek" | "qwen" | "glm";
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
  { id: "qwen" as const, name: "Qwen" },
  { id: "glm" as const, name: "GLM" },
];

export const AVAILABLE_MODELS = {
  deepseek: [
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
  ],
  qwen: [
    { id: "deepseek-v4-flash-0731", name: "DeepSeek v4 flash 0731" },
    { id: "deepseek-v4-flash", name: "DeepSeek v4 flash" },
    { id: "deepseek-v4-pro", name: "DeepSeek v4 pro" },
    { id: "qwen-turbo", name: "Qwen Turbo" },
    { id: "qwen-max", name: "Qwen Max" },
    { id: "qwen3.7-plus", name: "Qwen3.7 plus" },
    { id: "qwen3.6-plus", name: "Qwen3.6 plus" },
    { id: "qwen3.6-flash", name: "Qwen3.6 flash" },
    { id: "qwen3-8b", name: "Qwen3 8b" },
    { id: "glm-5", name: "GLM 5" },
    { id: "glm-5.1", name: "GLM 5.1" },
    { id: "glm-5.2", name: "GLM 5.2" },
  ],
  glm: [
    { id: "glm-4.7-flash", name: "GLM4.7 Flash" },
    { id: "glm-4-flash-250414", name: "GLM4 Flash 250414" },
    { id: "glm-4-flash", name: "GLM4 Flash" },
  ],
};
