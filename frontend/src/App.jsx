import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./i18n";
import "./App.css";
import Header from "./components/Header";
import SheetDialog from "./components/SheetDialog";
import UploadZone from "./components/UploadZone";
import { ApiError, deleteDataset, selectSheet, uploadDataset } from "./api/datasets";
import { fetchRows } from "./api/rows";
import DataWindow from "./dataWindow/DataWindow";
import { draftToQueryBody } from "./query/requestBody";
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
  const [appliedDraft, setAppliedDraft] = useState(null);
  const [dataWindow, setDataWindow] = useState(null);
  const [windowOpen, setWindowOpen] = useState(false);
  const [applyError, setApplyError] = useState(null);
  const [settingsColumns, setSettingsColumns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [serverMessage, setServerMessage] = useState(null);
  const [sheetPrompt, setSheetPrompt] = useState(null);
  const busyRef = useRef(false);
  const sheetRef = useRef(null);
  const datasetIdRef = useRef(null);
  const rowsRequestRef = useRef(0);
  const locale = (i18n.language || "en").toLowerCase().startsWith("ru") ? "ru" : "en";
  const api = {
    uploadDataset: (file) => uploadDataset(file, { lang: locale }),
    selectSheet: (id, sheet) => selectSheet(id, sheet, { lang: locale }),
    deleteDataset: (id) => deleteDataset(id, { lang: locale }),
  };

  function setActiveDataset(nextId) {
    if (nextId !== datasetIdRef.current) {
      rowsRequestRef.current += 1;
      setSettingsDraft(emptyDraft());
      setSettingsColumns([]);
      setSettingsOpen(false);
      setAppliedDraft(null);
      setDataWindow(null);
      setWindowOpen(false);
      setApplyError(null);
    }
    datasetIdRef.current = nextId;
    setDatasetId(nextId);
  }

  function rowsRequestIsCurrent(requestId, requestDatasetId) {
    return requestId === rowsRequestRef.current && requestDatasetId === datasetIdRef.current;
  }

  async function handleSettingsApply() {
    const requestId = rowsRequestRef.current + 1;
    rowsRequestRef.current = requestId;
    const requestDatasetId = datasetId;
    const draft = settingsDraft;
    const body = draftToQueryBody(draft, settingsColumns, 1);
    try {
      const result = await fetchRows(requestDatasetId, body, { lang: locale });
      if (!rowsRequestIsCurrent(requestId, requestDatasetId)) {
        return;
      }
      setAppliedDraft(JSON.parse(JSON.stringify(draft)));
      setDataWindow({ body, page: result });
      setWindowOpen(true);
      setApplyError(null);
      setSettingsOpen(false);
    } catch (error) {
      if (!rowsRequestIsCurrent(requestId, requestDatasetId)) {
        return;
      }
      if (error instanceof ApiError && error.status === 422) {
        setApplyError(error.message);
        return;
      }
      setApplyError(error instanceof Error && error.message ? error.message : "Request failed");
    }
  }

  async function loadPage(page) {
    if (!datasetId || !dataWindow) {
      return;
    }
    const requestId = rowsRequestRef.current + 1;
    rowsRequestRef.current = requestId;
    const requestDatasetId = datasetId;
    const body = { ...dataWindow.body, page };
    try {
      const result = await fetchRows(requestDatasetId, body, { lang: locale });
      if (!rowsRequestIsCurrent(requestId, requestDatasetId)) {
        return;
      }
      setDataWindow({
        body: { ...body, page: result.page },
        page: result,
      });
    } catch {
      // Keep the page that is already open.
    }
  }

  function closeSettings() {
    setSettingsOpen(false);
    setSettingsDraft(
      appliedDraft ? JSON.parse(JSON.stringify(appliedDraft)) : emptyDraft(),
    );
    setApplyError(null);
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
            errorMessage={applyError}
          />
        </SettingsSidebar>
      ) : null}
      {datasetId && windowOpen && dataWindow ? (
        <DataWindow
          columns={dataWindow.page.columns}
          rows={dataWindow.page.rows}
          spans={dataWindow.page.spans}
          mode={dataWindow.page.group?.mode || dataWindow.body.group?.mode || "rowspan"}
          page={dataWindow.page.page}
          totalPages={dataWindow.page.total_pages}
          locale={locale}
          labels={{
            close: t("table.close"),
            empty: t("table.empty"),
            pageSize: t("table.pageSize"),
            previous: t("table.previous"),
            next: t("table.next"),
          }}
          onPrevious={() => loadPage(dataWindow.page.page - 1)}
          onNext={() => loadPage(dataWindow.page.page + 1)}
          onClose={() => setWindowOpen(false)}
        />
      ) : null}
    </>
  );
}
