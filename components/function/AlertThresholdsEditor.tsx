"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { savePropertyThreshold, deletePropertyThreshold } from "@/app/actions/settings";
import type { PlcWithProperties } from "@/lib/plcsWithProperties";

type ThresholdsMap = Record<string, { min: number | null; max: number | null }>;

export function AlertThresholdsEditor({
  plcs,
  initialThresholds,
}: {
  plcs: PlcWithProperties[];
  initialThresholds: ThresholdsMap;
}) {
  const [thresholds, setThresholds] = useState<ThresholdsMap>(initialThresholds);
  const [pending, setPending] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const key = (thingId: string, propertyId: string) => `${thingId}:${propertyId}`;

  async function handleSave(thingId: string, propertyId: string, minStr: string, maxStr: string) {
    const id = key(thingId, propertyId);
    const minStrTrimmed = minStr.trim();
    const maxStrTrimmed = maxStr.trim();
    const min = minStrTrimmed === "" ? null : parseFloat(minStrTrimmed);
    const max = maxStrTrimmed === "" ? null : parseFloat(maxStrTrimmed);
    
    // If both are empty, delete the threshold
    if (min === null && max === null) {
      const result = await deletePropertyThreshold(thingId, propertyId);
      if (result.ok) {
        setThresholds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        toast({ title: "Cleared", description: "Threshold cleared." });
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } else {
      // If one is NaN (invalid number), treat it as null
      const minVal = (min !== null && Number.isNaN(min)) ? null : min;
      const maxVal = (max !== null && Number.isNaN(max)) ? null : max;
      setPending(id);
      const result = await savePropertyThreshold(thingId, propertyId, minVal, maxVal);
      setPending(null);
      if (result.ok) {
        setThresholds((prev) => ({ ...prev, [id]: { min: minVal, max: maxVal } }));
        toast({ title: "Saved", description: "Threshold saved." });
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    }
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
                const t = prop.type;
                const th = thresholds[key(plc.thingId, prop.id)];
                const isNumeric = t === "INT" || t === "FLOAT";
                const k = key(plc.thingId, prop.id);
                const isPending = pending === k;

                if (!isNumeric) {
                  return (
                    <div key={prop.id} className="flex items-center gap-4 text-sm">
                      <span className="font-medium">{prop.name}</span>
                      <span className="text-muted-foreground">({t})</span>
                      <span className="text-xs text-muted-foreground">No range threshold for this type</span>
                    </div>
                  );
                }

                return (
                  <ThresholdRow
                    key={prop.id}
                    thingId={plc.thingId}
                    propertyId={prop.id}
                    propertyName={prop.name}
                    propertyType={t}
                    initialMin={th?.min}
                    initialMax={th?.max}
                    onSave={handleSave}
                    pending={isPending}
                  />
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ThresholdRow({
  thingId,
  propertyId,
  propertyName,
  propertyType,
  initialMin,
  initialMax,
  onSave,
  pending,
}: {
  thingId: string;
  propertyId: string;
  propertyName: string;
  propertyType: string;
  initialMin?: number | null;
  initialMax?: number | null;
  onSave: (thingId: string, propertyId: string, minStr: string, maxStr: string) => void;
  pending: boolean;
}) {
  const [minStr, setMinStr] = useState(initialMin != null ? String(initialMin) : "");
  const [maxStr, setMaxStr] = useState(initialMax != null ? String(initialMax) : "");

  useEffect(() => {
    setMinStr(initialMin != null ? String(initialMin) : "");
    setMaxStr(initialMax != null ? String(initialMax) : "");
  }, [initialMin, initialMax]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded border p-3">
      <div className="min-w-[120px]">
        <Label className="text-xs">{propertyName}</Label>
        <p className="text-xs text-muted-foreground">{propertyType}</p>
      </div>
      <div className="w-24">
        <Label className="text-xs">Min</Label>
        <Input
          type="number"
          step={propertyType === "FLOAT" ? 0.1 : 1}
          value={minStr}
          onChange={(e) => setMinStr(e.target.value)}
          placeholder="—"
          className="mt-1"
        />
      </div>
      <div className="w-24">
        <Label className="text-xs">Max</Label>
        <Input
          type="number"
          step={propertyType === "FLOAT" ? 0.1 : 1}
          value={maxStr}
          onChange={(e) => setMaxStr(e.target.value)}
          placeholder="—"
          className="mt-1"
        />
      </div>
      <Button
        size="sm"
        disabled={pending}
        onClick={() => onSave(thingId, propertyId, minStr, maxStr)}
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
