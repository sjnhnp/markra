use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Mutex,
};

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;
use tauri::{
    menu::{AboutMetadata, Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};

const MARKDOWN_FILE_CHANGED_EVENT: &str = "markra://file-changed";
const NATIVE_MENU_COMMAND_EVENT: &str = "markra://menu-command";
const NEW_DOCUMENT_COMMAND: &str = "newDocument";
const SETTINGS_WINDOW_COMMAND: &str = "openSettings";
const BLANK_EDITOR_WINDOW_LABEL_PREFIX: &str = "markra-editor-";
const BLANK_EDITOR_WINDOW_URL: &str = "index.html?blank=1";
const SETTINGS_WINDOW_LABEL: &str = "markra-settings";
const SETTINGS_WINDOW_URL: &str = "index.html?settings=1";

static NEXT_EDITOR_WINDOW_ID: AtomicUsize = AtomicUsize::new(1);

struct ActiveMarkdownWatcher {
    path: PathBuf,
    _watcher: RecommendedWatcher,
}

#[derive(Default)]
struct MarkdownWatcherState(Mutex<Option<ActiveMarkdownWatcher>>);

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub struct MarkdownFile {
    path: String,
    contents: String,
}

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownFolderFile {
    path: String,
    relative_path: String,
}

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MarkdownOpenPath {
    File { path: String },
    Folder { path: String },
}

#[derive(Clone, serde::Serialize)]
pub struct MarkdownFileChanged {
    path: String,
}

#[derive(Clone, serde::Serialize)]
pub struct NativeMenuCommand {
    command: String,
}

fn app_menu_item<R: tauri::Runtime, M: tauri::Manager<R>>(
    manager: &M,
    id: &str,
    text: &str,
    accelerator: &str,
) -> tauri::Result<tauri::menu::MenuItem<R>> {
    MenuItemBuilder::with_id(id, text)
        .accelerator(accelerator)
        .build(manager)
}

fn create_application_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let new = app_menu_item(app, NEW_DOCUMENT_COMMAND, "New", "CmdOrCtrl+N")?;
    let open = app_menu_item(app, "openDocument", "Open...", "CmdOrCtrl+O")?;
    let save = app_menu_item(app, "saveDocument", "Save", "CmdOrCtrl+S")?;
    let save_as = app_menu_item(app, "saveDocumentAs", "Save As...", "CmdOrCtrl+Shift+S")?;
    let settings = app_menu_item(app, SETTINGS_WINDOW_COMMAND, "Settings...", "CmdOrCtrl+,")?;

    let bold = app_menu_item(app, "formatBold", "Bold", "CmdOrCtrl+B")?;
    let italic = app_menu_item(app, "formatItalic", "Italic", "CmdOrCtrl+I")?;
    let strikethrough = app_menu_item(
        app,
        "formatStrikethrough",
        "Strikethrough",
        "CmdOrCtrl+Shift+X",
    )?;
    let inline_code = app_menu_item(app, "formatInlineCode", "Inline Code", "CmdOrCtrl+E")?;
    let paragraph = app_menu_item(app, "formatParagraph", "Paragraph", "CmdOrCtrl+Alt+0")?;
    let heading_1 = app_menu_item(app, "formatHeading1", "Heading 1", "CmdOrCtrl+Alt+1")?;
    let heading_2 = app_menu_item(app, "formatHeading2", "Heading 2", "CmdOrCtrl+Alt+2")?;
    let heading_3 = app_menu_item(app, "formatHeading3", "Heading 3", "CmdOrCtrl+Alt+3")?;
    let bullet_list = app_menu_item(app, "formatBulletList", "Bullet List", "CmdOrCtrl+Shift+8")?;
    let ordered_list = app_menu_item(
        app,
        "formatOrderedList",
        "Ordered List",
        "CmdOrCtrl+Shift+7",
    )?;
    let quote = app_menu_item(app, "formatQuote", "Quote", "CmdOrCtrl+Shift+B")?;
    let code_block = app_menu_item(app, "formatCodeBlock", "Code Block", "CmdOrCtrl+Alt+C")?;
    let link = app_menu_item(app, "insertLink", "Link", "CmdOrCtrl+K")?;
    let image = app_menu_item(app, "insertImage", "Image", "CmdOrCtrl+Shift+I")?;

    let app_menu = SubmenuBuilder::with_id(app, "markra:app", "Markra")
        .about(Some(AboutMetadata {
            name: Some("Markra".into()),
            ..Default::default()
        }))
        .separator()
        .items(&[&settings])
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::with_id(app, "markra:file", "File")
        .items(&[&new, &open])
        .separator()
        .items(&[&save, &save_as])
        .separator()
        .close_window()
        .build()?;

    let edit_menu = SubmenuBuilder::with_id(app, "markra:edit", "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let format_menu = SubmenuBuilder::with_id(app, "markra:format", "Format")
        .items(&[&bold, &italic, &strikethrough, &inline_code])
        .separator()
        .items(&[&paragraph, &heading_1, &heading_2, &heading_3])
        .separator()
        .items(&[&bullet_list, &ordered_list, &quote, &code_block])
        .separator()
        .items(&[&link, &image])
        .build()?;

    let view_menu = SubmenuBuilder::with_id(app, "markra:view", "View")
        .fullscreen()
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &format_menu, &view_menu])
        .build()
}

