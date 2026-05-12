use crate::language::{resolve_startup_language, AppLanguage};
use tauri::{
    menu::{AboutMetadata, Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Manager,
};

pub(crate) const NATIVE_MENU_COMMAND_EVENT: &str = "markra://menu-command";

const NEW_DOCUMENT_COMMAND: &str = "newDocument";
const SETTINGS_WINDOW_COMMAND: &str = "openSettings";

#[derive(Clone, serde::Serialize)]
pub(crate) struct NativeMenuCommand {
    pub(crate) command: String,
}

fn app_menu_item<R: tauri::Runtime, M: Manager<R>>(
    manager: &M,
    id: &str,
    text: &str,
    accelerator: &str,
) -> tauri::Result<tauri::menu::MenuItem<R>> {
    MenuItemBuilder::with_id(id, text)
        .accelerator(accelerator)
        .build(manager)
}

pub(crate) fn create_application_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> tauri::Result<Menu<R>> {
    let language = resolve_startup_language(&app.config().identifier);
    create_application_menu_for_language(app, language)
}

fn create_application_menu_for_language<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    language: AppLanguage,
) -> tauri::Result<Menu<R>> {
    let labels = crate::menu_labels::for_language(language);

    let new = app_menu_item(
        app,
        NEW_DOCUMENT_COMMAND,
        labels.new_document,
        "CmdOrCtrl+N",
    )?;
    let open = app_menu_item(app, "openDocument", labels.open_document, "CmdOrCtrl+O")?;
    let save = app_menu_item(app, "saveDocument", labels.save_document, "CmdOrCtrl+S")?;
    let save_as = app_menu_item(
        app,
        "saveDocumentAs",
        labels.save_document_as,
        "CmdOrCtrl+Shift+S",
    )?;
    let export_pdf = app_menu_item(app, "exportPdf", labels.export_pdf, "CmdOrCtrl+P")?;
    let export_html = app_menu_item(app, "exportHtml", labels.export_html, "CmdOrCtrl+Shift+E")?;
    let export_menu = SubmenuBuilder::with_id(app, "markra:file:export", labels.export)
        .items(&[&export_pdf, &export_html])
        .build()?;
    let settings = app_menu_item(app, SETTINGS_WINDOW_COMMAND, labels.settings, "CmdOrCtrl+,")?;

    let bold = app_menu_item(app, "formatBold", labels.bold, "CmdOrCtrl+B")?;
    let italic = app_menu_item(app, "formatItalic", labels.italic, "CmdOrCtrl+I")?;
    let strikethrough = app_menu_item(
        app,
        "formatStrikethrough",
        labels.strikethrough,
        "CmdOrCtrl+Shift+X",
    )?;
    let inline_code = app_menu_item(app, "formatInlineCode", labels.inline_code, "CmdOrCtrl+E")?;
    let paragraph = app_menu_item(app, "formatParagraph", labels.paragraph, "CmdOrCtrl+Alt+0")?;
    let heading_1 = app_menu_item(app, "formatHeading1", labels.heading_1, "CmdOrCtrl+Alt+1")?;
    let heading_2 = app_menu_item(app, "formatHeading2", labels.heading_2, "CmdOrCtrl+Alt+2")?;
    let heading_3 = app_menu_item(app, "formatHeading3", labels.heading_3, "CmdOrCtrl+Alt+3")?;
    let bullet_list = app_menu_item(
        app,
        "formatBulletList",
        labels.bullet_list,
        "CmdOrCtrl+Shift+8",
    )?;
    let ordered_list = app_menu_item(
        app,
        "formatOrderedList",
        labels.ordered_list,
        "CmdOrCtrl+Shift+7",
    )?;
    let quote = app_menu_item(app, "formatQuote", labels.quote, "CmdOrCtrl+Shift+B")?;
    let code_block = app_menu_item(app, "formatCodeBlock", labels.code_block, "CmdOrCtrl+Alt+C")?;
    let link = app_menu_item(app, "insertLink", labels.link, "CmdOrCtrl+K")?;
    let image = app_menu_item(app, "insertImage", labels.image, "CmdOrCtrl+Shift+I")?;
    let table = app_menu_item(app, "insertTable", labels.table, "CmdOrCtrl+Alt+T")?;

    let app_menu = SubmenuBuilder::with_id(app, "markra:app", "Markra")
        .about(Some(AboutMetadata {
            name: Some("Markra".into()),
            ..Default::default()
        }))
        .separator()
        .items(&[&settings])
        .separator()
        .hide_with_text(labels.hide)
        .hide_others_with_text(labels.hide_others)
        .show_all_with_text(labels.show_all)
        .separator()
        .quit_with_text(labels.quit)
        .build()?;

    let file_menu = SubmenuBuilder::with_id(app, "markra:file", labels.file)
        .items(&[&new, &open])
        .separator()
        .items(&[&save, &save_as])
        .separator()
        .items(&[&export_menu])
        .separator()
        .close_window_with_text(labels.close_window)
        .build()?;

    let edit_menu = SubmenuBuilder::with_id(app, "markra:edit", labels.edit)
        .undo_with_text(labels.undo)
        .redo_with_text(labels.redo)
        .separator()
        .cut_with_text(labels.cut)
        .copy_with_text(labels.copy)
        .paste_with_text(labels.paste)
        .select_all_with_text(labels.select_all)
        .build()?;

    let format_menu = SubmenuBuilder::with_id(app, "markra:format", labels.format)
        .items(&[&bold, &italic, &strikethrough, &inline_code])
        .separator()
        .items(&[&paragraph, &heading_1, &heading_2, &heading_3])
        .separator()
        .items(&[&bullet_list, &ordered_list, &quote, &code_block])
        .separator()
        .items(&[&link, &image, &table])
        .build()?;

    let view_menu = SubmenuBuilder::with_id(app, "markra:view", labels.view)
        .fullscreen_with_text(labels.fullscreen)
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &format_menu, &view_menu])
        .build()
}

