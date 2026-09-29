export function formatNumber(value, locale) {
  if (value === null || value === undefined) {
    return null;
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

export function formatDate(value, locale) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
    return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(date);
  }
  return value;
}