fn is_native_new_window_command(command: &str) -> bool {
    command == NEW_DOCUMENT_COMMAND
}

fn is_native_settings_window_command(command: &str) -> bool {
    command == SETTINGS_WINDOW_COMMAND
}

fn is_frontend_menu_command(command: &str) -> bool {
    matches!(
        command,
        "openDocument"
            | "saveDocument"
            | "saveDocumentAs"
            | "formatBold"
            | "formatItalic"
            | "formatStrikethrough"
            | "formatInlineCode"
            | "formatParagraph"
            | "formatHeading1"
            | "formatHeading2"
            | "formatHeading3"
            | "formatBulletList"
            | "formatOrderedList"
            | "formatQuote"
            | "formatCodeBlock"
            | "insertLink"
            | "insertImage"
    )
}

fn next_blank_editor_window_label() -> String {
    let id = NEXT_EDITOR_WINDOW_ID.fetch_add(1, Ordering::Relaxed);
    format!("{BLANK_EDITOR_WINDOW_LABEL_PREFIX}{id}")
}

fn is_blank_editor_window_label(label: &str) -> bool {
    label.starts_with(BLANK_EDITOR_WINDOW_LABEL_PREFIX)
}

fn encode_url_query_component(value: &str) -> String {
    let mut encoded = String::new();

    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }

    encoded
}

fn editor_window_url_for_path(path: &str) -> String {
    format!("index.html?path={}", encode_url_query_component(path))
}

fn is_markdown_tree_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(extension.to_ascii_lowercase().as_str(), "md" | "markdown")
        })
}

fn is_markdown_open_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "md" | "markdown" | "txt"
            )
        })
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn markdown_open_path_for_path(path: &Path) -> Result<MarkdownOpenPath, String> {
    if path.is_dir() {
        return Ok(MarkdownOpenPath::Folder {
            path: path_to_string(path),
        });
    }

    if path.is_file() && is_markdown_open_file(path) {
        return Ok(MarkdownOpenPath::File {
            path: path_to_string(path),
        });
    }

    Err("Selected path is not a supported Markdown file or folder".to_string())
}

fn should_skip_markdown_tree_directory(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| matches!(name, ".git" | "node_modules" | "target" | "dist" | "build"))
}

fn markdown_tree_relative_path(root: &Path, path: &Path) -> Result<String, String> {
    let relative_path = path.strip_prefix(root).map_err(|error| error.to_string())?;
    let parts = relative_path
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>();

    Ok(parts.join("/"))
}

