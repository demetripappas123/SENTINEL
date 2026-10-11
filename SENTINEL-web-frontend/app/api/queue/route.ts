import { createSessionClient } from "../../../lib/api-session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const api = await createSessionClient();
    return Response.json(await api.getQueue());
  } catch {
    return Response.json({ error: "Queue is unavailable" }, { status: 503 });
  }
}
