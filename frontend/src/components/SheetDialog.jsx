import { useState } from "react";
import "./SheetDialog.css";

export default function SheetDialog({
  sheets,
  title,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) {
  const [selected, setSelected] = useState("");

  function handleConfirm() {
    if (!selected) {
      return;
    }
    onConfirm(selected);
  }

  return (
    <div
      className="sheet-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-dialog-title"
      data-testid="sheet-dialog"
    >
      <h2 id="sheet-dialog-title" className="sheet-dialog-title">
        {title}
      </h2>
      <div className="sheet-dialog-list">
        {sheets.map((name) => (
          <label key={name} className="sheet-dialog-option">
            <input
              type="radio"
              name="sheet"
              value={name}
              checked={selected === name}
              onChange={() => setSelected(name)}
            />
            {name}
          </label>
        ))}
      </div>
      <div className="sheet-dialog-actions">
        <button
          type="button"
          className="sheet-dialog-confirm"
          disabled={!selected}
          onClick={handleConfirm}
        >
          {confirmLabel}
        </button>
        <button type="button" className="sheet-dialog-cancel" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