fn collect_markdown_tree_files(
    root: &Path,
    directory: &Path,
    files: &mut Vec<MarkdownFolderFile>,
) -> Result<(), String> {
    let mut entries = fs::read_dir(directory)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    entries.sort_by(|a, b| {
        a.file_name()
            .to_string_lossy()
            .to_lowercase()
            .cmp(&b.file_name().to_string_lossy().to_lowercase())
    });

    for entry in entries {
        let path = entry.path();
        let file_type = entry.file_type().map_err(|error| error.to_string())?;

        if file_type.is_dir() {
            if !should_skip_markdown_tree_directory(&path) {
                collect_markdown_tree_files(root, &path, files)?;
            }
            continue;
        }

        if file_type.is_file() && is_markdown_tree_file(&path) {
            files.push(MarkdownFolderFile {
                path: path.to_string_lossy().to_string(),
                relative_path: markdown_tree_relative_path(root, &path)?,
            });
        }
    }

    Ok(())
}

fn markdown_tree_root_for_path(path: &Path) -> PathBuf {
    if path.is_dir() {
        return path.to_path_buf();
    }

    path.parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn spawn_editor_window<R>(app: tauri::AppHandle<R>, url: String)
where
    R: tauri::Runtime,
{
    // Create secondary windows off the menu event thread to avoid WebView2 deadlocks on Windows.
    std::thread::spawn(move || {
        let label = next_blank_editor_window_label();
        debug_assert!(is_blank_editor_window_label(&label));

        let builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
            .title("")
            .inner_size(1360.0, 800.0)
            .min_inner_size(960.0, 640.0)
            .decorations(true)
            .transparent(true)
            .shadow(true)
            .center();

        #[cfg(target_os = "macos")]
        let builder = builder
            .title_bar_style(TitleBarStyle::Overlay)
            .hidden_title(true);

        if let Err(error) = builder.build() {
            eprintln!("failed to create blank editor window: {error}");
        }
    });
}

fn spawn_blank_editor_window<R>(app: tauri::AppHandle<R>)
where
    R: tauri::Runtime,
{
    spawn_editor_window(app, BLANK_EDITOR_WINDOW_URL.to_string());
}

fn spawn_settings_window<R>(app: tauri::AppHandle<R>)
where
    R: tauri::Runtime,
{
    std::thread::spawn(move || {
        if let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) {
            let _ = window.show();
            let _ = window.set_focus();
            return;
        }

        let builder = WebviewWindowBuilder::new(
            &app,
            SETTINGS_WINDOW_LABEL,
            WebviewUrl::App(SETTINGS_WINDOW_URL.into()),
        )
        .title("Settings")
        .inner_size(560.0, 420.0)
        .min_inner_size(480.0, 360.0)
        .decorations(true)
        .transparent(false)
        .resizable(false)
        .shadow(true)
        .center();

        if let Err(error) = builder.build() {
            eprintln!("failed to create settings window: {error}");
        }
    });
}

#[cfg(target_os = "macos")]
fn pick_markdown_path<R: tauri::Runtime>(
    _app: &tauri::AppHandle<R>,
) -> Result<Option<PathBuf>, String> {
    use dispatch2::run_on_main;
    use objc2::rc::autoreleasepool;
    use objc2_app_kit::{NSModalResponseOK, NSOpenPanel};
    use objc2_foundation::{NSArray, NSString};

    Ok(autoreleasepool(|_| {
        run_on_main(|mtm| {
            let panel = NSOpenPanel::openPanel(mtm);
            let allowed_file_types = [
                NSString::from_str("md"),
                NSString::from_str("markdown"),
                NSString::from_str("txt"),
            ];
            let allowed_file_types = NSArray::from_retained_slice(&allowed_file_types);

            // NSOpenPanel can select both files and folders, while Tauri's JS dialog exposes them separately.
            panel.setCanChooseFiles(true);
            panel.setCanChooseDirectories(true);
            panel.setAllowsMultipleSelection(false);
            panel.setCanCreateDirectories(false);
            panel.setMessage(Some(&NSString::from_str("Open Markdown File or Folder")));

            #[allow(deprecated)]
            panel.setAllowedFileTypes(Some(&allowed_file_types));

            if panel.runModal() != NSModalResponseOK {
                return None;
            }

            let url = panel.URL()?;
            let path = url.path()?;
            Some(PathBuf::from(path.to_string()))
        })
    }))
}

