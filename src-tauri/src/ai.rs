use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

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
  /// Correlation id so the frontend can match stream events to a request.
  #[serde(default)]
  pub request_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIResponse {
  pub content: String,
  pub error: Option<String>,
  pub usage: Option<TokenUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
  pub prompt_tokens: u32,
  pub completion_tokens: u32,
  pub total_tokens: u32,
}

/// Payload of the `ai-stream` event emitted while a completion is generated.
#[derive(Clone, Serialize)]
struct AIStreamEvent {
  request_id: String,
  delta: Option<String>,
  done: bool,
  error: Option<String>,
  usage: Option<TokenUsage>,
}

const AI_STREAM_EVENT: &str = "ai-stream";

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

fn parse_usage(value: &Value) -> Option<TokenUsage> {
  Some(TokenUsage {
    prompt_tokens: value
      .get("prompt_tokens")
      .and_then(|t| t.as_u64())
      .unwrap_or(0) as u32,
    completion_tokens: value
      .get("completion_tokens")
      .and_then(|t| t.as_u64())
      .unwrap_or(0) as u32,
    total_tokens: value
      .get("total_tokens")
      .and_then(|t| t.as_u64())
      .unwrap_or(0) as u32,
  })
}

/// Parse a complete (non-streamed) chat completion response body.
fn parse_chat_completion(text: &str, provider: &str) -> AIResponse {
  let json: Value = match serde_json::from_str(text) {
    Ok(v) => v,
    Err(e) => {
      return AIResponse {
        content: String::new(),
        error: Some(format!("JSON parse error: {}", e)),
        usage: None,
      };
    }
  };

  let message = json
    .get("choices")
    .and_then(|c| c.get(0))
    .and_then(|c| c.get("message"));

  let content = message
    .and_then(|m| m.get("content"))
    .and_then(|c| c.as_str())
    .unwrap_or("")
    .to_string();

  let usage = json.get("usage").and_then(parse_usage);

  if !content.is_empty() {
    return AIResponse {
      content,
      error: None,
      usage,
    };
  }

  // Fallback: some reasoning models only return reasoning_content / refusal
  let reasoning = message
    .and_then(|m| m.get("reasoning_content"))
    .and_then(|r| r.as_str())
    .unwrap_or("")
    .to_string();

  if !reasoning.is_empty() {
    eprintln!("[AI] Content empty, returning reasoning_content");
    return AIResponse {
      content: reasoning,
      error: None,
      usage,
    };
  }

  let refusal = message
    .and_then(|m| m.get("refusal"))
    .and_then(|r| r.as_str())
    .unwrap_or("")
    .to_string();

  if !refusal.is_empty() {
    return AIResponse {
      content: String::new(),
      error: Some(format!("API refused: {}", refusal)),
      usage,
    };
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

  AIResponse {
    content: String::new(),
    error: Some(format!("{} API error: {}", provider, error)),
    usage,
  }
}

#[tauri::command]
pub async fn call_ai(app: AppHandle, request: AIRequest) -> Result<AIResponse, String> {
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

  call_openai_compatible(&app, &url, request).await
}

fn emit_stream(app: &AppHandle, event: AIStreamEvent) {
  let _ = app.emit(AI_STREAM_EVENT, event);
}

/// Stream a chat completion, emitting each delta on the `ai-stream` event.
///
/// Providers that ignore `stream: true` (or reply with a plain JSON body) are
/// handled by falling back to the previous non-streaming parsing, so a custom
/// endpoint can never break because of the streaming request.
async fn stream_completion(
  app: &AppHandle,
  request_id: &str,
  response: reqwest::Response,
  provider: &str,
) -> Result<AIResponse, String> {
  let mut stream = response.bytes_stream();
  let mut buffer = String::new();
  let mut content = String::new();
  let mut usage: Option<TokenUsage> = None;

  while let Some(chunk) = stream.next().await {
    let chunk = chunk.map_err(|e| format!("Stream read failed: {}", e))?;
    buffer.push_str(&String::from_utf8_lossy(&chunk));

    // SSE frames are separated by a blank line; process complete lines only.
    while let Some(newline) = buffer.find('\n') {
      let line: String = buffer.drain(..=newline).collect();
      let line = line.trim_end_matches('\r').trim_end();
      if line.is_empty() {
        continue;
      }

      let Some(data) = line.strip_prefix("data:") else {
        continue;
      };
      let data = data.trim();
      if data.is_empty() || data == "[DONE]" {
        continue;
      }

      let json: Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => continue,
      };

      if let Some(u) = json.get("usage") {
        usage = parse_usage(u);
      }

      if let Some(error) = json.get("error") {
        let message = error
          .get("message")
          .and_then(|m| m.as_str())
          .or_else(|| error.as_str())
          .unwrap_or("unknown streaming error");
        let message = format!("{} API error: {}", provider, message);
        emit_stream(
          app,
          AIStreamEvent {
            request_id: request_id.to_string(),
            delta: None,
            done: true,
            error: Some(message.clone()),
            usage: usage.clone(),
          },
        );
        return Ok(AIResponse {
          content: String::new(),
          error: Some(message),
          usage,
        });
      }

      let Some(delta) = json
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("delta"))
      else {
        continue;
      };

      // Content first, then reasoning_content for thinking models.
      let piece = ["content", "reasoning_content"]
        .iter()
        .filter_map(|key| delta.get(*key).and_then(|v| v.as_str()))
        .find(|s| !s.is_empty())
        .map(|s| s.to_string());

      if let Some(piece) = piece {
        content.push_str(&piece);
        emit_stream(
          app,
          AIStreamEvent {
            request_id: request_id.to_string(),
            delta: Some(piece),
            done: false,
            error: None,
            usage: None,
          },
        );
      }
    }
  }

  if content.is_empty() {
    let message = format!("{} API error: empty response from API", provider);
    emit_stream(
      app,
      AIStreamEvent {
        request_id: request_id.to_string(),
        delta: None,
        done: true,
        error: Some(message.clone()),
        usage: usage.clone(),
      },
    );
    return Ok(AIResponse {
      content: String::new(),
      error: Some(message),
      usage,
    });
  }

  emit_stream(
    app,
    AIStreamEvent {
      request_id: request_id.to_string(),
      delta: None,
      done: true,
      error: None,
      usage: usage.clone(),
    },
  );

  Ok(AIResponse {
    content,
    error: None,
    usage,
  })
}

