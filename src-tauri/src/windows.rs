use std::sync::atomic::{AtomicUsize, Ordering};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;
use tauri::{utils::config::Color, Manager, WebviewUrl, WebviewWindowBuilder};

const BLANK_EDITOR_WINDOW_LABEL_PREFIX: &str = "markra-editor-";
const BLANK_EDITOR_WINDOW_URL: &str = "index.html?blank=1";
#[cfg(test)]
pub(crate) const OPEN_BLANK_EDITOR_WINDOW_COMMAND: &str = "open_blank_editor_window";
#[cfg(test)]
pub(crate) const OPEN_SETTINGS_WINDOW_COMMAND: &str = "open_settings_window";
const SETTINGS_WINDOW_LABEL: &str = "markra-settings";
const SETTINGS_WINDOW_URL: &str = "index.html?settings=1";
const SETTINGS_WINDOW_TRANSPARENT: bool = true;
const SETTINGS_WINDOW_WIDTH: f64 = 1040.0;
const SETTINGS_WINDOW_HEIGHT: f64 = 720.0;
const SETTINGS_WINDOW_MIN_WIDTH: f64 = 860.0;
const SETTINGS_WINDOW_MIN_HEIGHT: f64 = 600.0;
const SETTINGS_WINDOW_RESIZABLE: bool = true;
const SETTINGS_WINDOW_SHADOW: bool = true;
#[cfg(target_os = "macos")]
const SETTINGS_WINDOW_HIDDEN_TITLE: bool = true;

static NEXT_EDITOR_WINDOW_ID: AtomicUsize = AtomicUsize::new(1);

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

pub(crate) fn editor_window_url_for_path(path: &str) -> String {
    format!("index.html?path={}", encode_url_query_component(path))
}

pub(crate) fn spawn_editor_window<R>(app: tauri::AppHandle<R>, url: String)
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

pub(crate) fn spawn_blank_editor_window<R>(app: tauri::AppHandle<R>)
where
    R: tauri::Runtime,
{
    spawn_editor_window(app, BLANK_EDITOR_WINDOW_URL.to_string());
}

#[tauri::command]
pub(crate) fn open_blank_editor_window(app: tauri::AppHandle) {
    spawn_blank_editor_window(app);
}

fn settings_window_transparent() -> bool {
    SETTINGS_WINDOW_TRANSPARENT
}

fn settings_window_inner_size() -> (f64, f64) {
    (SETTINGS_WINDOW_WIDTH, SETTINGS_WINDOW_HEIGHT)
}

fn settings_window_min_inner_size() -> (f64, f64) {
    (SETTINGS_WINDOW_MIN_WIDTH, SETTINGS_WINDOW_MIN_HEIGHT)
}

fn settings_window_resizable() -> bool {
    SETTINGS_WINDOW_RESIZABLE
}

fn settings_window_shadow() -> bool {
    SETTINGS_WINDOW_SHADOW
}

fn settings_window_background_color() -> Color {
    Color(255, 255, 255, 0)
}

#[cfg(target_os = "macos")]
fn settings_window_title_bar_style() -> TitleBarStyle {
    TitleBarStyle::Overlay
}

#[cfg(target_os = "macos")]
fn settings_window_hidden_title() -> bool {
    SETTINGS_WINDOW_HIDDEN_TITLE
}

pub(crate) fn spawn_settings_window<R>(app: tauri::AppHandle<R>)
where
    R: tauri::Runtime,
{
    std::thread::spawn(move || {
        if let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) {
            let _ = window.show();
            let _ = window.set_focus();
            return;
        }

        let (width, height) = settings_window_inner_size();
        let (min_width, min_height) = settings_window_min_inner_size();

        let builder = WebviewWindowBuilder::new(
            &app,
            SETTINGS_WINDOW_LABEL,
            WebviewUrl::App(SETTINGS_WINDOW_URL.into()),
        )
        .title("Settings")
        .inner_size(width, height)
        .min_inner_size(min_width, min_height)
        .decorations(true)
        .transparent(settings_window_transparent())
        .background_color(settings_window_background_color())
        .resizable(settings_window_resizable())
        .shadow(settings_window_shadow())
        .center();

        #[cfg(target_os = "macos")]
        let builder = builder
            .title_bar_style(settings_window_title_bar_style())
            .hidden_title(settings_window_hidden_title());

        if let Err(error) = builder.build() {
            eprintln!("failed to create settings window: {error}");
        }
    });
}

#[tauri::command]
pub(crate) fn open_settings_window(app: tauri::AppHandle) {
    spawn_settings_window(app);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_window_matches_editor_window_chrome() {
        assert!(settings_window_transparent());

        #[cfg(target_os = "macos")]
        {
            assert!(matches!(
                settings_window_title_bar_style(),
                TitleBarStyle::Overlay
            ));
            assert!(settings_window_hidden_title());
        }
    }

    #[test]
    fn settings_window_uses_roomier_default_size() {
        assert_eq!(settings_window_inner_size(), (1040.0, 720.0));
        assert_eq!(settings_window_min_inner_size(), (860.0, 600.0));
        assert!(settings_window_resizable());
    }

    #[test]
    fn settings_window_keeps_shadow_with_transparent_background() {
        assert!(settings_window_shadow());
        assert_eq!(settings_window_background_color(), Color(255, 255, 255, 0));
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
    fn exposes_window_command_names_for_js_menus() {
        assert_eq!(OPEN_BLANK_EDITOR_WINDOW_COMMAND, "open_blank_editor_window");
        assert_eq!(OPEN_SETTINGS_WINDOW_COMMAND, "open_settings_window");
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
}
