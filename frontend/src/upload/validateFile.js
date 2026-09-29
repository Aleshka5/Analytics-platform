export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [
  ".csv",
  ".tsv",
  ".xlsx",
  ".xls",
  ".json",
  ".parquet",
];

export function validateFile(file) {
  const name = file.name || "";
  const dotIndex = name.lastIndexOf(".");
  const extension = dotIndex === -1 ? "" : name.slice(dotIndex).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { ok: false, code: "unsupported_format" };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, code: "file_too_large" };
  }

  return { ok: true };
}
