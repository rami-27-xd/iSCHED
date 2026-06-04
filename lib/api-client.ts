/**
 * Client-side API fetch helper with resilient error handling.
 * Handles HTML redirects (session expired), network errors, and non-JSON responses.
 */
export async function safeFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { ...options, redirect: "follow" })
  } catch {
    throw new Error("Network error — could not reach the server.")
  }

  // If redirected to sign-in (middleware redirect or HTML response), treat as auth error
  if (res.redirected || res.headers.get("content-type")?.includes("text/html")) {
    throw new Error("Session expired. Please sign in again.")
  }

  let json: any
  try {
    json = await res.json()
  } catch {
    throw new Error(`Server error (status ${res.status}).`)
  }

  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
  // TanStack Query v5 forbids undefined — always return a value
  return (json.data ?? []) as T
}

/** @deprecated Use safeFetch instead */
export async function apiFetch(url: string, options?: RequestInit) {
  return safeFetch(url, options)
}
