import { useEffect } from "react";
import "./FormatDialog.css";

export default function FormatDialog({
  formats,
  errorMessage,
  title = "Export",
  dismissLabel = "Close",
  onConfirm,
  onDismiss,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      onDismiss();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onDismiss]);

  function handlePanelClick(event) {
    event.stopPropagation();
  }

  const showError = typeof errorMessage === "string" && errorMessage !== "";

  return (
    <div
      className="format-scrim"
      data-testid="format-scrim"
      onClick={onDismiss}
    >
      <div
        className="format-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="format-dialog-title"
        data-testid="format-dialog"
        onClick={handlePanelClick}
      >
        <h2 id="format-dialog-title" className="format-dialog-title">
          {title}
        </h2>
        {showError ? (
          <p className="format-error" data-testid="format-error">
            {errorMessage}
          </p>
        ) : null}
        <div className="format-dialog-formats">
          {formats.map((format) => (
            <button
              key={format.id}
              type="button"
              className="format-dialog-button"
              data-testid={`format-${format.id}`}
              onClick={() => onConfirm(format.id)}
            >
              {format.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="format-dialog-dismiss"
          data-testid="format-dismiss"
          onClick={onDismiss}
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}
