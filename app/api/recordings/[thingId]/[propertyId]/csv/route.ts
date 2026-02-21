import { buildRecordingCsv } from "@/lib/propertyRecordings";

function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ thingId: string; propertyId: string }> }
) {
  const { thingId, propertyId } = await params;
  const csv = await buildRecordingCsv(thingId, propertyId);
  const filename = `plc-${sanitizeName(thingId)}-${sanitizeName(propertyId)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
