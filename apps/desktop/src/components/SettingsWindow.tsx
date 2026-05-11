import { AppToaster } from "./AppToaster";
import { AiProviderSettingsPanel } from "./AiProviderSettingsPanel";
import {
  AppearanceSettings,
  EditorSettings,
  GeneralSettings,
  WebSearchSettings
} from "./SettingsSections";
import { SettingsContent, SettingsSidebar } from "./SettingsShell";
import { useSettingsWindowState } from "../hooks/useSettingsWindowState";
import { useAutoUpdater } from "../hooks/useAutoUpdater";
import { resolveDesktopPlatform } from "../lib/platform";

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
    handleUpdateWebSearchSettings,
    selectedAiProvider,
    setActiveCategory,
    setSelectedAiProviderId,
    translate,
    webSearchSettings,
    welcomeReset
  } = settingsState;
  const platform = resolveDesktopPlatform();
  const updater = useAutoUpdater(appLanguage.language, appLanguage.ready, {
    autoCheck: false
  });

  return (
    <main
      className="settings-window relative h-screen overflow-hidden overscroll-none bg-(--bg-primary) text-(--text-primary)"
      aria-label={translate("settings.aria.main")}
    >
      <AppToaster language={appLanguage.language} />
      {platform === "windows" ? null : (
        <div
          className="settings-drag-region fixed inset-x-0 top-0 z-10 h-9.5 select-none [-webkit-user-select:none]"
          aria-label={translate("settings.aria.dragRegion")}
          data-tauri-drag-region
        />
      )}
      <div className="settings-layout grid h-screen grid-cols-[180px_minmax(0,1fr)]">
        <SettingsSidebar
          activeCategory={activeCategory}
          platform={platform}
          translate={translate}
          onCategoryChange={setActiveCategory}
        />
        <SettingsContent activeCategory={activeCategory} translate={translate}>
          {activeCategory === "general" ? (
            <GeneralSettings
              preferences={editorPreferences}
              language={appLanguage.language}
              translate={translate}
              welcomeReset={welcomeReset}
              onCheckForUpdates={updater.checkForUpdates}
              onResetWelcomeDocument={handleResetWelcomeDocument}
              onSelectLanguage={appLanguage.selectLanguage}
              onUpdatePreferences={handleUpdateEditorPreferences}
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
          {activeCategory === "web" ? (
            <WebSearchSettings
              settings={webSearchSettings}
              translate={translate}
              onUpdateSettings={handleUpdateWebSearchSettings}
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
        </SettingsContent>
      </div>
    </main>
  );
}
