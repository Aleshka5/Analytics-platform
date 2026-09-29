import "./Header.css";
import { useTranslation } from "react-i18next";
import { setLanguage } from "../i18n";

export default function Header() {
  const { t, i18n } = useTranslation();
  const isRussian = (i18n.language || "").toLowerCase().startsWith("ru");

  return (
    <header>
      <h1>{t("header.title")}</h1>
      <div className="header-languages">
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
