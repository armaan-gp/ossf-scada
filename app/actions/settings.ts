"use server";

import { db } from "@/db";
import {
  alertEmailConfigTable,
  alertNotificationsTable,
  propertyAlertThresholdsTable,
  propertyDisplayOverridesTable,
  propertyDisplaySettingsTable,
} from "@/db/schema";
import { encrypt } from "@/lib/encrypt";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type AlertEmailConfigForm = {
  senderEmail: string;
  appPassword: string;
  recipients: string[];
};

/** Get alert email config for the settings form. Password is never returned. */
export async function getAlertEmailConfig(): Promise<AlertEmailConfigForm | null> {
  const row = await db.query.alertEmailConfigTable.findFirst();
  if (!row) return null;

  let recipients: string[] = [];
  try {
    const parsed = JSON.parse(row.recipientsJson || "[]");
    if (Array.isArray(parsed)) {
      recipients = parsed
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  } catch {
    // ignore
  }
  if (recipients.length === 0 && row.recipient?.includes("@")) recipients = [row.recipient.trim()];

  return {
    senderEmail: row.senderEmail ?? "",
    appPassword: "",
    recipients,
  };
}

/** Save only sender email and app password. */
export async function saveAlertEmailSenderConfig(senderEmail: string, appPassword: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const existing = await db.query.alertEmailConfigTable.findFirst();
    const encryptedPassword = appPassword ? encrypt(appPassword) : (existing?.appPasswordEncrypted ?? "");

    const updates = {
      senderEmail: senderEmail || "",
      appPasswordEncrypted: encryptedPassword,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(alertEmailConfigTable).set(updates).where(eq(alertEmailConfigTable.id, existing.id));
    } else {
      await db.insert(alertEmailConfigTable).values({
        senderEmail: updates.senderEmail,
        appPasswordEncrypted: updates.appPasswordEncrypted,
        recipientsJson: "[]",
        updatedAt: updates.updatedAt,
      });
    }
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}

/** Save only recipient email list. */
export async function saveAlertEmailRecipients(recipients: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const existing = await db.query.alertEmailConfigTable.findFirst();
    const recipientsJson = JSON.stringify(recipients);

    if (existing) {
      await db.update(alertEmailConfigTable).set({ recipientsJson, updatedAt: new Date() }).where(eq(alertEmailConfigTable.id, existing.id));
    } else {
      await db.insert(alertEmailConfigTable).values({
        senderEmail: "",
        appPasswordEncrypted: "",
        recipientsJson,
        updatedAt: new Date(),
      });
    }
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}

/** Check if we already sent alert email for this (thingId, propertyId) in this alert episode. */
export async function hasSentAlertEmail(thingId: string, propertyId: string): Promise<boolean> {
  const row = await db.query.alertNotificationsTable.findFirst({
    where: and(
      eq(alertNotificationsTable.thingId, thingId),
      eq(alertNotificationsTable.propertyId, propertyId)
    ),
  });
  return !!row;
}

/** Record that we sent an alert email for this (thingId, propertyId). */
export async function recordAlertEmailSent(thingId: string, propertyId: string): Promise<void> {
  await db.insert(alertNotificationsTable).values({
    thingId,
    propertyId,
  });
}

/** Remove record when property is back in range (so next out-of-range will trigger email again). */
export async function clearAlertEmailRecord(thingId: string, propertyId: string): Promise<void> {
  await db.delete(alertNotificationsTable).where(
    and(
      eq(alertNotificationsTable.thingId, thingId),
      eq(alertNotificationsTable.propertyId, propertyId)
    )
  );
}

export type PropertyThresholdRow = {
  thingId: string;
  propertyId: string;
  minValue: number | null;
  maxValue: number | null;
};

/** Get threshold for a property; returns null if no threshold is set. */
export async function getPropertyThreshold(
  thingId: string,
  propertyId: string
): Promise<{ min: number | null; max: number | null } | null> {
  const row = await db.query.propertyAlertThresholdsTable.findFirst({
    where: and(
      eq(propertyAlertThresholdsTable.thingId, thingId),
      eq(propertyAlertThresholdsTable.propertyId, propertyId)
    ),
  });
  if (!row) return null;
  return { min: row.minValue, max: row.maxValue };
}

/** Get all property thresholds (for Settings page list). */
export async function getAllPropertyThresholds(): Promise<PropertyThresholdRow[]> {
  const rows = await db.select().from(propertyAlertThresholdsTable);
  return rows.map((r) => ({
    thingId: r.thingId,
    propertyId: r.propertyId,
    minValue: r.minValue ?? null,
    maxValue: r.maxValue ?? null,
  }));
}

/** Delete a property threshold (revert to defaults). */
export async function deletePropertyThreshold(thingId: string, propertyId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.delete(propertyAlertThresholdsTable).where(
      and(
        eq(propertyAlertThresholdsTable.thingId, thingId),
        eq(propertyAlertThresholdsTable.propertyId, propertyId)
      )
    );
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete" };
  }
}

