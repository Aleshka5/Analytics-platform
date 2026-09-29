import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import "./SettingsForm.css";
import {
  addCondition,
  addSort,
  canAddSort,
  operatorsForRole,
  removeCondition,
  removeSort,
  setCombinator,
  setCondition,
  setGroupColumns,
  setGroupMode,
  setSort,
} from "./draft.js";
import {
  AggregatedTableIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  FilterIcon,
  GroupIcon,
  MergedTableIcon,
  PlusIcon,
  SortIcon,
  TrashIcon,
  VennIcon,
} from "./icons.jsx";

function roleFor(columns, name) {
  const column = columns.find((item) => item.name === name);
  return column ? column.role : "";
}

function parseInValue(text) {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

function Step({ icon, title, hint, children }) {
  return (
    <section className="settings-step">
      <div className="settings-step-head">
        <span className="settings-step-icon">{icon}</span>
        <div>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/* A large radio card: a picture, a title, and one plain sentence. */
function ChoiceCard({ name, value, checked, onSelect, picture, title, hint }) {
  return (
    <label className="choice-card">
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} />
      {picture}
      <span className="choice-card-title">{title}</span>
      <span className="choice-card-hint">{hint}</span>
    </label>
  );
}

function RemoveButton({ onClick }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="settings-icon-button settings-remove"
      aria-label={t("settings.remove")}
      title={t("settings.remove")}
      onClick={onClick}
    >
      <TrashIcon />
    </button>
  );
}

function InValueField({ index, value, onValue }) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => (Array.isArray(value) ? value.join(", ") : ""));
  return (
    <input
      type="text"
      data-testid={`condition-value-${index}`}
      placeholder={t("settings.inHint")}
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        onValue(parseInValue(next));
      }}
    />
  );
}

function ConditionValue({ condition, index, columns, draft, onChange }) {
  const { t } = useTranslation();
  const operator = condition.operator;
  const placeholder =
    roleFor(columns, condition.column) === "datetime" ? t("settings.datePlaceholder") : t("settings.value");
  const update = (value) => onChange(setCondition(draft, index, { value }, columns));

  if (operator === "empty" || operator === "not_empty") {
    return null;
  }
  if (operator === "between") {
    const pair = Array.isArray(condition.value) ? condition.value : ["", ""];
    const low = pair[0] ?? "";
    const high = pair[1] ?? "";
    return (
      <label className="settings-between">
        <span className="sr-only">{t("settings.value")}</span>
        <input
          type="text"
          data-testid={`condition-value-low-${index}`}
          placeholder={t("settings.from")}
          value={low}
          onChange={(event) => update([event.target.value, high])}
        />
        <span aria-hidden="true">–</span>
        <input
          type="text"
          data-testid={`condition-value-high-${index}`}
          placeholder={t("settings.to")}
          value={high}
          onChange={(event) => update([low, event.target.value])}
        />
      </label>
    );
  }
  if (operator === "in") {
    return (
      <label>
        <span className="sr-only">{t("settings.value")}</span>
        <InValueField index={index} value={condition.value} onValue={update} />
      </label>
    );
  }
  return (
    <label>
      <span className="sr-only">{t("settings.value")}</span>
      <input
        type="text"
        data-testid={`condition-value-${index}`}
        placeholder={placeholder}
        value={condition.value ?? ""}
        onChange={(event) => update(event.target.value)}
      />
    </label>
  );
}

function ColumnOptions({ columns }) {
  return columns.map((column) => (
    <option key={column.name} value={column.name}>
      {column.name}
    </option>
  ));
}