#[cfg(not(target_os = "macos"))]
fn pick_markdown_path<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<Option<PathBuf>, String> {
    use tauri_plugin_dialog::DialogExt;

    let Some(path) = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };

    path.into_path()
        .map(Some)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn read_markdown_file(path: String) -> Result<MarkdownFile, String> {
    let path_buf = PathBuf::from(&path);
    let contents = fs::read_to_string(&path_buf).map_err(|error| error.to_string())?;

    Ok(MarkdownFile { path, contents })
}

#[tauri::command]
fn open_markdown_path(app: tauri::AppHandle) -> Result<Option<MarkdownOpenPath>, String> {
    let Some(path) = pick_markdown_path(&app)? else {
        return Ok(None);
    };

    markdown_open_path_for_path(&path).map(Some)
}

#[tauri::command]
fn list_markdown_files_for_path(path: String) -> Result<Vec<MarkdownFolderFile>, String> {
    let source_path = PathBuf::from(path);
    let root = markdown_tree_root_for_path(&source_path);
    let mut files = Vec::new();

    collect_markdown_tree_files(&root, &root, &mut files)?;
    files.sort_by(|a, b| {
        a.relative_path
            .to_lowercase()
            .cmp(&b.relative_path.to_lowercase())
    });

    Ok(files)
}

