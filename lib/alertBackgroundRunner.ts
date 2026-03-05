import "server-only";

import { evaluateThingAlerts } from "@/lib/alertEvaluation";
import { getDevices } from "@/lib/arduinoInit";

export async function runAlertProcessing(): Promise<{
  checkedDevices: number;
  checkedProperties: number;
  activeAlerts: number;
  newEvents: number;
  smsSent: number;
  smsFailed: number;
}> {
  const devices = await getDevices();
  let checkedDevices = 0;
  let checkedProperties = 0;
  let activeAlerts = 0;
  let newEvents = 0;
  let smsSent = 0;
  let smsFailed = 0;

  for (const device of devices) {
    if (device.device_status !== "ONLINE") continue;
    const thingId = device.thing?.id ?? device.id;
    const result = await evaluateThingAlerts(thingId, device.name ?? device.id, {
      sendSmsForNewAlerts: true,
      trackAlertEvents: true,
    });

    checkedDevices++;
    checkedProperties += result.alerts.length;
    activeAlerts += result.alertCount;
    newEvents += result.newAlertEvents;
    smsSent += result.smsSent;
    smsFailed += result.smsFailed;
  }

  return {
    checkedDevices,
    checkedProperties,
    activeAlerts,
    newEvents,
    smsSent,
    smsFailed,
  };
}
