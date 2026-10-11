import { sessionHeaders } from "../../../../lib/api-session";

export const dynamic = "force-dynamic";

const api = process.env.SENTINEL_API_URL ?? "http://127.0.0.1:8000";

export async function GET() {
  try {
    const response = await fetch(api + "/api/auth/session", {
      cache: "no-store",
      headers: await sessionHeaders(),
    });
    const body = await response.json();
    if (!response.ok) return Response.json(body, { status: response.status });
    return Response.json({ user: body.user, organization: body.organization });
  } catch {
    return Response.json({ detail: "Sign-in is unavailable" }, { status: 503 });
  }
}
