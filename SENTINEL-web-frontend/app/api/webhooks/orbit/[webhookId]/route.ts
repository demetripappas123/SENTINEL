export const dynamic = "force-dynamic";

const api = process.env.SENTINEL_API_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request, context: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await context.params;
  const secret = request.headers.get("x-sentinel-webhook-secret");
  try {
    const response = await fetch(api + "/api/webhooks/orbit/" + encodeURIComponent(webhookId), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-sentinel-webhook-secret": secret } : {}),
      },
      body: await request.text(),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json({ error: "Orbit webhook is unavailable" }, { status: 503 });
  }
}
