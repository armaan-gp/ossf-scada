import "server-only";

import { db } from "@/db";
import {
  propertyAlertThresholdsTable,
  propertyRecordingConfigsTable,
  propertyRecordingRowsTable,
} from "@/db/schema";
import { getThing } from "@/lib/arduinoInit";
import { isPropertyInAlert } from "@/lib/alertRanges";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
} from "drizzle-orm";

export type RecordingConfigInput = {
  enabled: boolean;
  intervalMinutes: number | null;
  maxRows: number | null;
  resetExistingData?: boolean;
};

export type RecordingConfigView = {
  enabled: boolean;
  intervalMinutes: number | null;
  maxRows: number | null;
};

export type RecordingRowView = {
  recordedAt: Date;
  value: string;
  alertCount: number;
};

function normalizeRecordedValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isPositiveInteger(value: number | null): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

async function clearRowsForProperty(thingId: string, propertyId: string): Promise<void> {
  await db.delete(propertyRecordingRowsTable).where(
    and(
      eq(propertyRecordingRowsTable.thingId, thingId),
      eq(propertyRecordingRowsTable.propertyId, propertyId)
    )
  );
}

export async function getRecordingConfigsMap(): Promise<Record<string, RecordingConfigView>> {
  const rows = await db.select().from(propertyRecordingConfigsTable);
  const map: Record<string, RecordingConfigView> = {};
  for (const row of rows) {
    map[`${row.thingId}:${row.propertyId}`] = {
      enabled: row.enabled,
      intervalMinutes: row.intervalMinutes ?? null,
      maxRows: row.maxRows ?? null,
    };
  }
  return map;
}

export async function getRecordingConfigsForThing(thingId: string): Promise<Record<string, RecordingConfigView>> {
  const rows = await db.select().from(propertyRecordingConfigsTable).where(eq(propertyRecordingConfigsTable.thingId, thingId));
  const map: Record<string, RecordingConfigView> = {};
  for (const row of rows) {
    map[row.propertyId] = {
      enabled: row.enabled,
      intervalMinutes: row.intervalMinutes ?? null,
      maxRows: row.maxRows ?? null,
    };
  }
  return map;
}

export async function saveRecordingConfig(
  thingId: string,
  propertyId: string,
  input: RecordingConfigInput
): Promise<{ ok: boolean; error?: string; requiresReset?: boolean }> {
  const existing = await db.query.propertyRecordingConfigsTable.findFirst({
    where: and(
      eq(propertyRecordingConfigsTable.thingId, thingId),
      eq(propertyRecordingConfigsTable.propertyId, propertyId)
    ),
  });

  const now = new Date();
  const reset = input.resetExistingData === true;

  if (!input.enabled) {
    if (!reset && existing?.enabled) {
      return {
        ok: false,
        requiresReset: true,
        error: "Disabling recording requires clearing existing rows first.",
      };
    }
    if (reset) {
      await clearRowsForProperty(thingId, propertyId);
    }

    const row = {
      thingId,
      propertyId,
      enabled: false,
      intervalMinutes: null,
      maxRows: null,
      lastRecordedAt: null as Date | null,
      updatedAt: now,
    };

    if (existing) {
      await db
        .update(propertyRecordingConfigsTable)
        .set(row)
        .where(
          and(
            eq(propertyRecordingConfigsTable.thingId, thingId),
            eq(propertyRecordingConfigsTable.propertyId, propertyId)
          )
        );
    } else {
      await db.insert(propertyRecordingConfigsTable).values(row);
    }
    return { ok: true };
  }

  if (!isPositiveInteger(input.intervalMinutes) || !isPositiveInteger(input.maxRows)) {
    return { ok: false, error: "Interval and max rows must be positive whole numbers." };
  }

  const intervalChanged = !!existing && existing.intervalMinutes !== input.intervalMinutes;
  const maxRowsChanged = !!existing && existing.maxRows !== input.maxRows;
  const dataResetRequired = intervalChanged || maxRowsChanged;

  if (!reset && dataResetRequired) {
    return {
      ok: false,
      requiresReset: true,
      error: "Changing interval or max rows requires clearing existing rows first.",
    };
  }

  if (reset) {
    await clearRowsForProperty(thingId, propertyId);
  }

  const row = {
    thingId,
    propertyId,
    enabled: true,
    intervalMinutes: input.intervalMinutes,
    maxRows: input.maxRows,
    lastRecordedAt: reset ? null : (existing?.lastRecordedAt ?? null),
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(propertyRecordingConfigsTable)
      .set(row)
      .where(
        and(
          eq(propertyRecordingConfigsTable.thingId, thingId),
          eq(propertyRecordingConfigsTable.propertyId, propertyId)
        )
      );
  } else {
    await db.insert(propertyRecordingConfigsTable).values(row);
  }

  return { ok: true };
}

export async function clearRecordingData(thingId: string, propertyId: string): Promise<void> {
  await clearRowsForProperty(thingId, propertyId);
  await db
    .update(propertyRecordingConfigsTable)
    .set({ lastRecordedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(propertyRecordingConfigsTable.thingId, thingId),
        eq(propertyRecordingConfigsTable.propertyId, propertyId)
      )
    );
}