/** Get thresholds as a map keyed by "thingId:propertyId" for easy lookup. */
export async function getThresholdsMap(): Promise<Record<string, { min: number | null; max: number | null }>> {
  const rows = await db.select().from(propertyAlertThresholdsTable);
  const map: Record<string, { min: number | null; max: number | null }> = {};
  for (const r of rows) {
    map[`${r.thingId}:${r.propertyId}`] = { min: r.minValue ?? null, max: r.maxValue ?? null };
  }
  return map;
}

/** Save or update threshold for one property. minValue and maxValue can be null. */
export async function savePropertyThreshold(
  thingId: string,
  propertyId: string,
  minValue: number | null,
  maxValue: number | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const existing = await db.query.propertyAlertThresholdsTable.findFirst({
      where: and(
        eq(propertyAlertThresholdsTable.thingId, thingId),
        eq(propertyAlertThresholdsTable.propertyId, propertyId)
      ),
    });
    const row = {
      thingId,
      propertyId,
      minValue,
      maxValue,
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(propertyAlertThresholdsTable).set(row).where(eq(propertyAlertThresholdsTable.id, existing.id));
    } else {
      await db.insert(propertyAlertThresholdsTable).values(row);
    }
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}

/** Compute alert state for a list of properties (for client-side refresh). */
export async function getAlertStateForProperties(
  thingId: string,
  properties: { id: string; type?: string; last_value?: unknown }[]
): Promise<Record<string, boolean>> {
  const { isPropertyInAlert } = await import("@/lib/alertRanges");
  const result: Record<string, boolean> = {};
  for (const prop of properties) {
    const threshold = await getPropertyThreshold(thingId, prop.id);
    result[prop.id] = isPropertyInAlert(
      { type: prop.type ?? "", last_value: prop.last_value },
      threshold ?? undefined
    );
  }
  return result;
}

function normalizeDecimalPlaces(decimalPlaces: number | null): number | null {
  if (decimalPlaces === null) return null;
  if (!Number.isInteger(decimalPlaces)) {
    throw new Error("Decimal places must be a whole number.");
  }
  if (decimalPlaces < 0 || decimalPlaces > 10) {
    throw new Error("Decimal places must be between 0 and 10.");
  }
  return decimalPlaces;
}

export async function getGlobalDecimalPlaces(): Promise<number | null> {
  const row = await db.query.propertyDisplaySettingsTable.findFirst();
  return row?.globalDecimalPlaces ?? null;
}

export async function saveGlobalDecimalPlaces(decimalPlaces: number | null): Promise<{ ok: boolean; error?: string }> {
  try {
    const normalized = normalizeDecimalPlaces(decimalPlaces);
    const existing = await db.query.propertyDisplaySettingsTable.findFirst();
    const row = {
      globalDecimalPlaces: normalized,
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(propertyDisplaySettingsTable).set(row).where(eq(propertyDisplaySettingsTable.id, existing.id));
    } else {
      await db.insert(propertyDisplaySettingsTable).values(row);
    }
    revalidatePath("/app/settings");
    revalidatePath("/app/device/[id]", "page");
    revalidatePath("/app/center-map");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save decimal setting" };
  }
}

export async function getDecimalPlacesMap(): Promise<Record<string, number | null>> {
  const rows = await db.select().from(propertyDisplayOverridesTable);
  const map: Record<string, number | null> = {};
  for (const row of rows) {
    map[`${row.thingId}:${row.propertyId}`] = row.decimalPlaces ?? null;
  }
  return map;
}

export async function savePropertyDecimalPlaces(
  thingId: string,
  propertyId: string,
  decimalPlaces: number | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const normalized = normalizeDecimalPlaces(decimalPlaces);
    const existing = await db.query.propertyDisplayOverridesTable.findFirst({
      where: and(
        eq(propertyDisplayOverridesTable.thingId, thingId),
        eq(propertyDisplayOverridesTable.propertyId, propertyId)
      ),
    });

    if (existing) {
      await db
        .update(propertyDisplayOverridesTable)
        .set({ decimalPlaces: normalized, updatedAt: new Date() })
        .where(
          and(
            eq(propertyDisplayOverridesTable.thingId, thingId),
            eq(propertyDisplayOverridesTable.propertyId, propertyId)
          )
        );
    } else {
      await db.insert(propertyDisplayOverridesTable).values({
        thingId,
        propertyId,
        decimalPlaces: normalized,
        updatedAt: new Date(),
      });
    }

    revalidatePath("/app/settings");
    revalidatePath("/app/device/[id]", "page");
    revalidatePath("/app/center-map");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save property decimal setting" };
  }
}
