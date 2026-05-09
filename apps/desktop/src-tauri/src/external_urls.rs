use std::process::Command;

fn validate_external_url(url: &str) -> Result<String, String> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|_| "Invalid external URL".to_string())?;

    match parsed.scheme() {
        "http" | "https" | "mailto" => Ok(parsed.to_string()),
        _ => Err("Unsupported external URL scheme".to_string()),
    }
}

#[cfg(target_os = "macos")]
fn open_system_url(url: &str) -> Result<(), String> {
    Command::new("open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to open external URL: {error}"))
}

#[cfg(target_os = "windows")]
fn open_system_url(url: &str) -> Result<(), String> {
    Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to open external URL: {error}"))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_system_url(url: &str) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to open external URL: {error}"))
}

#[tauri::command]
pub(crate) fn open_external_url(url: String) -> Result<(), String> {
    let external_url = validate_external_url(&url)?;
    open_system_url(&external_url)
}

#[cfg(test)]
mod tests {
    use super::validate_external_url;

    #[test]
    fn accepts_browser_and_mail_urls() {
        assert_eq!(
            validate_external_url("https://example.com/path").unwrap(),
            "https://example.com/path"
        );
        assert_eq!(
            validate_external_url("mailto:hello@example.com").unwrap(),
            "mailto:hello@example.com"
        );
    }

    #[test]
    fn rejects_non_external_url_schemes() {
        assert!(validate_external_url("javascript:alert(1)").is_err());
        assert!(validate_external_url("file:///etc/passwd").is_err());
    }
}
