import deMessages from "./locales/de";
import enMessages from "./locales/en";
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

export type { AppLanguage, I18nKey };

export const supportedLanguages: Array<{
  code: AppLanguage;
  label: string;
}> = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "it", label: "Italiano" },
  { code: "ru", label: "Русский" }
];

const dictionaries: Record<AppLanguage, LocaleMessages> = {
  en: enMessages,
  "zh-CN": zhCnMessages,
  "zh-TW": zhTwMessages,
  ja: jaMessages,
  ko: koMessages,
  fr: frMessages,
  de: deMessages,
  es: esMessages,
  "pt-BR": ptBrMessages,
  it: itMessages,
  ru: ruMessages
};

export function isAppLanguage(value: unknown): value is AppLanguage {
  return supportedLanguages.some((language) => language.code === value);
}

export function t(language: AppLanguage, key: string) {
  const i18nKey = key as I18nKey;

  return dictionaries[language][i18nKey] ?? enMessages[i18nKey] ?? key;
}
