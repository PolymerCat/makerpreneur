var DEFAULT_TRACCAR_WS_URL = "ws://localhost:8082/api/socket";

// Client-side Traccar connection config. The env vars are inlined by Next.js
// for browser code; the standalone test script reads the same names directly.
export function getTraccarWsUrl(): string {
  var configured = process.env.NEXT_PUBLIC_TRACCAR_WS_URL;
  return configured || DEFAULT_TRACCAR_WS_URL;
}

export function getTraccarToken(): string {
  return process.env.NEXT_PUBLIC_TRACCAR_TOKEN || "";
}
