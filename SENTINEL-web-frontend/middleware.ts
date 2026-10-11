import { NextResponse, type NextRequest } from "next/server";

const api = process.env.SENTINEL_API_URL ?? "http://127.0.0.1:8000";

// REMOVE BEFORE PRODUCTION. Unset SENTINEL_DEV_OPEN on Vercel and delete this line.
const devOpen = process.env.SENTINEL_DEV_OPEN === "1";

function isPublic(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/organizations" ||
    pathname.startsWith("/api/webhooks/")
  );
}

async function sessionIsValid(token: string) {
  try {
    const response = await fetch(api + "/api/auth/session", {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("sentinel_session")?.value;
  if (isPublic(pathname)) {
    if (pathname === "/login" && token && (await sessionIsValid(token))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }
  // REMOVE BEFORE PRODUCTION. Delete this line so a missing cookie is redirected to /login again.
  if (!token && devOpen) return NextResponse.next();
  if (!token || !(await sessionIsValid(token))) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (token) response.cookies.delete("sentinel_session");
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
