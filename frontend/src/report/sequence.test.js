import { expect, test } from "vitest";
import {
  SECTION_ORDER,
  initialCards,
  loadOne,
  paramsFor,
  runSequence,
  selectorsFromColumns,
} from "./sequence";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("initialCards lists every section as pending", () => {
  expect(initialCards()).toEqual(
    SECTION_ORDER.map((name) => ({
      name,
      phase: "pending",
      body: null,
      message: null,
    })),
  );
});

test("paramsFor omits empty values and uses dateColumn", () => {
  const blank = { lang: "", metric: "", category: null, dateColumn: undefined };

  expect(paramsFor("preview", { lang: "en", metric: "PnL", dateColumn: "Transaction_Date" })).toEqual({
    lang: "en",
  });
  expect(paramsFor("summary", blank)).toEqual({});
  expect(paramsFor("ranking", { lang: "ru", metric: "PnL", category: "" })).toEqual({
    lang: "ru",
    metric: "PnL",
  });
  expect(paramsFor("ranking", { metric: "" })).toEqual({});
  expect(
    paramsFor("grouping", {
      lang: "en",
      category: "Region",
      metric: "Quantity",
      dateColumn: "Transaction_Date",
    }),
  ).toEqual({
    lang: "en",
    category: "Region",
    metric: "Quantity",
  });
  expect(paramsFor("grouping", { lang: "en", category: "", metric: null })).toEqual({ lang: "en" });
  expect(
    paramsFor("timeseries", {
      lang: "en",
      dateColumn: "Transaction_Date",
      metric: "Quantity",
    }),
  ).toEqual({
    lang: "en",
    dateColumn: "Transaction_Date",
    metric: "Quantity",
  });
  expect(paramsFor("timeseries", blank)).toEqual({});
  expect(paramsFor("timeseries", { dateColumn: "Transaction_Date", metric: "" }).date_column).toBeUndefined();
  expect(paramsFor("insights", { lang: "en", dateColumn: "Transaction_Date", metric: "PnL" })).toEqual({
    lang: "en",
    dateColumn: "Transaction_Date",
  });
  expect(paramsFor("insights", { dateColumn: "" })).toEqual({});
});

test("selectorsFromColumns maps suggestions and column roles", () => {
  const selectors = selectorsFromColumns({
    status: "ok",
    data: {
      columns: [
        { name: "Transaction_Date", role: "datetime" },
        { name: "Client_ID", role: "text" },
        { name: "Region", role: "category" },
        { name: "Asset", role: "category" },
        { name: "Quantity", role: "metric" },
        { name: "PnL", role: "metric" },
      ],
      suggestions: {
        metric: "Quantity",
        category: "Region",
        datetime: "Transaction_Date",
      },
    },
  });

  expect(selectors).toEqual({
    metric: "Quantity",
    category: "Region",
    dateColumn: "Transaction_Date",
    metrics: ["Quantity", "PnL"],
    categories: ["Client_ID", "Region", "Asset"],
    dates: ["Transaction_Date"],
  });
});

test("selectorsFromColumns returns empty selectors when the body is not ok", () => {
  const empty = {
    metric: null,
    category: null,
    dateColumn: null,
    metrics: [],
    categories: [],
    dates: [],
  };
  expect(selectorsFromColumns(null)).toEqual(empty);
  expect(selectorsFromColumns(undefined)).toEqual(empty);
  expect(selectorsFromColumns({ status: "unavailable", data: { columns: [] } })).toEqual(empty);
});

test("runSequence calls sections strictly one after another", async () => {
  const requested = [];
  const gates = new Map();
  const updates = [];

  const finished = runSequence({
    getSection(name) {
      requested.push(name);
      const gate = deferred();
      gates.set(name, gate);
      return gate.promise;
    },
    lang: "en",
    getSelectors: () => ({}),
    onUpdate(cards) {
      updates.push(cards);
    },
  });

  expect(requested).toEqual(["preview"]);

  for (let index = 0; index < SECTION_ORDER.length; index += 1) {
    const name = SECTION_ORDER[index];
    const next = SECTION_ORDER[index + 1];
    expect(requested).toEqual(SECTION_ORDER.slice(0, index + 1));

    const loading = updates.at(-1);
    expect(loading[index]).toMatchObject({ name, phase: "loading" });
    expect(loading.slice(index + 1).every((card) => card.phase === "pending")).toBe(true);

    const updateCount = updates.length;
    gates.get(name).resolve({ status: "ok", data: { name } });
    await gates.get(name).promise;

    const settled = updates[updateCount];
    expect(settled).not.toBe(loading);
    expect(loading[index].phase).toBe("loading");
    expect(settled[index]).toMatchObject({
      name,
      phase: "ok",
      message: null,
      body: { status: "ok", data: { name } },
    });
    expect(settled.slice(index + 1).every((card) => card.phase === "pending")).toBe(true);

    if (next) {
      expect(requested).toEqual(SECTION_ORDER.slice(0, index + 2));
      expect(requested).not.toContain(SECTION_ORDER[index + 2]);
      expect(updates.at(-1)[index + 1].phase).toBe("loading");
      expect(updates.at(-1).slice(index + 2).every((card) => card.phase === "pending")).toBe(true);
    }
  }

  const cards = await finished;
  expect(cards.every((card) => card.phase === "ok")).toBe(true);
  expect(requested).toEqual(SECTION_ORDER);
});

