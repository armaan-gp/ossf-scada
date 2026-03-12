"use server";

import { getUser } from "@/lib/actions/auth";
import { getDevices } from "@/lib/arduinoInit";
import { db } from "@/db";
import { centerMapAssignmentsTable, centerMapLocationsTable } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type CenterMapLayoutLocationInput = {
  id?: number;
  name: string;
  left: number;
  top: number;
  width?: number;
  height?: number;
  rotate?: number | null;
  sortOrder?: number;
};

type NormalizedLayoutLocation = {
  id?: number;
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number | null;
  sortOrder: number;
};

const DEFAULT_LOCATION_WIDTH = 9;
const DEFAULT_LOCATION_HEIGHT = 26;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeLayoutLocation(raw: CenterMapLayoutLocationInput, index: number): NormalizedLayoutLocation {
  const id = typeof raw.id === "number" && Number.isInteger(raw.id) && raw.id > 0 ? raw.id : undefined;
  const name = String(raw.name ?? "").trim();
  if (!name) {
    throw new Error("Each location must have a name.");
  }

  const widthInput = toFiniteNumber(raw.width);
  const heightInput = toFiniteNumber(raw.height);
  const width = clamp(widthInput ?? DEFAULT_LOCATION_WIDTH, 1, 100);
  const height = clamp(heightInput ?? DEFAULT_LOCATION_HEIGHT, 1, 100);

  const leftInput = toFiniteNumber(raw.left);
  const topInput = toFiniteNumber(raw.top);
  const left = clamp(leftInput ?? 0, 0, 100 - width);
  const top = clamp(topInput ?? 0, 0, 100 - height);

  const rotateInput = toFiniteNumber(raw.rotate);
  const rotate = rotateInput === null ? null : clamp(rotateInput, -180, 180);

  return {
    id,
    name,
    left,
    top,
    width,
    height,
    rotate,
    sortOrder: index,
  };
}

export async function getCenterMapLocations() {
  return db
    .select()
    .from(centerMapLocationsTable)
    .orderBy(asc(centerMapLocationsTable.sortOrder), asc(centerMapLocationsTable.id));
}

export async function getCenterMapAssignments(): Promise<Record<number, string | null>> {
  const rows = await db.select().from(centerMapAssignmentsTable);
  const map: Record<number, string | null> = {};
  for (const row of rows) {
    map[row.locationId] = row.deviceId ?? null;
  }
  return map;
}

export async function saveCenterMapLayout(
  locations: CenterMapLayoutLocationInput[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getUser();
    if (!user?.isAdmin) {
      return { ok: false, error: "Only admins can edit the center map layout." };
    }

    if (!Array.isArray(locations)) {
      return { ok: false, error: "Invalid layout payload." };
    }

    const normalized = locations.map((location, index) => normalizeLayoutLocation(location, index));

    const nameSet = new Set<string>();
    for (const location of normalized) {
      const normalizedName = location.name.toLowerCase();
      if (nameSet.has(normalizedName)) {
        return { ok: false, error: "Location names must be unique." };
      }
      nameSet.add(normalizedName);
    }

    const existingRows = await db.select({ id: centerMapLocationsTable.id }).from(centerMapLocationsTable);
    const existingIds = new Set(existingRows.map((row) => row.id));
    const incomingIds = new Set(normalized.filter((location) => typeof location.id === "number").map((location) => location.id as number));

    for (const incomingId of incomingIds) {
      if (!existingIds.has(incomingId)) {
        throw new Error(`Location ${incomingId} no longer exists.`);
      }
    }

    const idsToDelete = existingRows
      .map((row) => row.id)
      .filter((id) => !incomingIds.has(id));

    if (idsToDelete.length > 0) {
      await db.delete(centerMapAssignmentsTable).where(inArray(centerMapAssignmentsTable.locationId, idsToDelete));
      await db.delete(centerMapLocationsTable).where(inArray(centerMapLocationsTable.id, idsToDelete));
    }

    for (const location of normalized) {
      const row = {
        name: location.name,
        left: location.left,
        top: location.top,
        width: location.width,
        height: location.height,
        rotate: location.rotate,
        sortOrder: location.sortOrder,
        updatedAt: new Date(),
      };

      if (location.id) {
        await db.update(centerMapLocationsTable).set(row).where(eq(centerMapLocationsTable.id, location.id));
      } else {
        await db.insert(centerMapLocationsTable).values(row);
      }
    }

    revalidatePath("/app/center-map");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save center map layout." };
  }
}

export async function setCenterMapAssignment(
  locationId: number,
  deviceId: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const nextLocationId = Number(locationId);
    if (!Number.isInteger(nextLocationId) || nextLocationId <= 0) {
      return { ok: false, error: "Invalid map location." };
    }

    const location = await db.query.centerMapLocationsTable.findFirst({
      where: eq(centerMapLocationsTable.id, nextLocationId),
    });
    if (!location) {
      return { ok: false, error: "Selected map location no longer exists." };
    }

    const nextDeviceId = deviceId?.trim() ? deviceId : null;
    if (nextDeviceId) {
      const devices = await getDevices();
      const exists = devices.some((d) => d.id === nextDeviceId);
      if (!exists) {
        return { ok: false, error: "Selected PLC was not found." };
      }
    }

    await db
      .insert(centerMapAssignmentsTable)
      .values({
        locationId: nextLocationId,
        deviceId: nextDeviceId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: centerMapAssignmentsTable.locationId,
        set: {
          deviceId: nextDeviceId,
          updatedAt: new Date(),
        },
      });

    revalidatePath("/app/center-map");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save assignment." };
  }
}
