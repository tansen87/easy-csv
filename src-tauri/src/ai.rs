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
}

const HUGGING_FACE_API_URL: &str = "https://api-inference.huggingface.co/models";
const DEEPSEEK_API_URL: &str = "https://api.deepseek.com/chat/completions";
const QWEN_API_URL: &str = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

#[tauri::command]
pub async fn call_ai(request: AIRequest) -> Result<AIResponse, String> {
  match request.provider.as_str() {
    "deepseek" => call_deepseek(request).await,
    "huggingface" => call_hugging_face(request).await,
    "qwen" => call_qwen(request).await,
    _ => Ok(AIResponse {
      content: String::new(),
      error: Some(format!("Unknown provider: {}", request.provider)),
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

  Ok(AIResponse {
    content,
    error: None,
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
      });
    }

    return Ok(AIResponse {
      content: String::new(),
      error: Some(format!("Qwen API error: {}", error)),
    });
  }

  Ok(AIResponse {
    content,
    error: None,
  })
}

async fn call_hugging_face(request: AIRequest) -> Result<AIResponse, String> {
  let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(120))
    .build()
    .map_err(|e| format!("Failed to create client: {}", e))?;

  let system_msg = request
    .messages
    .iter()
    .find(|m| m.role == "system")
    .map(|m| m.content.as_str())
    .unwrap_or("");

  let user_msg = request
    .messages
    .iter()
    .last()
    .map(|m| m.content.as_str())
    .unwrap_or("");

  let prompt = if system_msg.is_empty() {
    user_msg.to_string()
  } else {
    format!("{}\n\nUser: {}", system_msg, user_msg)
  };

  let body = serde_json::json!({
      "inputs": prompt,
      "parameters": {
          "temperature": 0.7,
          "max_new_tokens": 2048,
          "return_full_text": false
      }
  });

  let url = format!("{}/{}", HUGGING_FACE_API_URL, request.model);

  eprintln!("[AI] Calling HuggingFace: {}", url);

  for attempt in 1..=3 {
    eprintln!("[AI] Attempt {}/3", attempt);

    let response = client
      .post(&url)
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
      });
    }

    let is_html = text.trim_start().to_lowercase().contains("<!doctype")
      || text.trim_start().to_lowercase().contains("<html");

    if is_html {
      eprintln!("[AI] Model loading, waiting 10s...");
      tokio::time::sleep(Duration::from_secs(10)).await;
      continue;
    }

    let content = if let Ok(json) = serde_json::from_str::<Value>(&text) {
      if let Some(arr) = json.as_array() {
        arr
          .first()
          .and_then(|v| v.get("generated_text"))
          .and_then(|v| v.as_str())
          .unwrap_or("")
          .to_string()
      } else if let Some(obj) = json.as_object() {
        obj
          .get("generated_text")
          .and_then(|v| v.as_str())
          .unwrap_or("")
          .to_string()
      } else {
        String::new()
      }
    } else {
      text.clone()
    };

    return Ok(AIResponse {
      content,
      error: None,
    });
  }

  Ok(AIResponse {
    content: String::new(),
    error: Some("Model is loading, please try again later".to_string()),
  })
}
