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

  it("uses the keyboard shortcuts category title for the active panel", () => {
    render(
      <SettingsContent activeCategory="keyboardShortcuts" translate={translate}>
        <div />
      </SettingsContent>
    );

    expect(screen.getByRole("heading", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });
});