export default function SettingsForm({ columns, draft, onChange, onApply, errorMessage }) {
  const { t } = useTranslation();
  const combinatorWord = draft.combinator === "or" ? t("settings.or") : t("settings.and");

  function toggleGroupColumn(name, checked) {
    const names = checked
      ? [...draft.groupColumns, name]
      : draft.groupColumns.filter((item) => item !== name);
    onChange(setGroupColumns(draft, names, columns));
  }

  return (
    <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
      {typeof errorMessage === "string" && errorMessage !== "" ? (
        <p className="settings-error" data-testid="settings-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Step icon={<FilterIcon />} title={t("settings.filterTitle")} hint={t("settings.filterHint")}>
        {draft.conditions.length >= 2 ? (
          <div className="choice-cards" role="radiogroup" aria-label={t("settings.filterTitle")}>
            <ChoiceCard
              name="combinator"
              value="and"
              checked={draft.combinator === "and"}
              onSelect={() => onChange(setCombinator(draft, "and"))}
              picture={<VennIcon mode="all" />}
              title={t("settings.matchAll")}
              hint={t("settings.matchAllHint")}
            />
            <ChoiceCard
              name="combinator"
              value="or"
              checked={draft.combinator === "or"}
              onSelect={() => onChange(setCombinator(draft, "or"))}
              picture={<VennIcon mode="any" />}
              title={t("settings.matchAny")}
              hint={t("settings.matchAnyHint")}
            />
          </div>
        ) : null}

        {draft.conditions.length === 0 ? <p className="settings-empty">{t("settings.noConditions")}</p> : null}

        <div className="settings-list">
          {draft.conditions.map((condition, index) => (
            <Fragment key={index}>
              {index > 0 ? (
                <div className="settings-connector" data-combinator={draft.combinator} aria-hidden="true">
                  <span>{combinatorWord}</span>
                </div>
              ) : null}
              <div className="settings-card">
                <div className="settings-card-top">
                  <label className="settings-grow">
                    <span className="sr-only">{t("settings.column")}</span>
                    <select
                      data-testid={`condition-column-${index}`}
                      value={condition.column}
                      onChange={(event) =>
                        onChange(setCondition(draft, index, { column: event.target.value }, columns))
                      }
                    >
                      <ColumnOptions columns={columns} />
                    </select>
                  </label>
                  <RemoveButton onClick={() => onChange(removeCondition(draft, index))} />
                </div>
                <div className="settings-card-rule">
                  <label>
                    <span className="sr-only">{t("settings.operator")}</span>
                    <select
                      data-testid={`condition-operator-${index}`}
                      value={condition.operator}
                      onChange={(event) =>
                        onChange(setCondition(draft, index, { operator: event.target.value }, columns))
                      }
                    >
                      {operatorsForRole(roleFor(columns, condition.column)).map((operator) => (
                        <option key={operator} value={operator}>
                          {t(`operators.${operator}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ConditionValue
                    condition={condition}
                    index={index}
                    columns={columns}
                    draft={draft}
                    onChange={onChange}
                  />
                </div>
              </div>
            </Fragment>
          ))}
        </div>

        <button
          type="button"
          className="btn settings-add"
          data-testid="settings-add-condition"
          disabled={columns.length === 0}
          onClick={() => onChange(addCondition(draft, columns))}
        >
          <PlusIcon />
          {t("settings.addCondition")}
        </button>
      </Step>

      <Step icon={<SortIcon />} title={t("settings.sortTitle")} hint={t("settings.sortHint")}>
        {draft.sorts.length === 0 ? <p className="settings-empty">{t("settings.noSorts")}</p> : null}
        <div className="settings-list">
          {draft.sorts.map((sort, index) => (
            <Fragment key={index}>
              {index > 0 ? (
                <div className="settings-connector" aria-hidden="true">
                  <span>{t("settings.then")}</span>
                </div>
              ) : null}
              <div className="settings-card settings-sort">
                <span className="settings-sort-rank" aria-hidden="true">
                  {index + 1}
                </span>
                <label className="settings-grow">
                  <span className="sr-only">{t("settings.column")}</span>
                  <select
                    data-testid={`sort-column-${index}`}
                    value={sort.column}
                    onChange={(event) => onChange(setSort(draft, index, { column: event.target.value }))}
                  >
                    <ColumnOptions columns={columns} />
                  </select>
                </label>
                <div className="direction-toggle" role="group" aria-label={t("settings.direction")} data-testid={`sort-direction-${index}`}>
                  {[
                    ["asc", t("settings.ascending"), <ArrowUpIcon key="up" />],
                    ["desc", t("settings.descending"), <ArrowDownIcon key="down" />],
                  ].map(([direction, label, icon]) => (
                    <button
                      key={direction}
                      type="button"
                      data-direction={direction}
                      aria-pressed={sort.direction === direction ? "true" : "false"}
                      aria-label={label}
                      title={label}
                      onClick={() => onChange(setSort(draft, index, { direction }))}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <RemoveButton onClick={() => onChange(removeSort(draft, index))} />
              </div>
            </Fragment>
          ))}
        </div>
        <button
          type="button"
          className="btn settings-add"
          data-testid="settings-add-sort"
          disabled={!canAddSort(draft)}
          onClick={() => onChange(addSort(draft, columns))}
        >
          <PlusIcon />
          {t("settings.addSort")}
        </button>
      </Step>

      <Step icon={<GroupIcon />} title={t("settings.groupTitle")} hint={t("settings.groupHint")}>
        <fieldset className="settings-chips">
          <legend className="sr-only">{t("settings.groupColumns")}</legend>
          {columns
            .filter((column) => column.role !== "metric")
            .map((column) => (
              <label key={column.name}>
                <input
                  type="checkbox"
                  data-testid={`group-column-${column.name}`}
                  checked={draft.groupColumns.includes(column.name)}
                  onChange={(event) => toggleGroupColumn(column.name, event.target.checked)}
                />
                {column.name}
              </label>
            ))}
        </fieldset>
        {draft.groupColumns.length > 0 ? (
          <div className="choice-cards" role="radiogroup" aria-label={t("settings.groupTitle")}>
            <ChoiceCard
              name="groupMode"
              value="rowspan"
              checked={draft.groupMode === "rowspan"}
              onSelect={() => onChange(setGroupMode(draft, "rowspan"))}
              picture={<MergedTableIcon />}
              title={t("settings.merged")}
              hint={t("settings.mergedHint")}
            />
            <ChoiceCard
              name="groupMode"
              value="aggregate"
              checked={draft.groupMode === "aggregate"}
              onSelect={() => onChange(setGroupMode(draft, "aggregate"))}
              picture={<AggregatedTableIcon />}
              title={t("settings.aggregated")}
              hint={t("settings.aggregatedHint")}
            />
          </div>
        ) : null}
      </Step>

      <div className="settings-footer">
        <button
          type="button"
          className="btn btn-primary settings-apply"
          data-testid="settings-apply"
          onClick={() => onApply()}
        >
          {t("settings.apply")}
        </button>
      </div>
    </form>
  );
}
