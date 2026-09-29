import { useEffect, useState } from "react";
import "./ReportBoard.css";
import {
  columnOptions,
  groupingSlice,
  rankingSlice,
  reportFixture,
  timeseriesSlice,
} from "./fixture";
import { formatDate, formatNumber } from "./format";
import LineChart from "./LineChart";

const DEFAULT_METRIC = "Quantity";
const DEFAULT_CATEGORY = "Region";
const DEFAULT_DATE = "Transaction_Date";

const NUMERIC_STATS = ["count", "mean", "std", "min", "p25", "p50", "p75", "max"];

function displayNumber(value, locale, empty) {
  const formatted = formatNumber(value, locale);
  return formatted == null ? empty : formatted;
}

function displayCell(value, role, locale, empty) {
  if (role === "datetime") {
    const formatted = formatDate(value, locale);
    return formatted == null ? empty : formatted;
  }
  if (role === "metric") {
    return displayNumber(value, locale, empty);
  }
  if (value == null || value === "") {
    return empty;
  }
  return String(value);
}

function ColumnSelect({ label, value, names, onChange }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {names.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

export default function ReportBoard({ locale, titles, labels, resetKey }) {
  const [rankingMetric, setRankingMetric] = useState(DEFAULT_METRIC);
  const [groupingCategory, setGroupingCategory] = useState(DEFAULT_CATEGORY);
  const [groupingMetric, setGroupingMetric] = useState(DEFAULT_METRIC);
  const [dateColumn, setDateColumn] = useState(DEFAULT_DATE);
  const [timeseriesMetric, setTimeseriesMetric] = useState(DEFAULT_METRIC);

  useEffect(() => {
    setRankingMetric(DEFAULT_METRIC);
    setGroupingCategory(DEFAULT_CATEGORY);
    setGroupingMetric(DEFAULT_METRIC);
    setDateColumn(DEFAULT_DATE);
    setTimeseriesMetric(DEFAULT_METRIC);
  }, [resetKey]);

  const options = columnOptions(reportFixture);
  const empty = labels.empty;
  const preview = reportFixture.preview.data;
  const columns = reportFixture.columns.data.columns;
  const roles = Object.fromEntries(columns.map((column) => [column.name, column.role]));
  const shape = reportFixture.shape.data;
  const ranking = rankingSlice(rankingMetric).data;
  const grouping = groupingSlice(groupingCategory, groupingMetric).data;
  const timeseries = timeseriesSlice(dateColumn, timeseriesMetric).data;

  return (
    <div className="report-board">
      <section data-testid="card-preview">
        <h2>{titles.preview}</h2>
        <table>
          <thead>
            <tr>
              {preview.columns.map((name) => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.Client_ID}>
                {preview.columns.map((name) => (
                  <td key={name}>{displayCell(row[name], roles[name], locale, empty)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section data-testid="card-columns">
        <h2>{titles.columns}</h2>
        <table>
          <thead>
            <tr>
              <th>{labels.name}</th>
              <th>{labels.role}</th>
              <th>{labels.distinct}</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => (
              <tr key={column.name}>
                <td>{column.name}</td>
                <td>{column.role}</td>
                <td>{displayNumber(column.unique_count, locale, empty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section data-testid="card-shape">
        <h2>{titles.size}</h2>
        <p>
          {labels.rowCount} {displayNumber(shape.row_count, locale, empty)}
        </p>
        <p>
          {labels.columnCount} {displayNumber(shape.column_count, locale, empty)}
        </p>
      </section>

      <section data-testid="card-dtypes">
        <h2>{titles.dtypes}</h2>
        <table>
          <thead>
            <tr>
              <th>{labels.name}</th>
              <th>{labels.dtype}</th>
              <th>{labels.role}</th>
            </tr>
          </thead>
          <tbody>
            {reportFixture.dtypes.data.columns.map((column) => (
              <tr key={column.name}>
                <td>{column.name}</td>
                <td>{column.dtype}</td>
                <td>{column.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section data-testid="card-missing">
        <h2>{titles.missing}</h2>
        <table>
          <thead>
            <tr>
              <th>{labels.name}</th>
              <th>{labels.missingCount}</th>
              <th>{labels.missingPercent}</th>
              <th>{labels.filled}</th>
            </tr>
          </thead>
          <tbody>
            {reportFixture.missing.data.columns.map((column) => (
              <tr key={column.name}>
                <td>{column.name}</td>
                <td>{displayNumber(column.missing_count, locale, empty)}</td>
                <td>{displayNumber(column.missing_pct, locale, empty)}</td>
                <td>{displayNumber(column.non_null_count, locale, empty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section data-testid="card-summary">
        <h2>{titles.summary}</h2>
        <div>
          <p>{labels.numeric}</p>
          {reportFixture.summary.data.numeric.map((stat) => (
            <div key={stat.column}>
              <p>{stat.column}</p>
              {NUMERIC_STATS.map((field) => (
                <p key={field}>
                  {labels[field]} {displayNumber(stat[field], locale, empty)}
                </p>
              ))}
            </div>
          ))}
        </div>
        <div>
          <p>{labels.other}</p>
          {reportFixture.summary.data.other.map((stat) => (
            <div key={stat.column}>
              <p>{stat.column}</p>
              <p>
                {labels.count} {displayNumber(stat.count, locale, empty)}
              </p>
              <p>
                {labels.unique} {displayNumber(stat.unique, locale, empty)}
              </p>
              <p>
                {labels.topValue} {stat.top}
              </p>
              <p>
                {labels.frequency} {displayNumber(stat.freq, locale, empty)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section data-testid="card-ranking">
        <h2>{titles.ranking}</h2>
        <ColumnSelect
          label={labels.metric}
          value={rankingMetric}
          names={options.metrics}
          onChange={setRankingMetric}
        />
        <div>
          <p>{labels.top}</p>
          <ul>
            {ranking.top.map((row) => (
              <li key={row.rank}>{displayNumber(row.values[ranking.metric], locale, empty)}</li>
            ))}
          </ul>
        </div>
        <div>
          <p>{labels.worst}</p>
          <ul>
            {ranking.worst.map((row) => (
              <li key={row.rank}>{displayNumber(row.values[ranking.metric], locale, empty)}</li>
            ))}
          </ul>
        </div>
      </section>

      <section data-testid="card-grouping">
        <h2>{titles.grouping}</h2>
        <ColumnSelect
          label={labels.category}
          value={groupingCategory}
          names={options.categories}
          onChange={setGroupingCategory}
        />
        <ColumnSelect
          label={labels.metric}
          value={groupingMetric}
          names={options.metrics}
          onChange={setGroupingMetric}
        />
        <table>
          <thead>
            <tr>
              <th>{labels.value}</th>
              <th>{labels.count}</th>
              <th>{labels.sum}</th>
              <th>{labels.mean}</th>
            </tr>
          </thead>
          <tbody>
            {grouping.groups.map((group) => (
              <tr key={group.value}>
                <td>{group.value}</td>
                <td>{displayNumber(group.count, locale, empty)}</td>
                <td>{displayNumber(group.sum, locale, empty)}</td>
                <td>{displayNumber(group.mean, locale, empty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {grouping.truncated ? <p>{labels.truncated}</p> : null}
      </section>

      <section data-testid="card-timeseries">
        <h2>{titles.timeseries}</h2>
        <ColumnSelect
          label={labels.date}
          value={dateColumn}
          names={options.dates}
          onChange={setDateColumn}
        />
        <ColumnSelect
          label={labels.metric}
          value={timeseriesMetric}
          names={options.metrics}
          onChange={setTimeseriesMetric}
        />
        <p>{timeseries.grain}</p>
        <LineChart points={timeseries.points} locale={locale} />
      </section>

      <section data-testid="card-insights" data-status={reportFixture.insights.status}>
        <h2>{titles.insights}</h2>
        <p>{labels.unavailable}</p>
      </section>
    </div>
  );
}
