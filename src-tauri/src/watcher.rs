use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::Emitter;

const MARKDOWN_FILE_CHANGED_EVENT: &str = "markra://file-changed";

struct ActiveMarkdownWatcher {
    path: PathBuf,
    _watcher: RecommendedWatcher,
}

#[derive(Default)]
pub(crate) struct MarkdownWatcherState(Mutex<Option<ActiveMarkdownWatcher>>);

#[derive(Clone, serde::Serialize)]
struct MarkdownFileChanged {
    path: String,
}

fn is_target_file_event(event: &Event, watched_path: &Path) -> bool {
    if !matches!(
        event.kind,
        EventKind::Any | EventKind::Create(_) | EventKind::Modify(_)
    ) {
        return false;
    }

    let Some(watched_file_name) = watched_path.file_name() else {
        return false;
    };

    event.paths.iter().any(|event_path| {
        event_path == watched_path
            || (event_path.parent() == watched_path.parent()
                && event_path.file_name() == Some(watched_file_name))
    })
}

#[tauri::command]
pub(crate) fn watch_markdown_file(
    app: tauri::AppHandle,
    watcher_state: tauri::State<'_, MarkdownWatcherState>,
    path: String,
) -> Result<(), String> {
    let watched_path = PathBuf::from(&path);
    let watch_root = watched_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let emitted_path = watched_path.to_string_lossy().to_string();
    let callback_path = watched_path.clone();

    // Watch the parent directory so atomic saves that replace the file are still visible.
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
        let Ok(event) = result else {
            return;
        };

        if !is_target_file_event(&event, &callback_path) {
            return;
        }

        let _ = app.emit(
            MARKDOWN_FILE_CHANGED_EVENT,
            MarkdownFileChanged {
                path: emitted_path.clone(),
            },
        );
    })
    .map_err(|error| error.to_string())?;

    watcher
        .watch(&watch_root, RecursiveMode::NonRecursive)
        .map_err(|error| error.to_string())?;

    let mut active_watcher = watcher_state
        .0
        .lock()
        .map_err(|_| "markdown file watcher state lock is poisoned".to_string())?;
    *active_watcher = Some(ActiveMarkdownWatcher {
        path: watched_path,
        _watcher: watcher,
    });

    Ok(())
}

#[tauri::command]
pub(crate) fn unwatch_markdown_file(
    watcher_state: tauri::State<'_, MarkdownWatcherState>,
    path: String,
) -> Result<(), String> {
    let watched_path = PathBuf::from(path);
    let mut active_watcher = watcher_state
        .0
        .lock()
        .map_err(|_| "markdown file watcher state lock is poisoned".to_string())?;

    if active_watcher
        .as_ref()
        .is_some_and(|watcher| watcher.path == watched_path)
    {
        *active_watcher = None;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{CreateKind, DataChange, ModifyKind};

    #[test]
    fn matches_target_file_modifications_in_the_watched_directory() {
        let watched_path = PathBuf::from("/mock-files/readme.md");
        let event = Event::new(EventKind::Modify(ModifyKind::Data(DataChange::Content)))
            .add_path(PathBuf::from("/mock-files/readme.md"));

        assert!(is_target_file_event(&event, &watched_path));
    }

    #[test]
    fn matches_target_file_recreation_from_atomic_saves() {
        let watched_path = PathBuf::from("/mock-files/readme.md");
        let event = Event::new(EventKind::Create(CreateKind::File))
            .add_path(PathBuf::from("/mock-files/readme.md"));

        assert!(is_target_file_event(&event, &watched_path));
    }

    #[test]
    fn ignores_other_files_in_the_same_directory() {
        let watched_path = PathBuf::from("/mock-files/readme.md");
        let event = Event::new(EventKind::Modify(ModifyKind::Data(DataChange::Content)))
            .add_path(PathBuf::from("/mock-files/other.md"));

        assert!(!is_target_file_event(&event, &watched_path));
    }
}
