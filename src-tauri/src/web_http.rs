use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE, LOCATION};
use reqwest::redirect::Policy;
use reqwest::Url;
use serde::{Deserialize, Serialize};

const WEB_RESOURCE_MAX_REDIRECTS: usize = 5;
const WEB_RESOURCE_REQUEST_TIMEOUT_SECS: u64 = 30;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WebResourceRequest {
    allow_localhost: Option<bool>,
    #[serde(default)]
    headers: HashMap<String, String>,
    url: String,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WebResourceResponse {
    body: String,
    content_type: Option<String>,
    final_url: String,
    status: u16,
}

#[tauri::command]
pub(crate) async fn request_web_resource(
    request: WebResourceRequest,
) -> Result<WebResourceResponse, String> {
    execute_web_resource_request(request).await
}

async fn execute_web_resource_request(
    request: WebResourceRequest,
) -> Result<WebResourceResponse, String> {
    let allow_localhost = request.allow_localhost.unwrap_or(false);
    let mut url = validated_web_resource_url(&request.url, allow_localhost)?;
    let headers = parse_headers(&request.headers)?;
    let client = reqwest::Client::builder()
        .redirect(Policy::none())
        .timeout(Duration::from_secs(WEB_RESOURCE_REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|error| error.to_string())?;

    for _ in 0..=WEB_RESOURCE_MAX_REDIRECTS {
        let response = client
            .get(url.clone())
            .headers(headers.clone())
            .send()
            .await
            .map_err(|error| error.to_string())?;
        let status = response.status();

        if status.is_redirection() {
            let location = response
                .headers()
                .get(LOCATION)
                .ok_or_else(|| "Web resource redirect did not include a location.".to_string())?;
            let location = location.to_str().map_err(|error| error.to_string())?;
            let next_url = url.join(location).map_err(|error| error.to_string())?;
            url = validated_web_resource_url(next_url.as_str(), allow_localhost)?;
            continue;
        }

        let status = status.as_u16();
        let final_url = response.url().to_string();
        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .map(|value| value.to_string());
        let body = response.text().await.map_err(|error| error.to_string())?;

        return Ok(WebResourceResponse {
            body,
            content_type,
            final_url,
            status,
        });
    }

    Err("Web resource request followed too many redirects.".to_string())
}

fn validated_web_resource_url(value: &str, allow_localhost: bool) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|error| error.to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Only HTTP and HTTPS web resource URLs are supported.".to_string());
    }

    if !allow_localhost && is_local_or_private_host(&url) {
        return Err(
            "Local and private network URLs are not allowed for web resources.".to_string(),
        );
    }

    Ok(url)
}

fn is_local_or_private_host(url: &Url) -> bool {
    let Some(host) = url.host_str() else {
        return true;
    };
    let normalized_host = host
        .trim()
        .trim_start_matches('[')
        .trim_end_matches(']')
        .trim_end_matches('.')
        .to_ascii_lowercase();
    if normalized_host == "localhost"
        || normalized_host.ends_with(".localhost")
        || normalized_host.ends_with(".local")
    {
        return true;
    }

    match normalized_host.parse::<IpAddr>() {
        Ok(IpAddr::V4(address)) => is_private_ipv4(address),
        Ok(IpAddr::V6(address)) => is_private_ipv6(address),
        Err(_) => false,
    }
}

fn is_private_ipv4(address: Ipv4Addr) -> bool {
    address.is_private()
        || address.is_loopback()
        || address.is_link_local()
        || address.is_multicast()
        || address.is_broadcast()
        || address.is_unspecified()
}

fn is_private_ipv6(address: Ipv6Addr) -> bool {
    address.is_loopback()
        || address.is_unspecified()
        || address.is_multicast()
        || address.is_unique_local()
        || address.is_unicast_link_local()
}

fn parse_headers(headers: &HashMap<String, String>) -> Result<HeaderMap, String> {
    let mut header_map = HeaderMap::new();

    for (name, value) in headers {
        let header_name =
            HeaderName::from_bytes(name.as_bytes()).map_err(|error| error.to_string())?;
        let header_value = HeaderValue::from_str(value).map_err(|error| error.to_string())?;
        header_map.insert(header_name, header_value);
    }

    Ok(header_map)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_public_http_urls() {
        let url = validated_web_resource_url("https://example.com/search?q=markra", false)
            .expect("public HTTPS URL should be accepted");

        assert_eq!(url.as_str(), "https://example.com/search?q=markra");
    }

    #[test]
    fn rejects_non_http_urls() {
        let error = validated_web_resource_url("file:///tmp/secret", false)
            .expect_err("file URLs should be rejected");

        assert!(error.contains("HTTP and HTTPS"));
    }

    #[test]
    fn rejects_local_and_private_urls_by_default() {
        for url in [
            "http://localhost:8888",
            "http://127.0.0.1:8888",
            "http://10.0.0.2",
            "http://172.16.0.2",
            "http://192.168.1.2",
            "http://[::1]:8888",
            "http://[fc00::1]",
            "http://printer.local",
        ] {
            let error =
                validated_web_resource_url(url, false).expect_err("private URL should be rejected");

            assert!(error.contains("Local and private"));
        }
    }

    #[test]
    fn allows_localhost_for_configured_search_endpoints() {
        let url = validated_web_resource_url("http://localhost:8888/search?q=markra", true)
            .expect("localhost should be allowed when explicitly requested");

        assert_eq!(url.as_str(), "http://localhost:8888/search?q=markra");
    }

    #[test]
    fn parses_custom_headers() {
        let mut headers = HashMap::new();
        headers.insert("accept".to_string(), "text/html".to_string());
        headers.insert("user-agent".to_string(), "Markra".to_string());

        let parsed = parse_headers(&headers).expect("headers should parse");

        assert_eq!(parsed.get("accept").unwrap(), "text/html");
        assert_eq!(parsed.get("user-agent").unwrap(), "Markra");
    }
}
