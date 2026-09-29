import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./i18n";
import "./App.css";
import Header from "./components/Header";
import SheetDialog from "./components/SheetDialog";
import UploadZone from "./components/UploadZone";
import { deleteDataset, selectSheet, uploadDataset } from "./api/datasets";
import ReportBoard from "./report/ReportBoard";
import { emptyDraft } from "./sidebar/draft";
import SettingsForm from "./sidebar/SettingsForm";
import SettingsSidebar from "./sidebar/SettingsSidebar";
import { cancelSheet, confirmSheet, uploadFile } from "./upload/session";

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
  const [datasetId, setDatasetId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(() => emptyDraft());
  const [settingsColumns, setSettingsColumns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [serverMessage, setServerMessage] = useState(null);
  const [sheetPrompt, setSheetPrompt] = useState(null);
  const busyRef = useRef(false);
  const sheetRef = useRef(null);
  const locale = (i18n.language || "en").toLowerCase().startsWith("ru") ? "ru" : "en";
  const api = {
    uploadDataset: (file) => uploadDataset(file, { lang: locale }),
    selectSheet: (id, sheet) => selectSheet(id, sheet, { lang: locale }),
    deleteDataset: (id) => deleteDataset(id, { lang: locale }),
  };

  function setActiveDataset(nextId) {
    if (nextId !== datasetId) {
      setSettingsDraft(emptyDraft());
      setSettingsColumns([]);
      setSettingsOpen(false);
    }
    setDatasetId(nextId);
  }

  function handleSettingsApply() {}

  function closeSettings() {
    setSettingsOpen(false);
    setSettingsDraft(emptyDraft());
  }

  function openSheet(prompt) {
    sheetRef.current = prompt;
    setSheetPrompt(prompt);
  }

  function closeSheet() {
    sheetRef.current = null;
    setSheetPrompt(null);
  }

  async function handleAccepted(file) {
    if (busyRef.current || sheetRef.current) {
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setServerMessage(null);
    const result = await uploadFile({ file, previousId: datasetId, api });
    busyRef.current = false;
    setBusy(false);

    if (!result.ok) {
      setServerMessage(result.message);
      return;
    }
    if (result.status === "sheet_required") {
      openSheet({
        datasetId: result.datasetId,
        sheets: result.sheets,
        previousId: result.previousId,
      });
      return;
    }
    if (result.status === "ready") {
      setActiveDataset(result.datasetId);
    }
  }

  async function handleConfirm(sheet) {
    const prompt = sheetRef.current;
    if (!prompt || busyRef.current) {
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setServerMessage(null);
    const result = await confirmSheet({
      datasetId: prompt.datasetId,
      sheet,
      previousId: prompt.previousId,
      api,
    });
    busyRef.current = false;
    setBusy(false);

    if (!result.ok) {
      setServerMessage(result.message);
      return;
    }

    closeSheet();
    setActiveDataset(result.datasetId);
  }

  async function handleCancel() {
    const prompt = sheetRef.current;
    if (!prompt || busyRef.current) {
      return;
    }

    busyRef.current = true;
    setBusy(true);
    const result = await cancelSheet({
      datasetId: prompt.datasetId,
      previousId: prompt.previousId,
      api,
    });
    busyRef.current = false;
    setBusy(false);
    closeSheet();
    setActiveDataset(result.datasetId);
    if (!result.ok && result.message) {
      setServerMessage(result.message);
    }
  }

  const titles = Object.fromEntries(CARD_TITLE_KEYS.map((key) => [key, t(`cards.${key}`)]));
  const labels = {
    ...Object.fromEntries(CARD_LABEL_KEYS.map((key) => [key, t(`card.${key}`)])),
    empty: "\u2014",
  };

  return (
    <>
      <Header />
      <UploadZone
        collapsed={datasetId !== null}
        busy={busy}
        serverMessage={serverMessage}
        actionLabel={t("upload.action")}
        replaceLabel={t("upload.replace")}
        messages={{
          file_too_large: t("upload.tooLarge"),
          unsupported_format: t("upload.unsupported"),
        }}
        onAccepted={handleAccepted}
      />
      {sheetPrompt ? (
        <SheetDialog
          sheets={sheetPrompt.sheets}
          title={t("sheet.title")}
          confirmLabel={t("sheet.confirm")}
          cancelLabel={t("sheet.cancel")}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : null}
      {datasetId ? (
        <ReportBoard
          datasetId={datasetId}
          lang={locale}
          titles={titles}
          labels={labels}
          onColumns={setSettingsColumns}
        />
      ) : null}
      {datasetId ? (
        <SettingsSidebar open={settingsOpen} onOpen={() => setSettingsOpen(true)} onClose={closeSettings}>
          <SettingsForm
            columns={settingsColumns}
            draft={settingsDraft}
            onChange={setSettingsDraft}
            onApply={handleSettingsApply}
          />
        </SettingsSidebar>
      ) : null}
    </>
  );
}
