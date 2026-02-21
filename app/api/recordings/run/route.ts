import { collectDueRecordingRows } from "@/lib/propertyRecordings";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const result = await collectDueRecordingRows();
  return Response.json(result);
}
