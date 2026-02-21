"use server";

import { revalidatePath } from "next/cache";
import {
  clearRecordingData,
  getRecordingConfigsForThing,
  getRecordingConfigsMap,
  getRecordingPreviewRows,
  saveRecordingConfig,
} from "@/lib/propertyRecordings";

export async function getAllRecordingConfigsMap() {
  return getRecordingConfigsMap();
}

export async function getThingRecordingConfigs(thingId: string) {
  return getRecordingConfigsForThing(thingId);
}

export async function savePropertyRecordingConfig(
  thingId: string,
  propertyId: string,
  enabled: boolean,
  intervalMinutes: number | null,
  maxRows: number | null,
  resetExistingData = false
): Promise<{ ok: boolean; error?: string; requiresReset?: boolean }> {
  const result = await saveRecordingConfig(thingId, propertyId, {
    enabled,
    intervalMinutes,
    maxRows,
    resetExistingData,
  });

  if (result.ok) {
    revalidatePath("/app/settings");
    revalidatePath("/app/device/[id]");
  }

  return result;
}

export async function clearPropertyRecordingData(thingId: string, propertyId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await clearRecordingData(thingId, propertyId);
    revalidatePath("/app/settings");
    revalidatePath("/app/device/[id]");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to clear data" };
  }
}

export async function getPropertyRecordingPreview(
  thingId: string,
  propertyId: string,
  limit = 100
) {
  return getRecordingPreviewRows(thingId, propertyId, limit);
}
