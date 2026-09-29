import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

const STORAGE_KEY = "lang";

export function resolveInitialLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "ru" || stored === "en") {
    return stored;
  }

  const browserLanguage =
    navigator.language ||
    (navigator.languages && navigator.languages[0]) ||
    "";
  if (browserLanguage.toLowerCase().startsWith("ru")) {
    return "ru";
  }

  return "en";
}

export function setLanguage(lang) {
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  return i18n.changeLanguage(lang);
}

if (!i18n.isInitialized) {
  const lng = typeof window !== "undefined" ? resolveInitialLanguage() : "en";

  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    lng,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
}

export default i18n;
