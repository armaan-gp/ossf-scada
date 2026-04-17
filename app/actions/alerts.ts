"use server";


// Server actions for alert history preview/export and maintenance tasks.
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/actions/auth";
import { clearAlertEvents, getAlertEventRows } from "@/lib/alertEvents";

export async function getAlertEventsPreview(limit = 100) {
  return getAlertEventRows(limit);
}

export async function clearAlertHistory(): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getUser();
    if (!user?.isAdmin || user.status !== "active") {
      return { ok: false, error: "Not authorized to clear alert history." };
    }

    await clearAlertEvents();
    revalidatePath("/app");
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to clear alert history." };
  }
}
