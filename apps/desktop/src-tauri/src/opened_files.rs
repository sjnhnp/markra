use std::path::PathBuf;
use std::sync::Mutex;

use crate::markdown_files::markdown_open_path_for_path;
use tauri::{Emitter, Manager, Url};

pub(crate) const OPENED_MARKDOWN_PATHS_EVENT: &str = "markra://opened-markdown-paths";

#[derive(Default)]
pub(crate) struct OpenedMarkdownPathsState(Mutex<Vec<String>>);

#[derive(Clone, serde::Serialize)]
struct OpenedMarkdownPathsPayload {
    paths: Vec<String>,
}

fn opened_markdown_path_from_path(path: PathBuf) -> Option<String> {
    markdown_open_path_for_path(&path).ok()?;
    Some(path.to_string_lossy().to_string())
}

pub(crate) fn opened_markdown_paths_from_args(
    args: impl IntoIterator<Item = String>,
) -> Vec<String> {
    args.into_iter()
        .skip(1)
        .filter_map(|arg| {
            let trimmed = arg.trim();
            if trimmed.is_empty() || trimmed.starts_with('-') {
                return None;
            }

            opened_markdown_path_from_path(PathBuf::from(trimmed))
        })
        .collect()
}

pub(crate) fn opened_markdown_paths_from_urls(urls: &[Url]) -> Vec<String> {
    urls.iter()
        .filter_map(|url| {
            let path = url.to_file_path().ok()?;
            opened_markdown_path_from_path(path)
        })
        .collect()
}

pub(crate) fn queue_opened_markdown_paths<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    paths: Vec<String>,
) {
    if paths.is_empty() {
        return;
    }

    {
        let state = app.state::<OpenedMarkdownPathsState>();
        let mut pending_paths = state.0.lock().expect("opened Markdown paths lock poisoned");
        pending_paths.extend(paths.clone());
    }

    let _ = app.emit(
        OPENED_MARKDOWN_PATHS_EVENT,
        OpenedMarkdownPathsPayload { paths },
    );
}

#[tauri::command]
pub(crate) fn take_opened_markdown_paths(app: tauri::AppHandle) -> Vec<String> {
    let state = app.state::<OpenedMarkdownPathsState>();
    let mut pending_paths = state.0.lock().expect("opened Markdown paths lock poisoned");

    std::mem::take(&mut *pending_paths)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tauri::Url;

    fn test_root(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "markra-opened-files-{name}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system clock should be after epoch")
                .as_nanos()
        ))
    }

    #[test]
    fn collects_supported_markdown_paths_from_launch_arguments() {
        let root = test_root("args");
        fs::create_dir_all(&root).expect("test folder should be created");
        let markdown_file = root.join("readme.md");
        let text_file = root.join("notes.txt");
        let unsupported_file = root.join("image.png");
        fs::write(&markdown_file, "# Readme").expect("markdown file should be created");
        fs::write(&text_file, "Notes").expect("text file should be created");
        fs::write(&unsupported_file, "png").expect("unsupported file should be created");

        let paths = opened_markdown_paths_from_args([
            "/Applications/Markra.app/Contents/MacOS/markra".to_string(),
            "--ignored".to_string(),
            markdown_file.to_string_lossy().to_string(),
            unsupported_file.to_string_lossy().to_string(),
            text_file.to_string_lossy().to_string(),
        ]);

        assert_eq!(
            paths,
            vec![
                markdown_file.to_string_lossy().to_string(),
                text_file.to_string_lossy().to_string()
            ]
        );

        fs::remove_dir_all(root).expect("test folder should be removed");
    }

    #[test]
    fn collects_supported_markdown_paths_from_opened_file_urls() {
        let root = test_root("urls");
        fs::create_dir_all(&root).expect("test folder should be created");
        let markdown_file = root.join("readme.markdown");
        let unsupported_file = root.join("image.png");
        fs::write(&markdown_file, "# Readme").expect("markdown file should be created");
        fs::write(&unsupported_file, "png").expect("unsupported file should be created");
        let markdown_url =
            Url::from_file_path(&markdown_file).expect("markdown file URL should be valid");
        let unsupported_url =
            Url::from_file_path(&unsupported_file).expect("unsupported file URL should be valid");
        let remote_url =
            Url::parse("https://example.com/readme.md").expect("remote URL should be valid");

        let paths = opened_markdown_paths_from_urls(&[markdown_url, unsupported_url, remote_url]);

        assert_eq!(paths, vec![markdown_file.to_string_lossy().to_string()]);

        fs::remove_dir_all(root).expect("test folder should be removed");
    }
}
