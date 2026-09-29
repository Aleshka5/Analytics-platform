import { useRef, useState } from "react";
import { validateFile } from "../upload/validateFile";
import "./UploadZone.css";

export default function UploadZone({
  collapsed,
  actionLabel,
  replaceLabel,
  messages,
  onAccepted,
}) {
  const inputRef = useRef(null);
  const [errorCode, setErrorCode] = useState(null);

  function handleFiles(fileList) {
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

  function handleDragOver(event) {
    event.preventDefault();
  }

  function handleDrop(event) {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  }

  function openPicker() {
    inputRef.current.click();
  }

  return (
    <div
      className="upload-zone"
      data-testid="upload-zone"
      data-collapsed={collapsed ? "true" : "false"}
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
        <button type="button" data-testid="upload-button" onClick={openPicker}>
          {collapsed ? replaceLabel : actionLabel}
        </button>
        {errorCode ? (
          <p className="upload-zone-error" role="alert">
            {messages[errorCode]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
