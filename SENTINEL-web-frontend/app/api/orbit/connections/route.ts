import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const api = process.env.SENTINEL_API_URL ?? "http://127.0.0.1:8000";

async function authHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  const token = (await cookies()).get("sentinel_session")?.value;
  if (token) headers.set("authorization", "Bearer " + token);
  return headers;
}

export async function GET() {
  try {
    const response = await fetch(api + "/api/orbit/connections", {
      cache: "no-store",
      headers: await authHeaders(),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json({ error: "Orbit connections are unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const response = await fetch(api + "/api/orbit/connections", {
      method: "POST",
      headers: await authHeaders({ "content-type": "application/json" }),
      body: await request.text(),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json({ error: "Orbit connections are unavailable" }, { status: 503 });
  }
}
