/**
 * Safe post-login redirect helper (marketplace flavour).
 * Only allows same-app relative paths (blocks open redirects).
 */
const ALLOWED_PREFIXES = [
  "/marketplace",
  "/products",
  "/messages",
  "/cart",
  "/profile",
  "/inbox",
  "/login",
  "/register",
] as const;

export function getSafeNextPath(next: string | null | undefined, fallback = "/marketplace"): string {
  if (!next) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("://")) {
    return fallback;
  }

  const pathOnly = decoded.split("?")[0]?.split("#")[0] ?? decoded;
  if (pathOnly === "/") return decoded;

  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)
  );

  return allowed ? decoded : fallback;
}

export function buildLoginUrl(returnPath: string): string {
  const safe = getSafeNextPath(returnPath, "/marketplace");
  return `/signin?next=${encodeURIComponent(safe)}`;
}
