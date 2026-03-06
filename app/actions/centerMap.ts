"use server";

import { getUser } from "@/lib/actions/auth";
import { getDevices } from "@/lib/arduinoInit";
import { db } from "@/db";
import { centerMapAssignmentsTable, centerMapBoxesTable } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type CenterMapLayoutBoxInput = {
  id?: number;
  name: string;
  left: number;
  top: number;
  width?: number;
  height?: number;
  rotate?: number | null;
  sortOrder?: number;
};

type NormalizedLayoutBox = {
  id?: number;
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number | null;
  sortOrder: number;
};

const DEFAULT_BOX_WIDTH = 9;
const DEFAULT_BOX_HEIGHT = 26;

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

function normalizeLayoutBox(raw: CenterMapLayoutBoxInput, index: number): NormalizedLayoutBox {
  const id = typeof raw.id === "number" && Number.isInteger(raw.id) && raw.id > 0 ? raw.id : undefined;
  const name = String(raw.name ?? "").trim();
  if (!name) {
    throw new Error("Each location must have a name.");
  }

  const widthInput = toFiniteNumber(raw.width);
  const heightInput = toFiniteNumber(raw.height);
  const width = clamp(widthInput ?? DEFAULT_BOX_WIDTH, 1, 100);
  const height = clamp(heightInput ?? DEFAULT_BOX_HEIGHT, 1, 100);

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

export async function getCenterMapBoxes() {
  return db
    .select()
    .from(centerMapBoxesTable)
    .orderBy(asc(centerMapBoxesTable.sortOrder), asc(centerMapBoxesTable.id));
}

export async function getCenterMapAssignments(): Promise<Record<number, string | null>> {
  const rows = await db.select().from(centerMapAssignmentsTable);
  const map: Record<number, string | null> = {};
  for (const row of rows) {
    map[row.boxId] = row.deviceId ?? null;
  }
  return map;
}

export async function saveCenterMapLayout(
  boxes: CenterMapLayoutBoxInput[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getUser();
    if (!user?.isAdmin) {
      return { ok: false, error: "Only admins can edit the center map layout." };
    }

    if (!Array.isArray(boxes)) {
      return { ok: false, error: "Invalid layout payload." };
    }

    const normalized = boxes.map((box, index) => normalizeLayoutBox(box, index));

    const nameSet = new Set<string>();
    for (const box of normalized) {
      const normalizedName = box.name.toLowerCase();
      if (nameSet.has(normalizedName)) {
        return { ok: false, error: "Location names must be unique." };
      }
      nameSet.add(normalizedName);
    }

    const existingRows = await db.select({ id: centerMapBoxesTable.id }).from(centerMapBoxesTable);
    const existingIds = new Set(existingRows.map((row) => row.id));
    const incomingIds = new Set(normalized.filter((box) => typeof box.id === "number").map((box) => box.id as number));

    for (const incomingId of incomingIds) {
      if (!existingIds.has(incomingId)) {
        throw new Error(`Location ${incomingId} no longer exists.`);
      }
    }

    const idsToDelete = existingRows
      .map((row) => row.id)
      .filter((id) => !incomingIds.has(id));

    if (idsToDelete.length > 0) {
      await db.delete(centerMapAssignmentsTable).where(inArray(centerMapAssignmentsTable.boxId, idsToDelete));
      await db.delete(centerMapBoxesTable).where(inArray(centerMapBoxesTable.id, idsToDelete));
    }

    for (const box of normalized) {
      const row = {
        name: box.name,
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        rotate: box.rotate,
        sortOrder: box.sortOrder,
        updatedAt: new Date(),
      };

      if (box.id) {
        await db.update(centerMapBoxesTable).set(row).where(eq(centerMapBoxesTable.id, box.id));
      } else {
        await db.insert(centerMapBoxesTable).values(row);
      }
    }

    revalidatePath("/app/center-map");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save center map layout." };
  }
}

export async function setCenterMapAssignment(
  boxId: number,
  deviceId: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const nextBoxId = Number(boxId);
    if (!Number.isInteger(nextBoxId) || nextBoxId <= 0) {
      return { ok: false, error: "Invalid map location." };
    }

    const box = await db.query.centerMapBoxesTable.findFirst({
      where: eq(centerMapBoxesTable.id, nextBoxId),
    });
    if (!box) {
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
        boxId: nextBoxId,
        deviceId: nextDeviceId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: centerMapAssignmentsTable.boxId,
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
