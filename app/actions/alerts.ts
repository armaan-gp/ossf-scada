"use server";

import { getAlertEventRows } from "@/lib/alertEvents";

export async function getAlertEventsPreview(limit = 100) {
  return getAlertEventRows(limit);
}
