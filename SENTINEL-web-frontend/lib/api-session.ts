import { createApiClient } from "@sentinel/core/api";
import { cookies } from "next/headers";

export async function sessionHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  const token = (await cookies()).get("sentinel_session")?.value;
  if (token) headers.set("authorization", "Bearer " + token);
  return headers;
}

export async function createSessionClient() {
  const token = (await cookies()).get("sentinel_session")?.value;
  return createApiClient(process.env.SENTINEL_API_URL ?? "http://127.0.0.1:8000", (input, init) => {
    const headers = new Headers(init?.headers);
    if (token) headers.set("authorization", "Bearer " + token);
    return fetch(input, { ...init, headers, cache: "no-store" });
  });
}
