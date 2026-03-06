"use client";

import { saveCenterMapLayout, setCenterMapAssignment } from "@/app/actions/centerMap";
import { getAlertStateForProperties } from "@/app/actions/settings";
import { FormattedDateTime } from "@/components/FormattedDateTime";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { fetchThing } from "@/lib/actions/arduino";
import { formatPropertyDisplayValue, resolvePropertyDecimalPlaces } from "@/lib/propertyValueDisplay";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Link2,
  PencilLine,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CenterMapSystemView = {
  id: number;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate?: number | null;
  sortOrder: number;
  assignedDeviceId: string | null;
  assignedDevice: {
    id: string;
    name: string;
    status: string;
    lastActivityAt: string | null;
    thingId: string;
  } | null;
  alertCount: number | null;
  properties: Array<{ id: string; name: string; value: string; inAlert: boolean }>;
};

type DraftBoxId = number | string;

type DraftBox = {
  id: DraftBoxId;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number | null;
  sortOrder: number;
};

type SelectDevice = {
  id: string;
  name: string;
};

type DragState = {
  id: DraftBoxId;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
  width: number;
  height: number;
};

const DEFAULT_NEW_WIDTH = 9;
const DEFAULT_NEW_HEIGHT = 26;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function makeSelectionKey(id: number): string {
  return String(id);
}

function sortSystems(systems: CenterMapSystemView[]): CenterMapSystemView[] {
  return [...systems].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
}

function mapSystemToDraft(system: CenterMapSystemView): DraftBox {
  return {
    id: system.id,
    label: system.label,
    left: system.left,
    top: system.top,
    width: system.width,
    height: system.height,
    rotate: system.rotate ?? null,
    sortOrder: system.sortOrder,
  };
}

function pickNextLocationName(existingLabels: string[]): string {
  const used = new Set(existingLabels.map((label) => label.trim().toLowerCase()));
  let n = 1;
  while (used.has(`location ${n}`)) n++;
  return `Location ${n}`;
}

