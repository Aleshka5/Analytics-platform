import { useRef, useState } from "react";
import { validateFile } from "../upload/validateFile";
import "./UploadZone.css";

export default function UploadZone({
  collapsed,
  actionLabel,
  replaceLabel,
  title,
  hint,
  replaceHint,
  messages,
  onAccepted,
  busy = false,
  serverMessage = null,
}) {
  const inputRef = useRef(null);
  const [errorCode, setErrorCode] = useState(null);
  const [dragging, setDragging] = useState(false);
  // dragenter and dragleave also fire for children, so count the nesting depth.
  const dragDepthRef = useRef(0);

  function handleFiles(fileList) {
    if (busy) {
      return;
    }

    const file = fileList && fileList.length > 0 ? fileList[0] : null;
    if (!file) {
      return;
    }

    const result = validateFile(file);
    if (!result.ok) {
      setErrorCode(result.code);
      return;
    }

    setErrorCode(null);
    onAccepted(file);
  }

  function handleInputChange(event) {
    handleFiles(event.target.files);
    // Clear so choosing the same file again fires another change event.
    event.target.value = "";
  }

  function handleDragEnter(event) {
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragging(true);
  }

  function handleDragLeave() {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragging(false);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  function handleDrop(event) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  function openPicker() {
    inputRef.current.click();
  }

  const alertText = errorCode ? messages[errorCode] : serverMessage;

  return (
    <div
      className="upload-zone"
      data-testid="upload-zone"
      data-collapsed={collapsed ? "true" : "false"}
      data-dragging={dragging ? "true" : "false"}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="upload-zone-drop">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.xlsx,.xls,.json,.parquet"
          hidden
          onChange={handleInputChange}
        />
        {collapsed ? null : (
          <>
            <span className="upload-zone-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 16V4m0 0L7 9m5-5l5 5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {title ? <p className="upload-zone-title">{title}</p> : null}
            {hint ? <p className="upload-zone-hint">{hint}</p> : null}
          </>
        )}
        <div className="upload-zone-actions">
          <button
            type="button"
            className={collapsed ? "btn" : "btn btn-primary upload-zone-button"}
            data-testid="upload-button"
            onClick={openPicker}
            disabled={busy}
          >
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {collapsed ? replaceLabel : actionLabel}
          </button>
          {collapsed && replaceHint ? <span className="upload-zone-hint">{replaceHint}</span> : null}
        </div>
        {alertText ? (
          <p className="upload-zone-error" role="alert">
            {alertText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
