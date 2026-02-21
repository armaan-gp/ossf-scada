"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveCsvRecordingConfig } from "@/app/actions/csv";
import type { PlcWithProperties } from "@/lib/plcsWithProperties";
import type { CsvRecordingConfig } from "@/app/actions/csv";

type ConfigMap = Record<string, CsvRecordingConfig>;

export function CsvRecordingEditor({
  plcs,
  initialConfig,
}: {
  plcs: PlcWithProperties[];
  initialConfig: ConfigMap;
}) {
  const [config, setConfig] = useState<ConfigMap>(initialConfig);
  const [pending, setPending] = useState<string | null>(null);
  const [warningFor, setWarningFor] = useState<{ thingId: string; propertyId: string; propertyName: string } | null>(null);
  const [pendingSave, setPendingSave] = useState<{
    thingId: string;
    propertyId: string;
    enabled: boolean;
    intervalMinutes: number | null;
    maxRows: number | null;
    clearRecords: boolean;
  } | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const key = (thingId: string, propertyId: string) => `${thingId}:${propertyId}`;

  function getCurrent(thingId: string, propertyId: string): CsvRecordingConfig {
    return config[key(thingId, propertyId)] ?? { enabled: false, intervalMinutes: null, maxRows: null };
  }

  function setCurrent(
    thingId: string,
    propertyId: string,
    patch: Partial<CsvRecordingConfig>
  ) {
    const id = key(thingId, propertyId);
    setConfig((prev) => ({
      ...prev,
      [id]: { ...getCurrent(thingId, propertyId), ...patch },
    }));
  }

  async function save(
    thingId: string,
    propertyId: string,
    enabled: boolean,
    intervalMinutes: number | null,
    maxRows: number | null,
    clearRecords: boolean
  ) {
    const id = key(thingId, propertyId);
    setPending(id);
    const result = await saveCsvRecordingConfig(
      thingId,
      propertyId,
      { enabled, intervalMinutes, maxRows },
      clearRecords
    );
    setPending(null);
    setWarningFor(null);
    setPendingSave(null);
    if (result.ok) {
      setConfig((prev) => ({ ...prev, [id]: { enabled, intervalMinutes, maxRows } }));
      toast({ title: "Saved", description: "CSV recording settings saved." });
      router.refresh();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  }

  function handleSave(
    thingId: string,
    propertyId: string,
    propertyName: string,
    enabled: boolean,
    intervalStr: string,
    maxRowsStr: string
  ) {
    const prev = getCurrent(thingId, propertyId);
    const intervalMinutes = intervalStr.trim() ? parseInt(intervalStr, 10) : null;
    const maxRows = maxRowsStr.trim() ? parseInt(maxRowsStr, 10) : null;
    const validInterval = intervalMinutes != null && !Number.isNaN(intervalMinutes) && intervalMinutes > 0;
    const validMaxRows = maxRows != null && !Number.isNaN(maxRows) && maxRows > 0;

    if (enabled && (!validInterval || !validMaxRows)) {
      toast({
        title: "Invalid",
        description: "When recording is on, enter a positive interval (minutes) and max rows.",
        variant: "destructive",
      });
      return;
    }

    const turningOff = prev.enabled && !enabled;
    const changingInterval = prev.intervalMinutes !== intervalMinutes;
    const changingMaxRows = prev.maxRows !== maxRows;
    const clearRecords = turningOff || changingInterval || changingMaxRows;

    if (clearRecords) {
      setWarningFor({ thingId, propertyId, propertyName });
      setPendingSave({
        thingId,
        propertyId,
        enabled,
        intervalMinutes: validInterval ? intervalMinutes : null,
        maxRows: validMaxRows ? maxRows : null,
        clearRecords: true,
      });
    } else {
      save(thingId, propertyId, enabled, intervalMinutes, maxRows, false);
    }
  }

  function confirmWarning() {
    if (!pendingSave) return;
    save(
      pendingSave.thingId,
      pendingSave.propertyId,
      pendingSave.enabled,
      pendingSave.intervalMinutes,
      pendingSave.maxRows,
      pendingSave.clearRecords
    );
  }

  if (plcs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No PLCs found. Ensure devices are connected.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {plcs.map((plc) => (
          <div key={plc.deviceId} className="rounded-lg border p-4">
            <h4 className="font-semibold text-sm mb-3">{plc.deviceName}</h4>
            {plc.properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties</p>
            ) : (
              <div className="space-y-3">
                {plc.properties.map((prop) => (
                  <CsvRecordingRow
                    key={prop.id}
                    thingId={plc.thingId}
                    propertyId={prop.id}
                    propertyName={prop.name}
                    config={getCurrent(plc.thingId, prop.id)}
                    onConfigChange={(patch) => setCurrent(plc.thingId, prop.id, patch)}
                    onSave={handleSave}
                    pending={pending === key(plc.thingId, prop.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!warningFor} onOpenChange={(open) => !open && (setWarningFor(null), setPendingSave(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear existing CSV data?</DialogTitle>
            <DialogDescription>
              {warningFor && (
                <>
                  Changing these settings or turning off recording will delete all existing CSV data for{" "}
                  <strong>{warningFor.propertyName}</strong>. Download the current CSV file from the device page before
                  continuing if you need to keep it.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => (setWarningFor(null), setPendingSave(null))}>
              Cancel
            </Button>
            <Button onClick={confirmWarning}>Continue and save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CsvRecordingRow({
  thingId,
  propertyId,
  propertyName,
  config,
  onConfigChange,
  onSave,
  pending,
}: {
  thingId: string;
  propertyId: string;
  propertyName: string;
  config: CsvRecordingConfig;
  onConfigChange: (patch: Partial<CsvRecordingConfig>) => void;
  onSave: (
    thingId: string,
    propertyId: string,
    propertyName: string,
    enabled: boolean,
    intervalStr: string,
    maxRowsStr: string
  ) => void;
  pending: boolean;
}) {
  const [intervalStr, setIntervalStr] = useState(
    config.intervalMinutes != null ? String(config.intervalMinutes) : ""
  );
  const [maxRowsStr, setMaxRowsStr] = useState(
    config.maxRows != null ? String(config.maxRows) : ""
  );

  useEffect(() => {
    setIntervalStr(config.intervalMinutes != null ? String(config.intervalMinutes) : "");
    setMaxRowsStr(config.maxRows != null ? String(config.maxRows) : "");
  }, [config.intervalMinutes, config.maxRows]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded border p-3">
      <div className="min-w-[120px]">
        <Label className="text-xs">{propertyName}</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => onConfigChange({ enabled: checked })}
        />
        <span className="text-xs text-muted-foreground">Record to CSV</span>
      </div>
      <div className="w-24">
        <Label className="text-xs">Interval (min)</Label>
        <Input
          type="number"
          min={1}
          value={intervalStr}
          onChange={(e) => setIntervalStr(e.target.value)}
          placeholder="e.g. 5"
          className="mt-1"
        />
      </div>
      <div className="w-28">
        <Label className="text-xs">Max rows</Label>
        <Input
          type="number"
          min={1}
          value={maxRowsStr}
          onChange={(e) => setMaxRowsStr(e.target.value)}
          placeholder="e.g. 10000"
          className="mt-1"
        />
      </div>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          onSave(thingId, propertyId, propertyName, config.enabled, intervalStr, maxRowsStr)
        }
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
