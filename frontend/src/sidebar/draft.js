const OPERATOR_ORDER = [
  "eq",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "contains",
  "in",
  "empty",
  "not_empty",
];

const UNIVERSAL = new Set(["eq", "in", "empty", "not_empty"]);
const ORDERED = new Set(["gt", "gte", "lt", "lte", "between"]);

export function emptyDraft() {
  return {
    combinator: "and",
    conditions: [],
    sorts: [],
    groupColumns: [],
    groupMode: "rowspan",
  };
}

export function operatorsForRole(role) {
  return OPERATOR_ORDER.filter((operator) => {
    if (UNIVERSAL.has(operator)) {
      return true;
    }
    if (ORDERED.has(operator)) {
      return role === "metric" || role === "datetime";
    }
    return role === "text" || role === "category";
  });
}

function blankValue(operator) {
  if (operator === "empty" || operator === "not_empty") {
    return null;
  }
  if (operator === "between") {
    return ["", ""];
  }
  if (operator === "in") {
    return [];
  }
  return "";
}

function copyCondition(condition) {
  return {
    ...condition,
    value: Array.isArray(condition.value) ? [...condition.value] : condition.value,
  };
}

function copyDraft(draft, overrides = {}) {
  return {
    combinator: draft.combinator,
    conditions: draft.conditions.map(copyCondition),
    sorts: draft.sorts.map((sort) => ({ ...sort })),
    groupColumns: [...draft.groupColumns],
    groupMode: draft.groupMode,
    ...overrides,
  };
}

function hasColumns(columns) {
  return Array.isArray(columns) && columns.length > 0;
}

function roleOf(columns, name) {
  const column = hasColumns(columns) ? columns.find((item) => item.name === name) : undefined;
  return column ? column.role : undefined;
}

export function addCondition(draft, columns) {
  if (!hasColumns(columns)) {
    return draft;
  }
  const column = columns[0];
  return copyDraft(draft, {
    conditions: [
      ...draft.conditions.map(copyCondition),
      {
        column: column.name,
        operator: operatorsForRole(column.role)[0],
        value: "",
      },
    ],
  });
}

export function removeCondition(draft, index) {
  if (!Number.isInteger(index) || index < 0 || index >= draft.conditions.length) {
    return draft;
  }
  return copyDraft(draft, {
    conditions: draft.conditions.filter((_, itemIndex) => itemIndex !== index).map(copyCondition),
  });
}

export function setCondition(draft, index, patch, columns) {
  if (!Number.isInteger(index) || index < 0 || index >= draft.conditions.length) {
    return draft;
  }

  const current = draft.conditions[index];
  const next = copyCondition(current);
  const columnProvided = Object.prototype.hasOwnProperty.call(patch, "column");
  const operatorProvided = Object.prototype.hasOwnProperty.call(patch, "operator");
  const valueProvided = Object.prototype.hasOwnProperty.call(patch, "value");

  if (columnProvided) {
    next.column = patch.column;
  }
  if (operatorProvided) {
    next.operator = patch.operator;
  }
  if (valueProvided) {
    next.value = Array.isArray(patch.value) ? [...patch.value] : patch.value;
  }

  if (columnProvided && patch.column !== current.column) {
    const legal = operatorsForRole(roleOf(columns, next.column));
    if (!legal.includes(next.operator)) {
      next.operator = legal[0];
      next.value = blankValue(next.operator);
    }
  }

  if (next.operator !== current.operator && !valueProvided) {
    next.value = blankValue(next.operator);
  }

  return copyDraft(draft, {
    conditions: draft.conditions.map((condition, itemIndex) =>
      itemIndex === index ? next : copyCondition(condition),
    ),
  });
}

export function canAddSort(draft) {
  return draft.sorts.length < 3;
}

export function addSort(draft, columns) {
  if (!canAddSort(draft) || !hasColumns(columns)) {
    return draft;
  }
  return copyDraft(draft, {
    sorts: [...draft.sorts.map((sort) => ({ ...sort })), { column: columns[0].name, direction: "asc" }],
  });
}

export function removeSort(draft, index) {
  if (!Number.isInteger(index) || index < 0 || index >= draft.sorts.length) {
    return draft;
  }
  return copyDraft(draft, {
    sorts: draft.sorts.filter((_, itemIndex) => itemIndex !== index).map((sort) => ({ ...sort })),
  });
}

export function setSort(draft, index, patch) {
  if (!Number.isInteger(index) || index < 0 || index >= draft.sorts.length) {
    return draft;
  }
  const next = { ...draft.sorts[index] };
  if (Object.prototype.hasOwnProperty.call(patch, "column")) {
    next.column = patch.column;
  }
  if (patch.direction === "asc" || patch.direction === "desc") {
    next.direction = patch.direction;
  }
  return copyDraft(draft, {
    sorts: draft.sorts.map((sort, itemIndex) => (itemIndex === index ? next : { ...sort })),
  });
}

export function setCombinator(draft, combinator) {
  if (combinator !== "and" && combinator !== "or") {
    return draft;
  }
  return copyDraft(draft, { combinator });
}

export function setGroupColumns(draft, names, columns) {
  const roles = new Map((columns || []).map((column) => [column.name, column.role]));
  const groupColumns = (names || []).filter((name) => roles.has(name) && roles.get(name) !== "metric");
  return copyDraft(draft, { groupColumns });
}

export function setGroupMode(draft, mode) {
  if (mode !== "rowspan" && mode !== "aggregate") {
    return draft;
  }
  return copyDraft(draft, { groupMode: mode });
}
