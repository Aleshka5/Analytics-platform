import { expect, test } from "vitest";
import { ApiError } from "./datasets";
import { fetchRows } from "./rows";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("fetchRows sends POST JSON and returns the parsed page", async () => {
  const page = {
    page: 1,
    page_size: 100,
    total_rows: 1,
    total_pages: 1,
    columns: ["Region", "PnL"],
    group: null,
    rows: [{ Region: "UAE", PnL: 10 }],
    spans: [],
  };
  const body = {
    filter: null,
    sort: null,
    group: null,
    page: 1,
  };
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return jsonResponse(page);
  };

  const result = await fetchRows("id-1", body, { fetchImpl });

  expect(captured.url).toBe("/api/v1/datasets/id-1/rows");
  expect(captured.options.method).toBe("POST");
  expect(captured.options.headers).toEqual({
    "Content-Type": "application/json",
  });
  expect(JSON.parse(captured.options.body)).toEqual(body);
  expect(result).toEqual(page);
});

test("fetchRows appends lang when it is a non-empty string", async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = url;
    return jsonResponse({ page: 1, rows: [] }, 200);
  };

  await fetchRows("id-1", { page: 1 }, { lang: "ru", fetchImpl });

  expect(captured).toBe("/api/v1/datasets/id-1/rows?lang=ru");
});

test("422 invalid_filter throws ApiError with the server message", async () => {
  const fetchImpl = async () =>
    jsonResponse(
      {
        error: {
          code: "invalid_filter",
          message: "Condition 0 is not valid.",
        },
      },
      422,
    );

  const attempt = fetchRows("id-1", { page: 1 }, { fetchImpl });

  await expect(attempt).rejects.toBeInstanceOf(ApiError);
  await expect(attempt).rejects.toMatchObject({
    status: 422,
    code: "invalid_filter",
    message: "Condition 0 is not valid.",
  });
});
