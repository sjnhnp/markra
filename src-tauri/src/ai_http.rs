use std::collections::HashMap;
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const AI_PROVIDER_REQUEST_TIMEOUT_SECS: u64 = 20;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiProviderJsonRequest {
    headers: HashMap<String, String>,
    method: String,
    url: String,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiProviderJsonResponse {
    status: u16,
    body: Value,
}

#[tauri::command]
pub(crate) async fn request_ai_provider_json(
    request: AiProviderJsonRequest,
) -> Result<AiProviderJsonResponse, String> {
    execute_ai_provider_json_request(request).await
}

async fn execute_ai_provider_json_request(
    request: AiProviderJsonRequest,
) -> Result<AiProviderJsonResponse, String> {
    let url = validated_ai_provider_url(&request)?;
    let headers = header_map_from_request(&request)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(AI_PROVIDER_REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|error| error.to_string())?;

    let response = client
        .get(url)
        .headers(headers)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let status = response.status().as_u16();
    let text = response.text().await.map_err(|error| error.to_string())?;
    let body = response_body_json(&text);

    Ok(AiProviderJsonResponse { status, body })
}

fn validated_ai_provider_url(request: &AiProviderJsonRequest) -> Result<reqwest::Url, String> {
    if !request.method.eq_ignore_ascii_case("GET") {
        return Err("Only GET requests are supported for AI provider checks.".to_string());
    }

    let url = reqwest::Url::parse(&request.url).map_err(|error| error.to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Only HTTP and HTTPS AI provider URLs are supported.".to_string());
    }

    Ok(url)
}

fn header_map_from_request(request: &AiProviderJsonRequest) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();

    for (name, value) in &request.headers {
        let header_name =
            HeaderName::from_bytes(name.as_bytes()).map_err(|error| error.to_string())?;
        let header_value = HeaderValue::from_str(value).map_err(|error| error.to_string())?;
        headers.insert(header_name, header_value);
    }

    Ok(headers)
}

fn response_body_json(text: &str) -> Value {
    if text.trim().is_empty() {
        return Value::Null;
    }

    serde_json::from_str(text).unwrap_or_else(|_| json!({ "message": text }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(method: &str, url: &str) -> AiProviderJsonRequest {
        AiProviderJsonRequest {
            headers: HashMap::new(),
            method: method.to_string(),
            url: url.to_string(),
        }
    }

    #[test]
    fn accepts_http_get_requests() {
        let url = validated_ai_provider_url(&request("GET", "http://localhost:11434/v1/models"))
            .expect("url should be accepted");

        assert_eq!(url.as_str(), "http://localhost:11434/v1/models");
    }

    #[test]
    fn rejects_non_get_requests() {
        let error = validated_ai_provider_url(&request(
            "POST",
            "https://api.openai.com/v1/models",
        ))
        .expect_err("POST should be rejected");

        assert!(error.contains("Only GET"));
    }

    #[test]
    fn rejects_non_http_urls() {
        let error = validated_ai_provider_url(&request("GET", "file:///tmp/secret"))
            .expect_err("file URLs should be rejected");

        assert!(error.contains("HTTP and HTTPS"));
    }

    #[test]
    fn converts_json_and_text_response_bodies() {
        assert_eq!(response_body_json(r#"{"data":[]}"#), json!({ "data": [] }));
        assert_eq!(
            response_body_json("Unauthorized"),
            json!({ "message": "Unauthorized" })
        );
    }
}
