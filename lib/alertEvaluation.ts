import "server-only";
import { getThing } from "@/lib/arduinoInit";
import { isPropertyInAlert } from "@/lib/alertRanges";
import { getPropertyThreshold, hasSentAlertSms, recordAlertSmsSent, clearAlertSmsRecord } from "@/app/actions/settings";
import { sendAlertSms } from "@/lib/sendAlertSms";
import { clearAlertEpisode, markAlertEpisodeActive, recordAlertEvent } from "@/lib/alertEvents";

export type PropertyAlertState = { propertyId: string; inAlert: boolean; name?: string };

/**
 * Evaluate alerts for one thing's properties. Optionally send SMS for new alerts.
 * Returns list of { propertyId, inAlert } and total alert count.
 */
export async function evaluateThingAlerts(
  thingId: string,
  deviceName: string,
  options: { sendSmsForNewAlerts?: boolean; trackAlertEvents?: boolean } = {}
): Promise<{ alerts: PropertyAlertState[]; alertCount: number; newAlertEvents: number; smsSent: number; smsFailed: number }> {
  let thing: { id: string; name?: string; properties?: any[] };
  try {
    thing = await getThing(thingId);
  } catch {
    return { alerts: [], alertCount: 0, newAlertEvents: 0, smsSent: 0, smsFailed: 0 };
  }

  const properties = thing.properties ?? [];
  const alerts: PropertyAlertState[] = [];
  let alertCount = 0;
  let newAlertEvents = 0;
  let smsSent = 0;
  let smsFailed = 0;
  const shouldTrackAlertEvents = options.trackAlertEvents === true || options.sendSmsForNewAlerts === true;

  for (const prop of properties) {
    const type = (prop.type ?? "").toUpperCase();
    if (type !== "INT" && type !== "FLOAT") continue;

    const threshold = await getPropertyThreshold(thingId, prop.id);
    const inAlert = isPropertyInAlert(
      { type: prop.type, last_value: prop.last_value },
      threshold ?? undefined
    );

    if (inAlert) {
      alertCount++;
      alerts.push({ propertyId: prop.id, inAlert: true, name: prop.name ?? prop.variable_name });

      if (shouldTrackAlertEvents) {
        const propertyName = prop.name ?? prop.variable_name ?? prop.id;
        const episode = await markAlertEpisodeActive({
          thingId,
          thingName: deviceName,
          propertyId: prop.id,
          propertyName,
          propertyType: type,
        });
        if (episode.isNew) {
          await recordAlertEvent({
            thingId,
            thingName: deviceName,
            propertyId: prop.id,
            propertyName,
            propertyType: type,
            value: prop.last_value,
          });
          newAlertEvents++;
        }
      }

      if (options.sendSmsForNewAlerts) {
        const sent = await hasSentAlertSms(thingId, prop.id);
        if (!sent) {
          const result = await sendAlertSms(undefined, {
            deviceName,
            propertyName: prop.name ?? prop.variable_name ?? prop.id,
            value: prop.last_value,
          });
          if (result.success) {
            await recordAlertSmsSent(thingId, prop.id);
            smsSent++;
          } else {
            smsFailed++;
          }
        }
      }
    } else {
      if (shouldTrackAlertEvents) await clearAlertEpisode(thingId, prop.id);
      if (options.sendSmsForNewAlerts) await clearAlertSmsRecord(thingId, prop.id);
      alerts.push({ propertyId: prop.id, inAlert: false, name: prop.name ?? prop.variable_name });
    }
  }

  return { alerts, alertCount, newAlertEvents, smsSent, smsFailed };
}
