import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScan } from "../hooks/useScan";

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function WebsiteScan() {
  const nav = useNavigate();
  const { scanWebsite, loading, error, setError } = useScan();
  const [url, setUrl] = useState("");

  const canSubmit = useMemo(() => isValidUrl(url.trim()) && !loading, [url, loading]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const target = url.trim();
    if (!isValidUrl(target)) {
      setError("Enter a valid URL starting with http:// or https://");
      return;
    }

    const res = await scanWebsite(target);
    nav(`/report/${res.reportId}`);
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 160px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 20px"
      }}
    >
      <div style={{ width: "100%", maxWidth: 900 }}>
        <h1
          style={{
            color: "white",
            fontSize: 44,
            fontWeight: 900,
            margin: "0 0 18px",
            textAlign: "center"
          }}
        >
          Website Scan
        </h1>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              borderRadius: 22,
              padding: 22,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(12px)"
            }}
          >
            <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
              <label style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>
                Target URL
              </label>

              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                spellCheck={false}
                style={{
                  height: 52,
                  borderRadius: 14,
                  padding: "0 14px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  outline: "none",
                  background: "rgba(10,10,14,0.65)",
                  color: "white"
                }}
              />

              {error ? (
                <div style={{ color: "rgba(255,80,120,0.95)", fontWeight: 700 }}>
                  {error}
                </div>
              ) : (
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
                  Use a full URL including https.
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  height: 52,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: loading
                    ? "rgba(120,120,120,0.15)"
                    : "linear-gradient(90deg, rgba(140,60,255,0.65), rgba(255,30,90,0.55))",
                  color: "white",
                  fontWeight: 900,
                  cursor: !canSubmit ? "not-allowed" : "pointer",
                  opacity: !canSubmit ? 0.7 : 1
                }}
              >
                {loading ? "Scanning..." : "Scan Website"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
