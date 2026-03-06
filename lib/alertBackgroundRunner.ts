import "server-only";

import { evaluateThingAlerts } from "@/lib/alertEvaluation";
import { getDevices } from "@/lib/arduinoInit";

export async function runAlertProcessing(): Promise<{
  checkedDevices: number;
  checkedProperties: number;
  activeAlerts: number;
  newEvents: number;
  emailsSent: number;
  emailsFailed: number;
}> {
  const devices = await getDevices();
  let checkedDevices = 0;
  let checkedProperties = 0;
  let activeAlerts = 0;
  let newEvents = 0;
  let emailsSent = 0;
  let emailsFailed = 0;

  for (const device of devices) {
    if (device.device_status !== "ONLINE") continue;
    const thingId = device.thing?.id ?? device.id;
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
  }

  return {
    checkedDevices,
    checkedProperties,
    activeAlerts,
    newEvents,
    emailsSent,
    emailsFailed,
  };
}
