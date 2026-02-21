/**
 * Default timezone when user's timezone is not available (e.g. server render).
 * Central Standard Time (America/Chicago) — GMT-6.
 */
export const DEFAULT_TIMEZONE = "America/Chicago";

/**
 * Format an ISO date string in a given timezone.
 * Use for server-side or when you explicitly want a specific timezone.
 */
export function formatInTimeZone(
  iso: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    ...options,
  }).format(date);
}

/**
 * Format as full date and time (e.g. "1/15/2025, 2:30:00 PM").
 */
export function formatDateTime(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(iso, timeZone, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

/**
 * Format as time only (e.g. "2:30 PM").
 */
export function formatTimeOnly(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(iso, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
