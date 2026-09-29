import { expect, test } from "vitest";
import { MAX_UPLOAD_BYTES, validateFile } from "./validateFile";

function fileWithSize(name, size) {
  const file = new File(["x"], name, { type: "text/csv" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

test("accepts a small .csv, .TSV, and .XLSX file", () => {
  expect(validateFile(new File(["x"], "notes.csv", { type: "text/csv" }))).toEqual({
    ok: true,
  });
  expect(validateFile(new File(["x"], "notes.TSV", { type: "text/csv" }))).toEqual({
    ok: true,
  });
  expect(validateFile(new File(["x"], "notes.XLSX", { type: "text/csv" }))).toEqual({
    ok: true,
  });
});

test("rejects .png as an unsupported format", () => {
  expect(validateFile(new File(["x"], "notes.png", { type: "image/png" }))).toEqual({
    ok: false,
    code: "unsupported_format",
  });
});

test("rejects a huge .png for its extension before size", () => {
  const file = fileWithSize("huge.png", MAX_UPLOAD_BYTES + 1);
  expect(validateFile(file)).toEqual({
    ok: false,
    code: "unsupported_format",
  });
});

test("rejects a csv one byte over the limit", () => {
  const file = fileWithSize("notes.csv", MAX_UPLOAD_BYTES + 1);
  expect(validateFile(file)).toEqual({
    ok: false,
    code: "file_too_large",
  });
});

test("accepts a csv of exactly the limit", () => {
  const file = fileWithSize("notes.csv", MAX_UPLOAD_BYTES);
  expect(validateFile(file)).toEqual({ ok: true });
});

test("rejects a file with no extension", () => {
  expect(validateFile(new File(["x"], "notes", { type: "text/csv" }))).toEqual({
    ok: false,
    code: "unsupported_format",
  });
});
