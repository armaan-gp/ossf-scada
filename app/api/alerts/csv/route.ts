import { buildAlertEventsCsv } from "@/lib/alertEvents";

export async function GET() {
  const csv = await buildAlertEventsCsv();
  const filename = "alerts-history.csv";

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