#[tauri::command]
pub(crate) fn install_application_menu(
    app: tauri::AppHandle,
    language: String,
) -> Result<(), String> {
    let language = AppLanguage::from_code(&language)
        .ok_or_else(|| format!("Unsupported application menu language: {language}"))?;
    let menu =
        create_application_menu_for_language(&app, language).map_err(|error| error.to_string())?;

    app.set_menu(menu)
        .map(|_| ())
        .map_err(|error| error.to_string())
}

pub(crate) fn is_native_new_window_command(command: &str) -> bool {
    command == NEW_DOCUMENT_COMMAND
}

pub(crate) fn is_native_settings_window_command(command: &str) -> bool {
    command == SETTINGS_WINDOW_COMMAND
}

pub(crate) fn is_frontend_menu_command(command: &str) -> bool {
    matches!(
        command,
        "openDocument"
            | "saveDocument"
            | "saveDocumentAs"
            | "exportPdf"
            | "exportHtml"
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
            | "insertTable"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::language::AppLanguage;

    #[test]
    fn menu_labels_follow_the_selected_startup_language() {
        let english = crate::menu_labels::for_language(AppLanguage::En);
        let simplified_chinese = crate::menu_labels::for_language(AppLanguage::ZhCn);

        assert_ne!(simplified_chinese.file, english.file);
        assert_ne!(simplified_chinese.new_document, english.new_document);
    }

    #[test]
    fn recognizes_frontend_menu_commands() {
        assert!(!is_frontend_menu_command("newDocument"));
        assert!(is_frontend_menu_command("openDocument"));
        assert!(!is_frontend_menu_command("openFolder"));
        assert!(is_frontend_menu_command("saveDocument"));
        assert!(is_frontend_menu_command("exportPdf"));
        assert!(is_frontend_menu_command("exportHtml"));
        assert!(is_frontend_menu_command("formatBold"));
        assert!(is_frontend_menu_command("insertImage"));
        assert!(is_frontend_menu_command("insertTable"));
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
}
