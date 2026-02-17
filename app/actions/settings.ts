"use server";

import { db } from "@/db";
import {
  smsConfigTable,
  alertNotificationsTable,
  propertyAlertThresholdsTable,
} from "@/db/schema";
import { encrypt } from "@/lib/encrypt";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type SmsRecipientEntry = { phoneNumber: string; carrier: string };

export type SmsConfigForm = {
  senderEmail: string;
  appPassword: string;
  recipients: SmsRecipientEntry[];
};

/** Get SMS config for the settings form. Password is never returned. Migrates legacy recipient into recipientsJson on first read. */
export async function getSmsConfig(): Promise<SmsConfigForm | null> {
  const row = await db.query.smsConfigTable.findFirst();
  if (!row) return null;

  let recipients: SmsRecipientEntry[] = [];
  try {
    const parsed = JSON.parse(row.recipientsJson || "[]") as SmsRecipientEntry[];
    if (Array.isArray(parsed)) recipients = parsed;
  } catch {
    // ignore
  }
  if (recipients.length === 0 && row.recipient) {
    const { parseLegacyRecipient } = await import("@/lib/smsGateways");
    const one = parseLegacyRecipient(row.recipient);
    if (one) recipients = [one];
  }

  return {
    senderEmail: row.senderEmail ?? "",
    appPassword: "",
    recipients,
  };
}

/** Save only sender email and app password. */
export async function saveSmsSenderConfig(senderEmail: string, appPassword: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const existing = await db.query.smsConfigTable.findFirst();
    const encryptedPassword = appPassword ? encrypt(appPassword) : (existing?.appPasswordEncrypted ?? "");

    const updates = {
      senderEmail: senderEmail || "",
      appPasswordEncrypted: encryptedPassword,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(smsConfigTable).set(updates).where(eq(smsConfigTable.id, existing.id));
    } else {
      await db.insert(smsConfigTable).values({
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

/** Save only recipients list (phone + carrier). */
export async function saveSmsRecipients(recipients: SmsRecipientEntry[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const existing = await db.query.smsConfigTable.findFirst();
    const recipientsJson = JSON.stringify(recipients);

    if (existing) {
      await db.update(smsConfigTable).set({ recipientsJson, updatedAt: new Date() }).where(eq(smsConfigTable.id, existing.id));
    } else {
      await db.insert(smsConfigTable).values({
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

/** Check if we already sent SMS for this (thingId, propertyId) in this alert episode. */
export async function hasSentAlertSms(thingId: string, propertyId: string): Promise<boolean> {
  const row = await db.query.alertNotificationsTable.findFirst({
    where: and(
      eq(alertNotificationsTable.thingId, thingId),
      eq(alertNotificationsTable.propertyId, propertyId)
    ),
  });
  return !!row;
}

/** Record that we sent an SMS for this (thingId, propertyId). */
export async function recordAlertSmsSent(thingId: string, propertyId: string): Promise<void> {
  await db.insert(alertNotificationsTable).values({
    thingId,
    propertyId,
  });
}

/** Remove record when property is back in range (so next out-of-range will trigger SMS again). */
export async function clearAlertSmsRecord(thingId: string, propertyId: string): Promise<void> {
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
  minValue: number;
  maxValue: number;
};

/** Get threshold for a property; returns null if using defaults. */
export async function getPropertyThreshold(
  thingId: string,
  propertyId: string
): Promise<{ min: number; max: number } | null> {
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
    minValue: r.minValue,
    maxValue: r.maxValue,
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
export async function getThresholdsMap(): Promise<Record<string, { min: number; max: number }>> {
  const rows = await db.select().from(propertyAlertThresholdsTable);
  const map: Record<string, { min: number; max: number }> = {};
  for (const r of rows) {
    map[`${r.thingId}:${r.propertyId}`] = { min: r.minValue, max: r.maxValue };
  }
  return map;
}

/** Save or update threshold for one property. */
export async function savePropertyThreshold(
  thingId: string,
  propertyId: string,
  minValue: number,
  maxValue: number
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