test("unavailable timeseries still requests insights and keeps summary ok", async () => {
  const requested = [];
  const gates = new Map();

  const finished = runSequence({
    getSection(name) {
      requested.push(name);
      const gate = deferred();
      gates.set(name, gate);
      return gate.promise;
    },
    lang: "en",
    getSelectors: () => ({ metric: "Quantity", category: "Region", dateColumn: null }),
    onUpdate() {},
  });

  for (const name of SECTION_ORDER) {
    const next = SECTION_ORDER[SECTION_ORDER.indexOf(name) + 1];
    expect(requested.at(-1)).toBe(name);
    if (next) {
      expect(requested).not.toContain(next);
    }
    const body =
      name === "timeseries"
        ? {
            status: "unavailable",
            error: {
              code: "no_datetime_column",
              message: "There is no date column for this block.",
            },
          }
        : { status: "ok", data: {} };
    gates.get(name).resolve(body);
    await gates.get(name).promise;
  }

  const cards = await finished;
  expect(requested).toEqual(SECTION_ORDER);
  expect(cards.find((card) => card.name === "summary").phase).toBe("ok");
  expect(cards.find((card) => card.name === "timeseries")).toMatchObject({
    phase: "unavailable",
    message: "There is no date column for this block.",
  });
  expect(cards.find((card) => card.name === "timeseries").body.status).toBe("unavailable");
  expect(cards.find((card) => card.name === "insights").phase).toBe("ok");
});

test("a thrown section stores phase error and the next section still runs", async () => {
  const requested = [];
  const gates = new Map();

  const finished = runSequence({
    getSection(name) {
      requested.push(name);
      const gate = deferred();
      gates.set(name, gate);
      return gate.promise;
    },
    lang: "en",
    getSelectors: () => ({}),
    onUpdate() {},
  });

  for (const name of SECTION_ORDER) {
    expect(requested).toEqual(SECTION_ORDER.slice(0, SECTION_ORDER.indexOf(name) + 1));
    if (name === "shape") {
      gates.get(name).reject(new Error("shape failed"));
    } else {
      gates.get(name).resolve({ status: "ok", data: {} });
    }
    await gates.get(name).promise.catch(() => {});
  }

  const cards = await finished;
  expect(cards.find((card) => card.name === "shape")).toMatchObject({
    phase: "error",
    body: null,
    message: "shape failed",
  });
  expect(cards.find((card) => card.name === "dtypes").phase).toBe("ok");
  expect(requested).toEqual(SECTION_ORDER);
});

test("shouldContinue false before a section prevents that request", async () => {
  const requested = [];
  const updates = [];
  let stop = false;

  const blockedAtStart = await runSequence({
    getSection(name) {
      requested.push(name);
      return Promise.resolve({ status: "ok" });
    },
    getSelectors: () => ({}),
    onUpdate(cards) {
      updates.push(cards);
    },
    shouldContinue: () => false,
  });

  expect(requested).toEqual([]);
  expect(updates).toEqual([]);
  expect(blockedAtStart.every((card) => card.phase === "pending")).toBe(true);

  const stoppedCards = await runSequence({
    async getSection(name) {
      requested.push(name);
      return { status: "ok", data: {} };
    },
    lang: "en",
    getSelectors: () => ({}),
    onUpdate(cards) {
      updates.push(cards);
      if (cards.find((card) => card.name === "preview" && card.phase === "ok")) {
        stop = true;
      }
    },
    shouldContinue: () => !stop,
  });

  expect(requested).toEqual(["preview"]);
  expect(stoppedCards.find((card) => card.name === "preview").phase).toBe("ok");
  expect(stoppedCards.find((card) => card.name === "columns").phase).toBe("pending");
  expect(updates.at(-1).find((card) => card.name === "columns").phase).toBe("pending");
});

test("loadOne requests only the named section", async () => {
  const calls = [];
  const card = await loadOne({
    section: "ranking",
    lang: "en",
    selectors: { metric: "PnL", category: "Region", dateColumn: "Transaction_Date" },
    getSection: async (name, params) => {
      calls.push({ name, params });
      return { status: "ok", data: { metric: "PnL" } };
    },
  });

  expect(calls).toEqual([{ name: "ranking", params: { lang: "en", metric: "PnL" } }]);
  expect(calls.map((call) => call.name)).not.toContain("insights");
  expect(card).toEqual({
    name: "ranking",
    phase: "ok",
    body: { status: "ok", data: { metric: "PnL" } },
    message: null,
  });
});
