import { ApiError } from "./datasets.js";

const API_BASE = "/api/v1";

function isOmitted(value) {
  return value === null || value === undefined || value === "";
}

function queryString(entries) {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (!isOmitted(value)) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function stripQuotes(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

export function filenameFromDisposition(header) {
  if (typeof header !== "string" || header === "") {
    return null;
  }

  const extended = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (extended) {
    const raw = stripQuotes(extended[1].trim());
    const match = /^[^']*'[^']*'(.*)$/.exec(raw);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }

  const plain = /filename\s*=\s*([^;]+)/i.exec(header);
  if (plain) {
    return stripQuotes(plain[1].trim());
  }
  return null;
}

async function throwApiError(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const error = payload && payload.error;
  if (
    error &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  ) {
    throw new ApiError(response.status, error.code, error.message);
  }

  throw new ApiError(
    response.status,
    "internal_error",
    response.statusText || "Request failed",
  );
}

function triggerDownload(blob, filename) {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function readDownload(response, format) {
  if (!response.ok) {
    await throwApiError(response);
  }
  const blob = await response.blob();
  const filename =
    filenameFromDisposition(response.headers.get("Content-Disposition")) ||
    `export.${format}`;
  triggerDownload(blob, filename);
  return filename;
}

export async function downloadReport(
  datasetId,
  { format, lang, fetchImpl = fetch } = {},
) {
  const query = queryString([
    ["format", format],
    ["lang", lang],
  ]);
  const response = await fetchImpl(
    `${API_BASE}/datasets/${datasetId}/report${query}`,
    { method: "GET" },
  );
  return readDownload(response, format);
}

export async function downloadRows(
  datasetId,
  body,
  { format, lang, fetchImpl = fetch } = {},
) {
  const query = queryString([
    ["format", format],
    ["lang", lang],
  ]);
  const payload = { ...body };
  delete payload.page;
  const response = await fetchImpl(
    `${API_BASE}/datasets/${datasetId}/rows/export${query}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return readDownload(response, format);
}
