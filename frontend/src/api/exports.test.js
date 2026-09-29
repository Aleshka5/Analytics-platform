import { expect, test } from "vitest";
import { ApiError } from "./datasets";
import { downloadReport, downloadRows, filenameFromDisposition } from "./exports";

function fileResponse(disposition) {
  return new Response(new Blob(["file"]), {
    status: 200,
    headers: { "Content-Disposition": disposition },
  });
}

test("downloadReport GETs format and lang and reads the attachment filename", async () => {
  const disposition = 'attachment; filename="sales.xlsx"';
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return fileResponse(disposition);
  };

  const filename = await downloadReport("id-1", {
    format: "xlsx",
    lang: "en",
    fetchImpl,
  });

  expect(captured.url).toBe("/api/v1/datasets/id-1/report?format=xlsx&lang=en");
  expect(captured.options.method).toBe("GET");
  expect(filenameFromDisposition(disposition)).toBe("sales.xlsx");
  expect(filename).toBe("sales.xlsx");
});

test("downloadRows posts the applied query and omits page", async () => {
  const body = {
    filter: { column: "Region", op: "eq", value: "UAE" },
    sort: [{ column: "PnL", direction: "desc" }],
    group: { mode: "aggregate", columns: ["Region"] },
    page: 2,
  };
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return fileResponse('attachment; filename="rows.csv"');
  };

  await downloadRows("id-1", body, { format: "csv", lang: "ru", fetchImpl });

  expect(captured.url).toBe(
    "/api/v1/datasets/id-1/rows/export?format=csv&lang=ru",
  );
  expect(captured.options.method).toBe("POST");
  expect(captured.options.headers).toEqual({
    "Content-Type": "application/json",
  });
  const sent = JSON.parse(captured.options.body);
  expect(sent).toEqual({
    filter: body.filter,
    sort: body.sort,
    group: body.group,
  });
  expect(sent).not.toHaveProperty("page");
});

test("422 unsupported_export_format rejects with ApiError", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "unsupported_export_format",
          message: "This export format is not supported.",
        },
      }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      },
    );

  const attempt = downloadReport("id-1", { format: "zip", lang: "en", fetchImpl });

  await expect(attempt).rejects.toBeInstanceOf(ApiError);
  await expect(attempt).rejects.toMatchObject({
    status: 422,
    code: "unsupported_export_format",
    message: "This export format is not supported.",
  });
});

test("filename star parameter wins over the plain filename", () => {
  const header =
    "attachment; filename=\"plain.pdf\"; filename*=UTF-8''report%20ru.pdf";

  expect(filenameFromDisposition(header)).toBe("report ru.pdf");
});
