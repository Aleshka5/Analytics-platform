import TableExport from "../export/TableExport";
import DataTable from "./DataTable";
import ZoomSurface from "./ZoomSurface";
import "./DataWindow.css";

export default function DataWindow({
  columns,
  rows,
  spans,
  mode,
  locale,
  labels,
  hasMore,
  onReachEnd,
  onClose,
  exportLabels,
  exportError,
  exportBusy,
  onExport,
  onExportDismiss,
}) {
  return (
    <div
      className="data-window"
      role="dialog"
      aria-modal="true"
      aria-label={labels.close}
      data-testid="data-window"
    >
      <button
        type="button"
        className="data-window-close"
        data-testid="data-window-close"
        aria-label={labels.close}
        onClick={onClose}
      >
        {"\u00d7"}
      </button>
      <ZoomSurface onReachEnd={hasMore ? onReachEnd : undefined} watchKey={rows?.length || 0}>
        <DataTable
          columns={columns}
          rows={rows}
          spans={spans}
          mode={mode}
          emptyLabel={labels.empty}
          locale={locale}
        />
      </ZoomSurface>
      {onExport ? (
        <TableExport
          labels={exportLabels}
          errorMessage={exportError}
          busy={exportBusy}
          onExport={onExport}
          onDismiss={onExportDismiss}
        />
      ) : null}
    </div>
  );
}
