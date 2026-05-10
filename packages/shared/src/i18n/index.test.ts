import { supportedLanguages, t } from "./index";

describe("i18n", () => {
  it("ships common app languages with English as the first default", () => {
    expect(supportedLanguages.map((language) => language.code)).toEqual([
      "en",
      "zh-CN",
      "zh-TW",
      "ja",
      "ko",
      "fr",
      "de",
      "es",
      "pt-BR",
      "it",
      "ru"
    ]);
  });

  it("falls back to the key when no translation exists", () => {
    expect(t("ru", "missing.key")).toBe("missing.key");
  });
});
