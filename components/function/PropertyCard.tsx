"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Download, FileText } from "lucide-react";
import { updateDeviceProperty } from "@/lib/actions/arduino";
import { FormattedDateTime } from "@/components/FormattedDateTime";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getPropertyRecordingPreview } from "@/app/actions/recordings";

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
    recordingConfig?: {
        enabled: boolean;
        intervalMinutes: number | null;
        maxRows: number | null;
    };
}

export function PropertyCard({ property, thingId, onUpdate, inAlert = false, recordingConfig }: PropertyCardProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [optimisticValue, setOptimisticValue] = useState<any>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewRows, setPreviewRows] = useState<Array<{ recordedAt: Date; value: string; alertCount: number }>>([]);

    const displayValue = optimisticValue !== null ? optimisticValue : property.last_value;
    const isRecordingEnabled = recordingConfig?.enabled === true;
    const csvUrl = `/api/recordings/${encodeURIComponent(thingId)}/${encodeURIComponent(property.id)}/csv`;

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

    const openPreview = async () => {
        setPreviewOpen(true);
        setPreviewLoading(true);
        try {
            const previewLimit = recordingConfig?.maxRows ?? 10000;
            const rows = await getPropertyRecordingPreview(thingId, property.id, previewLimit);
            setPreviewRows(rows);
        } catch (error) {
            console.error("Failed to load recording preview:", error);
            setPreviewRows([]);
        } finally {
            setPreviewLoading(false);
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
                                ? "bg-blue-100 text-blue-800 hover:bg-blue-100 cursor-default"
                                : "bg-green-100 text-green-800 hover:bg-green-100 cursor-default"
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
                        <div className="mt-4 border rounded p-3">
                            <h4 className="text-sm font-medium mb-2">CSV Recording</h4>
                            {isRecordingEnabled ? (
                                <>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Interval: {recordingConfig?.intervalMinutes} min • Max rows: {recordingConfig?.maxRows}
                                    </p>
                                    <div className="flex gap-2">
                                        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                                            <DialogTrigger asChild>
                                                <Button size="sm" variant="outline" onClick={openPreview}>
                                                    <FileText className="h-4 w-4 mr-1" />
                                                    Preview CSV
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl">
                                                <DialogHeader>
                                                    <DialogTitle>{property.name} CSV Preview</DialogTitle>
                                                </DialogHeader>
                                                {previewLoading ? (
                                                    <p className="text-sm text-muted-foreground">Loading preview...</p>
                                                ) : previewRows.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground">No recorded rows yet.</p>
                                                ) : (
                                                    <div className="max-h-[360px] overflow-auto border rounded">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-muted">
                                                                <tr>
                                                                    <th className="text-left p-2">#</th>
                                                                    <th className="text-left p-2">Date/Time</th>
                                                                    <th className="text-left p-2">Value</th>
                                                                    <th className="text-left p-2">Alerts</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {previewRows.map((row, idx) => (
                                                                    <tr key={`${String(row.recordedAt)}-${idx}`} className="border-t">
                                                                        <td className="p-2">{previewRows.length - idx}</td>
                                                                        <td className="p-2">{new Date(row.recordedAt).toLocaleString()}</td>
                                                                        <td className="p-2">{row.value}</td>
                                                                        <td className="p-2">{row.alertCount}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </DialogContent>
                                        </Dialog>
                                        <Button asChild size="sm">
                                            <a href={csvUrl}>
                                                <Download className="h-4 w-4 mr-1" />
                                                Download CSV
                                            </a>
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Recording is disabled for this property. Enable it in Settings.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 
