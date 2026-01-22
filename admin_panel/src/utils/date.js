const DEFAULT_LOCALE = "uk-UA";
const DATE_FORMAT = { day: "2-digit", month: "short", year: "numeric" };
const DATE_TIME_FORMAT = {
  ...DATE_FORMAT,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const str = String(value).trim();
  if (!str) return null;
  const normalized = str.includes(" ") ? str.replace(" ", "T") : str;
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date;
  const utcDate = new Date(`${normalized}Z`);
  return Number.isNaN(utcDate.getTime()) ? null : utcDate;
}

function formatDateTime(value, locale = DEFAULT_LOCALE) {
  const date = toDate(value);
  return date ? date.toLocaleString(locale, DATE_TIME_FORMAT) : "—";
}

function formatDate(value, locale = DEFAULT_LOCALE) {
  const date = toDate(value);
  return date ? date.toLocaleDateString(locale, DATE_FORMAT) : "—";
}

function formatTime(value, locale = DEFAULT_LOCALE) {
  const date = toDate(value);
  return date ? date.toLocaleTimeString(locale) : "—";
}

export { formatDateTime, formatDate, formatTime, toDate };
