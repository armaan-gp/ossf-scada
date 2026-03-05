"use client";

import { saveGlobalDecimalPlaces, savePropertyDecimalPlaces } from "@/app/actions/settings";
import { useToast } from "@/hooks/use-toast";
import type { PlcWithProperties } from "@/lib/plcsWithProperties";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function key(thingId: string, propertyId: string): string {
  return `${thingId}:${propertyId}`;
}

function isNumericProperty(type: string): boolean {
  const normalized = (type ?? "").toUpperCase();
  return normalized === "INT" || normalized === "FLOAT";
}

type RowState = {
  raw: string;
  saved: number | null;
};

export function PropertyValueDisplayEditor({
  plcs,
  initialGlobalDecimalPlaces,
  initialPropertyDecimals,
}: {
  plcs: PlcWithProperties[];
  initialGlobalDecimalPlaces: number | null;
  initialPropertyDecimals: Record<string, number | null>;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedThingId, setSelectedThingId] = useState<string>(plcs[0]?.thingId ?? "");
  const [globalRaw, setGlobalRaw] = useState<string>(
    initialGlobalDecimalPlaces === null ? "" : String(initialGlobalDecimalPlaces)
  );
  const [savedGlobal, setSavedGlobal] = useState<number | null>(initialGlobalDecimalPlaces);
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const next: Record<string, RowState> = {};
    for (const plc of plcs) {
      for (const prop of plc.properties) {
        const current = initialPropertyDecimals[key(plc.thingId, prop.id)] ?? null;
        next[key(plc.thingId, prop.id)] = { raw: current === null ? "" : String(current), saved: current };
      }
    }
    return next;
  });

  const selectedPlc = useMemo(
    () => plcs.find((plc) => plc.thingId === selectedThingId) ?? plcs[0],
    [plcs, selectedThingId]
  );

  useEffect(() => {
    if (plcs.length === 0) return;
    if (!plcs.some((plc) => plc.thingId === selectedThingId)) {
      setSelectedThingId(plcs[0].thingId);
    }
  }, [plcs, selectedThingId]);

  const parseDecimalInput = (raw: string): { ok: true; value: number | null } | { ok: false; message: string } => {
    if (raw.trim() === "") return { ok: true, value: null };
    const value = Number(raw);
    if (!Number.isInteger(value)) return { ok: false, message: "Decimal places must be a whole number." };
    if (value < 0 || value > 10) return { ok: false, message: "Decimal places must be between 0 and 10." };
    return { ok: true, value };
  };

  const handleSaveGlobal = () => {
    const parsed = parseDecimalInput(globalRaw);
    if (!parsed.ok) {
      toast({ title: "Invalid global value", description: parsed.message, variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const result = await saveGlobalDecimalPlaces(parsed.value);
      if (!result.ok) {
        toast({ title: "Error", description: result.error ?? "Failed to save global decimal places.", variant: "destructive" });
        return;
      }
      setSavedGlobal(parsed.value);
      setGlobalRaw(parsed.value === null ? "" : String(parsed.value));
      toast({
        title: "Saved",
        description: parsed.value === null ? "Global decimal display cleared." : `Global decimal places set to ${parsed.value}.`,
      });
    });
  };

  const handleSaveProperty = (thingId: string, propertyId: string) => {
    const k = key(thingId, propertyId);
    const current = rows[k] ?? { raw: "", saved: null };
    const parsed = parseDecimalInput(current.raw);
    if (!parsed.ok) {
      toast({ title: "Invalid value", description: parsed.message, variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const result = await savePropertyDecimalPlaces(thingId, propertyId, parsed.value);
      if (!result.ok) {
        toast({ title: "Error", description: result.error ?? "Failed to save property decimal places.", variant: "destructive" });
        return;
      }
      setRows((prev) => ({
        ...prev,
        [k]: {
          raw: parsed.value === null ? "" : String(parsed.value),
          saved: parsed.value,
        },
      }));
      toast({
        title: "Saved",
        description: parsed.value === null ? "Property now uses global decimal places." : `Property decimal places set to ${parsed.value}.`,
      });
    });
  };

  if (plcs.length === 0) {
    return <p className="text-sm text-muted-foreground">No PLCs found. Ensure devices are connected.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2 border rounded-md p-3">
        <Label className="text-xs">Global decimal places (all properties)</Label>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            min={0}
            max={10}
            placeholder="Blank = no forced decimals"
            value={globalRaw}
            onChange={(e) => setGlobalRaw(e.target.value)}
            className="max-w-[220px]"
          />
          <Button size="sm" disabled={isPending} onClick={handleSaveGlobal}>
            Save Global
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Current global setting: {savedGlobal === null ? "None (show original value)" : `${savedGlobal} decimal places`}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Per-property override</Label>
        <Select value={selectedPlc?.thingId ?? ""} onValueChange={setSelectedThingId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a PLC" />
          </SelectTrigger>
          <SelectContent>
            {plcs.map((plc) => (
              <SelectItem key={plc.deviceId} value={plc.thingId}>
                {plc.deviceName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPlc ? (
        <div className="space-y-2">
          {selectedPlc.properties.map((prop) => {
            const k = key(selectedPlc.thingId, prop.id);
            const row = rows[k] ?? { raw: "", saved: null };
            const numeric = isNumericProperty(prop.type);
            return (
              <div key={k} className="border rounded-md p-3 space-y-2">
                <div>
                  <p className="text-sm font-medium">{prop.name}</p>
                  <p className="text-xs text-muted-foreground">{prop.type}</p>
                </div>
                {numeric ? (
                  <>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        placeholder="Blank = use global"
                        value={row.raw}
                        onChange={(e) =>
                          setRows((prev) => ({
                            ...prev,
                            [k]: { ...row, raw: e.target.value },
                          }))
                        }
                        className="max-w-[220px]"
                      />
                      <Button size="sm" disabled={isPending} onClick={() => handleSaveProperty(selectedPlc.thingId, prop.id)}>
                        Save
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current override: {row.saved === null ? "Uses global setting" : `${row.saved} decimal places`}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Not applicable for this property type.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
