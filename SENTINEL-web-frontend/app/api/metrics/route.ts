import { createSessionClient } from "../../../lib/api-session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const api = await createSessionClient();
    return Response.json(await api.getMetrics());
  } catch {
    return Response.json({ error: "Metrics are unavailable" }, { status: 503 });
  }
}
