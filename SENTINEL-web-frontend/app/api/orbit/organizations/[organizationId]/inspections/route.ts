import { sessionHeaders } from "../../../../../../lib/api-session";

export const dynamic = "force-dynamic";

const api = process.env.SENTINEL_API_URL ?? "http://127.0.0.1:8000";

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;
  try {
    const response = await fetch(
      api + "/api/orbit/organizations/" + encodeURIComponent(organizationId) + "/inspections",
      { cache: "no-store", headers: await sessionHeaders() },
    );
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json({ error: "Inspections are unavailable" }, { status: 503 });
  }
}
