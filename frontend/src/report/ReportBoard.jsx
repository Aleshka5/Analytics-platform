import { useEffect, useRef, useState } from "react";
import { fetchSection } from "../api/datasets";
import "./ReportBoard.css";
import { formatDate, formatNumber } from "./format";
import LineChart from "./LineChart";
import { cardsSettled } from "./cardsSettled";
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

const WIDE_CARDS = new Set(["preview", "summary", "timeseries", "insights"]);

function cardClass(name) {
  return WIDE_CARDS.has(name) ? "card card-wide" : "card";
}

function ColumnSelect({ label, value, names, onChange }) {
  const current = names.includes(value) ? value : "";
  return (
    <label className="card-field">
      <span aria-hidden="true">{label}</span>
      <select aria-label={label} value={current} onChange={(event) => onChange(event.target.value)}>
        {current === "" ? <option value="" /> : null}
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Card({ name, title, controls, children }) {
  return (
    <section data-testid={`card-${name}`} className={cardClass(name)}>
      <div className="card-head">
        <h2>{title}</h2>
        {controls ? <div className="card-controls">{controls}</div> : null}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

function StatusCard({ card, title }) {
  const status = card.phase === "loading" ? "loading" : "unavailable";
  return (
    <section data-testid={`card-${card.name}`} data-status={status} className={cardClass(card.name)}>
      <div className="card-head">
        <h2>{title}</h2>
      </div>
      {card.phase === "loading" ? (
        <div className="card-skeleton" data-testid="card-skeleton" />
      ) : (
        <p className="card-message">{card.message}</p>
      )}
    </section>
  );
}

function RoleBadge({ role }) {
  return (
    <span className="role-badge" data-role={role}>
      {role}
    </span>
  );
}

function Bar({ value, max }) {
  const share = max > 0 && Number.isFinite(value) ? Math.abs(value) / max : 0;
  return (
    <span className="bar" aria-hidden="true">
      <span style={{ width: `${Math.round(share * 100)}%` }} />
    </span>
  );
}

function maxAbs(values) {
  return Math.max(0, ...values.filter(Number.isFinite).map(Math.abs));
}

export default function ReportBoard({ datasetId, lang, titles, labels, onColumns, onSettled }) {
  const [cards, setCards] = useState(initialCards);
  const [choices, setChoices] = useState(EMPTY_CHOICES);
  const [trackedDatasetId, setTrackedDatasetId] = useState(datasetId);
  const cardsRef = useRef(initialCards());
  const selectorsRef = useRef({ ...EMPTY_CHOICES });
  const choicesDatasetRef = useRef(null);
  const overridesRef = useRef({});
  const generationRef = useRef(0);
  const activeDatasetRef = useRef(datasetId);
  const onColumnsRef = useRef(onColumns);
  const onSettledRef = useRef(onSettled);
  const reportedColumnsKeyRef = useRef(null);
  const columnsStaleRef = useRef(false);
  const settingsColumnsRef = useRef([]);
  const empty = labels.empty;

  activeDatasetRef.current = datasetId;
  onColumnsRef.current = onColumns;
  onSettledRef.current = onSettled;

  if (trackedDatasetId !== datasetId) {
    // The previous dataset's cards stay mounted until the load effect replaces them.
    columnsStaleRef.current = true;
    generationRef.current += 1;
    setTrackedDatasetId(datasetId);
    setChoices(EMPTY_CHOICES);
    selectorsRef.current = { ...EMPTY_CHOICES };
    choicesDatasetRef.current = null;
    overridesRef.current = {};
  }

  useEffect(() => {
    columnsStaleRef.current = false;
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
  if (columnsStaleRef.current) {
    settingsColumnsRef.current = [];
  } else if (columnsCard) {
    settingsColumnsRef.current = columnList.map((column) => ({
      name: column.name,
      role: column.role,
    }));
  }
  const settingsColumnsKey = `${datasetId}\n${settingsColumnsRef.current
    .map((column) => `${column.name}:${column.role}`)
    .join("\n")}`;

  useEffect(() => {
    const notify = onSettledRef.current;
    if (typeof notify === "function") {
      notify(cardsSettled(cards));
    }
  }, [cards]);

  useEffect(() => {
    const notify = onColumnsRef.current;
    if (typeof notify !== "function") {
      return;
    }
    if (reportedColumnsKeyRef.current === settingsColumnsKey) {
      return;
    }
    reportedColumnsKeyRef.current = settingsColumnsKey;
    notify(settingsColumnsRef.current);
  }, [settingsColumnsKey]);

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
  const cardProps = { name: card.name, title };

  if (card.name === "preview") {
    const columns = data.columns ?? [];
    const rows = data.rows ?? [];
    const numeric = (name) => (roles[name] === "metric" ? "num" : undefined);
    return (
      <Card {...cardProps}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((name) => (
                  <th key={name} className={numeric(name)}>
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((name) => (
                    <td key={name} className={numeric(name)}>
                      {displayCell(row[name], roles[name], lang, empty)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  if (card.name === "columns") {
    return (
      <Card {...cardProps}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{labels.name}</th>
                <th>{labels.role}</th>
                <th className="num">{labels.distinct}</th>
              </tr>
            </thead>
            <tbody>
              {(data.columns ?? []).map((column) => (
                <tr key={column.name}>
                  <td>{column.name}</td>
                  <td>
                    <RoleBadge role={column.role} />
                  </td>
                  <td className="num">{displayNumber(column.unique_count, lang, empty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  if (card.name === "shape") {
    return (
      <Card {...cardProps}>
        <div className="stat-row">
          <p className="stat">
            <span className="stat-label">{labels.rowCount}</span>{" "}
            <span className="stat-value">{displayNumber(data.row_count, lang, empty)}</span>
          </p>
          <p className="stat">
            <span className="stat-label">{labels.columnCount}</span>{" "}
            <span className="stat-value">{displayNumber(data.column_count, lang, empty)}</span>
          </p>
        </div>
      </Card>
    );
  }

  if (card.name === "dtypes") {
    return (
      <Card {...cardProps}>
        <div className="table-scroll">
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
                  <td>
                    <code>{column.dtype}</code>
                  </td>
                  <td>
                    <RoleBadge role={column.role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  if (card.name === "missing") {
    return (
      <Card {...cardProps}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{labels.name}</th>
                <th className="num">{labels.missingCount}</th>
                <th>{labels.missingPercent}</th>
                <th className="num">{labels.filled}</th>
              </tr>
            </thead>
            <tbody>
              {(data.columns ?? []).map((column) => (
                <tr key={column.name}>
                  <td>{column.name}</td>
                  <td className="num">{displayNumber(column.missing_count, lang, empty)}</td>
                  <td>
                    <span className="meter-cell">
                      <span className="meter" aria-hidden="true">
                        <span style={{ width: `${Math.min(100, column.missing_pct || 0)}%` }} />
                      </span>
                      <span className="num">{displayNumber(column.missing_pct, lang, empty)}</span>
                    </span>
                  </td>
                  <td className="num">{displayNumber(column.non_null_count, lang, empty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  if (card.name === "summary") {
    return (
      <Card {...cardProps}>
        <h3 className="card-subhead">{labels.numeric}</h3>
        <div className="tile-grid">
          {(data.numeric ?? []).map((stat) => (
            <div key={stat.column} className="tile">
              <h4>{stat.column}</h4>
              <dl>
                {NUMERIC_STATS.map((field) => (
                  <div key={field}>
                    <dt>{labels[field]}</dt> <dd>{displayNumber(stat[field], lang, empty)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <h3 className="card-subhead">{labels.other}</h3>
        <div className="tile-grid">
          {(data.other ?? []).map((stat) => (
            <div key={stat.column} className="tile">
              <h4>{stat.column}</h4>
              <dl>
                <div>
                  <dt>{labels.count}</dt> <dd>{displayNumber(stat.count, lang, empty)}</dd>
                </div>
                <div>
                  <dt>{labels.unique}</dt> <dd>{displayNumber(stat.unique, lang, empty)}</dd>
                </div>
                <div>
                  <dt>{labels.topValue}</dt> <dd>{stat.top}</dd>
                </div>
                <div>
                  <dt>{labels.frequency}</dt> <dd>{displayNumber(stat.freq, lang, empty)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (card.name === "ranking") {
    const metric = data.metric;
    const top = data.top ?? [];
    const worst = data.worst ?? [];
    const max = maxAbs([...top, ...worst].map((row) => row.values?.[metric]));
    const contextColumns = Object.keys(roles)
      .filter((name) => roles[name] === "text" || roles[name] === "category")
      .slice(0, 2);
    const side = (key, rows) => (
      <div className="ranking-side" data-side={key}>
        <h3 className="card-subhead">{labels[key]}</h3>
        <ol>
          {rows.map((row) => (
            <li key={row.rank}>
              <span className="ranking-rank">{row.rank}</span>
              <span className="ranking-main">
                <span className="ranking-line">
                  <span className="ranking-value">{displayNumber(row.values?.[metric], lang, empty)}</span>
                  <span className="ranking-context">
                    {contextColumns
                      .map((name) => row.values?.[name])
                      .filter((value) => value != null && value !== "")
                      .join(" · ")}
                  </span>
                </span>
                <Bar value={row.values?.[metric]} max={max} />
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
    return (
      <Card
        {...cardProps}
        controls={
          options.metrics.length > 0 ? (
            <ColumnSelect
              label={labels.metric}
              value={choices.rankingMetric}
              names={options.metrics}
              onChange={onRankingMetric}
            />
          ) : null
        }
      >
        <div className="ranking">
          {side("top", top)}
          {side("worst", worst)}
        </div>
      </Card>
    );
  }

  if (card.name === "grouping") {
    const groups = data.groups ?? [];
    const max = maxAbs(groups.map((group) => group.sum));
    return (
      <Card
        {...cardProps}
        controls={
          <>
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
          </>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{labels.value}</th>
                <th className="num">{labels.count}</th>
                <th>{labels.sum}</th>
                <th className="num">{labels.mean}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, index) => (
                <tr key={`${group.value ?? ""}-${index}`}>
                  <td>{group.value == null || group.value === "" ? empty : String(group.value)}</td>
                  <td className="num">{displayNumber(group.count, lang, empty)}</td>
                  <td>
                    <span className="meter-cell">
                      <Bar value={group.sum} max={max} />
                      <span className="num">{displayNumber(group.sum, lang, empty)}</span>
                    </span>
                  </td>
                  <td className="num">{displayNumber(group.mean, lang, empty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.truncated ? <p className="card-note">{labels.truncated}</p> : null}
      </Card>
    );
  }

  if (card.name === "timeseries") {
    return (
      <Card
        {...cardProps}
        controls={
          <>
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
          </>
        }
      >
        {data.grain ? <span className="chip">{labels[data.grain] ?? data.grain}</span> : null}
        <LineChart points={data.points ?? []} locale={lang} />
      </Card>
    );
  }

  if (card.name === "insights") {
    const items = data.items ?? [];
    return (
      <Card
        {...cardProps}
        controls={
          options.dates.length > 0 ? (
            <ColumnSelect
              label={labels.date}
              value={choices.insightsDate}
              names={options.dates}
              onChange={onInsightsDate}
            />
          ) : null
        }
      >
        <ul className="insights">
          {items.map((item, index) => (
            <li key={index} style={{ "--item": index }}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"
                  fill="currentColor"
                />
              </svg>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return null;
}
