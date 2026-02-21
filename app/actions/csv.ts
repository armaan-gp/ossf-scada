"use server";

import { db } from "@/db";
import {
  propertyCsvConfigTable,
  propertyCsvRecordsTable,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { formatDateForCsv, formatTimeForCsv, DEFAULT_TIMEZONE } from "@/lib/dateUtils";

export type CsvRecordingConfig = {
  enabled: boolean;
  intervalMinutes: number | null;
  maxRows: number | null;
};

/** Get all CSV recording configs keyed by "thingId:propertyId". */
export async function getCsvRecordingConfigMap(): Promise<
  Record<string, CsvRecordingConfig>
> {
  const rows = await db.select().from(propertyCsvConfigTable);
  const map: Record<string, CsvRecordingConfig> = {};
  for (const r of rows) {
    const key = `${r.thingId}:${r.propertyId}`;
    map[key] = {
      enabled: r.enabled,
      intervalMinutes: r.intervalMinutes ?? null,
      maxRows: r.maxRows ?? null,
    };
  }
  return map;
}

/** Clear all recorded rows for a property (used when config changes or recording disabled). */
export async function clearPropertyCsvRecords(
  thingId: string,
  propertyId: string
): Promise<void> {
  await db
    .delete(propertyCsvRecordsTable)
    .where(
      and(
        eq(propertyCsvRecordsTable.thingId, thingId),
        eq(propertyCsvRecordsTable.propertyId, propertyId)
      )
    );
}

/** Save CSV recording config for one property. If clearExistingRecords is true, deletes all stored rows first. */
export async function saveCsvRecordingConfig(
  thingId: string,
  propertyId: string,
  config: {
    enabled: boolean;
    intervalMinutes: number | null;
    maxRows: number | null;
  },
  clearExistingRecords: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (clearExistingRecords) {
      await clearPropertyCsvRecords(thingId, propertyId);
    }

    if (config.enabled && (config.intervalMinutes == null || config.maxRows == null)) {
      return {
        ok: false,
        error: "When recording is on, interval (minutes) and max rows are required.",
      };
    }

    const existing = await db.query.propertyCsvConfigTable.findFirst({
      where: and(
        eq(propertyCsvConfigTable.thingId, thingId),
        eq(propertyCsvConfigTable.propertyId, propertyId)
      ),
    });

    const row = {
      thingId,
      propertyId,
      enabled: config.enabled,
      intervalMinutes: config.intervalMinutes,
      maxRows: config.maxRows,
      lastRecordedAt: config.enabled ? existing?.lastRecordedAt ?? null : null,
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(propertyCsvConfigTable)
        .set(row)
        .where(eq(propertyCsvConfigTable.id, existing.id));
    } else {
      await db.insert(propertyCsvConfigTable).values({
        ...row,
        lastRecordedAt: null,
      });
    }

    revalidatePath("/app/settings");
    revalidatePath("/app/device");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save",
    };
  }
}

export type CsvDataRow = {
  date: string;
  time: string;
  value: string;
  alerts: number;
};

/** Get recorded CSV rows for a property (for preview and download). */
export async function getPropertyCsvData(
  thingId: string,
  propertyId: string
): Promise<CsvDataRow[]> {
  const rows = await db
    .select()
    .from(propertyCsvRecordsTable)
    .where(
      and(
        eq(propertyCsvRecordsTable.thingId, thingId),
        eq(propertyCsvRecordsTable.propertyId, propertyId)
      )
    )
    .orderBy(propertyCsvRecordsTable.recordedAt);

  const tz = DEFAULT_TIMEZONE;
  return rows.map((r) => ({
    date: formatDateForCsv(new Date(r.recordedAt), tz),
    time: formatTimeForCsv(new Date(r.recordedAt), tz),
    value: r.value,
    alerts: r.alerts,
  }));
}

/** Get CSV config for a single property (for device page to show preview/download only when recording enabled, or always show). */
export async function getCsvConfigForProperty(
  thingId: string,
  propertyId: string
): Promise<CsvRecordingConfig | null> {
  const row = await db.query.propertyCsvConfigTable.findFirst({
    where: and(
      eq(propertyCsvConfigTable.thingId, thingId),
      eq(propertyCsvConfigTable.propertyId, propertyId)
    ),
  });
  if (!row) return null;
  return {
    enabled: row.enabled,
    intervalMinutes: row.intervalMinutes ?? null,
    maxRows: row.maxRows ?? null,
  };
}
