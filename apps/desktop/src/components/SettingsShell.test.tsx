import { fireEvent, render, screen } from "@testing-library/react";
import { t } from "@markra/shared";
import { SettingsContent, SettingsSidebar } from "./SettingsShell";

function translate(key: Parameters<typeof t>[1]) {
  return t("en", key);
}

describe("SettingsShell", () => {
  it("shows keyboard shortcuts as its own settings category", () => {
    const onCategoryChange = vi.fn();

    render(
      <SettingsSidebar
        activeCategory="general"
        platform="macos"
        translate={translate}
        onCategoryChange={onCategoryChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));

    expect(onCategoryChange).toHaveBeenCalledWith("keyboardShortcuts");
  });

  it("shows storage as its own settings category", () => {
    const onCategoryChange = vi.fn();

    render(
      <SettingsSidebar
        activeCategory="general"
        platform="macos"
        translate={translate}
        onCategoryChange={onCategoryChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Storage" }));

    expect(onCategoryChange).toHaveBeenCalledWith("storage");
  });

  it("shows AI and providers as separate settings categories", () => {
    const onCategoryChange = vi.fn();

    render(
      <SettingsSidebar
        activeCategory="general"
        platform="macos"
        translate={translate}
        onCategoryChange={onCategoryChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    fireEvent.click(screen.getByRole("button", { name: "Providers" }));

    expect(onCategoryChange).toHaveBeenCalledWith("ai");
    expect(onCategoryChange).toHaveBeenCalledWith("providers");
  });

  it("uses the keyboard shortcuts category title for the active panel", () => {
    render(
      <SettingsContent activeCategory="keyboardShortcuts" translate={translate}>
        <div />
      </SettingsContent>
    );

    expect(screen.getByRole("heading", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });

  it("uses the storage category title for the active panel", () => {
    render(
      <SettingsContent activeCategory="storage" translate={translate}>
        <div />
      </SettingsContent>
    );

    expect(screen.getByRole("heading", { name: "Storage" })).toBeInTheDocument();
  });

  it("uses the provider category title for the provider panel", () => {
    render(
      <SettingsContent activeCategory="providers" translate={translate}>
        <div />
      </SettingsContent>
    );

    expect(screen.getByRole("heading", { name: "Providers" })).toBeInTheDocument();
  });
});
