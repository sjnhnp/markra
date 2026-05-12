import { supportedLanguages, t } from "./index";
import deMessages from "./locales/de";
import esMessages from "./locales/es";
import frMessages from "./locales/fr";
import itMessages from "./locales/it";
import jaMessages from "./locales/ja";
import koMessages from "./locales/ko";
import ptBrMessages from "./locales/pt-BR";
import ruMessages from "./locales/ru";
import zhCnMessages from "./locales/zh-CN";
import zhTwMessages from "./locales/zh-TW";
import type { AppLanguage, I18nKey, LocaleMessages } from "./locales/types";

const nonEnglishLocaleMessages: Record<Exclude<AppLanguage, "en">, LocaleMessages> = {
  de: deMessages,
  es: esMessages,
  fr: frMessages,
  it: itMessages,
  ja: jaMessages,
  ko: koMessages,
  "pt-BR": ptBrMessages,
  ru: ruMessages,
  "zh-CN": zhCnMessages,
  "zh-TW": zhTwMessages
};

const sourceModeKeys: I18nKey[] = [
  "app.switchToSourceMode",
  "app.switchToVisualMode",
  "app.markdownSource"
];

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

  it("ships source mode labels in every supported locale", () => {
    for (const [language, messages] of Object.entries(nonEnglishLocaleMessages)) {
      for (const key of sourceModeKeys) {
        expect(messages[key], `${language} should define ${key}`).toEqual(expect.any(String));
        expect(messages[key]?.trim(), `${language} should not leave ${key} empty`).not.toBe("");
      }
    }
  });
});
