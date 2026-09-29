const API_BASE = "/api/v1";

export const SECTION_ORDER = [
  "preview",
  "columns",
  "shape",
  "dtypes",
  "missing",
  "summary",
  "ranking",
  "grouping",
  "timeseries",
  "insights",
];

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

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

async function send(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  if (!response.ok) {
    await throwApiError(response);
  }
  return response;
}

function urlWithLang(path, lang) {
  return isOmitted(lang) ? path : `${path}?lang=${encodeURIComponent(lang)}`;
}

export async function uploadDataset(file, { lang, fetchImpl = fetch } = {}) {
  const body = new FormData();
  body.append("file", file);
  const response = await send(fetchImpl, urlWithLang(`${API_BASE}/datasets`, lang), {
    method: "POST",
    body,
  });
  return response.json();
}

export async function selectSheet(datasetId, sheet, { lang, fetchImpl = fetch } = {}) {
  const response = await send(
    fetchImpl,
    urlWithLang(`${API_BASE}/datasets/${datasetId}/sheet`, lang),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheet }),
    },
  );
  return response.json();
}

export async function deleteDataset(datasetId, { lang, fetchImpl = fetch } = {}) {
  await send(fetchImpl, urlWithLang(`${API_BASE}/datasets/${datasetId}`, lang), {
    method: "DELETE",
  });
}

export async function fetchSection(
  datasetId,
  section,
  { lang, metric, category, dateColumn, fetchImpl = fetch } = {},
) {
  const query = queryString([
    ["lang", lang],
    ["metric", metric],
    ["category", category],
    ["date_column", dateColumn],
  ]);
  const response = await send(
    fetchImpl,
    `${API_BASE}/datasets/${datasetId}/${section}${query}`,
  );
  return response.json();
}
