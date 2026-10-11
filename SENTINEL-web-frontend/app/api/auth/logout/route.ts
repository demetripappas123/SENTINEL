import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const api = process.env.SENTINEL_API_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  const token = request.headers.get("cookie")?.match(/(?:^|;\s*)sentinel_session=([^;]+)/)?.[1];
  try {
    await fetch(api + "/api/auth/logout", {
      method: "POST",
      headers: token ? { Authorization: "Bearer " + decodeURIComponent(token) } : {},
    });
  } catch {
    // Clearing the cookie still signs the browser out.
  }
  const next = new NextResponse(null, { status: 204 });
  next.cookies.delete("sentinel_session");
  return next;
}
