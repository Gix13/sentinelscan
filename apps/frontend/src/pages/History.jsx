import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function pillStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.35)",
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: 800
  };
}

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const hasItems = useMemo(() => items && items.length > 0, [items]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await api.getHistory(50);
      setItems(res?.items || []);
    } catch (e) {
      setErr(e?.message || "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div
      style={{
        minHeight: "calc(100vh - 160px)",
        display: "flex",
        justifyContent: "center",
        padding: "48px 20px"
      }}
    >
      <div style={{ width: "100%", maxWidth: 1000 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <h1
            style={{
              color: "white",
              fontSize: 44,
              fontWeight: 900,
              margin: 0
            }}
          >
            History
          </h1>

          <button
            onClick={load}
            disabled={loading}
            style={{
              marginLeft: "auto",
              height: 42,
              padding: "0 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background: loading
                ? "rgba(120,120,120,0.15)"
                : "rgba(0,0,0,0.35)",
              color: "rgba(255,255,255,0.9)",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div style={{ color: "rgba(255,255,255,0.75)", fontWeight: 800 }}>Loading…</div>
        ) : err ? (
          <div style={{ color: "rgba(255,80,120,0.95)", fontWeight: 800 }}>{err}</div>
        ) : !hasItems ? (
          <div style={{ color: "rgba(255,255,255,0.65)", fontWeight: 700 }}>
            No scans yet. Go run a Website or File scan.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((x) => {
              const type = (x.type || "").toLowerCase();
              const preview = x.inputPreview || "(no input)";
              const status = x.status || "unknown";

              return (
                <Link
                  key={x.id}
                  to={`/report/${x.id}`}
                  style={{
                    textDecoration: "none",
                    borderRadius: 18,
                    padding: 16,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.35)",
                    backdropFilter: "blur(12px)",
                    color: "white",
                    display: "grid",
                    gap: 10
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={pillStyle()}>{type.toUpperCase()}</span>
                    <span style={pillStyle()}>STATUS: {String(status).toUpperCase()}</span>
                    <span style={pillStyle()}>ID: {x.id}</span>
                    {x.createdAt ? <span style={pillStyle()}>{formatTime(x.createdAt)}</span> : null}
                  </div>

                  <div
                    style={{
                      color: "rgba(255,255,255,0.88)",
                      fontWeight: 900,
                      fontSize: 16
                    }}
                  >
                    {type === "website" ? "Target URL" : "File"}:{" "}
                    <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 800 }}>
                      {preview}
                    </span>
                  </div>

                  <div style={{ color: "rgba(255,255,255,0.60)", fontWeight: 700, fontSize: 13 }}>
                    Click to open report →
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