#[tauri::command]
fn write_markdown_file(path: String, contents: String) -> Result<(), String> {
    let path_buf = PathBuf::from(path);
    fs::write(path_buf, contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn open_markdown_file_in_new_window(app: tauri::AppHandle, path: String) -> Result<(), String> {
    spawn_editor_window(app, editor_window_url_for_path(&path));
    Ok(())
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
fn watch_markdown_file(
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
fn unwatch_markdown_file(
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MarkdownWatcherState::default())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .menu(create_application_menu)
        .on_menu_event(|app, event| {
            let command = event.id().as_ref();
            if is_native_new_window_command(command) {
                spawn_blank_editor_window(app.clone());
                return;
            }

            if is_native_settings_window_command(command) {
                spawn_settings_window(app.clone());
                return;
            }

            if !is_frontend_menu_command(command) {
                return;
            }

            let _ = app.emit(
                NATIVE_MENU_COMMAND_EVENT,
                NativeMenuCommand {
                    command: command.to_string(),
                },
            );
        })
        .invoke_handler(tauri::generate_handler![
            list_markdown_files_for_path,
            open_markdown_file_in_new_window,
            open_markdown_path,
            read_markdown_file,
            write_markdown_file,
            watch_markdown_file,
            unwatch_markdown_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Markra");
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

    #[test]
    fn recognizes_frontend_menu_commands() {
        assert!(!is_frontend_menu_command("newDocument"));
        assert!(is_frontend_menu_command("openDocument"));
        assert!(!is_frontend_menu_command("openFolder"));
        assert!(is_frontend_menu_command("saveDocument"));
        assert!(is_frontend_menu_command("formatBold"));
        assert!(is_frontend_menu_command("insertImage"));
        assert!(!is_frontend_menu_command("markra:file"));
        assert!(!is_frontend_menu_command("copy"));
    }

    #[test]
    fn recognizes_native_new_window_menu_command() {
        assert!(is_native_new_window_command("newDocument"));
        assert!(!is_native_new_window_command("saveDocument"));
    }

    #[test]
    fn recognizes_native_settings_window_menu_command() {
        assert!(is_native_settings_window_command("openSettings"));
        assert!(!is_native_settings_window_command("saveDocument"));
        assert!(!is_frontend_menu_command("openSettings"));
    }

    #[test]
    fn creates_unique_blank_editor_window_labels() {
        let first = next_blank_editor_window_label();
        let second = next_blank_editor_window_label();

        assert_ne!(first, second);
        assert!(is_blank_editor_window_label(&first));
        assert!(is_blank_editor_window_label(&second));
        assert!(!is_blank_editor_window_label("main"));
    }

    #[test]
    fn encodes_open_file_window_urls() {
        assert_eq!(
            editor_window_url_for_path("/mock files/read me.md"),
            "index.html?path=%2Fmock%20files%2Fread%20me.md"
        );
        assert_eq!(
            editor_window_url_for_path("/mock/中文.md"),
            "index.html?path=%2Fmock%2F%E4%B8%AD%E6%96%87.md"
        );
    }

    #[test]
    fn lists_markdown_files_below_the_current_file_directory() {
        let root = std::env::temp_dir().join(format!(
            "markra-tree-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system clock should be after epoch")
                .as_nanos()
        ));
        let docs = root.join("docs");
        let ignored = root.join("node_modules").join("package");

        fs::create_dir_all(&docs).expect("docs folder should be created");
        fs::create_dir_all(&ignored).expect("ignored folder should be created");
        fs::write(root.join("Untitled.md"), "# Untitled").expect("root markdown should be created");
        fs::write(root.join("AWS.md"), "# AWS").expect("root markdown should be created");
        fs::write(root.join("notes.txt"), "notes").expect("non-markdown should be created");
        fs::write(docs.join("guide.markdown"), "# Guide")
            .expect("nested markdown should be created");
        fs::write(ignored.join("dependency.md"), "# Dependency")
            .expect("ignored markdown should be created");

        let files =
            list_markdown_files_for_path(root.join("Untitled.md").to_string_lossy().to_string())
                .expect("markdown tree should be listed");

        assert_eq!(
            files,
            vec![
                MarkdownFolderFile {
                    path: root.join("AWS.md").to_string_lossy().to_string(),
                    relative_path: "AWS.md".to_string(),
                },
                MarkdownFolderFile {
                    path: docs.join("guide.markdown").to_string_lossy().to_string(),
                    relative_path: "docs/guide.markdown".to_string(),
                },
                MarkdownFolderFile {
                    path: root.join("Untitled.md").to_string_lossy().to_string(),
                    relative_path: "Untitled.md".to_string(),
                },
            ]
        );

        fs::remove_dir_all(root).expect("test tree should be removed");
    }

    #[test]
    fn lists_markdown_files_below_the_selected_folder() {
        let root = std::env::temp_dir().join(format!(
            "markra-folder-tree-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system clock should be after epoch")
                .as_nanos()
        ));
        let docs = root.join("docs");

        fs::create_dir_all(&docs).expect("docs folder should be created");
        fs::write(root.join("index.md"), "# Index").expect("root markdown should be created");
        fs::write(docs.join("note.md"), "# Note").expect("nested markdown should be created");

        let files = list_markdown_files_for_path(root.to_string_lossy().to_string())
            .expect("selected folder tree should be listed");

        assert_eq!(
            files,
            vec![
                MarkdownFolderFile {
                    path: docs.join("note.md").to_string_lossy().to_string(),
                    relative_path: "docs/note.md".to_string(),
                },
                MarkdownFolderFile {
                    path: root.join("index.md").to_string_lossy().to_string(),
                    relative_path: "index.md".to_string(),
                },
            ]
        );

        fs::remove_dir_all(root).expect("test tree should be removed");
    }

    #[test]
    fn classifies_unified_open_picker_targets() {
        let root = std::env::temp_dir().join(format!(
            "markra-open-target-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system clock should be after epoch")
                .as_nanos()
        ));
        let readme = root.join("README.md");
        let unsupported = root.join("image.png");

        fs::create_dir_all(&root).expect("test folder should be created");
        fs::write(&readme, "# README").expect("markdown file should be created");
        fs::write(&unsupported, "not markdown").expect("unsupported file should be created");

        assert_eq!(
            markdown_open_path_for_path(&readme),
            Ok(MarkdownOpenPath::File {
                path: readme.to_string_lossy().to_string(),
            })
        );
        assert_eq!(
            markdown_open_path_for_path(&root),
            Ok(MarkdownOpenPath::Folder {
                path: root.to_string_lossy().to_string(),
            })
        );
        assert!(markdown_open_path_for_path(&unsupported).is_err());

        fs::remove_dir_all(root).expect("test tree should be removed");
    }
}
