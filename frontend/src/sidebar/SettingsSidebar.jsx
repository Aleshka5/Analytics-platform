import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./SettingsSidebar.css";
import { CloseIcon } from "./icons.jsx";

export default function SettingsSidebar({ open, onOpen, onClose, children }) {
  const { t } = useTranslation();
  const tabRef = useRef(null);
  const wasOpenRef = useRef(open);
  const label = t("settings.open");

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      tabRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <>
      <button
        ref={tabRef}
        type="button"
        className="settings-tab"
        data-testid="settings-tab"
        aria-label={label}
        onClick={onOpen}
      >
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="9" cy="7" r="2.25" fill="#fff" stroke="currentColor" strokeWidth="1.75" />
          <circle cx="15" cy="12" r="2.25" fill="#fff" stroke="currentColor" strokeWidth="1.75" />
          <circle cx="11" cy="17" r="2.25" fill="#fff" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      </button>
      {open ? (
        <>
          <div
            className="settings-scrim"
            data-testid="settings-scrim"
            onClick={onClose}
          />
          <div
            className="settings-panel"
            data-testid="settings-panel"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-header">
              <h2>{label}</h2>
              <button
                type="button"
                className="settings-close"
                aria-label={t("table.close")}
                title={t("table.close")}
                onClick={onClose}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="settings-scroll" data-testid="settings-scroll">
              {children}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
