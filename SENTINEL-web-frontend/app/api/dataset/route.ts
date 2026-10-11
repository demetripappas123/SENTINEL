import { createSessionClient } from "../../../lib/api-session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const api = await createSessionClient();
    return Response.json(await api.getLiveDataset());
  } catch {
    return Response.json({ error: "Dataset is unavailable" }, { status: 503 });
  }
}