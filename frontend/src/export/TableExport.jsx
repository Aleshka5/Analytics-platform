import { useState } from "react";
import FormatDialog from "./FormatDialog.jsx";
import "./TableExport.css";

export default function TableExport({
  labels,
  errorMessage,
  busy,
  onExport,
  onDismiss,
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  function openDialog() {
    if (busy) {
      return;
    }
    setDialogOpen(true);
  }

  function handleConfirm(formatId) {
    const result = onExport(formatId);
    if (result != null && typeof result.then === "function") {
      result.then(
        () => {
          setDialogOpen(false);
        },
        () => {},
      );
      return;
    }
    setDialogOpen(false);
  }

  function handleDismiss() {
    setDialogOpen(false);
    if (onDismiss) {
      onDismiss();
    }
  }

  const formats = [
    { id: "xlsx", label: labels.excel },
    { id: "csv", label: labels.csv },
    { id: "json", label: labels.json },
  ];

  return (
    <>
      <button
        type="button"
        className="table-export"
        data-testid="table-export"
        disabled={busy}
        onClick={openDialog}
      >
        {labels.action}
      </button>
      {dialogOpen ? (
        <FormatDialog
          formats={formats}
          errorMessage={errorMessage}
          title={labels.action}
          dismissLabel={labels.close}
          onConfirm={handleConfirm}
          onDismiss={handleDismiss}
        />
      ) : null}
    </>
  );
}
