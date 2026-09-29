// Built-in report for every accepted file. The uploaded file is not parsed.

const columns = [
  { name: "Transaction_Date", dtype: "datetime64[ns]", role: "datetime", unique_count: 90 },
  { name: "Client_ID", dtype: "object", role: "text", unique_count: 50 },
  { name: "Region", dtype: "object", role: "category", unique_count: 7 },
  { name: "Asset", dtype: "object", role: "category", unique_count: 10 },
  { name: "Quantity", dtype: "int64", role: "metric", unique_count: 230 },
  { name: "PnL", dtype: "float64", role: "metric", unique_count: 280 },
];

const columnNames = columns.map((column) => column.name);

export const reportFixture = {
  preview: {
    status: "ok",
    data: {
      row_limit: 20,
      columns: columnNames,
      rows: [
        {
          Transaction_Date: "2025-01-01",
          Client_ID: "Client_010",
          Region: "UAE",
          Asset: "Gold",
          Quantity: 7,
          PnL: null,
        },
        {
          Transaction_Date: "2025-01-02",
          Client_ID: "Client_011",
          Region: "USA",
          Asset: "Oil",
          Quantity: 500,
          PnL: 1200.5,
        },
      ],
    },
  },
  columns: {
    status: "ok",
    data: {
      columns,
      suggestions: {
        metric: "Quantity",
        category: "Region",
        datetime: "Transaction_Date",
      },
    },
  },
  shape: {
    status: "ok",
    data: {
      row_count: 300,
      column_count: 6,
    },
  },
  dtypes: {
    status: "ok",
    data: {
      columns: columns.map(({ name, dtype, role }) => ({ name, dtype, role })),
    },
  },
  missing: {
    status: "ok",
    data: {
      columns: [
        { name: "PnL", missing_count: 1, missing_pct: 0.3333, non_null_count: 299 },
        { name: "Quantity", missing_count: 0, missing_pct: 0, non_null_count: 300 },
      ],
    },
  },
  summary: {
    status: "ok",
    data: {
      numeric: [
        {
          column: "Quantity",
          count: 300,
          mean: 253.33666666666667,
          std: 144.2,
          min: 2,
          p25: 120,
          p50: 254.5,
          p75: 380,
          max: 500,
        },
      ],
      other: [
        {
          column: "Region",
          role: "category",
          count: 300,
          unique: 7,
          top: "USA",
          freq: 49,
        },
      ],
    },
  },
  insights: {
    status: "unavailable",
    error: { code: "no_insight_inputs", message: "" },
  },
};

export function columnOptions(fixture) {
  const listed = fixture.columns.data.columns;
  return {
    metrics: listed.filter((column) => column.role === "metric").map((column) => column.name),
    categories: listed
      .filter((column) => column.role === "category" || column.role === "text")
      .map((column) => column.name),
    dates: listed.filter((column) => column.role === "datetime").map((column) => column.name),
  };
}

export function rankingSlice(metric) {
  const slices = {
    Quantity: {
      top: [{ rank: 1, values: { Quantity: 500 } }],
      worst: [{ rank: 1, values: { Quantity: 2 } }],
    },
    PnL: {
      top: [{ rank: 1, values: { PnL: 42 } }],
      worst: [{ rank: 1, values: { PnL: -5 } }],
    },
  };
  const slice = slices[metric] ?? { top: [], worst: [] };
  return {
    status: "ok",
    data: {
      metric,
      higher_is_better: true,
      top: slice.top,
      worst: slice.worst,
    },
  };
}

const regionQuantityGroups = [{ value: "USA", count: 49, sum: 12000, mean: 244.9 }];

export function groupingSlice(category, metric) {
  let groups = [{ value: "Other", count: 49, sum: 12000, mean: 244.9 }];
  if (category === "Region" && metric === "Quantity") {
    groups = regionQuantityGroups;
  } else if (category === "Asset" && metric === "PnL") {
    groups = [{ value: "Gold", count: 10, sum: 99, mean: 9.9 }];
  }
  return {
    status: "ok",
    data: {
      category,
      metric,
      truncated: false,
      groups,
    },
  };
}

export function timeseriesSlice(dateColumn, metric) {
  let points = [{ bucket: "2025-01-01", sum: 1 }];
  if (dateColumn === "Transaction_Date" && metric === "Quantity") {
    points = [
      { bucket: "2025-01-01", sum: 7 },
      { bucket: "2025-01-02", sum: 500 },
    ];
  } else if (dateColumn === "Transaction_Date" && metric === "PnL") {
    points = [
      { bucket: "2025-01-01", sum: 10 },
      { bucket: "2025-01-02", sum: 42 },
    ];
  }
  return {
    status: "ok",
    data: {
      date_column: dateColumn,
      metric,
      grain: "day",
      points,
    },
  };
}