export async function getRecordingPreviewRows(
  thingId: string,
  propertyId: string,
  limit = 100
): Promise<RecordingRowView[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const rows = await db
    .select({
      recordedAt: propertyRecordingRowsTable.recordedAt,
      value: propertyRecordingRowsTable.value,
      alertCount: propertyRecordingRowsTable.alertCount,
    })
    .from(propertyRecordingRowsTable)
    .where(
      and(
        eq(propertyRecordingRowsTable.thingId, thingId),
        eq(propertyRecordingRowsTable.propertyId, propertyId)
      )
    )
    .orderBy(desc(propertyRecordingRowsTable.recordedAt), desc(propertyRecordingRowsTable.id))
    .limit(safeLimit);
  return rows;
}

function escapeCsvValue(raw: string): string {
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function buildRecordingCsv(thingId: string, propertyId: string): Promise<string> {
  const rows = await db
    .select({
      recordedAt: propertyRecordingRowsTable.recordedAt,
      value: propertyRecordingRowsTable.value,
      alertCount: propertyRecordingRowsTable.alertCount,
    })
    .from(propertyRecordingRowsTable)
    .where(
      and(
        eq(propertyRecordingRowsTable.thingId, thingId),
        eq(propertyRecordingRowsTable.propertyId, propertyId)
      )
    )
    .orderBy(asc(propertyRecordingRowsTable.recordedAt), asc(propertyRecordingRowsTable.id));

  const lines = ["datetime,value,alerts"];
  for (const row of rows) {
    const datetimeIso = row.recordedAt.toISOString();
    lines.push(
      `${escapeCsvValue(datetimeIso)},${escapeCsvValue(row.value)},${row.alertCount}`
    );
  }
  return lines.join("\n");
}

async function trimRowsToMax(thingId: string, propertyId: string, maxRows: number): Promise<void> {
  const rows = await db
    .select({ id: propertyRecordingRowsTable.id })
    .from(propertyRecordingRowsTable)
    .where(
      and(
        eq(propertyRecordingRowsTable.thingId, thingId),
        eq(propertyRecordingRowsTable.propertyId, propertyId)
      )
    )
    .orderBy(desc(propertyRecordingRowsTable.recordedAt), desc(propertyRecordingRowsTable.id));

  if (rows.length <= maxRows) return;
  const staleIds = rows.slice(maxRows).map((r) => r.id);
  if (staleIds.length === 0) return;

  await db.delete(propertyRecordingRowsTable).where(inArray(propertyRecordingRowsTable.id, staleIds));
}

export async function collectDueRecordingRows(): Promise<{
  checked: number;
  recorded: number;
  skipped: number;
}> {
  const now = new Date();
  const configs = await db
    .select()
    .from(propertyRecordingConfigsTable)
    .where(eq(propertyRecordingConfigsTable.enabled, true));

  const thingCache = new Map<string, Awaited<ReturnType<typeof getThing>>>();
  let recorded = 0;
  let skipped = 0;

  for (const cfg of configs) {
    if (!isPositiveInteger(cfg.intervalMinutes) || !isPositiveInteger(cfg.maxRows)) {
      skipped++;
      continue;
    }

    if (cfg.lastRecordedAt) {
      const elapsedMs = now.getTime() - cfg.lastRecordedAt.getTime();
      const dueMs = cfg.intervalMinutes * 60 * 1000;
      if (elapsedMs < dueMs) {
        skipped++;
        continue;
      }
    }

    let thing = thingCache.get(cfg.thingId);
    if (!thing) {
      try {
        thing = await getThing(cfg.thingId);
        thingCache.set(cfg.thingId, thing);
      } catch {
        skipped++;
        continue;
      }
    }

    const properties = (thing.properties ?? []) as Array<{
      id: string;
      type?: string;
      last_value?: unknown;
    }>;
    const property = properties.find((p) => p.id === cfg.propertyId);
    if (!property) {
      skipped++;
      continue;
    }

    const threshold = await db.query.propertyAlertThresholdsTable.findFirst({
      where: and(
        eq(propertyAlertThresholdsTable.thingId, cfg.thingId),
        eq(propertyAlertThresholdsTable.propertyId, cfg.propertyId)
      ),
    });

    const inAlert = isPropertyInAlert(
      { type: property.type ?? "", last_value: property.last_value },
      threshold ? { min: threshold.minValue, max: threshold.maxValue } : undefined
    );

    await db.insert(propertyRecordingRowsTable).values({
      thingId: cfg.thingId,
      propertyId: cfg.propertyId,
      recordedAt: now,
      value: normalizeRecordedValue(property.last_value),
      alertCount: inAlert ? 1 : 0,
    });

    await trimRowsToMax(cfg.thingId, cfg.propertyId, cfg.maxRows);

    await db
      .update(propertyRecordingConfigsTable)
      .set({ lastRecordedAt: now, updatedAt: now })
      .where(
        and(
          eq(propertyRecordingConfigsTable.thingId, cfg.thingId),
          eq(propertyRecordingConfigsTable.propertyId, cfg.propertyId)
        )
      );

    recorded++;
  }

  return { checked: configs.length, recorded, skipped };
}
