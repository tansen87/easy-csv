use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct AIMessage {
  pub role: String,
  pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIRequest {
  pub messages: Vec<AIMessage>,
  pub model: String,
  pub api_key: String,
  pub provider: String,
  pub base_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIResponse {
  pub content: String,
  pub error: Option<String>,
  pub usage: Option<TokenUsage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenUsage {
  pub prompt_tokens: u32,
  pub completion_tokens: u32,
  pub total_tokens: u32,
}

const DEEPSEEK_API_URL: &str = "https://api.deepseek.com/chat/completions";
const QWEN_API_URL: &str = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const GLM_API_URL: &str = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

fn resolve_chat_url(base_url: &str) -> String {
  let trimmed = base_url.trim().trim_end_matches('/');
  if trimmed.is_empty() {
    trimmed.to_string()
  } else if trimmed.ends_with("/chat/completions") {
    trimmed.to_string()
  } else {
    format!("{}/chat/completions", trimmed)
  }
}

#[tauri::command]
pub async fn call_ai(request: AIRequest) -> Result<AIResponse, String> {
  let url = match request.provider.as_str() {
    "deepseek" => DEEPSEEK_API_URL.to_string(),
    "qwen" => QWEN_API_URL.to_string(),
    "glm" => GLM_API_URL.to_string(),
    _ => resolve_chat_url(request.base_url.as_deref().unwrap_or("")),
  };

  if url.is_empty() {
    return Ok(AIResponse {
      content: String::new(),
      error: Some(format!(
        "Custom provider \"{}\" has no base URL configured. Please set it in Settings → AI.",
        request.provider
      )),
      usage: None,
    });
  }

  call_openai_compatible(&url, request).await
}

async fn call_openai_compatible(url: &str, request: AIRequest) -> Result<AIResponse, String> {
  let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(60))
    .build()
    .map_err(|e| format!("Failed to create client: {}", e))?;

  let body = serde_json::json!({
      "model": request.model,
      "messages": request.messages,
      "temperature": 0.7,
      "max_tokens": 2048,
  });

  eprintln!(
    "[AI] Calling {} ({}): {}",
    request.provider, url, request.model
  );

  let response = client
    .post(url)
    .header("Authorization", format!("Bearer {}", request.api_key))
    .header("Content-Type", "application/json")
    .json(&body)
    .send()
    .await
    .map_err(|e| format!("Request failed: {}", e))?;

  let status = response.status();
  let text = response
    .text()
    .await
    .map_err(|e| format!("Failed to read response: {}", e))?;

  eprintln!("[AI] Status: {}", status);

  if !status.is_success() {
    return Ok(AIResponse {
      content: String::new(),
      error: Some(format!("API error {}: {}", status, text)),
      usage: None,
    });
  }

  let json: Value = serde_json::from_str(&text).map_err(|e| format!("JSON parse error: {}", e))?;

  let message = json
    .get("choices")
    .and_then(|c| c.get(0))
    .and_then(|c| c.get("message"));

  let content = message
    .and_then(|m| m.get("content"))
    .and_then(|c| c.as_str())
    .unwrap_or("")
    .to_string();

  let usage = json.get("usage").and_then(|u| {
    Some(TokenUsage {
      prompt_tokens: u.get("prompt_tokens").and_then(|t| t.as_u64()).unwrap_or(0) as u32,
      completion_tokens: u
        .get("completion_tokens")
        .and_then(|t| t.as_u64())
        .unwrap_or(0) as u32,
      total_tokens: u.get("total_tokens").and_then(|t| t.as_u64()).unwrap_or(0) as u32,
    })
  });

  if !content.is_empty() {
    return Ok(AIResponse {
      content,
      error: None,
      usage,
    });
  }

  // Fallback: some reasoning models only return reasoning_content / refusal
  let reasoning = message
    .and_then(|m| m.get("reasoning_content"))
    .and_then(|r| r.as_str())
    .unwrap_or("")
    .to_string();

  if !reasoning.is_empty() {
    eprintln!("[AI] Content empty, returning reasoning_content");
    return Ok(AIResponse {
      content: reasoning,
      error: None,
      usage,
    });
  }

  let refusal = message
    .and_then(|m| m.get("refusal"))
    .and_then(|r| r.as_str())
    .unwrap_or("")
    .to_string();

  if !refusal.is_empty() {
    return Ok(AIResponse {
      content: String::new(),
      error: Some(format!("API refused: {}", refusal)),
      usage,
    });
  }

  let error = json
    .get("error")
    .and_then(|e| e.get("message"))
    .and_then(|m| m.as_str())
    .or_else(|| json.get("error").and_then(|e| e.as_str()))
    .or_else(|| json.get("message").and_then(|m| m.as_str()))
    .or_else(|| json.get("code").and_then(|c| c.as_str()))
    .unwrap_or("empty response from API")
    .to_string();

  Ok(AIResponse {
    content: String::new(),
    error: Some(format!("{} API error: {}", request.provider, error)),
    usage,
  })
}