export function CenterMapView({
  systems,
  devices,
  globalDecimalPlaces,
  propertyDecimalPlacesMap,
  canEditLayout,
}: {
  systems: CenterMapSystemView[];
  devices: SelectDevice[];
  globalDecimalPlaces: number | null;
  propertyDecimalPlacesMap: Record<string, number | null>;
  canEditLayout: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const [systemState, setSystemState] = useState<CenterMapSystemView[]>(() => sortSystems(systems));
  const [pendingSystemId, setPendingSystemId] = useState<number | null>(null);
  const [openSystemId, setOpenSystemId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [layoutPending, setLayoutPending] = useState(false);
  const [draftBoxes, setDraftBoxes] = useState<DraftBox[]>([]);
  const [renameBoxId, setRenameBoxId] = useState<DraftBoxId | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [selectedBySystem, setSelectedBySystem] = useState<Record<string, string | undefined>>(() => {
    const validIds = new Set(devices.map((d) => d.id));
    const initial: Record<string, string | undefined> = {};
    for (const system of systems) {
      const key = makeSelectionKey(system.id);
      initial[key] =
        system.assignedDeviceId && validIds.has(system.assignedDeviceId) ? system.assignedDeviceId : undefined;
    }
    return initial;
  });

  const devicesById = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const validDeviceIds = useMemo(() => new Set(devices.map((d) => d.id)), [devices]);
  const systemStateRef = useRef<CenterMapSystemView[]>(systemState);

  const activeSystem = openSystemId ? systemState.find((s) => s.id === openSystemId) ?? null : null;
  const isActiveSystemPending = activeSystem ? pendingSystemId === activeSystem.id : false;

  useEffect(() => {
    setSystemState(sortSystems(systems));
    const validIds = new Set(devices.map((d) => d.id));
    const nextSelection: Record<string, string | undefined> = {};
    for (const system of systems) {
      const key = makeSelectionKey(system.id);
      nextSelection[key] =
        system.assignedDeviceId && validIds.has(system.assignedDeviceId) ? system.assignedDeviceId : undefined;
    }
    setSelectedBySystem(nextSelection);
  }, [systems, devices]);

  useEffect(() => {
    systemStateRef.current = systemState;
  }, [systemState]);

  useEffect(() => {
    if (!isEditMode || !isMobile) return;
    setIsEditMode(false);
    setDraftBoxes([]);
    setRenameBoxId(null);
    setRenameValue("");
    setOpenSystemId(null);
    toast({ title: "Edit mode disabled", description: "Map layout editing is available on desktop/tablet only." });
  }, [isEditMode, isMobile, toast]);

  useEffect(() => {
    if (renameBoxId === null) return;
    const stillExists = draftBoxes.some((box) => box.id === renameBoxId);
    if (!stillExists) {
      setRenameBoxId(null);
      setRenameValue("");
    }
  }, [draftBoxes, renameBoxId]);

  useEffect(() => {
    let cancelled = false;
    let polling = false;

    const refreshAssignedSystems = async () => {
      if (polling) return;
      polling = true;
      try {
        const current = systemStateRef.current;
        const updates = await Promise.all(
          current.map(async (system) => {
            if (!system.assignedDeviceId) return null;
            const thingId = system.assignedDevice?.thingId ?? system.assignedDeviceId;
            const thingResult = await fetchThing(thingId);
            if (!thingResult.success || !thingResult.data) return null;

            const thingProps = (thingResult.data.properties ?? []) as Array<{
              id: string;
              name?: string;
              variable_name?: string;
              type?: string;
              last_value?: unknown;
            }>;

            const properties = thingProps.map((prop) => ({
              id: prop.id,
              name: prop.name ?? prop.variable_name ?? prop.id,
              value: formatPropertyDisplayValue(
                prop.last_value,
                prop.type ?? "",
                resolvePropertyDecimalPlaces(thingId, prop.id, globalDecimalPlaces, propertyDecimalPlacesMap)
              ),
              inAlert: false,
            }));

            const alertMap = await getAlertStateForProperties(
              thingId,
              thingProps.map((prop) => ({
                id: prop.id,
                type: prop.type ?? "",
                last_value: prop.last_value,
              }))
            );
            const alertCount = Object.values(alertMap).filter(Boolean).length;
            const propertiesWithAlert = properties.map((prop) => ({
              ...prop,
              inAlert: alertMap[prop.id] ?? false,
            }));

            return { id: system.id, properties: propertiesWithAlert, alertCount };
          })
        );

        if (cancelled) return;
        const updateMap = new Map(
          updates
            .filter(
              (u): u is { id: number; properties: Array<{ id: string; name: string; value: string; inAlert: boolean }>; alertCount: number } =>
                !!u
            )
            .map((u) => [u.id, u])
        );

        setSystemState((curr) =>
          curr.map((system) => {
            const next = updateMap.get(system.id);
            if (!next) return system;
            return {
              ...system,
              properties: next.properties,
              alertCount: next.alertCount,
            };
          })
        );
      } finally {
        polling = false;
      }
    };

    refreshAssignedSystems();
    const intervalId = setInterval(refreshAssignedSystems, 5000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [globalDecimalPlaces, propertyDecimalPlacesMap]);

  const onDragMove = useCallback((event: MouseEvent) => {
    const drag = dragStateRef.current;
    const mapEl = mapCanvasRef.current;
    if (!drag || !mapEl) return;

    const rect = mapEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const deltaX = ((event.clientX - drag.startX) / rect.width) * 100;
    const deltaY = ((event.clientY - drag.startY) / rect.height) * 100;

    const nextLeft = clamp(drag.originLeft + deltaX, 0, 100 - drag.width);
    const nextTop = clamp(drag.originTop + deltaY, 0, 100 - drag.height);

    setDraftBoxes((curr) =>
      curr.map((box) =>
        box.id === drag.id
          ? {
              ...box,
              left: nextLeft,
              top: nextTop,
            }
          : box
      )
    );
  }, []);

  const stopDragging = useCallback(() => {
    dragStateRef.current = null;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", stopDragging);
  }, [onDragMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", stopDragging);
    };
  }, [onDragMove, stopDragging]);

  function getSelectedDeviceId(systemId: number): string | undefined {
    const selected = selectedBySystem[makeSelectionKey(systemId)];
    if (!selected || !validDeviceIds.has(selected)) return undefined;
    return selected;
  }

  function getStatusDisplay(system: CenterMapSystemView) {
    if (!system.assignedDeviceId) {
      return {
        icon: <Circle className="h-6 w-6 text-slate-400 transition-none pointer-events-none" aria-label="Unassigned" />,
      };
    }
    if (system.alertCount == null) {
      return {
        icon: <Circle className="h-6 w-6 text-slate-500 transition-none pointer-events-none" aria-label="Unknown status" />,
      };
    }
    if (system.alertCount > 0) {
      return {
        icon: <AlertTriangle className="h-6 w-6 text-red-500 transition-none pointer-events-none" aria-label="Active alerts" />,
      };
    }
    return {
      icon: <CheckCircle2 className="h-6 w-6 text-green-600 transition-none pointer-events-none" aria-label="No alerts" />,
    };
  }

  async function handleAssign(systemId: number) {
    const selectedDeviceId = getSelectedDeviceId(systemId);
    if (!selectedDeviceId) {
      toast({ title: "No PLC selected", description: "Choose a PLC before connecting.", variant: "destructive" });
      return;
    }

    const previous = systemState;
    setPendingSystemId(systemId);
    setSystemState((curr) =>
      curr.map((system) =>
        system.id === systemId
          ? {
              ...system,
              assignedDeviceId: selectedDeviceId,
              assignedDevice: {
                id: selectedDeviceId,
                name: devicesById.get(selectedDeviceId)?.name ?? selectedDeviceId,
                status: "UNKNOWN",
                lastActivityAt: null,
                thingId: selectedDeviceId,
              },
              alertCount: null,
              properties: [],
            }
          : system
      )
    );

    const result = await setCenterMapAssignment(systemId, selectedDeviceId);
    setPendingSystemId(null);
    if (!result.ok) {
      setSystemState(previous);
      toast({ title: "Error", description: result.error ?? "Failed to connect PLC.", variant: "destructive" });
      return;
    }

    toast({ title: "PLC connected", description: "Map assignment updated." });
    router.refresh();
  }

  async function handleRemove(systemId: number) {
    const previous = systemState;
    setPendingSystemId(systemId);
    setSystemState((curr) =>
      curr.map((system) =>
        system.id === systemId
          ? {
              ...system,
              assignedDeviceId: null,
              assignedDevice: null,
              alertCount: null,
              properties: [],
            }
          : system
      )
    );

    const result = await setCenterMapAssignment(systemId, null);
    setPendingSystemId(null);
    if (!result.ok) {
      setSystemState(previous);
      toast({ title: "Error", description: result.error ?? "Failed to remove PLC.", variant: "destructive" });
      return;
    }

    setSelectedBySystem((curr) => ({ ...curr, [makeSelectionKey(systemId)]: undefined }));
    toast({ title: "PLC removed", description: "Map assignment cleared." });
    router.refresh();
  }

  function handleEnterEditMode() {
    if (!canEditLayout) return;
    if (isMobile) {
      toast({ title: "Desktop required", description: "Map layout editing is available on desktop/tablet only." });
      return;
    }

    setDraftBoxes(sortSystems(systemState).map(mapSystemToDraft));
    setOpenSystemId(null);
    setIsEditMode(true);
  }

  function handleCancelEdit() {
    setIsEditMode(false);
    setDraftBoxes([]);
    setRenameBoxId(null);
    setRenameValue("");
  }

  function handleAddBox() {
    setDraftBoxes((curr) => {
      const nextLabel = pickNextLocationName(curr.map((box) => box.label));
      return [
        ...curr,
        {
          id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          label: nextLabel,
          left: 45,
          top: 35,
          width: DEFAULT_NEW_WIDTH,
          height: DEFAULT_NEW_HEIGHT,
          rotate: null,
          sortOrder: curr.length,
        },
      ];
    });
  }

  function handleDeleteDraftBox(boxId: DraftBoxId) {
    if (renameBoxId === boxId) {
      setRenameBoxId(null);
      setRenameValue("");
    }
    setDraftBoxes((curr) =>
      curr
        .filter((box) => box.id !== boxId)
        .map((box, index) => ({
          ...box,
          sortOrder: index,
        }))
    );
  }

  function handleDraftNameChange(boxId: DraftBoxId, nextName: string) {
    setDraftBoxes((curr) => curr.map((box) => (box.id === boxId ? { ...box, label: nextName } : box)));
  }

  function openRenameDialog(box: DraftBox) {
    setRenameBoxId(box.id);
    setRenameValue(box.label);
  }

  function closeRenameDialog() {
    setRenameBoxId(null);
    setRenameValue("");
  }

  function handleRenameSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (renameBoxId === null) return;
    const nextName = renameValue.trim();
    if (!nextName) {
      toast({ title: "Name required", description: "Location name cannot be blank.", variant: "destructive" });
      return;
    }
    handleDraftNameChange(renameBoxId, nextName);
    closeRenameDialog();
  }

  function handleDragStart(event: React.MouseEvent<HTMLDivElement>, box: DraftBox) {
    if (!isEditMode || isMobile || layoutPending) return;
    if (event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest("[data-no-drag='true']")) return;
    event.preventDefault();

    dragStateRef.current = {
      id: box.id,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: box.left,
      originTop: box.top,
      width: box.width,
      height: box.height,
    };

    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", stopDragging);
  }

  async function handleSaveLayout() {
    const payload = draftBoxes.map((box, index) => ({
      id: typeof box.id === "number" ? box.id : undefined,
      name: box.label,
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      rotate: box.rotate,
      sortOrder: index,
    }));

    setLayoutPending(true);
    const result = await saveCenterMapLayout(payload);
    setLayoutPending(false);
    if (!result.ok) {
      toast({ title: "Error", description: result.error ?? "Failed to save map layout.", variant: "destructive" });
      return;
    }

    toast({ title: "Layout saved", description: "Center map layout updated globally." });
    setIsEditMode(false);
    setDraftBoxes([]);
    router.refresh();
  }

  function openSystem(systemId: number) {
    if (isEditMode) return;
    setOpenSystemId(systemId);
  }

  function renderSystemCard(system: CenterMapSystemView, absolute = false) {
    const status = getStatusDisplay(system);

    return (
      <button
        key={system.id}
        type="button"
        onClick={() => openSystem(system.id)}
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
          absolute ? "absolute" : "min-h-[200px] w-full",
          "rounded-xl border bg-slate-50 p-4 transition-all transform-gpu hover:-translate-y-0.5 hover:border-slate-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer overflow-hidden"
        )}
      >
        <div className="flex h-full min-w-0 flex-col items-center justify-center gap-2 text-center">
          <p
            className="font-semibold tracking-wide text-slate-900 break-words leading-tight text-[clamp(0.8rem,1vw,1.75rem)]"
            style={system.rotate ? { transform: `rotate(${system.rotate}deg)` } : undefined}
          >
            {system.label}
          </p>
          <div className="flex items-center justify-center text-slate-600 pointer-events-none">{status.icon}</div>
          <p className="text-slate-600 break-words leading-tight text-[clamp(0.65rem,0.78vw,0.9rem)]">
            {system.assignedDeviceId
              ? `PLC: ${system.assignedDevice?.name ?? `${system.assignedDeviceId} (Unavailable)`}`
              : "No PLC connected"}
          </p>
        </div>
      </button>
    );
  }

  function renderDraftCard(box: DraftBox) {
    return (
      <div
        key={String(box.id)}
        onMouseDown={(event) => handleDragStart(event, box)}
        style={{
          left: `${box.left}%`,
          top: `${box.top}%`,
          width: `${box.width}%`,
          height: `${box.height}%`,
        }}
        className="absolute rounded-xl border-2 border-dashed border-slate-500 bg-slate-50/95 p-3 cursor-move overflow-hidden select-none"
      >
        <div className="flex h-full min-w-0 flex-col">
          <div className="px-2 pt-1">
            <p className="text-sm leading-snug font-semibold text-center text-slate-900 break-words line-clamp-3">
              {box.label}
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex items-center justify-center gap-2 pb-2" data-no-drag="true">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 text-muted-foreground shrink-0"
              onClick={() => openRenameDialog(box)}
              data-no-drag="true"
              aria-label="Rename location"
            >
              <PencilLine className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 text-muted-foreground shrink-0"
              onClick={() => handleDeleteDraftBox(box.id)}
              data-no-drag="true"
              aria-label="Delete location"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-[11px] text-center text-slate-500">Drag to reposition</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {canEditLayout ? (
        <div className="flex flex-wrap items-center gap-2">
          {!isEditMode ? (
            <Button type="button" variant="outline" onClick={handleEnterEditMode}>
              <PencilLine className="mr-1 h-4 w-4" />
              Edit Layout
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleAddBox} disabled={layoutPending}>
                <Plus className="mr-1 h-4 w-4" />
                Add Box
              </Button>
              <Button type="button" onClick={handleSaveLayout} disabled={layoutPending || isMobile}>
                <Save className="mr-1 h-4 w-4" />
                {layoutPending ? "Saving..." : "Save Layout"}
              </Button>
              <Button type="button" variant="ghost" onClick={handleCancelEdit} disabled={layoutPending}>
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
            </>
          )}
        </div>
      ) : null}

      {isEditMode && isMobile ? (
        <p className="text-sm text-muted-foreground">Layout editing is disabled on mobile screens.</p>
      ) : null}

      {!isEditMode && systemState.length === 0 ? (
        <div className="rounded-xl border bg-slate-50 p-6 text-center text-sm text-muted-foreground">
          No map locations configured.
          {canEditLayout ? " Use Edit Layout to add your first location." : " Ask an admin to add map locations."}
        </div>
      ) : null}

      {isEditMode && draftBoxes.length === 0 ? (
        <div className="rounded-xl border bg-slate-50 p-6 text-center text-sm text-muted-foreground">
          No map locations yet. Click Add Box to create one.
        </div>
      ) : null}

      <div className="hidden md:block">
        <div
          ref={mapCanvasRef}
          className={cn(
            "relative w-full overflow-hidden rounded-xl border bg-white aspect-[16/8]",
            isEditMode ? "select-none" : ""
          )}
        >
          {isEditMode ? draftBoxes.map((box) => renderDraftCard(box)) : systemState.map((system) => renderSystemCard(system, true))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:hidden sm:grid-cols-2">
        {systemState.map((system) => renderSystemCard(system, false))}
      </div>

      <Dialog
        open={!!activeSystem && !isEditMode}
        onOpenChange={(open) => {
          if (!open) setOpenSystemId(null);
        }}
      >
        <DialogContent className="w-[95vw] max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {activeSystem ? (
            <>
              <DialogHeader>
                <DialogTitle>{activeSystem.label}</DialogTitle>
                <DialogDescription>Basic PLC details for this location</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold">Assigned PLC:</span>{" "}
                  {activeSystem.assignedDevice
                    ? activeSystem.assignedDevice.name
                    : activeSystem.assignedDeviceId
                    ? "Unavailable PLC"
                    : "No PLC assigned"}
                </p>
                <p>
                  <span className="font-semibold">PLC ID:</span> {activeSystem.assignedDeviceId ?? "N/A"}
                </p>
                <p>
                  <span className="font-semibold">Status:</span>{" "}
                  {activeSystem.assignedDevice ? activeSystem.assignedDevice.status : "N/A"}
                </p>
                <p>
                  <span className="font-semibold">Last Active:</span>{" "}
                  {activeSystem.assignedDevice?.lastActivityAt ? (
                    <FormattedDateTime iso={activeSystem.assignedDevice.lastActivityAt} />
                  ) : (
                    "N/A"
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Alerts:</span>
                  <span className="inline-flex items-center text-slate-600">{getStatusDisplay(activeSystem).icon}</span>
                </div>
              </div>
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-semibold">Assign PLC</p>
                <Select
                  value={getSelectedDeviceId(activeSystem.id)}
                  onValueChange={(value) =>
                    setSelectedBySystem((curr) => ({
                      ...curr,
                      [makeSelectionKey(activeSystem.id)]: value,
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
                        {device.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-2">
                  <Button disabled={isActiveSystemPending || !getSelectedDeviceId(activeSystem.id)} onClick={() => handleAssign(activeSystem.id)}>
                    <Link2 className="mr-1 h-3.5 w-3.5" />
                    Connect
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isActiveSystemPending || !activeSystem.assignedDeviceId}
                    onClick={() => handleRemove(activeSystem.id)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remove PLC
                  </Button>
                </div>
              </div>
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-semibold">Properties</p>
                {activeSystem.properties.length > 0 ? (
                  <div className="max-h-56 overflow-auto rounded border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left font-medium">Property</th>
                          <th className="p-2 text-left font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSystem.properties.map((property) => (
                          <tr key={property.id} className="border-t align-top">
                            <td className="p-2 break-words">
                              <span className="inline-flex items-center gap-1">
                                {property.name}
                                {property.inAlert ? (
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" aria-label="Property in alert" />
                                ) : null}
                              </span>
                            </td>
                            <td className="p-2 break-words">{property.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No properties available</p>
                )}
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

      <Dialog
        open={renameBoxId !== null}
        onOpenChange={(open) => {
          if (!open) closeRenameDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Rename Location</DialogTitle>
              <DialogDescription>Update the location name used on the center map.</DialogDescription>
            </DialogHeader>
            <div>
              <Input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder="Location name"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeRenameDialog}>
                Cancel
              </Button>
              <Button type="submit">Save Name</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