async fn call_openai_compatible(
  app: &AppHandle,
  url: &str,
  request: AIRequest,
) -> Result<AIResponse, String> {
  let request_id = request.request_id.clone().unwrap_or_default();

  // A long completion can exceed the previous 60s budget; connect fast but
  // allow the body to keep streaming.
  let client = reqwest::Client::builder()
    .connect_timeout(Duration::from_secs(15))
    .timeout(Duration::from_secs(600))
    .build()
    .map_err(|e| format!("Failed to create client: {}", e))?;

  let body = serde_json::json!({
      "model": request.model,
      "messages": request.messages,
      "temperature": 0.7,
      "max_tokens": 2048,
      "stream": true,
      "stream_options": { "include_usage": true },
  });

  eprintln!(
    "[AI] Calling {} ({}): {} [stream]",
    request.provider, url, request.model
  );

  let response = client
    .post(url)
    .header("Authorization", format!("Bearer {}", request.api_key))
    .header("Content-Type", "application/json")
    .header("Accept", "text/event-stream")
    .json(&body)
    .send()
    .await
    .map_err(|e| format!("Request failed: {}", e))?;

  let status = response.status();
  eprintln!("[AI] Status: {}", status);

  if !status.is_success() {
    let text = response
      .text()
      .await
      .map_err(|e| format!("Failed to read response: {}", e))?;
    let parsed = parse_chat_completion(&text, &request.provider);
    let error = parsed
      .error
      .unwrap_or_else(|| format!("API error {}: {}", status, text));
    emit_stream(
      app,
      AIStreamEvent {
        request_id,
        delta: None,
        done: true,
        error: Some(error.clone()),
        usage: None,
      },
    );
    return Ok(AIResponse {
      content: String::new(),
      error: Some(error),
      usage: None,
    });
  }

  // Providers that do not honour `stream` reply with a plain JSON body.
  let is_event_stream = response
    .headers()
    .get(reqwest::header::CONTENT_TYPE)
    .and_then(|v| v.to_str().ok())
    .map(|ct| ct.contains("text/event-stream"))
    .unwrap_or(false);

  if !is_event_stream {
    eprintln!("[AI] Non-SSE response, falling back to non-streaming parse");
    let text = response
      .text()
      .await
      .map_err(|e| format!("Failed to read response: {}", e))?;
    let parsed = parse_chat_completion(&text, &request.provider);
    emit_stream(
      app,
      AIStreamEvent {
        request_id,
        delta: Some(parsed.content.clone()),
        done: true,
        error: parsed.error.clone(),
        usage: parsed.usage.clone(),
      },
    );
    return Ok(parsed);
  }

  stream_completion(app, &request_id, response, &request.provider).await
}
