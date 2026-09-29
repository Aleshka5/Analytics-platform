import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "@fontsource-variable/inter";
import "./i18n";
import "./App.css";
import Header from "./components/Header";
import SheetDialog from "./components/SheetDialog";
import UploadZone from "./components/UploadZone";
import { ApiError, deleteDataset, selectSheet, uploadDataset } from "./api/datasets";
import { downloadReport, downloadRows } from "./api/exports";
import { fetchRows } from "./api/rows";
import { appendRowsPage } from "./dataWindow/appendPage";
import DataWindow from "./dataWindow/DataWindow";
import { draftToQueryBody } from "./query/requestBody";
import ReportExportButton from "./export/ReportExportButton";
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
  "day",
  "month",
];

export default function App() {
  const { t, i18n } = useTranslation();
  const [datasetId, setDatasetId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(() => emptyDraft());
  const [appliedDraft, setAppliedDraft] = useState(null);
  const [dataWindow, setDataWindow] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [windowOpen, setWindowOpen] = useState(false);
  const [applyError, setApplyError] = useState(null);
  const [reportSettled, setReportSettled] = useState(false);
  const [reportExportError, setReportExportError] = useState(null);
  const [tableExportError, setTableExportError] = useState(null);
  const [tableExportBusy, setTableExportBusy] = useState(false);
  const [settingsColumns, setSettingsColumns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [serverMessage, setServerMessage] = useState(null);
  const [sheetPrompt, setSheetPrompt] = useState(null);
  const busyRef = useRef(false);
  const sheetRef = useRef(null);
  const datasetIdRef = useRef(null);
  const rowsRequestRef = useRef(0);
  const dataWindowRef = useRef(null);
  const loadedPageRef = useRef(0);
  const loadingMoreRef = useRef(false);
  dataWindowRef.current = dataWindow;
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
      loadedPageRef.current = 0;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setWindowOpen(false);
      setApplyError(null);
      setReportSettled(false);
      setReportExportError(null);
      setTableExportError(null);
      setTableExportBusy(false);
    }
    datasetIdRef.current = nextId;
    setDatasetId(nextId);
  }

  function rowsRequestIsCurrent(requestId, requestDatasetId) {
    return requestId === rowsRequestRef.current && requestDatasetId === datasetIdRef.current;
  }

  async function handleSettingsApply() {
    loadingMoreRef.current = false;
    setLoadingMore(false);
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
      loadedPageRef.current = result.page;
      setDataWindow({ body, loaded: appendRowsPage(null, result) });
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

  const loadMore = useCallback(async () => {
    const current = dataWindowRef.current;
    if (!datasetId || !current || loadingMoreRef.current) {
      return;
    }
    const nextPage = loadedPageRef.current + 1;
    if (current.loaded.total_pages < 1 || nextPage > current.loaded.total_pages) {
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const requestId = rowsRequestRef.current;
    const requestDatasetId = datasetId;
    const body = { ...current.body, page: nextPage };
    try {
      const result = await fetchRows(requestDatasetId, body, { lang: locale });
      if (!rowsRequestIsCurrent(requestId, requestDatasetId)) {
        return;
      }
      loadedPageRef.current = result.page;
      setDataWindow((windowState) => {
        if (!windowState || windowState.loaded.page + 1 !== result.page) {
          return windowState;
        }
        return {
          body: windowState.body,
          loaded: appendRowsPage(windowState.loaded, result),
        };
      });
    } catch {
      // Keep the rows already shown. Panning away and back retries.
    } finally {
      if (rowsRequestIsCurrent(requestId, requestDatasetId)) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [datasetId, locale]);

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

  function exportMessage(error) {
    return error instanceof Error && error.message ? error.message : "Request failed";
  }

  async function handleReportExport(format) {
    setReportExportError(null);
    try {
      await downloadReport(datasetId, { format, lang: locale });
    } catch (error) {
      setReportExportError(exportMessage(error));
      throw error;
    }
  }

  async function handleTableExport(format) {
    const body = dataWindowRef.current && dataWindowRef.current.body;
    setTableExportError(null);
    setTableExportBusy(true);
    try {
      await downloadRows(datasetId, body, { format, lang: locale });
    } catch (error) {
      setTableExportError(exportMessage(error));
      throw error;
    } finally {
      setTableExportBusy(false);
    }
  }

  const titles = Object.fromEntries(CARD_TITLE_KEYS.map((key) => [key, t(`cards.${key}`)]));
  const exportLabels = {
    action: t("export.action"),
    excel: t("export.excel"),
    csv: t("export.csv"),
    json: t("export.json"),
    pdf: t("export.pdf"),
    close: t("table.close"),
  };
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
        title={t("upload.title")}
        hint={t("upload.hint")}
        replaceHint={t("upload.replaceHint")}
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
          onSettled={setReportSettled}
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
      {datasetId ? (
        <ReportExportButton
          settled={reportSettled}
          labels={exportLabels}
          errorMessage={reportExportError}
          onConfirm={handleReportExport}
        />
      ) : null}
      {datasetId && windowOpen && dataWindow ? (
        <DataWindow
          columns={dataWindow.loaded.columns}
          rows={dataWindow.loaded.rows}
          spans={dataWindow.loaded.spans}
          mode={dataWindow.loaded.group?.mode || dataWindow.body.group?.mode || "rowspan"}
          locale={locale}
          labels={{
            close: t("table.close"),
            empty: t("table.empty"),
          }}
          exportLabels={exportLabels}
          exportError={tableExportError}
          exportBusy={tableExportBusy}
          onExport={handleTableExport}
          onExportDismiss={() => setTableExportError(null)}
          hasMore={
            !loadingMore && dataWindow.loaded.page < dataWindow.loaded.total_pages
          }
          onReachEnd={loadMore}
          onClose={() => setWindowOpen(false)}
        />
      ) : null}
    </>
  );
}
