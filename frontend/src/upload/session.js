function activeId(previousId) {
  return previousId || null;
}

function shouldDeletePrevious(previousId, nextId) {
  return typeof previousId === "string" && previousId.length > 0 && previousId !== nextId;
}

export async function uploadFile({ file, previousId, api }) {
  let result;
  try {
    result = await api.uploadDataset(file);
  } catch (error) {
    return { ok: false, message: error.message, datasetId: activeId(previousId) };
  }

  if (result?.status === "ready") {
    if (shouldDeletePrevious(previousId, result.dataset_id)) {
      try {
        await api.deleteDataset(previousId);
      } catch (error) {
        return {
          ok: false,
          message: error.message,
          datasetId: activeId(previousId),
          orphanDatasetId: result.dataset_id,
        };
      }
    }
    return { ok: true, status: "ready", datasetId: result.dataset_id };
  }

  if (result?.status === "sheet_required") {
    return {
      ok: true,
      status: "sheet_required",
      datasetId: result.dataset_id,
      sheets: result.sheets || [],
      previousId: activeId(previousId),
    };
  }

  return {
    ok: false,
    message: "Unexpected upload status",
    datasetId: activeId(previousId),
  };
}

export async function confirmSheet({ datasetId, sheet, previousId, api }) {
  let result;
  try {
    result = await api.selectSheet(datasetId, sheet);
  } catch (error) {
    return { ok: false, message: error.message, datasetId: activeId(previousId) };
  }

  if (result?.status !== "ready") {
    return {
      ok: false,
      message: "Unexpected sheet status",
      datasetId: activeId(previousId),
    };
  }

  if (shouldDeletePrevious(previousId, datasetId)) {
    try {
      await api.deleteDataset(previousId);
    } catch (error) {
      return {
        ok: false,
        message: error.message,
        datasetId: previousId,
        orphanDatasetId: datasetId,
      };
    }
  }

  return { ok: true, status: "ready", datasetId };
}

export async function cancelSheet({ datasetId, previousId, api }) {
  try {
    await api.deleteDataset(datasetId);
  } catch (error) {
    return { ok: false, message: error.message, datasetId: activeId(previousId) };
  }

  return { ok: true, datasetId: activeId(previousId) };
}
