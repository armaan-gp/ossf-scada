import "server-only";
import { db } from "@/db";
import {
  propertyCsvConfigTable,
  propertyCsvRecordsTable,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getThing } from "@/lib/arduinoInit";
import { getPropertyThreshold } from "@/app/actions/settings";
import { isPropertyInAlert } from "@/lib/alertRanges";

/**
 * Run one pass of CSV recording: for each enabled config whose interval has elapsed,
 * record current value and alert state, then trim to max rows.
 */
export async function runCsvRecording(): Promise<{ recorded: number; errors: string[] }> {
  const configs = await db
    .select()
    .from(propertyCsvConfigTable)
    .where(eq(propertyCsvConfigTable.enabled, true));

  const now = new Date();
  const errors: string[] = [];
  let recorded = 0;

  for (const config of configs) {
    const intervalMinutes = config.intervalMinutes ?? 0;
    const maxRows = config.maxRows ?? 0;
    if (intervalMinutes <= 0 || maxRows <= 0) continue;

    const lastAt = config.lastRecordedAt ? new Date(config.lastRecordedAt) : null;
    const elapsedMs = lastAt ? now.getTime() - lastAt.getTime() : Infinity;
    const intervalMs = intervalMinutes * 60 * 1000;
    if (elapsedMs < intervalMs) continue;

    try {
      const thing = await getThing(config.thingId);
      const properties = (thing.properties ?? []) as any[];
      const prop = properties.find((p: any) => p.id === config.propertyId);
      if (!prop) {
        errors.push(`Property ${config.propertyId} not found for thing ${config.thingId}`);
        continue;
      }

      const threshold = await getPropertyThreshold(config.thingId, config.propertyId);
      const inAlert = isPropertyInAlert(
        { type: prop.type ?? "", last_value: prop.last_value },
        threshold ?? undefined
      );
      const valueStr = String(prop.last_value ?? "");

      await db.insert(propertyCsvRecordsTable).values({
        thingId: config.thingId,
        propertyId: config.propertyId,
        recordedAt: now,
        value: valueStr,
        alerts: inAlert ? 1 : 0,
      });

      // Keep only the last maxRows rows (delete oldest)
      const allRows = await db
        .select({ id: propertyCsvRecordsTable.id })
        .from(propertyCsvRecordsTable)
        .where(
          and(
            eq(propertyCsvRecordsTable.thingId, config.thingId),
            eq(propertyCsvRecordsTable.propertyId, config.propertyId)
          )
        )
        .orderBy(desc(propertyCsvRecordsTable.recordedAt));

      if (allRows.length > maxRows) {
        const idsToDelete = allRows.slice(maxRows).map((r) => r.id);
        for (const id of idsToDelete) {
          await db.delete(propertyCsvRecordsTable).where(eq(propertyCsvRecordsTable.id, id));
        }
      }

      await db
        .update(propertyCsvConfigTable)
        .set({ lastRecordedAt: now, updatedAt: now })
        .where(eq(propertyCsvConfigTable.id, config.id));

      recorded++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${config.thingId}/${config.propertyId}: ${msg}`);
    }
  }

  return { recorded, errors };
}
