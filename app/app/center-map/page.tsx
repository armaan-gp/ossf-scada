import { getCenterMapAssignments } from "@/app/actions/centerMap";
import { CenterMapView, type CenterMapSystemView } from "@/components/function/CenterMapView";
import { evaluateThingAlerts } from "@/lib/alertEvaluation";
import { getDevices, getThing } from "@/lib/arduinoInit";
import { CENTER_MAP_SYSTEMS } from "@/lib/centerMapLayout";

export default async function CenterMapPage() {
  const [devices, assignmentMap] = await Promise.all([getDevices(), getCenterMapAssignments()]);

  const normalizeLastActivityAt = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (value instanceof Date) return value.toISOString();
    return String(value);
  };
  const normalizeDisplayValue = (value: unknown): string => {
    if (value === null || value === undefined) return "N/A";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "N/A";
    }
  };

  const devicesForSelect = devices.map((device) => ({
    id: device.id,
    name: device.name ?? device.id,
  }));

  const devicesById = new Map(
    devices.map((device) => [
      device.id,
      {
        id: device.id,
        name: device.name ?? device.id,
        status: device.device_status ?? "UNKNOWN",
        lastActivityAt: normalizeLastActivityAt(device.last_activity_at),
        thingId: device.thing?.id ?? device.id,
      },
    ])
  );
  const thingCache = new Map<string, Promise<{ properties?: Array<{ id: string; name?: string; variable_name?: string; last_value?: unknown }> }>>();

  const getThingCached = async (thingId: string) => {
    if (!thingCache.has(thingId)) {
      thingCache.set(thingId, getThing(thingId));
    }
    return thingCache.get(thingId)!;
  };

  const systems: CenterMapSystemView[] = [];
  for (const system of CENTER_MAP_SYSTEMS) {
    const assignedDeviceId = assignmentMap[system.key] ?? null;
    const assignedDevice = assignedDeviceId ? devicesById.get(assignedDeviceId) : undefined;
    let alertCount: number | null = null;
    let properties: Array<{ id: string; name: string; value: string }> = [];

    if (assignedDeviceId && assignedDevice) {
      try {
        const thing = await getThingCached(assignedDevice.thingId);
        properties = (thing.properties ?? []).map((prop) => ({
          id: prop.id,
          name: prop.name ?? prop.variable_name ?? prop.id,
          value: normalizeDisplayValue(prop.last_value),
        }));
        const result = await evaluateThingAlerts(assignedDevice.thingId, assignedDevice.name, {
          sendSmsForNewAlerts: false,
        });
        alertCount = result.alertCount;
      } catch {
        alertCount = null;
        properties = [];
      }
    }

    systems.push({
      ...system,
      assignedDeviceId,
      assignedDevice: assignedDevice ?? null,
      alertCount,
      properties,
    });
  }

  return (
    <main className="w-full h-full flex justify-center">
      <div className="container p-6 md:p-10">
        <div className="tracking-tight font-bold">
          <p className="text-4xl text-tama font-serif">Center Map</p>
          <p className="text-sm font-semibold text-muted-foreground">
            Assign PLCs to OSSF systems and monitor alert status at a glance
          </p>
        </div>
        <CenterMapView systems={systems} devices={devicesForSelect} />
      </div>
    </main>
  );
}
