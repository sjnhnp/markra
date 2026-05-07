mod ai_http;
mod language;
mod markdown_files;
mod menu;
mod menu_labels;
mod watcher;
mod windows;

use ai_http::{request_ai_provider_json, request_native_chat, request_native_chat_stream};
use markdown_files::{
    create_markdown_tree_file, create_markdown_tree_folder, delete_markdown_tree_file,
    list_markdown_files_for_path, open_markdown_file_in_new_window, open_markdown_path,
    read_markdown_file, rename_markdown_tree_file, write_markdown_file,
};
use menu::{
    create_application_menu, is_frontend_menu_command, is_native_new_window_command,
    is_native_settings_window_command, NativeMenuCommand, NATIVE_MENU_COMMAND_EVENT,
};
use tauri::Emitter;
use watcher::{unwatch_markdown_file, watch_markdown_file, MarkdownWatcherState};
use windows::{
    apply_main_window_chrome, apply_webview_window_chrome, apply_window_event_chrome,
    open_blank_editor_window, open_settings_window, spawn_blank_editor_window,
    spawn_settings_window,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MarkdownWatcherState::default())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            apply_main_window_chrome(app);
            Ok(())
        })
        .on_page_load(|webview, _| {
            apply_webview_window_chrome(webview);
        })
        .on_window_event(|window, event| {
            apply_window_event_chrome(window, event);
        })
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
            create_markdown_tree_file,
            create_markdown_tree_folder,
            rename_markdown_tree_file,
            delete_markdown_tree_file,
            open_markdown_file_in_new_window,
            open_markdown_path,
            read_markdown_file,
            open_blank_editor_window,
            open_settings_window,
            request_ai_provider_json,
            request_native_chat,
            request_native_chat_stream,
            write_markdown_file,
            watch_markdown_file,
            unwatch_markdown_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Markra");
}

#[cfg(test)]
mod tests {
    #[test]
    fn exposes_native_command_classification_from_menu_module() {
        assert!(crate::menu::is_frontend_menu_command("saveDocument"));
        assert!(crate::menu::is_native_new_window_command("newDocument"));
        assert!(crate::menu::is_native_settings_window_command(
            "openSettings"
        ));
    }
}
