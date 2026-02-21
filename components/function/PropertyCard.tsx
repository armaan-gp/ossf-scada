"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileDown, Table2 } from "lucide-react";
import { updateDeviceProperty } from "@/lib/actions/arduino";
import { FormattedDateTime } from "@/components/FormattedDateTime";
import { getPropertyCsvData, type CsvDataRow } from "@/app/actions/csv";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ArduinoProperty {
    id: string;
    name: string;
    type: string;
    permission: "READ_ONLY" | "READ_WRITE";
    update_strategy: string;
    variable_name: string;
    tag: string;
    persist: boolean;
    last_value: any;
    value_updated_at: string;
}

interface PropertyCardProps {
    property: ArduinoProperty;
    thingId: string;
    onUpdate: () => void;
    inAlert?: boolean;
}

export function PropertyCard({ property, thingId, onUpdate, inAlert = false }: PropertyCardProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [optimisticValue, setOptimisticValue] = useState<any>(null);

    const displayValue = optimisticValue !== null ? optimisticValue : property.last_value;

    const handlePropertyUpdate = async (value: any) => {
        if (value === property.last_value) return;

        setOptimisticValue(value);
        setIsUpdating(true);

        try {
            const result = await updateDeviceProperty(thingId, property.id, value);
            if (result.success) {
                onUpdate();
            } else {
                setOptimisticValue(property.last_value);
            }
        } catch (error) {
            console.error("Failed to update property:", error);
            setOptimisticValue(property.last_value);
        } finally {
            setIsUpdating(false);
        }
    };

    if (optimisticValue !== null && property.last_value === optimisticValue) {
        setOptimisticValue(null);
    }

    return (
        <Card className="border-muted">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg inline-flex items-center gap-2">
                        {property.name}
                        {inAlert && <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" aria-label="Out of range" />}
                    </CardTitle>
                    <Badge
                        className={
                            property.permission === "READ_ONLY"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                        }
                    >
                        {property.permission}
                    </Badge>
                </div>
                <CardDescription>
                    Type: {property.type} • Update: {property.update_strategy}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Current Value</h4>
                        <div className="text-xl font-semibold">
                            {property.type === "STATUS" ? (displayValue ? "True" : "False") : displayValue}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Last updated: <FormattedDateTime iso={property.value_updated_at} />
                        </p>
                        {property.permission === "READ_WRITE" && (
                            <div className="mt-4">
                                {property.type === "STATUS" ? (
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            checked={!!displayValue}
                                            disabled={isUpdating}
                                            onCheckedChange={handlePropertyUpdate}
                                        />
                                        <span className="text-sm text-muted-foreground">
                                            {displayValue ? "On" : "Off"}
                                        </span>
                                    </div>
                                ) : (
                                    <Input
                                        type="text"
                                        value={displayValue ?? ""}
                                        className="w-full"
                                        disabled={isUpdating}
                                        onChange={(e) => handlePropertyUpdate(e.target.value)}
                                    />
                                )}
                                {isUpdating && (
                                    <p className="text-xs text-muted-foreground mt-1">Updating...</p>
                                )}
                            </div>
                        )}
                    </div>
                    <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Property Details</h4>
                        <dl className="grid grid-cols-2 gap-1 text-sm">
                            <dt className="text-muted-foreground">Variable:</dt>
                            <dd>{property.variable_name}</dd>
                            <dt className="text-muted-foreground">Tag:</dt>
                            <dd>{property.tag}</dd>
                            <dt className="text-muted-foreground">Persist:</dt>
                            <dd>{property.persist ? "Yes" : "No"}</dd>
                        </dl>
                        <div className="mt-3 pt-3 border-t">
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">CSV data</h4>
                            <CsvDataActions thingId={thingId} propertyId={property.id} propertyName={property.name} />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function CsvDataActions({
  thingId,
  propertyId,
  propertyName,
}: {
  thingId: string;
  propertyId: string;
  propertyName: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [rows, setRows] = useState<CsvDataRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadPreview() {
    setLoading(true);
    try {
      const data = await getPropertyCsvData(thingId, propertyId);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  function openPreview() {
    setPreviewOpen(true);
    loadPreview();
  }

  async function downloadCsv() {
    setLoading(true);
    try {
      const data = await getPropertyCsvData(thingId, propertyId);
      const header = "date,time,value,alerts";
      const body = data.map((r) => `${r.date},${r.time},${escapeCsv(r.value)},${r.alerts}`).join("\n");
      const csv = header + "\n" + body;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizeFileName(propertyName)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={openPreview} disabled={loading}>
          <Table2 className="h-3.5 w-3.5 mr-1" />
          Preview
        </Button>
        <Button variant="outline" size="sm" onClick={downloadCsv} disabled={loading}>
          <FileDown className="h-3.5 w-3.5 mr-1" />
          Download CSV
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>CSV data: {propertyName}</DialogTitle>
          </DialogHeader>
          {loading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data recorded yet. Enable recording in Settings.</p>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Alerts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.date}</TableCell>
                      <TableCell className="font-mono text-xs">{r.time}</TableCell>
                      <TableCell className="font-mono text-xs">{r.value}</TableCell>
                      <TableCell>{r.alerts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50) || "data";
} 