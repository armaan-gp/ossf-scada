"use client";

import { useMemo } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/dateUtils";

type Format = "datetime" | "time";

interface FormattedDateTimeProps {
  /** ISO date string from API/database */
  iso: string;
  /** "datetime" = date + time; "time" = time only */
  format?: Format;
  /** Optional class name for the wrapper span */
  className?: string;
}

/**
 * Renders a date/time in the user's timezone when in the browser, and CST when on the server.
 * Use this for all user-facing timestamps so they are consistent (CST fallback, user TZ preferred).
 */
export function FormattedDateTime({ iso, format = "datetime", className }: FormattedDateTimeProps) {
  const formatted = useMemo(() => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    const timeZone =
      typeof window !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone ?? DEFAULT_TIMEZONE
        : DEFAULT_TIMEZONE;
    const options: Intl.DateTimeFormatOptions =
      format === "time"
        ? { hour: "2-digit", minute: "2-digit", timeZone }
        : { dateStyle: "short", timeStyle: "medium", timeZone };
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }, [iso, format]);

  return <span className={className}>{formatted}</span>;
}
