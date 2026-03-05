"use client";

import { useState } from "react";
import { getAlertEventsPreview } from "@/app/actions/alerts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, FileText } from "lucide-react";

type AlertPreviewRow = {
  occurredAt: Date;
  thingId: string;
  thingName: string;
  propertyId: string;
  propertyName: string;
  propertyType: string;
  valueRaw: string;
};

export function AlertEventsCsvCard() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AlertPreviewRow[]>([]);
  const csvUrl = "/api/alerts/csv";

  const loadPreview = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const next = await getAlertEventsPreview(500);
      setRows(next);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-md border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Alert History CSV</p>
          <p className="text-xs text-muted-foreground">
            New alert events with timestamp, PLC, and property details.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={loadPreview}>
                <FileText className="h-4 w-4 mr-1" />
                Preview CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl">
              <DialogHeader>
                <DialogTitle>Alert History CSV Preview</DialogTitle>
              </DialogHeader>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No alert events recorded yet.</p>
              ) : (
                <div className="max-h-[420px] overflow-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">#</th>
                        <th className="text-left p-2">Date/Time</th>
                        <th className="text-left p-2">PLC Name</th>
                        <th className="text-left p-2">PLC ID</th>
                        <th className="text-left p-2">Property Name</th>
                        <th className="text-left p-2">Property ID</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={`${row.thingId}:${row.propertyId}:${String(row.occurredAt)}:${idx}`} className="border-t">
                          <td className="p-2">{rows.length - idx}</td>
                          <td className="p-2">{new Date(row.occurredAt).toLocaleString()}</td>
                          <td className="p-2">{row.thingName}</td>
                          <td className="p-2">{row.thingId}</td>
                          <td className="p-2">{row.propertyName}</td>
                          <td className="p-2">{row.propertyId}</td>
                          <td className="p-2">{row.propertyType}</td>
                          <td className="p-2">{row.valueRaw}</td>
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
      </div>
    </div>
  );
}
