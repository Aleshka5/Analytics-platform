import { ApiError } from "./datasets.js";

const API_BASE = "/api/v1";

function urlWithLang(path, lang) {
  if (typeof lang !== "string" || lang === "") {
    return path;
  }
  return `${path}?lang=${encodeURIComponent(lang)}`;
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

export async function fetchRows(datasetId, body, { lang, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(urlWithLang(`${API_BASE}/datasets/${datasetId}/rows`, lang), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  return response.json();
}
