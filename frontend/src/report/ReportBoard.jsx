import { useEffect, useRef, useState } from "react";
import { fetchSection } from "../api/datasets";
import "./ReportBoard.css";
import { formatDate, formatNumber } from "./format";
import LineChart from "./LineChart";
import { initialCards, loadOne, runSequence, selectorsFromColumns } from "./sequence";

const NUMERIC_STATS = ["count", "mean", "std", "min", "p25", "p50", "p75", "max"];

const EMPTY_CHOICES = {
  rankingMetric: null,
  groupingCategory: null,
  groupingMetric: null,
  timeseriesDate: null,
  timeseriesMetric: null,
  insightsDate: null,
};

function displayNumber(value, locale, empty) {
  const formatted = formatNumber(value, locale);
  return formatted == null ? empty : formatted;
}

function displayCell(value, role, locale, empty) {
  if (value == null || value === "") {
    return empty;
  }
  if (role === "datetime") {
    const formatted = formatDate(value, locale);
    return formatted == null ? empty : formatted;
  }
  if (role === "metric") {
    return displayNumber(value, locale, empty);
  }
  return String(value);
}

function cardTitle(name, titles) {
  if (name === "shape") {
    return titles.size;
  }
  return titles[name];
}

function selectorsForSection(section, choices) {
  if (section === "ranking") {
    return { metric: choices.rankingMetric };
  }
  if (section === "grouping") {
    return { metric: choices.groupingMetric, category: choices.groupingCategory };
  }
  if (section === "timeseries") {
    return { metric: choices.timeseriesMetric, dateColumn: choices.timeseriesDate };
  }
  if (section === "insights") {
    return { dateColumn: choices.insightsDate };
  }
  return {};
}

