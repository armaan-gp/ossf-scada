import { getCenterMapAssignments, getCenterMapLocations } from "@/app/actions/centerMap";
import { getDecimalPlacesMap, getGlobalDecimalPlaces } from "@/app/actions/settings";
import { CenterMapView, type CenterMapSystemView } from "@/components/function/CenterMapView";
import { evaluateThingAlerts } from "@/lib/alertEvaluation";
import { getUser } from "@/lib/actions/auth";
import { getDevices, getThing, isArduinoUnauthorizedError } from "@/lib/arduinoInit";
import { formatPropertyDisplayValue, resolvePropertyDecimalPlaces } from "@/lib/propertyValueDisplay";

export default async function CenterMapPage() {
  const [locations, assignmentMap, globalDecimalPlaces, propertyDecimalPlacesMap, user] = await Promise.all([
    getCenterMapLocations(),
    getCenterMapAssignments(),
    getGlobalDecimalPlaces(),
    getDecimalPlacesMap(),
    getUser(),
  ]);
  let devices: Awaited<ReturnType<typeof getDevices>> = [];
  let dataSourceError: string | null = null;
  try {
    devices = await getDevices();
  } catch (error) {
    dataSourceError = isArduinoUnauthorizedError(error)
      ? "Live Arduino data is temporarily unavailable because API authorization failed."
      : "Live Arduino data is temporarily unavailable.";
    console.error("[center-map] failed to load devices:", error);
  }

  const normalizeLastActivityAt = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (value instanceof Date) return value.toISOString();
    return String(value);
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

  const thingCache = new Map<
    string,
    Promise<{ properties?: Array<{ id: string; name?: string; variable_name?: string; type?: string; last_value?: unknown }> }>
  >();

  const getThingCached = async (thingId: string) => {
    if (!thingCache.has(thingId)) {
      thingCache.set(thingId, getThing(thingId));
    }
    return thingCache.get(thingId)!;
  };

  const systems: CenterMapSystemView[] = [];
  for (const location of locations) {
    const assignedDeviceId = assignmentMap[location.id] ?? null;
    const assignedDevice = assignedDeviceId ? devicesById.get(assignedDeviceId) : undefined;
    let alertCount: number | null = null;
    let properties: Array<{ id: string; name: string; value: string; inAlert: boolean }> = [];

    if (assignedDeviceId && assignedDevice) {
      try {
        const thing = await getThingCached(assignedDevice.thingId);
        const result = await evaluateThingAlerts(assignedDevice.thingId, assignedDevice.name, {
          sendEmailsForNewAlerts: false,
        });
        const alertIds = new Set(result.alerts.filter((a) => a.inAlert).map((a) => a.propertyId));

        properties = (thing.properties ?? []).map((prop) => ({
          id: prop.id,
          name: prop.name ?? prop.variable_name ?? prop.id,
          value: formatPropertyDisplayValue(
            prop.last_value,
            prop.type ?? "",
            resolvePropertyDecimalPlaces(assignedDevice.thingId, prop.id, globalDecimalPlaces, propertyDecimalPlacesMap)
          ),
          inAlert: alertIds.has(prop.id),
        }));
        alertCount = result.alertCount;
      } catch {
        alertCount = null;
        properties = [];
      }
    }

    systems.push({
      id: location.id,
      label: location.name,
      left: location.left,
      top: location.top,
      width: location.width,
      height: location.height,
      rotate: location.rotate,
      sortOrder: location.sortOrder,
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
            Assign PLCs to map locations and monitor alert status at a glance
          </p>
        </div>
        {dataSourceError ? (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {dataSourceError}
          </div>
        ) : null}
        <CenterMapView
          systems={systems}
          devices={devicesForSelect}
          globalDecimalPlaces={globalDecimalPlaces}
          propertyDecimalPlacesMap={propertyDecimalPlacesMap}
          canEditLayout={!!user?.isAdmin}
        />
      </div>
    </main>
  );
}
