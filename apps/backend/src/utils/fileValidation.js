export function validateFile({ file, maxBytes }) {
  if (!file) return { ok: false, error: "File is required" };

  if (typeof file.size === "number" && file.size > maxBytes) {
    return { ok: false, error: `File too large. Max is ${Math.floor(maxBytes / (1024 * 1024))}MB.` };
  }

  const name = (file.originalname || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";

  return { ok: true, ext, mimeType: file.mimetype || "application/octet-stream" };
}
