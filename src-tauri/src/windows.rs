use std::sync::atomic::{AtomicUsize, Ordering};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;
use tauri::{utils::config::Color, Manager, WebviewUrl, WebviewWindowBuilder};

const BLANK_EDITOR_WINDOW_LABEL_PREFIX: &str = "markra-editor-";
const BLANK_EDITOR_WINDOW_URL: &str = "index.html?blank=1";
const MAIN_WINDOW_LABEL: &str = "main";
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
#[cfg(target_os = "macos")]
const TRAFFIC_LIGHT_X: f64 = 20.0;
#[cfg(target_os = "macos")]
const TRAFFIC_LIGHT_TOP_INSET: f64 = 22.0;

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

#[cfg(target_os = "macos")]
fn apply_macos_traffic_light_position<R>(window: &tauri::WebviewWindow<R>)
where
    R: tauri::Runtime,
{
    let Ok(ns_window) = window.ns_window() else {
        return;
    };
    schedule_macos_traffic_light_position(ns_window);
}

#[cfg(target_os = "macos")]
fn apply_macos_window_traffic_light_position<R>(window: &tauri::Window<R>)
where
    R: tauri::Runtime,
{
    let Ok(ns_window) = window.ns_window() else {
        return;
    };
    schedule_macos_traffic_light_position(ns_window);
}

#[cfg(target_os = "macos")]
fn schedule_macos_traffic_light_position(ns_window: *mut std::ffi::c_void) {
    if ns_window.is_null() {
        return;
    }

    let ns_window = ns_window as usize;

    dispatch2::run_on_main(move |_| {
        let ns_window = ns_window as *mut std::ffi::c_void;
        inset_macos_traffic_lights(ns_window);
    });
}

#[cfg(target_os = "macos")]
fn inset_macos_traffic_lights(ns_window: *mut std::ffi::c_void) {
    use objc2_app_kit::{NSView, NSWindow, NSWindowButton};

    // Match Wry's native inset strategy: move the titlebar container itself,
    // then place the standard buttons horizontally inside that container.
    let window = unsafe { &*ns_window.cast::<NSWindow>() };
    let Some(close) = window.standardWindowButton(NSWindowButton::CloseButton) else {
        return;
    };
    let Some(miniaturize) = window.standardWindowButton(NSWindowButton::MiniaturizeButton) else {
        return;
    };
    let zoom = window.standardWindowButton(NSWindowButton::ZoomButton);

    let Some(button_container) = (unsafe { NSView::superview(&close) }) else {
        return;
    };
    let Some(titlebar_container) = (unsafe { NSView::superview(&button_container) }) else {
        return;
    };

    let close_frame = NSView::frame(&close);
    let titlebar_height = close_frame.size.height + TRAFFIC_LIGHT_TOP_INSET;
    let mut titlebar_frame = NSView::frame(&titlebar_container);
    titlebar_frame.size.height = titlebar_height;
    titlebar_frame.origin.y = window.frame().size.height - titlebar_height;
    titlebar_container.setFrame(titlebar_frame);

    let miniaturize_frame = NSView::frame(&miniaturize);
    let space_between = miniaturize_frame.origin.x - close_frame.origin.x;
    let mut buttons = vec![close, miniaturize];

    if let Some(zoom) = zoom {
        buttons.push(zoom);
    }

    for (index, button) in buttons.into_iter().enumerate() {
        let mut frame = NSView::frame(&button);
        frame.origin.x = TRAFFIC_LIGHT_X + index as f64 * space_between;
        button.setFrameOrigin(frame.origin);
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn apply_webview_window_chrome<R>(webview: &tauri::Webview<R>)
where
    R: tauri::Runtime,
{
    let Ok(ns_window) = webview.window().ns_window() else {
        return;
    };
    schedule_macos_traffic_light_position(ns_window);
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn apply_webview_window_chrome<R>(_webview: &tauri::Webview<R>)
where
    R: tauri::Runtime,
{
}

#[cfg(target_os = "macos")]
pub(crate) fn apply_window_event_chrome<R>(window: &tauri::Window<R>, event: &tauri::WindowEvent)
where
    R: tauri::Runtime,
{
    match event {
        tauri::WindowEvent::Focused(true)
        | tauri::WindowEvent::Resized(_)
        | tauri::WindowEvent::ScaleFactorChanged { .. } => {
            apply_macos_window_traffic_light_position(window);
        }
        _ => {}
    }
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn apply_window_event_chrome<R>(_window: &tauri::Window<R>, _event: &tauri::WindowEvent)
where
    R: tauri::Runtime,
{
}

#[cfg(target_os = "macos")]
pub(crate) fn apply_main_window_chrome<R>(app: &tauri::App<R>)
where
    R: tauri::Runtime,
{
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        apply_macos_traffic_light_position(&window);
    }
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn apply_main_window_chrome<R>(_app: &tauri::App<R>)
where
    R: tauri::Runtime,
{
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

        match builder.build() {
            Ok(window) => {
                #[cfg(target_os = "macos")]
                apply_macos_traffic_light_position(&window);
            }
            Err(error) => {
                eprintln!("failed to create blank editor window: {error}");
            }
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

        match builder.build() {
            Ok(window) => {
                #[cfg(target_os = "macos")]
                apply_macos_traffic_light_position(&window);
            }
            Err(error) => {
                eprintln!("failed to create settings window: {error}");
            }
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
