import "server-only";

import { db } from "@/db";
import {
  activeAlertEpisodesTable,
  alertEventsTable,
  propertyDisplayOverridesTable,
  propertyDisplaySettingsTable,
} from "@/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

const MAX_ALERT_EVENT_ROWS = 10000;

export type AlertEventView = {
  occurredAt: Date;
  thingId: string;
  thingName: string;
  propertyId: string;
  propertyName: string;
  propertyType: string;
  valueRaw: string;
};

function normalizeRawValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeCsvValue(raw: string): string {
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function isFloatType(type: string | null | undefined): boolean {
  return (type ?? "").toUpperCase() === "FLOAT";
}

function formatCsvAlertValueForFloat(raw: string, decimalPlaces: number | null): string {
  if (decimalPlaces === null) return raw;
  if (raw.trim() === "") return raw;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return raw;
  return parsed.toFixed(decimalPlaces);
}

async function getAlertDecimalFormattingContext(): Promise<{
  globalDecimalPlaces: number | null;
  perPropertyDecimalMap: Map<string, number | null>;
}> {
  const [overrideRows, globalRow] = await Promise.all([
    db.select().from(propertyDisplayOverridesTable),
    db.query.propertyDisplaySettingsTable.findFirst(),
  ]);

  const perPropertyDecimalMap = new Map<string, number | null>();
  for (const row of overrideRows) {
    perPropertyDecimalMap.set(`${row.thingId}:${row.propertyId}`, row.decimalPlaces ?? null);
  }

  return {
    globalDecimalPlaces: globalRow?.globalDecimalPlaces ?? null,
    perPropertyDecimalMap,
  };
}

function formatAlertValue(
  row: Pick<AlertEventView, "thingId" | "propertyId" | "propertyType" | "valueRaw">,
  ctx: { globalDecimalPlaces: number | null; perPropertyDecimalMap: Map<string, number | null> }
): string {
  const decimalPlaces =
    ctx.perPropertyDecimalMap.get(`${row.thingId}:${row.propertyId}`) ?? ctx.globalDecimalPlaces;
  return isFloatType(row.propertyType)
    ? formatCsvAlertValueForFloat(row.valueRaw, decimalPlaces)
    : row.valueRaw;
}

async function trimAlertEventsToMax(maxRows: number): Promise<void> {
  const rows = await db
    .select({ id: alertEventsTable.id })
    .from(alertEventsTable)
    .orderBy(desc(alertEventsTable.occurredAt), desc(alertEventsTable.id));

  if (rows.length <= maxRows) return;
  const staleIds = rows.slice(maxRows).map((r) => r.id);
  if (staleIds.length === 0) return;
  await db.delete(alertEventsTable).where(inArray(alertEventsTable.id, staleIds));
}

export async function markAlertEpisodeActive(input: {
  thingId: string;
  thingName: string;
  propertyId: string;
  propertyName: string;
  propertyType: string;
  now?: Date;
}): Promise<{ isNew: boolean }> {
  const now = input.now ?? new Date();
  const existing = await db.query.activeAlertEpisodesTable.findFirst({
    where: and(
      eq(activeAlertEpisodesTable.thingId, input.thingId),
      eq(activeAlertEpisodesTable.propertyId, input.propertyId)
    ),
  });

  if (existing) {
    await db
      .update(activeAlertEpisodesTable)
      .set({
        thingName: input.thingName,
        propertyName: input.propertyName,
        propertyType: input.propertyType,
        lastSeenAt: now,
      })
      .where(
        and(
          eq(activeAlertEpisodesTable.thingId, input.thingId),
          eq(activeAlertEpisodesTable.propertyId, input.propertyId)
        )
      );
    return { isNew: false };
  }

  await db.insert(activeAlertEpisodesTable).values({
    thingId: input.thingId,
    propertyId: input.propertyId,
    thingName: input.thingName,
    propertyName: input.propertyName,
    propertyType: input.propertyType,
    startedAt: now,
    lastSeenAt: now,
  });
  return { isNew: true };
}

export async function clearAlertEpisode(thingId: string, propertyId: string): Promise<void> {
  await db.delete(activeAlertEpisodesTable).where(
    and(
      eq(activeAlertEpisodesTable.thingId, thingId),
      eq(activeAlertEpisodesTable.propertyId, propertyId)
    )
  );
}

export async function recordAlertEvent(input: {
  thingId: string;
  thingName: string;
  propertyId: string;
  propertyName: string;
  propertyType: string;
  value: unknown;
  occurredAt?: Date;
}): Promise<void> {
  await db.insert(alertEventsTable).values({
    thingId: input.thingId,
    thingName: input.thingName,
    propertyId: input.propertyId,
    propertyName: input.propertyName,
    propertyType: input.propertyType,
    valueRaw: normalizeRawValue(input.value),
    occurredAt: input.occurredAt ?? new Date(),
  });
  await trimAlertEventsToMax(MAX_ALERT_EVENT_ROWS);
}

export async function getAlertEventRows(limit = 100): Promise<AlertEventView[]> {
  const safeLimit = Math.min(Math.max(limit, 1), MAX_ALERT_EVENT_ROWS);
  const [rows, decimalContext] = await Promise.all([
    db
      .select({
        occurredAt: alertEventsTable.occurredAt,
        thingId: alertEventsTable.thingId,
        thingName: alertEventsTable.thingName,
        propertyId: alertEventsTable.propertyId,
        propertyName: alertEventsTable.propertyName,
        propertyType: alertEventsTable.propertyType,
        valueRaw: alertEventsTable.valueRaw,
      })
      .from(alertEventsTable)
      .orderBy(desc(alertEventsTable.occurredAt), desc(alertEventsTable.id))
      .limit(safeLimit),
    getAlertDecimalFormattingContext(),
  ]);

  return rows.map((row) => ({
    ...row,
    valueRaw: formatAlertValue(row, decimalContext),
  }));
}

export async function buildAlertEventsCsv(): Promise<string> {
  const [rows, decimalContext] = await Promise.all([
    db
      .select({
        occurredAt: alertEventsTable.occurredAt,
        thingId: alertEventsTable.thingId,
        thingName: alertEventsTable.thingName,
        propertyId: alertEventsTable.propertyId,
        propertyName: alertEventsTable.propertyName,
        propertyType: alertEventsTable.propertyType,
        valueRaw: alertEventsTable.valueRaw,
      })
      .from(alertEventsTable)
      .orderBy(asc(alertEventsTable.occurredAt), asc(alertEventsTable.id)),
    getAlertDecimalFormattingContext(),
  ]);

  const lines = ["datetime,plc_name,plc_id,property_name,property_id,property_type,value"];
  for (const row of rows) {
    const value = formatAlertValue(row, decimalContext);

    lines.push(
      [
        escapeCsvValue(row.occurredAt.toISOString()),
        escapeCsvValue(row.thingName),
        escapeCsvValue(row.thingId),
        escapeCsvValue(row.propertyName),
        escapeCsvValue(row.propertyId),
        escapeCsvValue(row.propertyType),
        escapeCsvValue(value),
      ].join(",")
    );
  }

  return lines.join("\n");
}
