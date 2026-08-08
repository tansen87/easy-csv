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

#[tauri::command]
pub async fn call_ai(request: AIRequest) -> Result<AIResponse, String> {
  match request.provider.as_str() {
    "deepseek" => call_deepseek(request).await,
    "qwen" => call_qwen(request).await,
    "glm" => call_glm(request).await,
    _ => Ok(AIResponse {
      content: String::new(),
      error: Some(format!("Unknown provider: {}", request.provider)),
      usage: None,
    }),
  }
}

async fn call_deepseek(request: AIRequest) -> Result<AIResponse, String> {
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

  eprintln!("[AI] Calling DeepSeek: {}", request.model);

  let response = client
    .post(DEEPSEEK_API_URL)
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

  let content = json
    .get("choices")
    .and_then(|c| c.get(0))
    .and_then(|c| c.get("message"))
    .and_then(|m| m.get("content"))
    .and_then(|c| c.as_str())
    .unwrap_or("")
    .to_string();

  let usage = json.get("usage").and_then(|u| {
    Some(TokenUsage {
      prompt_tokens: u.get("prompt_tokens").and_then(|t| t.as_u64()).unwrap_or(0) as u32,
      completion_tokens: u.get("completion_tokens").and_then(|t| t.as_u64()).unwrap_or(0) as u32,
      total_tokens: u.get("total_tokens").and_then(|t| t.as_u64()).unwrap_or(0) as u32,
    })
  });

  Ok(AIResponse {
    content,
    error: None,
    usage,
  })
}

async fn call_qwen(request: AIRequest) -> Result<AIResponse, String> {
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

  eprintln!("[AI] Calling Qwen (DashScope): {}", request.model);

  let response = client
    .post(QWEN_API_URL)
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
  // eprintln!("[AI] Raw response: {}", text);

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
      completion_tokens: u.get("completion_tokens").and_then(|t| t.as_u64()).unwrap_or(0) as u32,
      total_tokens: u.get("total_tokens").and_then(|t| t.as_u64()).unwrap_or(0) as u32,
    })
  });

  if message.is_none() || content.is_empty() {
    let error = json
      .get("error")
      .and_then(|e| e.get("message"))
      .and_then(|m| m.as_str())
      .or_else(|| json.get("message").and_then(|m| m.as_str()))
      .or_else(|| json.get("code").and_then(|c| c.as_str()))
      .unwrap_or("empty response from API")
      .to_string();

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
        error: Some(format!("Qwen API refused: {}", refusal)),
        usage,
      });
    }

    return Ok(AIResponse {
      content: String::new(),
      error: Some(format!("Qwen API error: {}", error)),
      usage,
    });
  }

  Ok(AIResponse {
    content,
    error: None,
    usage,
  })
}

async fn call_glm(request: AIRequest) -> Result<AIResponse, String> {
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

  eprintln!("[AI] Calling GLM: {}", request.model);

  let response = client
    .post(GLM_API_URL)
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

  let content = json
    .get("choices")
    .and_then(|c| c.get(0))
    .and_then(|c| c.get("message"))
    .and_then(|m| m.get("content"))
    .and_then(|c| c.as_str())
    .unwrap_or("")
    .to_string();

  let usage = json.get("usage").and_then(|u| {
    Some(TokenUsage {
      prompt_tokens: u.get("prompt_tokens").and_then(|t| t.as_u64()).unwrap_or(0) as u32,
      completion_tokens: u.get("completion_tokens").and_then(|t| t.as_u64()).unwrap_or(0) as u32,
      total_tokens: u.get("total_tokens").and_then(|t| t.as_u64()).unwrap_or(0) as u32,
    })
  });

  if content.is_empty() {
    let error = json
      .get("error")
      .and_then(|e| e.get("message"))
      .and_then(|m| m.as_str())
      .or_else(|| json.get("error").and_then(|e| e.as_str()))
      .unwrap_or("empty response from API")
      .to_string();

    return Ok(AIResponse {
      content: String::new(),
      error: Some(format!("GLM API error: {}", error)),
      usage,
    });
  }

  Ok(AIResponse {
    content,
    error: None,
    usage,
  })
}


