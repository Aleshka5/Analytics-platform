import "./Header.css";
import { useTranslation } from "react-i18next";
import { setLanguage } from "../i18n";

function BrandMark() {
  return (
    <svg className="header-mark" aria-hidden="true" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="9" />
      <path d="M8 21l5-6 4 3 7-8" />
    </svg>
  );
}

export default function Header() {
  const { t, i18n } = useTranslation();
  const isRussian = (i18n.language || "").toLowerCase().startsWith("ru");

  return (
    <header>
      <div className="header-brand">
        <BrandMark />
        <h1>{t("header.title")}</h1>
      </div>
      <div className="header-languages" data-active={isRussian ? "ru" : "en"}>
        <button
          type="button"
          aria-pressed={isRussian ? "true" : "false"}
          onClick={() => setLanguage("ru")}
        >
          RU
        </button>
        <button
          type="button"
          aria-pressed={isRussian ? "false" : "true"}
          onClick={() => setLanguage("en")}
        >
          EN
        </button>
      </div>
    </header>
  );
}
