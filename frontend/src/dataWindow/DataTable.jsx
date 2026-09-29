import "./DataTable.css";
import { formatDate, formatNumber } from "../report/format";

const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

function formatCell(value, locale) {
  if (value === null || value === undefined) {
    return "\u2014";
  }
  if (typeof value === "number") {
    return formatNumber(value, locale);
  }
  if (typeof value === "string" && DATE_PREFIX.test(value)) {
    return formatDate(value, locale);
  }
  return String(value);
}

function cellKey(rowIndex, column) {
  return `${rowIndex}\0${column}`;
}

function mergedCells(columns, spans, mode) {
  const skip = new Set();
  const merge = new Map();
  if (mode !== "rowspan" || !Array.isArray(spans)) {
    return { skip, merge };
  }
  const known = new Set(columns);
  for (const span of spans) {
    if (!span || !known.has(span.column)) {
      continue;
    }
    const start = span.start_row;
    const length = span.length;
    if (
      !Number.isInteger(start) ||
      start < 0 ||
      !Number.isInteger(length) ||
      length < 1
    ) {
      continue;
    }
    merge.set(cellKey(start, span.column), length);
    for (let offset = 1; offset < length; offset += 1) {
      skip.add(cellKey(start + offset, span.column));
    }
  }
  return { skip, merge };
}

export default function DataTable({
  columns,
  rows,
  spans,
  mode,
  emptyLabel,
  locale,
}) {
  if (!rows || rows.length === 0) {
    return (
      <p className="data-table-empty" data-testid="data-empty">
        {emptyLabel}
      </p>
    );
  }

  const { skip, merge } = mergedCells(columns, spans, mode);

  return (
    <table className="data-table" data-testid="data-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} className="data-table-header" scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((column) => {
              const key = cellKey(rowIndex, column);
              if (skip.has(key)) {
                return null;
              }
              const length = merge.get(key);
              return (
                <td
                  key={column}
                  className="data-table-cell"
                  rowSpan={length > 1 ? length : undefined}
                >
                  {formatCell(row?.[column], locale)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
