import "./PaginationBar.css";

export default function PaginationBar({
  page,
  totalPages,
  pageSizeLabel,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
}) {
  return (
    <div className="pagination-bar" data-testid="pagination-bar">
      <button
        type="button"
        className="pagination-button pagination-previous"
        data-testid="pagination-previous"
        disabled={page <= 1}
        onClick={onPrevious}
      >
        {previousLabel}
      </button>
      <span className="pagination-status">
        <span className="pagination-label" data-testid="page-label">{`${page} / ${totalPages}`}</span>
        <span className="pagination-size" data-testid="page-size">{pageSizeLabel}</span>
      </span>
      <button
        type="button"
        className="pagination-button pagination-next"
        data-testid="pagination-next"
        disabled={totalPages < 1 || page >= totalPages}
        onClick={onNext}
      >
        {nextLabel}
      </button>
    </div>
  );
}
