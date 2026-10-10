import { createApiClient } from "@sentinel/core/api";

export const dynamic = "force-dynamic";

const api = createApiClient(process.env.SENTINEL_API_URL ?? "http://127.0.0.1:8000");

export async function GET(request: Request) {
  const detail = new URL(request.url).searchParams.get("detail") !== "0";
  try {
    return Response.json(await api.getCombinedDataset(detail));
  } catch {
    return Response.json({ error: "Dataset is unavailable" }, { status: 503 });
  }
}