function ColumnSelect({ label, value, names, onChange }) {
  const current = names.includes(value) ? value : "";
  return (
    <select aria-label={label} value={current} onChange={(event) => onChange(event.target.value)}>
      {current === "" ? <option value="" /> : null}
      {names.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

function StatusCard({ card, title }) {
  const status = card.phase === "loading" ? "loading" : "unavailable";
  return (
    <section data-testid={`card-${card.name}`} data-status={status}>
      <h2>{title}</h2>
      {card.phase === "loading" ? (
        <div className="card-skeleton" data-testid="card-skeleton" />
      ) : (
        <p>{card.message}</p>
      )}
    </section>
  );
}

export default function ReportBoard({ datasetId, lang, titles, labels }) {
  const [cards, setCards] = useState(initialCards);
  const [choices, setChoices] = useState(EMPTY_CHOICES);
  const [trackedDatasetId, setTrackedDatasetId] = useState(datasetId);
  const cardsRef = useRef(initialCards());
  const selectorsRef = useRef({ ...EMPTY_CHOICES });
  const choicesDatasetRef = useRef(null);
  const overridesRef = useRef({});
  const generationRef = useRef(0);
  const activeDatasetRef = useRef(datasetId);
  const empty = labels.empty;

  activeDatasetRef.current = datasetId;

  if (trackedDatasetId !== datasetId) {
    generationRef.current += 1;
    setTrackedDatasetId(datasetId);
    setChoices(EMPTY_CHOICES);
    selectorsRef.current = { ...EMPTY_CHOICES };
    choicesDatasetRef.current = null;
    overridesRef.current = {};
  }

  useEffect(() => {
    const generation = generationRef.current;
    overridesRef.current = {};
    setCards(initialCards());

    function getSection(section, params) {
      return fetchSection(datasetId, section, params);
    }

    runSequence({
      getSection,
      lang,
      getSelectors() {
        const loading = cardsRef.current.find((card) => card.phase === "loading");
        return selectorsForSection(loading?.name, selectorsRef.current);
      },
      onUpdate(next) {
        if (generationRef.current !== generation || activeDatasetRef.current !== datasetId) {
          return;
        }
        cardsRef.current = next;
        const columns = next.find((card) => card.name === "columns" && card.phase === "ok");
        // Write the ref here, before this function returns. Ranking's getSelectors runs
        // in the same turn, and a useState update would still be the previous value.
        if (columns && choicesDatasetRef.current !== datasetId) {
          choicesDatasetRef.current = datasetId;
          const parsed = selectorsFromColumns(columns.body);
          const nextChoices = {
            rankingMetric: parsed.metric,
            groupingCategory: parsed.category,
            groupingMetric: parsed.metric,
            timeseriesDate: parsed.dateColumn,
            timeseriesMetric: parsed.metric,
            insightsDate: parsed.dateColumn,
          };
          selectorsRef.current = nextChoices;
          setChoices(nextChoices);
        }
        setCards(next.map((card) => overridesRef.current[card.name] ?? card));
      },
      shouldContinue() {
        return generationRef.current === generation && activeDatasetRef.current === datasetId;
      },
    });

    return () => {
      generationRef.current += 1;
    };
  }, [datasetId, lang]);

  async function reloadSection(section, selectors) {
    const generation = generationRef.current;
    const loadingCard = { name: section, phase: "loading", body: null, message: null };
    overridesRef.current[section] = loadingCard;
    setCards((current) => current.map((card) => (card.name === section ? loadingCard : card)));
    const card = await loadOne({
      getSection: (name, params) => fetchSection(datasetId, name, params),
      section,
      lang,
      selectors,
    });
    if (generationRef.current !== generation || activeDatasetRef.current !== datasetId) {
      return;
    }
    overridesRef.current[section] = card;
    setCards((current) => current.map((existing) => (existing.name === section ? card : existing)));
  }

  function commitChoice(patch, section, selectors) {
    const next = { ...selectorsRef.current, ...patch };
    selectorsRef.current = next;
    setChoices(next);
    reloadSection(section, selectors);
  }

  const columnsCard = cards.find((card) => card.name === "columns" && card.phase === "ok");
  const columnList = columnsCard?.body?.data?.columns ?? [];
  const roles = Object.fromEntries(columnList.map((column) => [column.name, column.role]));
  const options = columnsCard
    ? selectorsFromColumns(columnsCard.body)
    : { metrics: [], categories: [], dates: [] };

  return (
    <div className="report-board">
      {cards
        .filter((card) => card.phase !== "pending")
        .map((card) => {
          const title = cardTitle(card.name, titles);
          if (card.phase === "loading" || card.phase === "unavailable" || card.phase === "error") {
            return <StatusCard key={card.name} card={card} title={title} />;
          }
          return (
            <OkCard
              key={card.name}
              card={card}
              title={title}
              lang={lang}
              labels={labels}
              empty={empty}
              roles={roles}
              options={options}
              choices={choices}
              onRankingMetric={(metric) => commitChoice({ rankingMetric: metric }, "ranking", { metric })}
              onGroupingCategory={(category) =>
                commitChoice({ groupingCategory: category }, "grouping", {
                  category,
                  metric: selectorsRef.current.groupingMetric,
                })
              }
              onGroupingMetric={(metric) =>
                commitChoice({ groupingMetric: metric }, "grouping", {
                  category: selectorsRef.current.groupingCategory,
                  metric,
                })
              }
              onTimeseriesDate={(dateColumn) =>
                commitChoice({ timeseriesDate: dateColumn }, "timeseries", {
                  dateColumn,
                  metric: selectorsRef.current.timeseriesMetric,
                })
              }
              onTimeseriesMetric={(metric) =>
                commitChoice({ timeseriesMetric: metric }, "timeseries", {
                  dateColumn: selectorsRef.current.timeseriesDate,
                  metric,
                })
              }
              onInsightsDate={(dateColumn) =>
                commitChoice({ insightsDate: dateColumn }, "insights", { dateColumn })
              }
            />
          );
        })}
    </div>
  );
}

function OkCard({
  card,
  title,
  lang,
  labels,
  empty,
  roles,
  options,
  choices,
  onRankingMetric,
  onGroupingCategory,
  onGroupingMetric,
  onTimeseriesDate,
  onTimeseriesMetric,
  onInsightsDate,
}) {
  const data = card.body?.data ?? {};

  if (card.name === "preview") {
    const columns = data.columns ?? [];
    const rows = data.rows ?? [];
    return (
      <section data-testid="card-preview">
        <h2>{title}</h2>
        <table>
          <thead>
            <tr>
              {columns.map((name) => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((name) => (
                  <td key={name}>{displayCell(row[name], roles[name], lang, empty)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  if (card.name === "columns") {
    return (
      <section data-testid="card-columns">
        <h2>{title}</h2>
        <table>
          <thead>
            <tr>
              <th>{labels.name}</th>
              <th>{labels.role}</th>
              <th>{labels.distinct}</th>
            </tr>
          </thead>
          <tbody>
            {(data.columns ?? []).map((column) => (
              <tr key={column.name}>
                <td>{column.name}</td>
                <td>{column.role}</td>
                <td>{displayNumber(column.unique_count, lang, empty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  if (card.name === "shape") {
    return (
      <section data-testid="card-shape">
        <h2>{title}</h2>
        <p>
          {labels.rowCount} {displayNumber(data.row_count, lang, empty)}
        </p>
        <p>
          {labels.columnCount} {displayNumber(data.column_count, lang, empty)}
        </p>
      </section>
    );
  }

  if (card.name === "dtypes") {
    return (
      <section data-testid="card-dtypes">
        <h2>{title}</h2>
        <table>
          <thead>
            <tr>
              <th>{labels.name}</th>
              <th>{labels.dtype}</th>
              <th>{labels.role}</th>
            </tr>
          </thead>
          <tbody>
            {(data.columns ?? []).map((column) => (
              <tr key={column.name}>
                <td>{column.name}</td>
                <td>{column.dtype}</td>
                <td>{column.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  if (card.name === "missing") {
    return (
      <section data-testid="card-missing">
        <h2>{title}</h2>
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
            {(data.columns ?? []).map((column) => (
              <tr key={column.name}>
                <td>{column.name}</td>
                <td>{displayNumber(column.missing_count, lang, empty)}</td>
                <td>{displayNumber(column.missing_pct, lang, empty)}</td>
                <td>{displayNumber(column.non_null_count, lang, empty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  if (card.name === "summary") {
    return (
      <section data-testid="card-summary">
        <h2>{title}</h2>
        <div>
          <p>{labels.numeric}</p>
          {(data.numeric ?? []).map((stat) => (
            <div key={stat.column}>
              <p>{stat.column}</p>
              {NUMERIC_STATS.map((field) => (
                <p key={field}>
                  {labels[field]} {displayNumber(stat[field], lang, empty)}
                </p>
              ))}
            </div>
          ))}
        </div>
        <div>
          <p>{labels.other}</p>
          {(data.other ?? []).map((stat) => (
            <div key={stat.column}>
              <p>{stat.column}</p>
              <p>
                {labels.count} {displayNumber(stat.count, lang, empty)}
              </p>
              <p>
                {labels.unique} {displayNumber(stat.unique, lang, empty)}
              </p>
              <p>
                {labels.topValue} {stat.top}
              </p>
              <p>
                {labels.frequency} {displayNumber(stat.freq, lang, empty)}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (card.name === "ranking") {
    const metric = data.metric;
    return (
      <section data-testid="card-ranking">
        <h2>{title}</h2>
        {options.metrics.length > 0 ? (
          <ColumnSelect
            label={labels.metric}
            value={choices.rankingMetric}
            names={options.metrics}
            onChange={onRankingMetric}
          />
        ) : null}
        <div>
          <p>{labels.top}</p>
          <ul>
            {(data.top ?? []).map((row) => (
              <li key={row.rank}>{displayNumber(row.values?.[metric], lang, empty)}</li>
            ))}
          </ul>
        </div>
        <div>
          <p>{labels.worst}</p>
          <ul>
            {(data.worst ?? []).map((row) => (
              <li key={row.rank}>{displayNumber(row.values?.[metric], lang, empty)}</li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (card.name === "grouping") {
    return (
      <section data-testid="card-grouping">
        <h2>{title}</h2>
        {options.categories.length > 0 ? (
          <ColumnSelect
            label={labels.category}
            value={choices.groupingCategory}
            names={options.categories}
            onChange={onGroupingCategory}
          />
        ) : null}
        {options.metrics.length > 0 ? (
          <ColumnSelect
            label={labels.metric}
            value={choices.groupingMetric}
            names={options.metrics}
            onChange={onGroupingMetric}
          />
        ) : null}
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
            {(data.groups ?? []).map((group, index) => (
              <tr key={`${group.value ?? ""}-${index}`}>
                <td>{group.value == null || group.value === "" ? empty : String(group.value)}</td>
                <td>{displayNumber(group.count, lang, empty)}</td>
                <td>{displayNumber(group.sum, lang, empty)}</td>
                <td>{displayNumber(group.mean, lang, empty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.truncated ? <p>{labels.truncated}</p> : null}
      </section>
    );
  }

  if (card.name === "timeseries") {
    return (
      <section data-testid="card-timeseries">
        <h2>{title}</h2>
        {options.dates.length > 0 ? (
          <ColumnSelect
            label={labels.date}
            value={choices.timeseriesDate}
            names={options.dates}
            onChange={onTimeseriesDate}
          />
        ) : null}
        {options.metrics.length > 0 ? (
          <ColumnSelect
            label={labels.metric}
            value={choices.timeseriesMetric}
            names={options.metrics}
            onChange={onTimeseriesMetric}
          />
        ) : null}
        <p>{data.grain}</p>
        <LineChart points={data.points ?? []} locale={lang} />
      </section>
    );
  }

  if (card.name === "insights") {
    const items = data.items ?? [];
    return (
      <section data-testid="card-insights">
        <h2>{title}</h2>
        {options.dates.length > 0 ? (
          <ColumnSelect
            label={labels.date}
            value={choices.insightsDate}
            names={options.dates}
            onChange={onInsightsDate}
          />
        ) : null}
        <ul>
          {items.map((item, index) => (
            <li key={index}>{item.text}</li>
          ))}
        </ul>
      </section>
    );
  }

  return null;
}
