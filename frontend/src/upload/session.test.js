import { expect, test } from "vitest";
import { cancelSheet, confirmSheet, uploadFile } from "./session";

function createApi(handlers = {}) {
  const calls = [];
  return {
    calls,
    async uploadDataset(file) {
      calls.push({ method: "uploadDataset", args: [file] });
      return handlers.uploadDataset(file);
    },
    async selectSheet(datasetId, sheet) {
      calls.push({ method: "selectSheet", args: [datasetId, sheet] });
      return handlers.selectSheet(datasetId, sheet);
    },
    async deleteDataset(id) {
      calls.push({ method: "deleteDataset", args: [id] });
      if (handlers.deleteDataset) {
        return handlers.deleteDataset(id);
      }
    },
  };
}

test("ready upload with no previous id does not delete and returns the new id", async () => {
  const file = { name: "notes.csv" };
  const api = createApi({
    uploadDataset: async () => ({ status: "ready", dataset_id: "new-id" }),
  });

  const outcome = await uploadFile({ file, api });

  expect(outcome).toEqual({ ok: true, status: "ready", datasetId: "new-id" });
  expect(api.calls).toEqual([{ method: "uploadDataset", args: [file] }]);
});

test("ready upload deletes only the previous id after upload and returns the new id", async () => {
  const file = { name: "notes.csv" };
  const api = createApi({
    uploadDataset: async () => ({ status: "ready", dataset_id: "new-id" }),
  });

  const outcome = await uploadFile({ file, previousId: "old-id", api });

  expect(outcome).toEqual({ ok: true, status: "ready", datasetId: "new-id" });
  expect(api.calls).toEqual([
    { method: "uploadDataset", args: [file] },
    { method: "deleteDataset", args: ["old-id"] },
  ]);
});

test("uploadDataset rejection does not delete and keeps previousId", async () => {
  const file = { name: "notes.csv" };
  const api = createApi({
    uploadDataset: async () => {
      throw new Error("upload failed");
    },
  });

  const outcome = await uploadFile({ file, previousId: "old-id", api });

  expect(outcome).toEqual({
    ok: false,
    message: "upload failed",
    datasetId: "old-id",
  });
  expect(api.calls).toEqual([{ method: "uploadDataset", args: [file] }]);
});

test("sheet_required does not delete and returns sheets plus previousId", async () => {
  const file = { name: "book.xlsx" };
  const api = createApi({
    uploadDataset: async () => ({
      status: "sheet_required",
      dataset_id: "new-id",
      sheets: ["Sales", "Costs"],
    }),
  });

  const outcome = await uploadFile({ file, previousId: "old-id", api });

  expect(outcome).toEqual({
    ok: true,
    status: "sheet_required",
    datasetId: "new-id",
    sheets: ["Sales", "Costs"],
    previousId: "old-id",
  });
  expect(api.calls).toEqual([{ method: "uploadDataset", args: [file] }]);
});

test("confirmSheet selects the sheet then deletes the previous id", async () => {
  const api = createApi({
    selectSheet: async () => ({ status: "ready" }),
  });

  const outcome = await confirmSheet({
    datasetId: "new-id",
    sheet: "Sales",
    previousId: "old-id",
    api,
  });

  expect(outcome).toEqual({ ok: true, status: "ready", datasetId: "new-id" });
  expect(api.calls).toEqual([
    { method: "selectSheet", args: ["new-id", "Sales"] },
    { method: "deleteDataset", args: ["old-id"] },
  ]);
});

test("confirmSheet rejection does not delete and keeps previousId", async () => {
  const api = createApi({
    selectSheet: async () => {
      throw new Error("sheet failed");
    },
  });

  const outcome = await confirmSheet({
    datasetId: "new-id",
    sheet: "Sales",
    previousId: "old-id",
    api,
  });

  expect(outcome).toEqual({
    ok: false,
    message: "sheet failed",
    datasetId: "old-id",
  });
  expect(api.calls).toEqual([{ method: "selectSheet", args: ["new-id", "Sales"] }]);
});

test("cancelSheet deletes only the new id and returns the previous id", async () => {
  const api = createApi();

  const outcome = await cancelSheet({
    datasetId: "new-id",
    previousId: "old-id",
    api,
  });

  expect(outcome).toEqual({ ok: true, datasetId: "old-id" });
  expect(api.calls).toEqual([{ method: "deleteDataset", args: ["new-id"] }]);
});
