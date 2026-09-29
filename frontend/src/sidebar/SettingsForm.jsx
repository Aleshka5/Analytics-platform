import { useState } from "react";
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

function InValueField({ index, value, onValue }) {
  const [text, setText] = useState(() => (Array.isArray(value) ? value.join(", ") : ""));

  return (
    <input
      type="text"
      data-testid={`condition-value-${index}`}
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

  if (operator === "empty" || operator === "not_empty") {
    return null;
  }

  if (operator === "between") {
    const pair = Array.isArray(condition.value) ? condition.value : ["", ""];
    const low = pair[0] ?? "";
    const high = pair[1] ?? "";
    return (
      <label>
        {t("settings.value")}
        <input
          type="text"
          data-testid={`condition-value-low-${index}`}
          value={low}
          onChange={(event) =>
            onChange(
              setCondition(
                draft,
                index,
                { value: [event.target.value, high] },
                columns,
              ),
            )
          }
        />
        <input
          type="text"
          data-testid={`condition-value-high-${index}`}
          value={high}
          onChange={(event) =>
            onChange(
              setCondition(
                draft,
                index,
                { value: [low, event.target.value] },
                columns,
              ),
            )
          }
        />
      </label>
    );
  }

  if (operator === "in") {
    return (
      <label>
        {t("settings.value")}
        <InValueField
          index={index}
          value={condition.value}
          onValue={(next) =>
            onChange(setCondition(draft, index, { value: next }, columns))
          }
        />
      </label>
    );
  }

  return (
    <label>
      {t("settings.value")}
      <input
        type="text"
        data-testid={`condition-value-${index}`}
        value={condition.value ?? ""}
        onChange={(event) =>
          onChange(
            setCondition(
              draft,
              index,
              { value: event.target.value },
              columns,
            ),
          )
        }
      />
    </label>
  );
}

export default function SettingsForm({ columns, draft, onChange, onApply, errorMessage }) {
  const { t } = useTranslation();

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
      <div className="settings-section">
        <label className="settings-choice">
          <input
            type="radio"
            name="combinator"
            value="and"
            checked={draft.combinator === "and"}
            onChange={() => onChange(setCombinator(draft, "and"))}
          />
          {t("settings.matchAll")}
        </label>
        <label className="settings-choice">
          <input
            type="radio"
            name="combinator"
            value="or"
            checked={draft.combinator === "or"}
            onChange={() => onChange(setCombinator(draft, "or"))}
          />
          {t("settings.matchAny")}
        </label>
      </div>

      <div className="settings-section">
        <button
          type="button"
          data-testid="settings-add-condition"
          disabled={columns.length === 0}
          onClick={() => onChange(addCondition(draft, columns))}
        >
          {t("settings.addCondition")}
        </button>
        {draft.conditions.map((condition, index) => (
          <div className="settings-row" key={index}>
            <label>
              {t("settings.column")}
              <select
                data-testid={`condition-column-${index}`}
                value={condition.column}
                onChange={(event) =>
                  onChange(
                    setCondition(
                      draft,
                      index,
                      { column: event.target.value },
                      columns,
                    ),
                  )
                }
              >
                {columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("settings.operator")}
              <select
                data-testid={`condition-operator-${index}`}
                value={condition.operator}
                onChange={(event) =>
                  onChange(
                    setCondition(
                      draft,
                      index,
                      { operator: event.target.value },
                      columns,
                    ),
                  )
                }
              >
                {operatorsForRole(roleFor(columns, condition.column)).map(
                  (operator) => (
                    <option key={operator} value={operator}>
                      {operator}
                    </option>
                  ),
                )}
              </select>
            </label>
            <ConditionValue
              condition={condition}
              index={index}
              columns={columns}
              draft={draft}
              onChange={onChange}
            />
            <button
              type="button"
              onClick={() => onChange(removeCondition(draft, index))}
            >
              {t("settings.remove")}
            </button>
          </div>
        ))}
      </div>

      <div className="settings-section">
        <button
          type="button"
          data-testid="settings-add-sort"
          disabled={!canAddSort(draft)}
          onClick={() => onChange(addSort(draft, columns))}
        >
          {t("settings.addSort")}
        </button>
        {draft.sorts.map((sort, index) => (
          <div className="settings-row" key={index}>
            <label>
              {t("settings.column")}
              <select
                data-testid={`sort-column-${index}`}
                value={sort.column}
                onChange={(event) =>
                  onChange(
                    setSort(draft, index, { column: event.target.value }),
                  )
                }
              >
                {columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
            <select
              data-testid={`sort-direction-${index}`}
              value={sort.direction}
              onChange={(event) =>
                onChange(
                  setSort(draft, index, { direction: event.target.value }),
                )
              }
            >
              <option value="asc">{t("settings.ascending")}</option>
              <option value="desc">{t("settings.descending")}</option>
            </select>
            <button
              type="button"
              onClick={() => onChange(removeSort(draft, index))}
            >
              {t("settings.remove")}
            </button>
          </div>
        ))}
      </div>

      <fieldset className="settings-section">
        <legend>{t("settings.groupColumns")}</legend>
        {columns
          .filter((column) => column.role !== "metric")
          .map((column) => (
            <label className="settings-choice" key={column.name}>
              <input
                type="checkbox"
                data-testid={`group-column-${column.name}`}
                checked={draft.groupColumns.includes(column.name)}
                onChange={(event) =>
                  toggleGroupColumn(column.name, event.target.checked)
                }
              />
              {column.name}
            </label>
          ))}
      </fieldset>

      <div className="settings-section">
        <label className="settings-choice">
          <input
            type="radio"
            name="groupMode"
            value="rowspan"
            checked={draft.groupMode === "rowspan"}
            onChange={() => onChange(setGroupMode(draft, "rowspan"))}
          />
          {t("settings.merged")}
        </label>
        <label className="settings-choice">
          <input
            type="radio"
            name="groupMode"
            value="aggregate"
            checked={draft.groupMode === "aggregate"}
            onChange={() => onChange(setGroupMode(draft, "aggregate"))}
          />
          {t("settings.aggregated")}
        </label>
      </div>

      <button type="button" data-testid="settings-apply" onClick={() => onApply()}>
        {t("settings.apply")}
      </button>
    </form>
  );
}
