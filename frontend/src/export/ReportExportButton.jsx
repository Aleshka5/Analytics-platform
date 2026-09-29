import { useEffect, useRef, useState } from "react";
import FormatDialog from "./FormatDialog.jsx";
import "./ReportExportButton.css";

const HOLD_MS = 10_000;
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const ARC_LENGTH = 125.664;

function queryFinePointer() {
  if (typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(FINE_POINTER_QUERY);
}

function useFinePointer() {
  const [fine, setFine] = useState(() => {
    const media = queryFinePointer();
    return media ? media.matches : false;
  });

  useEffect(() => {
    const media = queryFinePointer();
    if (!media) {
      return undefined;
    }
    const onChange = () => setFine(media.matches);
    setFine(media.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    return undefined;
  }, []);

  return fine;
}

function PageIcon() {
  return (
    <svg
      className="report-export-icon"
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function CooldownArc() {
  return (
    <svg className="report-export-arc" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="20" strokeDasharray={ARC_LENGTH} />
    </svg>
  );
}

export default function ReportExportButton({
  settled,
  labels,
  errorMessage,
  onConfirm,
}) {
  const fine = useFinePointer();
  const coolingRef = useRef(false);
  const [intro, setIntro] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cooling, setCooling] = useState(false);

  useEffect(() => {
    if (!settled) {
      coolingRef.current = false;
      setCooling(false);
      setDialogOpen(false);
      setIntro(true);
      return undefined;
    }
    setIntro(true);
    const timer = window.setTimeout(() => setIntro(false), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [settled]);

  useEffect(() => {
    if (!cooling) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      coolingRef.current = false;
      setCooling(false);
    }, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [cooling]);

  if (!settled) {
    return null;
  }

  const hovering = !cooling && !intro && fine && hovered;
  const expanded = !cooling && (intro || hovering);
  const dataState = cooling ? "cooldown" : intro ? "pill" : "circle";

  function openDialog() {
    if (cooling) {
      return;
    }
    setDialogOpen(true);
  }

  function confirmFormat(formatId) {
    if (coolingRef.current) {
      return;
    }
    coolingRef.current = true;
    setCooling(true);
    const result = onConfirm(formatId);
    if (result != null && typeof result.then === "function") {
      result.then(
        () => setDialogOpen(false),
        () => {},
      );
      return;
    }
    setDialogOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={
          expanded
            ? "report-export report-export-pill"
            : "report-export report-export-circle"
        }
        data-testid="report-export"
        data-state={dataState}
        data-expanded={hovering ? "true" : undefined}
        aria-label={labels.action}
        disabled={cooling}
        onClick={openDialog}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {cooling ? <CooldownArc /> : null}
        <PageIcon />
        <span className="report-export-label" aria-hidden="true">
          {labels.action}
        </span>
      </button>
      {dialogOpen ? (
        <FormatDialog
          formats={[
            { id: "xlsx", label: labels.excel },
            { id: "pdf", label: labels.pdf },
          ]}
          errorMessage={errorMessage}
          title={labels.action}
          dismissLabel={labels.close}
          onConfirm={confirmFormat}
          onDismiss={() => setDialogOpen(false)}
        />
      ) : null}
    </>
  );
}
