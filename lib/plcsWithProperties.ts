import "server-only";
import { getDevices, getThing } from "@/lib/arduinoInit";

export type PlcProperty = {
  id: string;
  name: string;
  type: string;
  variable_name?: string;
};

export type PlcWithProperties = {
  deviceId: string;
  deviceName: string;
  thingId: string;
  properties: PlcProperty[];
};

/**
 * Fetches all devices and their things/properties for the Settings alert thresholds editor.
 * Skips devices that fail to load (e.g. API errors).
 */
export async function getPlcsWithProperties(): Promise<PlcWithProperties[]> {
  const devices = await getDevices();
  const result: PlcWithProperties[] = [];

  for (const device of devices) {
    const thingId = device.thing?.id ?? device.id;
    try {
      const thing = device.thing ?? (await getThing(thingId));
      const properties = (thing.properties ?? []) as { id: string; name?: string; type?: string; variable_name?: string }[];
      result.push({
        deviceId: device.id,
        deviceName: device.name ?? device.id,
        thingId: thing.id ?? thingId,
        properties: properties.map((p) => ({
          id: p.id,
          name: p.name ?? p.variable_name ?? p.id,
          type: (p.type ?? "").toUpperCase(),
          variable_name: p.variable_name,
        })),
      });
    } catch {
      // Skip devices that fail to load
    }
  }

  return result;
}
