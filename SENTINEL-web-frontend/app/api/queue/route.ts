import { createApiClient } from "@sentinel/core/api";

export const dynamic = "force-dynamic";

const api = createApiClient(process.env.SENTINEL_API_URL ?? "http://127.0.0.1:8000");

export async function GET() {
  try {
    return Response.json(await api.getQueue());
  } catch {
    return Response.json({ error: "Queue is unavailable" }, { status: 503 });
  }
}
