/**
 * The backend stores opens_at/closes_at as naive datetimes whose digits
 * represent UTC (see `is_accepting_submissions` in
 * `collection_campaign.py`, which reads a naive value as UTC without
 * converting it). Browsers parse a date-time string with no "Z"/offset
 * as LOCAL time, so every place that reads or writes one of these
 * fields must explicitly convert between the visitor's local wall
 * clock and that UTC representation -- otherwise the enforced deadline
 * silently drifts by the browser's UTC offset (the bug that made a
 * request with a future closing time look already closed).
 */

/** Parse a backend opens_at/closes_at value (naive digits representing UTC) into a correct Date. */
export function parseBackendUtc(isoValue: string): Date {
  const trimmed = isoValue.trim();
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(trimmed);
  const normalized = hasZone ? trimmed : `${trimmed.slice(0, 19)}Z`;
  return new Date(normalized);
}

/** Backend UTC timestamp -> value for <input type="datetime-local">, in the browser's local time. */
export function utcIsoToLocalInputValue(isoValue: string): string {
  if (!isoValue) {
    return "";
  }

  const date = parseBackendUtc(isoValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local"> value (local wall time) -> naive UTC digits to send to the backend. */
export function localInputValueToUtcIso(localValue: string): string {
  if (!localValue) {
    return "";
  }

  // No timezone in this string, so the browser correctly treats it as
  // local wall time when constructing the Date.
  const date = new Date(localValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 19);
}

/** Backend UTC timestamp -> human-readable string in the viewer's local time. */
export function formatUtcForDisplay(
  isoValue: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!isoValue) {
    return "Not specified";
  }

  const date = parseBackendUtc(isoValue);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    options ?? {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}
