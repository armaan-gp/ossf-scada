import { NextRequest, NextResponse } from "next/server";
import { runCsvRecording } from "@/lib/csvRecording";

/**
 * Cron endpoint to run CSV recording for all enabled properties.
 * Call every 1–5 minutes (e.g. Vercel Cron: "*/5 * * * *" for every 5 min).
 * Secure with CRON_SECRET: pass ?secret=... or Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  const secret =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { recorded, errors } = await runCsvRecording();
    return NextResponse.json({ recorded, errors });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
