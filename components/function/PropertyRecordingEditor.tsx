"use client";

import { useMemo, useState } from "react";
import type { PlcWithProperties } from "@/lib/plcsWithProperties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { savePropertyRecordingConfig } from "@/app/actions/recordings";
import { useRouter } from "next/navigation";

type RecordingConfigMap = Record<
  string,
  {
    enabled: boolean;
    intervalMinutes: number | null;
    maxRows: number | null;
  }
>;

type RowState = {
  enabled: boolean;
  interval: string;
  maxRows: string;
};

function key(thingId: string, propertyId: string): string {
  return `${thingId}:${propertyId}`;
}

function toPositiveInt(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

const DATA_RESET_WARNING =
  "This change will delete previously recorded CSV data for this property. Download the current CSV first if you need to keep it. Continue?";

export function PropertyRecordingEditor({
  plcs,
  initialConfigs,
}: {
  plcs: PlcWithProperties[];
  initialConfigs: RecordingConfigMap;
}) {
  const [configs, setConfigs] = useState<RecordingConfigMap>(initialConfigs);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const rows = useMemo(() => {
    const flat: Array<{ thingId: string; propertyId: string; propertyName: string; deviceName: string; cfg: RowState }> = [];
    for (const plc of plcs) {
      for (const prop of plc.properties) {
        const k = key(plc.thingId, prop.id);
        const base = configs[k];
        flat.push({
          thingId: plc.thingId,
          propertyId: prop.id,
          propertyName: prop.name,
          deviceName: plc.deviceName,
          cfg: {
            enabled: base?.enabled ?? false,
            interval: base?.intervalMinutes != null ? String(base.intervalMinutes) : "",
            maxRows: base?.maxRows != null ? String(base.maxRows) : "",
          },
        });
      }
    }
    return flat;
  }, [configs, plcs]);

  const [drafts, setDrafts] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {};
    for (const row of rows) {
      initial[key(row.thingId, row.propertyId)] = row.cfg;
    }
    return initial;
  });

  function updateDraft(k: string, next: Partial<RowState>) {
    setDrafts((prev) => ({ ...prev, [k]: { ...prev[k], ...next } }));
  }

  async function handleSave(thingId: string, propertyId: string) {
    const k = key(thingId, propertyId);
    const draft = drafts[k];
    const current = configs[k] ?? { enabled: false, intervalMinutes: null, maxRows: null };
    if (!draft) return;

    if (!draft.enabled) {
      if (current.enabled && !window.confirm(DATA_RESET_WARNING)) return;
      setPendingKey(k);
      const result = await savePropertyRecordingConfig(thingId, propertyId, false, null, null, current.enabled);
      setPendingKey(null);
      if (!result.ok) {
        toast({ title: "Error", description: result.error ?? "Failed to save", variant: "destructive" });
        return;
      }
      setConfigs((prev) => ({ ...prev, [k]: { enabled: false, intervalMinutes: null, maxRows: null } }));
      setDrafts((prev) => ({ ...prev, [k]: { enabled: false, interval: "", maxRows: "" } }));
      toast({ title: "Saved", description: "Recording disabled and previous data cleared." });
      router.refresh();
      return;
    }

    const intervalMinutes = toPositiveInt(draft.interval);
    const maxRows = toPositiveInt(draft.maxRows);
    if (intervalMinutes === null || maxRows === null || intervalMinutes < 5) {
      toast({
        title: "Missing values",
        description: "Interval must be a whole number of at least 5 minutes. Max rows must be a positive whole number.",
        variant: "destructive",
      });
      return;
    }

    const changedWhileEnabled =
      current.enabled &&
      (current.intervalMinutes !== intervalMinutes || current.maxRows !== maxRows);
    const reset = changedWhileEnabled;

    if (changedWhileEnabled && !window.confirm(DATA_RESET_WARNING)) return;

    setPendingKey(k);
    const result = await savePropertyRecordingConfig(
      thingId,
      propertyId,
      true,
      intervalMinutes,
      maxRows,
      reset
    );
    setPendingKey(null);

    if (!result.ok) {
      toast({ title: "Error", description: result.error ?? "Failed to save", variant: "destructive" });
      return;
    }

    setConfigs((prev) => ({
      ...prev,
      [k]: { enabled: true, intervalMinutes, maxRows },
    }));
    toast({
      title: "Saved",
      description: reset ? "Configuration updated and previous data cleared." : "Recording configuration saved.",
    });
    router.refresh();
  }

  if (plcs.length === 0) {
    return <p className="text-sm text-muted-foreground">No PLCs found. Ensure devices are connected.</p>;
  }

  return (
    <div className="space-y-6">
      {plcs.map((plc) => (
        <div key={plc.deviceId} className="rounded-lg border p-4">
          <h4 className="font-semibold text-sm mb-3">{plc.deviceName}</h4>
          {plc.properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No properties</p>
          ) : (
            <div className="space-y-3">
              {plc.properties.map((prop) => {
                const k = key(plc.thingId, prop.id);
                const draft = drafts[k] ?? { enabled: false, interval: "", maxRows: "" };
                const isPending = pendingKey === k;

                return (
                  <div key={prop.id} className="rounded border p-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[140px]">
                        <Label className="text-xs">{prop.name}</Label>
                        <p className="text-xs text-muted-foreground">{prop.type}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={draft.enabled}
                          onCheckedChange={(checked) => updateDraft(k, { enabled: checked })}
                          disabled={isPending}
                        />
                        <span className="text-sm text-muted-foreground">Record CSV data</span>
                      </div>
                      <div className="w-28">
                        <Label className="text-xs">Interval (min)</Label>
                        <Input
                          type="number"
                          min={5}
                          step={1}
                          value={draft.interval}
                          onChange={(e) => updateDraft(k, { interval: e.target.value })}
                          placeholder=">= 5"
                          className="mt-1"
                          disabled={!draft.enabled || isPending}
                        />
                      </div>
                      <div className="w-28">
                        <Label className="text-xs">Max rows</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={draft.maxRows}
                          onChange={(e) => updateDraft(k, { maxRows: e.target.value })}
                          placeholder="required"
                          className="mt-1"
                          disabled={!draft.enabled || isPending}
                        />
                      </div>
                      <Button size="sm" disabled={isPending} onClick={() => handleSave(plc.thingId, prop.id)}>
                        {isPending ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
