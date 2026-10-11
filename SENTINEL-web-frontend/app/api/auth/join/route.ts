import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const api = process.env.SENTINEL_API_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    const response = await fetch(api + "/api/auth/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    });
    const body = await response.json();
    if (!response.ok) return NextResponse.json(body, { status: response.status });
    const next = NextResponse.json({ user: body.user, organization: body.organization });
    next.cookies.set("sentinel_session", body.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return next;
  } catch {
    return NextResponse.json({ detail: "Could not join the organization" }, { status: 503 });
  }
}
