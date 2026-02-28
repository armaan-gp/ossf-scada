"use client";

import { setCenterMapAssignment } from "@/app/actions/centerMap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Circle, ExternalLink, Link2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type CenterMapSystemView = {
  key: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate?: number;
  assignedDeviceId: string | null;
  assignedDevice: {
    id: string;
    name: string;
    status: string;
    lastActivityAt: string | null;
  } | null;
  alertCount: number | null;
};

type SelectDevice = {
  id: string;
  name: string;
};

export function CenterMapView({
  systems,
  devices,
}: {
  systems: CenterMapSystemView[];
  devices: SelectDevice[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [systemState, setSystemState] = useState<CenterMapSystemView[]>(systems);
  const [pendingSystemKey, setPendingSystemKey] = useState<string | null>(null);
  const [openSystemKey, setOpenSystemKey] = useState<string | null>(null);
  const [selectedBySystem, setSelectedBySystem] = useState<Record<string, string | undefined>>(() => {
    const validIds = new Set(devices.map((d) => d.id));
    const initial: Record<string, string | undefined> = {};
    for (const system of systems) {
      initial[system.key] =
        system.assignedDeviceId && validIds.has(system.assignedDeviceId) ? system.assignedDeviceId : undefined;
    }
    return initial;
  });

  const devicesById = useMemo(() => {
    return new Map(devices.map((d) => [d.id, d]));
  }, [devices]);
  const validDeviceIds = useMemo(() => new Set(devices.map((d) => d.id)), [devices]);

  const activeSystem = openSystemKey ? systemState.find((s) => s.key === openSystemKey) ?? null : null;
  const isActiveSystemPending = activeSystem ? pendingSystemKey === activeSystem.key : false;

  useEffect(() => {
    setSystemState(systems);
    const validIds = new Set(devices.map((d) => d.id));
    const nextSelection: Record<string, string | undefined> = {};
    for (const system of systems) {
      nextSelection[system.key] =
        system.assignedDeviceId && validIds.has(system.assignedDeviceId) ? system.assignedDeviceId : undefined;
    }
    setSelectedBySystem(nextSelection);
  }, [systems, devices]);

  function getSelectedDeviceId(systemKey: string): string | undefined {
    const selected = selectedBySystem[systemKey];
    if (!selected || !validDeviceIds.has(selected)) return undefined;
    return selected;
  }

  function getStatusDisplay(system: CenterMapSystemView) {
    if (!system.assignedDeviceId) {
      return {
        icon: <Circle className="h-6 w-6 text-slate-400" aria-label="Unassigned" />,
        text: "Unassigned",
      };
    }
    if (system.alertCount == null) {
      return {
        icon: <Circle className="h-6 w-6 text-slate-500" aria-label="Unknown status" />,
        text: "Unknown",
      };
    }
    if (system.alertCount > 0) {
      return {
        icon: <AlertTriangle className="h-6 w-6 text-red-500" aria-label="Active alerts" />,
        text: `${system.alertCount} active alert${system.alertCount > 1 ? "s" : ""}`,
      };
    }
    return {
      icon: <CheckCircle2 className="h-6 w-6 text-green-600" aria-label="No alerts" />,
      text: "No active alerts",
    };
  }

  async function handleAssign(systemKey: string) {
    const selectedDeviceId = getSelectedDeviceId(systemKey);
    if (!selectedDeviceId) {
      toast({ title: "No PLC selected", description: "Choose a PLC before connecting.", variant: "destructive" });
      return;
    }

    const previous = systemState;
    setPendingSystemKey(systemKey);
    setSystemState((curr) =>
      curr.map((system) =>
        system.key === systemKey
          ? {
              ...system,
              assignedDeviceId: selectedDeviceId,
              assignedDevice: {
                id: selectedDeviceId,
                name: devicesById.get(selectedDeviceId)?.name ?? selectedDeviceId,
                status: "UNKNOWN",
                lastActivityAt: null,
              },
              alertCount: null,
            }
          : system
      )
    );

    const result = await setCenterMapAssignment(systemKey, selectedDeviceId);
    setPendingSystemKey(null);
    if (!result.ok) {
      setSystemState(previous);
      toast({ title: "Error", description: result.error ?? "Failed to connect PLC.", variant: "destructive" });
      return;
    }

    toast({ title: "PLC connected", description: "System assignment updated." });
    router.refresh();
  }

  async function handleRemove(systemKey: string) {
    const previous = systemState;
    setPendingSystemKey(systemKey);
    setSystemState((curr) =>
      curr.map((system) =>
        system.key === systemKey
          ? {
              ...system,
              assignedDeviceId: null,
              assignedDevice: null,
              alertCount: null,
            }
          : system
      )
    );

    const result = await setCenterMapAssignment(systemKey, null);
    setPendingSystemKey(null);
    if (!result.ok) {
      setSystemState(previous);
      toast({ title: "Error", description: result.error ?? "Failed to remove PLC.", variant: "destructive" });
      return;
    }

    setSelectedBySystem((curr) => ({ ...curr, [systemKey]: undefined }));
    toast({ title: "PLC removed", description: "System assignment cleared." });
    router.refresh();
  }

  function openSystem(systemKey: string) {
    setOpenSystemKey(systemKey);
  }

  function renderSystemCard(system: CenterMapSystemView, absolute = false) {
    const status = getStatusDisplay(system);

    return (
      <button
        key={system.key}
        type="button"
        onClick={() => openSystem(system.key)}
        style={
          absolute
            ? {
                left: `${system.left}%`,
                top: `${system.top}%`,
                width: `${system.width}%`,
                height: `${system.height}%`,
              }
            : undefined
        }
        className={cn(
          absolute ? "absolute" : "min-h-[180px] w-full",
          "rounded-xl border bg-slate-50 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-slate-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
        )}
      >
        <div className="flex h-full flex-col gap-2">
          <p
            className="font-semibold tracking-wide text-slate-900"
            style={system.rotate ? { transform: `rotate(${system.rotate}deg)` } : undefined}
          >
            {system.label}
          </p>
          <div className="inline-flex items-center text-slate-600">{status.icon}</div>
          <p className="text-xs text-slate-600">
            {system.assignedDeviceId
              ? `PLC: ${system.assignedDevice?.name ?? `${system.assignedDeviceId} (Unavailable)`}`
              : "No PLC connected"}
          </p>
        </div>
      </button>
    );
  }

  return (
    <div className="mt-8">
      <div className="hidden md:block">
        <div className="relative w-full overflow-hidden rounded-xl border bg-white aspect-[16/8]">
          {systemState.map((system) => renderSystemCard(system, true))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:hidden sm:grid-cols-2">
        {systemState.map((system) => renderSystemCard(system, false))}
      </div>

      <Dialog
        open={!!activeSystem}
        onOpenChange={(open) => {
          if (!open) setOpenSystemKey(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {activeSystem ? (
            <>
              <DialogHeader>
                <DialogTitle>{activeSystem.label}</DialogTitle>
                <DialogDescription>Basic PLC details for this system</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold">Assigned PLC:</span>{" "}
                  {activeSystem.assignedDevice
                    ? `${activeSystem.assignedDevice.name} (${activeSystem.assignedDevice.id})`
                    : activeSystem.assignedDeviceId
                    ? `${activeSystem.assignedDeviceId} (not currently available)`
                    : "No PLC assigned"}
                </p>
                <p>
                  <span className="font-semibold">Status:</span>{" "}
                  {activeSystem.assignedDevice ? activeSystem.assignedDevice.status : "N/A"}
                </p>
                <p>
                  <span className="font-semibold">Last Active:</span>{" "}
                  {activeSystem.assignedDevice?.lastActivityAt ?? "N/A"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Alerts:</span>
                  <span className="inline-flex items-center text-slate-600">{getStatusDisplay(activeSystem).icon}</span>
                </div>
              </div>
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-semibold">Assign PLC</p>
                <Select
                  value={getSelectedDeviceId(activeSystem.key)}
                  onValueChange={(value) =>
                    setSelectedBySystem((curr) => ({
                      ...curr,
                      [activeSystem.key]: value,
                    }))
                  }
                  disabled={isActiveSystemPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select PLC" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.name} ({device.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    disabled={isActiveSystemPending || !getSelectedDeviceId(activeSystem.key)}
                    onClick={() => handleAssign(activeSystem.key)}
                  >
                    <Link2 className="mr-1 h-3.5 w-3.5" />
                    Connect
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isActiveSystemPending || !activeSystem.assignedDeviceId}
                    onClick={() => handleRemove(activeSystem.key)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remove PLC
                  </Button>
                </div>
              </div>
              <DialogFooter className="sm:justify-start pt-1">
                {activeSystem.assignedDeviceId ? (
                  <Link href={`/app/device/${activeSystem.assignedDeviceId}`}>
                    <Button>
                      View Details
                      <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
