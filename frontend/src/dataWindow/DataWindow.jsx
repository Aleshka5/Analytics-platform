import DataTable from "./DataTable";
import PaginationBar from "./PaginationBar";
import ZoomSurface from "./ZoomSurface";
import "./DataWindow.css";

export default function DataWindow({
  columns,
  rows,
  spans,
  mode,
  page,
  totalPages,
  locale,
  labels,
  onPrevious,
  onNext,
  onClose,
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
      <ZoomSurface>
        <DataTable
          columns={columns}
          rows={rows}
          spans={spans}
          mode={mode}
          emptyLabel={labels.empty}
          locale={locale}
        />
      </ZoomSurface>
      <PaginationBar
        page={page}
        totalPages={totalPages}
        pageSizeLabel={labels.pageSize}
        previousLabel={labels.previous}
        nextLabel={labels.next}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </div>
  );
}
