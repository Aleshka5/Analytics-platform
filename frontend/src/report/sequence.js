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

const LANG_ONLY = new Set(["preview", "columns", "shape", "dtypes", "missing", "summary"]);

export function initialCards() {
  return SECTION_ORDER.map((name) => ({
    name,
    phase: "pending",
    body: null,
    message: null,
  }));
}

function isSet(value) {
  return typeof value === "string" && value !== "";
}

export function paramsFor(section, options = {}) {
  const { lang, metric, category, dateColumn } = options;
  const params = {};
  if (isSet(lang)) {
    params.lang = lang;
  }
  if (LANG_ONLY.has(section)) {
    return params;
  }
  if (section === "ranking" && isSet(metric)) {
    params.metric = metric;
  }
  if (section === "grouping") {
    if (isSet(category)) {
      params.category = category;
    }
    if (isSet(metric)) {
      params.metric = metric;
    }
  }
  if (section === "timeseries") {
    if (isSet(dateColumn)) {
      params.dateColumn = dateColumn;
    }
    if (isSet(metric)) {
      params.metric = metric;
    }
  }
  if (section === "insights" && isSet(dateColumn)) {
    params.dateColumn = dateColumn;
  }
  return params;
}

export function selectorsFromColumns(body) {
  const empty = {
    metric: null,
    category: null,
    dateColumn: null,
    metrics: [],
    categories: [],
    dates: [],
  };
  if (!body || body.status !== "ok" || !body.data) {
    return empty;
  }
  const columns = Array.isArray(body.data.columns) ? body.data.columns : [];
  const suggestions = body.data.suggestions ?? {};
  return {
    metric: suggestions.metric ?? null,
    category: suggestions.category ?? null,
    dateColumn: suggestions.datetime ?? null,
    metrics: columnNames(columns, (role) => role === "metric"),
    categories: columnNames(columns, (role) => role === "category" || role === "text"),
    dates: columnNames(columns, (role) => role === "datetime"),
  };
}

function columnNames(columns, matches) {
  return columns.filter((column) => matches(column.role)).map((column) => column.name);
}

function outcomeFromBody(body) {
  if (body && body.status === "ok") {
    return { phase: "ok", body, message: null };
  }
  if (body && body.status === "unavailable") {
    return {
      phase: "unavailable",
      body,
      message: body.error?.message || "",
    };
  }
  return {
    phase: "error",
    body: null,
    message: body?.error?.message || "",
  };
}

function outcomeFromError(error) {
  return {
    phase: "error",
    body: null,
    message: error?.message || "",
  };
}

function withCard(cards, name, update) {
  return cards.map((card) => (card.name === name ? update(card) : card));
}

export async function runSequence({
  getSection,
  lang,
  getSelectors,
  onUpdate,
  shouldContinue = () => true,
}) {
  let cards = initialCards();

  for (const section of SECTION_ORDER) {
    if (!shouldContinue()) {
      return cards;
    }

    cards = withCard(cards, section, (card) => ({ ...card, phase: "loading" }));
    onUpdate(cards);

    const selectors = getSelectors();
    let outcome;
    try {
      const body = await getSection(section, paramsFor(section, { lang, ...selectors }));
      outcome = outcomeFromBody(body);
    } catch (error) {
      outcome = outcomeFromError(error);
    }

    if (!shouldContinue()) {
      return cards;
    }

    cards = withCard(cards, section, (card) => ({ ...card, ...outcome }));
    onUpdate(cards);
  }

  return cards;
}

export async function loadOne({ getSection, section, lang, selectors = {} }) {
  try {
    const body = await getSection(section, paramsFor(section, { lang, ...selectors }));
    return { name: section, ...outcomeFromBody(body) };
  } catch (error) {
    return { name: section, ...outcomeFromError(error) };
  }
}
