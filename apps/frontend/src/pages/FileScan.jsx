import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScan } from "../hooks/useScan";

const MAX_MB = 100;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

export default function FileScan() {
  const nav = useNavigate();
  const { scanFile, loading, error, setError } = useScan();

  const [file, setFile] = useState(null);

  const fileLabel = useMemo(() => {
    if (!file) return "No file selected";
    return `${file.name} • ${formatBytes(file.size)}`;
  }, [file]);

  const canSubmit = useMemo(() => !!file && !loading, [file, loading]);

  function onPick(e) {
    setError("");
    const f = e.target.files?.[0] || null;
    if (!f) return;

    if (f.size > MAX_BYTES) {
      setError(`Max file size is ${MAX_MB}MB. Your file is ${formatBytes(f.size)}.`);
      e.target.value = "";
      setFile(null);
      return;
    }

    setFile(f);
  }

  function onDrop(e) {
    e.preventDefault();
    setError("");
    const f = e.dataTransfer.files?.[0] || null;
    if (!f) return;

    if (f.size > MAX_BYTES) {
      setError(`Max file size is ${MAX_MB}MB. Your file is ${formatBytes(f.size)}.`);
      setFile(null);
      return;
    }

    setFile(f);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("Select a file first.");
      return;
    }

    const res = await scanFile(file);
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
          File Scan
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
                Upload file (max {MAX_MB}MB)
              </label>

              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                style={{
                  borderRadius: 16,
                  padding: 16,
                  border: "1px dashed rgba(255,255,255,0.22)",
                  background: "rgba(10,10,14,0.55)",
                  color: "rgba(255,255,255,0.75)"
                }}
              >
                <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>
                  Drag & drop a file here
                </div>
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  Or choose a file below. ({fileLabel})
                </div>
              </div>

              <input
                type="file"
                onChange={onPick}
                style={{
                  height: 48,
                  borderRadius: 14,
                  padding: "10px 12px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  outline: "none",
                  background: "rgba(10,10,14,0.65)",
                  color: "white"
                }}
              />

              {error ? (
                <div style={{ color: "rgba(255,80,120,0.95)", fontWeight: 700 }}>{error}</div>
              ) : (
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
                  Tip: executables/scripts usually require deeper analysis.
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
                {loading ? "Scanning..." : "Scan File"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
