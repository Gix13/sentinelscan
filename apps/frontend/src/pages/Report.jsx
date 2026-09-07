import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

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

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

export default function Report() {
  const { id } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const status = report?.status || "";
  const isActive = status === "queued" || status === "running";

  const title = useMemo(() => {
    if (!report) return "Report";
    const t = (report.type || "").toLowerCase();
    return t === "file" ? "File Report" : "Website Report";
  }, [report]);

  async function load() {
    setErr("");
    try {
      const r = await api.getReport(id);
      setReport(r);
      setLoading(false);
      return r;
    } catch (e) {
      setErr(e?.message || "Failed to load report.");
      setLoading(false);
      return null;
    }
  }

  useEffect(() => {
    let alive = true;
    let timer = null;

    (async () => {
      setLoading(true);
      const r = await load();
      if (!alive) return;

      if (r && (r.status === "queued" || r.status === "running")) {
        timer = setInterval(async () => {
          const next = await api.getReport(id);
          if (!alive) return;
          setReport(next);
          if (next.status !== "queued" && next.status !== "running") {
            clearInterval(timer);
          }
        }, 700);
      }
    })();

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
          <h1 style={{ color: "white", fontSize: 44, fontWeight: 900, margin: 0 }}>{title}</h1>

          {report?.status ? (
            <span style={pillStyle()}>STATUS: {String(report.status).toUpperCase()}</span>
          ) : null}

          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Link
              to="/history"
              style={{
                textDecoration: "none",
                height: 42,
                display: "inline-flex",
                alignItems: "center",
                padding: "0 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.35)",
                color: "rgba(255,255,255,0.9)",
                fontWeight: 900
              }}
            >
              History
            </Link>

            <button
              onClick={load}
              disabled={loading}
              style={{
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
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ color: "rgba(255,255,255,0.75)", fontWeight: 800 }}>Loading…</div>
        ) : isActive ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{
              borderRadius: 22,
              padding: "32px 18px",
              border: "1px solid rgba(124,58,237,0.2)",
              background: "rgba(124,58,237,0.06)",
              backdropFilter: "blur(12px)",
              textAlign: "center"
            }}>
              <div style={{
                width: 48, height: 48, margin: "0 auto 16px",
                borderRadius: "50%",
                border: "3px solid rgba(124,58,237,0.3)",
                borderTopColor: "rgba(124,58,237,0.9)",
                animation: "spin 1s linear infinite"
              }} />
              <div style={{ color: "white", fontSize: 18, fontWeight: 900, marginBottom: 6 }}>
                {report.type === "website" ? "Scanning website with Nmap..." : "Analyzing file..."}
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>
                {report.type === "website"
                  ? "Port scanning and service detection in progress. This typically takes 60-90 seconds."
                  : "Running malware analysis. This should complete shortly."}
              </div>
              <div style={{ marginTop: 14, color: "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 600 }}>
                Target: {report.input?.url || report.input?.originalName || "Not available"}
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        ) : err ? (
          <div style={{ color: "rgba(255,80,120,0.95)", fontWeight: 800 }}>{err}</div>
        ) : !report ? (
          <div style={{ color: "rgba(255,255,255,0.65)", fontWeight: 700 }}>
            Report not found.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {/* Security banner */}
            {report.findings && report.findings.some((f) => String(f.severity || "").toLowerCase() === "critical") ? (
              <div style={{ borderRadius: 12, padding: 14, background: "rgba(200,20,20,0.12)", border: "1px solid rgba(200,20,20,0.25)", color: "#ffdede", fontWeight: 900 }}>
                WARNING: This file was flagged by malware scanners. Do not download or open this file. Contact support if you believe this is a false positive.
              </div>
            ) : report.findings && report.findings.some((f) => ["medium","high"].includes(String(f.severity || "").toLowerCase())) ? (
              <div style={{ borderRadius: 12, padding: 14, background: "rgba(220,150,20,0.08)", border: "1px solid rgba(220,150,20,0.18)", color: "#fff7e6", fontWeight: 900 }}>
                Notice: Suspicious indicators were found. Exercise caution before opening the file.
              </div>
            ) : (
              <div style={{ borderRadius: 12, padding: 12, background: "rgba(20,150,40,0.06)", border: "1px solid rgba(20,150,40,0.12)", color: "#eaffef", fontWeight: 800 }}>
                No critical detections reported.
              </div>
            )}
            {/* Meta card */}
            <div
              style={{
                borderRadius: 22,
                padding: 18,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.35)",
                backdropFilter: "blur(12px)"
              }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={pillStyle()}>ID: {report.id}</span>
                <span style={pillStyle()}>TYPE: {String(report.type).toUpperCase()}</span>
                {report.createdAt ? <span style={pillStyle()}>{formatTime(report.createdAt)}</span> : null}
                {report.meta?.engine ? <span style={pillStyle()}>ENGINE: {report.meta.engine}</span> : null}
              </div>

              <div style={{ marginTop: 14, color: "rgba(255,255,255,0.88)", fontWeight: 900 }}>
                Target
              </div>

              {/* Website target */}
              {String(report.type).toLowerCase() === "website" ? (
                <div style={{ marginTop: 6, color: "rgba(255,255,255,0.72)", fontWeight: 700 }}>
                  URL: <span style={{ fontWeight: 900 }}>{report?.input?.url || "(missing)"}</span>
                </div>
              ) : (
                /* File target */
                <div style={{ marginTop: 6, color: "rgba(255,255,255,0.72)", fontWeight: 700 }}>
                  File:{" "}
                  <span style={{ fontWeight: 900 }}>{report?.input?.originalName || "(missing)"}</span>
                  {typeof report?.input?.size === "number" ? (
                    <>
                      {" "}
                      • <span style={{ fontWeight: 900 }}>{formatBytes(report.input.size)}</span>
                    </>
                  ) : null}
                  {report?.input?.mimeType ? (
                    <>
                      {" "}
                      • <span style={{ fontWeight: 900 }}>{report.input.mimeType}</span>
                    </>
                  ) : null}
                </div>
              )}

              <div style={{ marginTop: 14, color: "rgba(255,255,255,0.88)", fontWeight: 900 }}>
                Summary
              </div>
              <div style={{ marginTop: 6, color: "rgba(255,255,255,0.72)" }}>
                {report.summary || (isActive ? "Scan in progress…" : "No summary provided.")}
              </div>
            </div>

            {/* Findings card */}
            <div
              style={{
                borderRadius: 22,
                padding: 18,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.35)",
                backdropFilter: "blur(12px)"
              }}
            >
              <div style={{ color: "rgba(255,255,255,0.88)", fontWeight: 900 }}>
                Findings
              </div>

              {report.findings && report.findings.length > 0 ? (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {report.findings.map((f, idx) => (
                    <div
                      key={idx}
                      style={{
                        borderRadius: 16,
                        padding: 12,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(10,10,14,0.55)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={pillStyle()}>{String(f.severity || "info").toUpperCase()}</span>
                        <div style={{ color: "white", fontWeight: 900 }}>{f.title}</div>
                      </div>
                      <div style={{ marginTop: 6, color: "rgba(255,255,255,0.70)", fontWeight: 600 }}>
                        {f.detail}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.60)", fontWeight: 700 }}>
                  {isActive ? "Waiting for results…" : "No findings."}
                </div>
              )}
            </div>
            {/* Scan provider details */}
            {report.meta?.scan ? (
              <div
                style={{
                  borderRadius: 22,
                  padding: 18,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.35)",
                  backdropFilter: "blur(12px)"
                }}
              >
                <div style={{ color: "rgba(255,255,255,0.88)", fontWeight: 900 }}>Scan details</div>
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)" }}>
                  {report.meta.scan.clamscan ? (
                    <div style={{ marginBottom: 8 }}>
                      <strong>ClamAV:</strong>{" "}
                      {report.meta.scan.clamscan.available
                        ? report.meta.scan.clamscan.infected
                          ? "Infected; see findings above"
                          : "No detection"
                        : "ClamAV not available"}
                    </div>
                  ) : null}

                  {report.meta.scan.virusTotal ? (
                    <div style={{ marginBottom: 8 }}>
                      <strong>VirusTotal:</strong>{" "}
                      {report.meta.scan.virusTotal.available
                        ? report.meta.scan.virusTotal.found
                          ? `${report.meta.scan.virusTotal.positives}/${report.meta.scan.virusTotal.total} engines flagged`
                          : "No known detections"
                        : "VirusTotal lookup not configured"}
                    </div>
                  ) : null}

                  {report.meta.scan.nmap ? (
                    <div>
                      <div style={{ marginBottom: 10 }}>
                        <strong>Nmap:</strong>{" "}
                        {report.meta.scan.nmap.available === false
                          ? report.meta.scan.nmap.reason || "Nmap not available"
                          : report.meta.scan.nmap.summary}
                      </div>

                      {report.meta.scan.nmap.available && report.meta.scan.nmap.ports?.length > 0 ? (
                        <div>
                          <div style={{ marginBottom: 6, color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
                            OPEN PORTS
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            {report.meta.scan.nmap.ports.map((p, i) => (
                              <div
                                key={i}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "80px 80px 1fr",
                                  gap: 10,
                                  padding: "8px 10px",
                                  borderRadius: 10,
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid rgba(255,255,255,0.07)",
                                  fontSize: 13,
                                  fontWeight: 700
                                }}
                              >
                                <span style={{ color: "rgba(180,140,255,0.9)" }}>{p.port}/{p.protocol}</span>
                                <span style={{ color: "rgba(255,255,255,0.8)" }}>{p.service}</span>
                                <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                                  {[p.product, p.version].filter(Boolean).join(" ") || "Not available"}
                                </span>
                              </div>
                            ))}
                          </div>

                          {report.meta.scan.nmap.ip ? (
                            <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                              Resolved IP: {report.meta.scan.nmap.ip}
                              {report.meta.scan.nmap.os ? ` · OS: ${report.meta.scan.nmap.os}` : ""}
                              {report.meta.scan.nmap.scanTime ? ` · Scan time: ${report.meta.scan.nmap.scanTime}s` : ""}
                            </div>
                          ) : null}
                        </div>
                      ) : report.meta.scan.nmap.available ? (
                        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>No open ports detected.</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Phishing Detection card */}
            {report.meta?.scan?.phishing?.available ? (() => {
              const ph = report.meta.scan.phishing;
              const isPhish = ph.isPhishing;
              const color = isPhish ? "rgba(239,68,68,0.9)" : "rgba(34,197,94,0.9)";
              const bg = isPhish ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.06)";
              return (
                <div style={{ borderRadius: 22, padding: 18, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)" }}>
                  <div style={{ color: "rgba(255,255,255,0.88)", fontWeight: 900 }}>Phishing Detection</div>
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", padding: "8px 16px", borderRadius: 12, background: bg, border: `1px solid ${color.replace("0.9","0.3")}`, color, fontSize: 16, fontWeight: 900, letterSpacing: 0.5 }}>
                      {ph.label}
                    </div>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 4 }}>
                        Confidence: {(ph.confidence * 100).toFixed(1)}%
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${ph.confidence * 100}%`, borderRadius: 4, background: color, transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  </div>
                  {ph.probabilities ? (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                        CLASS PROBABILITIES
                      </div>
                      <div style={{ display: "grid", gap: 4 }}>
                        {Object.entries(ph.probabilities).sort((a, b) => b[1] - a[1]).map(([cls, prob]) => (
                          <div key={cls} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 100, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{cls}</span>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                              <div style={{ height: "100%", width: `${prob * 100}%`, borderRadius: 3, background: cls === "Phishing" ? "rgba(239,68,68,0.7)" : "rgba(34,197,94,0.7)" }} />
                            </div>
                            <span style={{ width: 45, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textAlign: "right" }}>
                              {(prob * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                    Best of 5 models: {ph.model} · Trained on PhiUSIIL dataset · Test accuracy: {ph.modelAccuracy ? `${(ph.modelAccuracy * 100).toFixed(1)}%` : "N/A"}
                  </div>
                </div>
              );
            })() : null}

            {/* Network Attack Classification card */}
            {report.meta?.scan?.network?.available ? (() => {
              const nw = report.meta.scan.network;
              const cls = nw.attackClass;
              const color = cls === "Normal" ? "rgba(34,197,94,0.9)"
                : (cls === "DoS" || cls === "U2R") ? "rgba(239,68,68,0.9)"
                : "rgba(245,158,11,0.9)";
              const bg = cls === "Normal" ? "rgba(34,197,94,0.06)"
                : (cls === "DoS" || cls === "U2R") ? "rgba(239,68,68,0.12)"
                : "rgba(245,158,11,0.08)";
              const probColor = (c) =>
                c === "Normal" ? "rgba(34,197,94,0.7)"
                : (c === "DoS" || c === "U2R") ? "rgba(239,68,68,0.7)"
                : "rgba(245,158,11,0.7)";
              return (
                <div style={{ borderRadius: 22, padding: 18, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)" }}>
                  <div style={{ color: "rgba(255,255,255,0.88)", fontWeight: 900 }}>Network Attack Classification</div>
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", padding: "8px 16px", borderRadius: 12, background: bg, border: `1px solid ${color.replace("0.9","0.3")}`, color, fontSize: 16, fontWeight: 900, letterSpacing: 0.5 }}>
                      {cls}
                    </div>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 4 }}>
                        Confidence: {(nw.confidence * 100).toFixed(1)}%
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${nw.confidence * 100}%`, borderRadius: 4, background: color, transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  </div>
                  {nw.probabilities ? (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                        CLASS PROBABILITIES
                      </div>
                      <div style={{ display: "grid", gap: 4 }}>
                        {Object.entries(nw.probabilities).sort((a, b) => b[1] - a[1]).map(([c, prob]) => (
                          <div key={c} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 100, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{c}</span>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                              <div style={{ height: "100%", width: `${prob * 100}%`, borderRadius: 3, background: probColor(c) }} />
                            </div>
                            <span style={{ width: 45, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textAlign: "right" }}>
                              {(prob * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                    Best of 5 models: {nw.model} · Trained on NSL-KDD dataset · Test accuracy: {nw.modelAccuracy ? `${(nw.modelAccuracy * 100).toFixed(1)}%` : "N/A"}
                  </div>
                </div>
              );
            })() : null}

            {/* Metasploit Detection card */}
            {report.meta?.scan?.metasploit?.available ? (() => {
              const ms = report.meta.scan.metasploit;
              const hasVulns = ms.vulnerabilitiesFound > 0;
              const headerColor = hasVulns ? "rgba(239,68,68,0.9)" : "rgba(34,197,94,0.9)";
              const headerBg = hasVulns ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.06)";
              const sevColor = (sev) => {
                if (sev === "critical") return "rgba(239,68,68,0.9)";
                if (sev === "high") return "rgba(245,158,11,0.9)";
                if (sev === "medium") return "rgba(234,179,8,0.85)";
                if (sev === "low") return "rgba(96,165,250,0.85)";
                return "rgba(148,163,184,0.7)";
              };

              return (
                <div
                  style={{
                    borderRadius: 22,
                    padding: 18,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.35)",
                    backdropFilter: "blur(12px)"
                  }}
                >
                  <div style={{ color: "rgba(255,255,255,0.88)", fontWeight: 900 }}>
                    Metasploit Detection
                  </div>

                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "8px 16px",
                      borderRadius: 12,
                      background: headerBg,
                      border: `1px solid ${headerColor.replace("0.9", "0.3")}`,
                      color: headerColor,
                      fontSize: 14,
                      fontWeight: 900,
                      letterSpacing: 0.5
                    }}>
                      {hasVulns
                        ? `${ms.vulnerabilitiesFound} VULNERABILITY ${ms.vulnerabilitiesFound === 1 ? "FOUND" : "FOUND"}`
                        : "NO VULNERABILITIES"}
                    </div>
                    <div style={{ flex: 1, minWidth: 150, fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
                      Ran {ms.modulesRun} detection modules · {ms.scanTime}s
                    </div>
                  </div>

                  {ms.modules?.length > 0 ? (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                        MODULES EXECUTED
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {ms.modules.map((m, i) => (
                          <div
                            key={i}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "100px 50px 1fr",
                              gap: 10,
                              padding: "8px 10px",
                              borderRadius: 10,
                              background: "rgba(255,255,255,0.04)",
                              border: `1px solid ${m.vulnerable ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)"}`,
                              fontSize: 13,
                              fontWeight: 600
                            }}
                          >
                            <span style={{
                              color: sevColor(m.severity),
                              fontWeight: 800,
                              fontSize: 11,
                              alignSelf: "center",
                              letterSpacing: 0.5
                            }}>
                              {String(m.severity || "info").toUpperCase()}
                            </span>
                            <span style={{ color: "rgba(180,140,255,0.9)", alignSelf: "center" }}>
                              {m.port}/tcp
                            </span>
                            <div style={{ color: "rgba(255,255,255,0.75)" }}>
                              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "monospace", marginBottom: 2 }}>
                                {m.name}
                              </div>
                              <div>{m.finding}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                    Powered by Metasploit Framework · Detection-only (no exploitation)
                  </div>
                </div>
              );
            })() : null}

            {/* File Risk Assessment card */}
            {report.meta?.scan?.fileRisk ? (() => {
              const fr = report.meta.scan.fileRisk;
              const frColor = fr.riskLevel === "Dangerous"
                ? "rgba(239,68,68,0.9)"
                : fr.riskLevel === "Suspicious"
                  ? "rgba(245,158,11,0.9)"
                  : "rgba(34,197,94,0.9)";
              const frBg = fr.riskLevel === "Dangerous"
                ? "rgba(239,68,68,0.12)"
                : fr.riskLevel === "Suspicious"
                  ? "rgba(245,158,11,0.08)"
                  : "rgba(34,197,94,0.06)";

              return (
                <div
                  style={{
                    borderRadius: 22,
                    padding: 18,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.35)",
                    backdropFilter: "blur(12px)"
                  }}
                >
                  <div style={{ color: "rgba(255,255,255,0.88)", fontWeight: 900 }}>
                    File Risk Assessment
                  </div>
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "8px 16px",
                      borderRadius: 12,
                      background: frBg,
                      border: `1px solid ${frColor.replace("0.9", "0.3")}`,
                      color: frColor,
                      fontSize: 16,
                      fontWeight: 900,
                      letterSpacing: 0.5
                    }}>
                      {fr.riskLevel}
                    </div>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 4 }}>
                        Confidence: {(fr.confidence * 100).toFixed(1)}%
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${fr.confidence * 100}%`, borderRadius: 4, background: frColor }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
                    {fr.detail}
                  </div>
                </div>
              );
            })() : null}
          </div>
        )}
      </div>
    </div>
  );
}
