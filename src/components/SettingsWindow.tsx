import { AppToaster } from "./AppToaster";
import { AiProviderSettingsPanel } from "./AiProviderSettingsPanel";
import {
  AppearanceSettings,
  EditorSettings,
  GeneralSettings,
  MarkdownSettings,
  ShortcutsSettings
} from "./SettingsSections";
import { SettingsContent, SettingsSidebar } from "./SettingsShell";
import { useSettingsWindowState } from "../hooks/useSettingsWindowState";

export function SettingsWindow() {
  const settingsState = useSettingsWindowState();
  const {
    activeCategory,
    aiSettings,
    aiSettingsSaved,
    appLanguage,
    appTheme,
    editorPreferences,
    handleAddAiProvider,
    handleFetchAiProviderModels,
    handleResetWelcomeDocument,
    handleSaveAiSettings,
    handleTestAiProvider,
    handleUpdateAiSettings,
    handleUpdateEditorPreferences,
    selectedAiProvider,
    setActiveCategory,
    setSelectedAiProviderId,
    translate,
    welcomeReset
  } = settingsState;

  return (
    <main
      className="settings-window relative h-screen overflow-hidden overscroll-none bg-(--bg-primary) text-(--text-primary)"
      aria-label={translate("settings.aria.main")}
    >
      <AppToaster language={appLanguage.language} />
      <div
        className="settings-drag-region fixed inset-x-0 top-0 z-10 h-9.5 select-none [-webkit-user-select:none]"
        aria-label={translate("settings.aria.dragRegion")}
        data-tauri-drag-region
      />
      <div className="settings-layout grid h-screen grid-cols-[180px_minmax(0,1fr)]">
        <SettingsSidebar activeCategory={activeCategory} translate={translate} onCategoryChange={setActiveCategory} />
        <SettingsContent activeCategory={activeCategory} translate={translate}>
          {activeCategory === "general" ? (
            <GeneralSettings
              language={appLanguage.language}
              translate={translate}
              welcomeReset={welcomeReset}
              onResetWelcomeDocument={handleResetWelcomeDocument}
              onSelectLanguage={appLanguage.selectLanguage}
            />
          ) : null}
          {activeCategory === "ai" ? (
            <AiProviderSettingsPanel
              saved={aiSettingsSaved}
              selectedProviderId={selectedAiProvider?.id}
              settings={aiSettings}
              translate={translate}
              onAddProvider={handleAddAiProvider}
              onFetchModels={handleFetchAiProviderModels}
              onSave={handleSaveAiSettings}
              onSelectProvider={setSelectedAiProviderId}
              onTestProvider={handleTestAiProvider}
              onUpdateSettings={handleUpdateAiSettings}
            />
          ) : null}
          {activeCategory === "appearance" ? (
            <AppearanceSettings
              selectedTheme={appTheme.theme}
              translate={translate}
              onSelectTheme={appTheme.selectTheme}
            />
          ) : null}
          {activeCategory === "editor" ? (
            <EditorSettings
              preferences={editorPreferences}
              translate={translate}
              onUpdatePreferences={handleUpdateEditorPreferences}
            />
          ) : null}
          {activeCategory === "markdown" ? <MarkdownSettings translate={translate} /> : null}
          {activeCategory === "shortcuts" ? <ShortcutsSettings translate={translate} /> : null}
        </SettingsContent>
      </div>
    </main>
  );
}
