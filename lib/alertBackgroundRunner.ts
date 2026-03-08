import "server-only";

import { evaluateThingAlerts } from "@/lib/alertEvaluation";
import { getDevices, isArduinoUnauthorizedError } from "@/lib/arduinoInit";

export async function runAlertProcessing(): Promise<{
  checkedDevices: number;
  checkedProperties: number;
  activeAlerts: number;
  newEvents: number;
  emailsSent: number;
  emailsFailed: number;
  failedDevices: number;
  error?: string;
}> {
  let devices: Awaited<ReturnType<typeof getDevices>>;
  try {
    devices = await getDevices();
  } catch (error) {
    const message = isArduinoUnauthorizedError(error)
      ? "Arduino API authorization failed while fetching devices."
      : "Failed to fetch Arduino devices for alert processing.";
    console.error("[alerts] background runner unavailable:", error);
    return {
      checkedDevices: 0,
      checkedProperties: 0,
      activeAlerts: 0,
      newEvents: 0,
      emailsSent: 0,
      emailsFailed: 0,
      failedDevices: 0,
      error: message,
    };
  }

  let checkedDevices = 0;
  let checkedProperties = 0;
  let activeAlerts = 0;
  let newEvents = 0;
  let emailsSent = 0;
  let emailsFailed = 0;
  let failedDevices = 0;

  for (const device of devices) {
    if (device.device_status !== "ONLINE") continue;
    const thingId = device.thing?.id ?? device.id;
    try {
      const result = await evaluateThingAlerts(thingId, device.name ?? device.id, {
        sendEmailsForNewAlerts: true,
        trackAlertEvents: true,
      });

      checkedDevices++;
      checkedProperties += result.alerts.length;
      activeAlerts += result.alertCount;
      newEvents += result.newAlertEvents;
      emailsSent += result.emailsSent;
      emailsFailed += result.emailsFailed;
    } catch (error) {
      failedDevices++;
      console.error(`[alerts] failed to evaluate device ${device.id}:`, error);
    }
  }

  return {
    checkedDevices,
    checkedProperties,
    activeAlerts,
    newEvents,
    emailsSent,
    emailsFailed,
    failedDevices,
  };
}
