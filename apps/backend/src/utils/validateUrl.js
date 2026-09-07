export function validateHttpUrl(raw) {
  if (!raw || typeof raw !== "string") return { ok: false, error: "URL is required" };

  const value = raw.trim();
  let u;
  try {
    u = new URL(value);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "URL must start with http:// or https://" };
  }

  // Basic host sanity
  if (!u.hostname || u.hostname.length < 3) {
    return { ok: false, error: "Invalid hostname" };
  }

  return { ok: true, url: u.toString() };
}
