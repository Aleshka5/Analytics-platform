import { expect, test } from "vitest";
import {
  ApiError,
  deleteDataset,
  fetchSection,
  selectSheet,
  uploadDataset,
} from "./datasets";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("upload sends POST multipart and returns a ready JSON body", async () => {
  const file = new File(["a,b\n1,2"], "notes.csv", { type: "text/csv" });
  const ready = {
    dataset_id: "id-1",
    filename: "notes.csv",
    status: "ready",
    sheet: null,
    sheets: [],
    size_bytes: 7,
    expires_at: "2026-09-29T16:14:00Z",
  };
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return jsonResponse(ready, 201);
  };

  const result = await uploadDataset(file, { fetchImpl });

  expect(captured.url).toBe("/api/v1/datasets");
  expect(captured.options.method).toBe("POST");
  expect(captured.options.body).toBeInstanceOf(FormData);
  expect(captured.options.body.get("file")).toBe(file);
  expect(captured.options.headers).toBeUndefined();
  expect(result).toEqual(ready);
});

test("upload of an error status throws ApiError with the server code and message", async () => {
  const fetchImpl = async () =>
    jsonResponse(
      {
        error: {
          code: "file_too_large",
          message: "The file is larger than 100 MB.",
        },
      },
      413,
    );

  await expect(
    uploadDataset(new File(["x"], "big.csv"), { fetchImpl }),
  ).rejects.toBeInstanceOf(ApiError);
  await expect(
    uploadDataset(new File(["x"], "big.csv"), { fetchImpl }),
  ).rejects.toMatchObject({
    status: 413,
    code: "file_too_large",
    message: "The file is larger than 100 MB.",
  });
});

test("upload, sheet, and delete send lang when the page has one", async () => {
  const fetchImpl = async (url) => {
    if (url.startsWith("/api/v1/datasets?") || url.includes("/sheet?")) {
      return jsonResponse({ dataset_id: "id-1", status: "ready", sheet: "Trades" }, url.includes("sheet") ? 200 : 201);
    }
    return new Response(null, { status: 204 });
  };
  const urls = [];
  const record = async (url, options) => {
    urls.push(url);
    return fetchImpl(url, options);
  };

  await uploadDataset(new File(["x"], "notes.csv"), { lang: "ru", fetchImpl: record });
  await selectSheet("id-1", "Trades", { lang: "ru", fetchImpl: record });
  await deleteDataset("id-1", { lang: "ru", fetchImpl: record });

  expect(urls).toEqual([
    "/api/v1/datasets?lang=ru",
    "/api/v1/datasets/id-1/sheet?lang=ru",
    "/api/v1/datasets/id-1?lang=ru",
  ]);
});

test("selectSheet sends PUT JSON", async () => {
  const ready = { dataset_id: "id-1", status: "ready", sheet: "Trades" };
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return jsonResponse(ready);
  };

  const result = await selectSheet("id-1", "Trades", { fetchImpl });

  expect(captured.url).toBe("/api/v1/datasets/id-1/sheet");
  expect(captured.options.method).toBe("PUT");
  expect(captured.options.headers).toEqual({
    "Content-Type": "application/json",
  });
  expect(JSON.parse(captured.options.body)).toEqual({ sheet: "Trades" });
  expect(result).toEqual(ready);
});

test("deleteDataset sends DELETE and accepts 204 with an empty body", async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return new Response(null, { status: 204 });
  };

  const result = await deleteDataset("id-1", { fetchImpl });

  expect(captured.url).toBe("/api/v1/datasets/id-1");
  expect(captured.options.method).toBe("DELETE");
  expect(result).toBeUndefined();
});

test("fetchSection builds lang, metric, category, and date_column, and returns a 200 unavailable body without throwing", async () => {
  const unavailable = {
    status: "unavailable",
    error: {
      code: "no_datetime_column",
      message: "There is no date column.",
    },
  };
  let captured;
  const fetchImpl = async (url) => {
    captured = url;
    return jsonResponse(unavailable, 200);
  };

  const result = await fetchSection("id-1", "timeseries", {
    lang: "en",
    metric: "Quantity",
    category: "Region",
    dateColumn: "Transaction_Date",
    fetchImpl,
  });

  const parsed = new URL(captured, "http://local.test");
  expect(parsed.pathname).toBe("/api/v1/datasets/id-1/timeseries");
  expect(parsed.searchParams.get("lang")).toBe("en");
  expect(parsed.searchParams.get("metric")).toBe("Quantity");
  expect(parsed.searchParams.get("category")).toBe("Region");
  expect(parsed.searchParams.get("date_column")).toBe("Transaction_Date");
  expect(result).toEqual(unavailable);
});

test("fetchSection omits empty params", async () => {
  let captured;
  const fetchImpl = async (url) => {
    captured = url;
    return jsonResponse({ status: "ok", data: {} });
  };

  await fetchSection("id-1", "ranking", {
    lang: "",
    metric: null,
    category: undefined,
    dateColumn: "",
    fetchImpl,
  });

  expect(captured).toBe("/api/v1/datasets/id-1/ranking");
});
