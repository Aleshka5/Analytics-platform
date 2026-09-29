function roleOf(columns, name) {
  if (!Array.isArray(columns)) {
    return undefined;
  }
  const column = columns.find((item) => item.name === name);
  return column ? column.role : undefined;
}

function coerceMetric(value) {
  if (typeof value === "boolean" || typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return value;
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : value;
}

function coerceValue(value, role) {
  if (Array.isArray(value)) {
    return value.map((item) => coerceValue(item, role));
  }
  if (role === "metric") {
    return coerceMetric(value);
  }
  return value;
}

function mapCondition(condition, columns) {
  const mapped = {
    column: condition.column,
    operator: condition.operator,
  };
  if (condition.operator === "empty" || condition.operator === "not_empty") {
    return mapped;
  }
  mapped.value = coerceValue(condition.value, roleOf(columns, condition.column));
  return mapped;
}

export function draftToQueryBody(draft, columns, page = 1) {
  return {
    filter:
      draft.conditions.length === 0
        ? null
        : {
            combinator: draft.combinator,
            conditions: draft.conditions.map((condition) => mapCondition(condition, columns)),
          },
    sort:
      draft.sorts.length === 0
        ? null
        : draft.sorts.map((sort) => ({
            column: sort.column,
            direction: sort.direction,
          })),
    group:
      draft.groupColumns.length === 0
        ? null
        : {
            mode: draft.groupMode,
            columns: [...draft.groupColumns],
          },
    page,
  };
}
