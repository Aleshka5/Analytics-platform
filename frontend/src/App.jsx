import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./i18n";
import "./App.css";
import Header from "./components/Header";
import UploadZone from "./components/UploadZone";
import ReportBoard from "./report/ReportBoard";

const CARD_TITLE_KEYS = [
  "preview",
  "columns",
  "size",
  "dtypes",
  "missing",
  "summary",
  "ranking",
  "grouping",
  "timeseries",
  "insights",
];

const CARD_LABEL_KEYS = [
  "rowCount",
  "columnCount",
  "top",
  "worst",
  "metric",
  "category",
  "date",
  "truncated",
  "name",
  "role",
  "distinct",
  "dtype",
  "missingCount",
  "missingPercent",
  "filled",
  "numeric",
  "other",
  "count",
  "mean",
  "std",
  "min",
  "p25",
  "p50",
  "p75",
  "max",
  "unique",
  "topValue",
  "frequency",
  "value",
  "sum",
];

export default function App() {
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const locale = (i18n.language || "en").toLowerCase().startsWith("ru") ? "ru" : "en";

  function handleAccepted() {
    setCollapsed(true);
    setResetKey((key) => key + 1);
  }

  const titles = Object.fromEntries(CARD_TITLE_KEYS.map((key) => [key, t(`cards.${key}`)]));
  const labels = {
    ...Object.fromEntries(CARD_LABEL_KEYS.map((key) => [key, t(`card.${key}`)])),
    unavailable: t("unavailable.no_insight_inputs"),
    empty: "\u2014",
  };

  return (
    <>
      <Header />
      <UploadZone
        collapsed={collapsed}
        actionLabel={t("upload.action")}
        replaceLabel={t("upload.replace")}
        messages={{
          file_too_large: t("upload.tooLarge"),
          unsupported_format: t("upload.unsupported"),
        }}
        onAccepted={handleAccepted}
      />
      {collapsed ? (
        <ReportBoard locale={locale} titles={titles} labels={labels} resetKey={resetKey} />
      ) : null}
    </>
  );
}
