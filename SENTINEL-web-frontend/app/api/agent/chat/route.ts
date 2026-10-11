import { sessionHeaders } from "../../../../lib/api-session";

export const dynamic = "force-dynamic";

const api = process.env.SENTINEL_API_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    const response = await fetch(api + "/api/agent/chat", {
      method: "POST",
      cache: "no-store",
      headers: await sessionHeaders({ "content-type": "application/json" }),
      body: await request.text(),
    });
    const body = await response.json();
    return Response.json(body, { status: response.status });
  } catch {
    return Response.json({ detail: "The inspection assistant is not running." }, { status: 503 });
  }
}
