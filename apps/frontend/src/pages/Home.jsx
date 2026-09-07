import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import GridScan from "../components/GridScan.jsx";
import "../styles/homepage.css";

function formatTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}

export default function HomePage() {
  const [stats, setStats] = useState({ total: 0, clean: 0, threats: 0, recent: [] });

  useEffect(() => {
    api.getHistory(50).then((data) => {
      const items = data.items || data || [];
      const total = items.length;
      const threats = items.filter((r) => r.status === "done" && r.findings?.some?.((f) => ["critical", "high"].includes(f.severity))).length;
      setStats({ total, clean: total - threats, threats, recent: items.slice(0, 3) });
    }).catch(() => {});
  }, []);

  return (
    <div className="homePage">
      {/* Fullscreen background */}
      <div className="homeGridBg">
        <GridScan
          sensitivity={0.55}
          lineThickness={1}
          linesColor="#5f4196"
          gridScale={0.12}
          scanColor="#c70509"
          scanOpacity={0.45}
          enablePost
          bloomIntensity={0.7}
          chromaticAberration={0.002}
          noiseIntensity={0.01}
          scanGlow={0.6}
          scanSoftness={2}
        />
      </div>

      {/* readability layers */}
      <div className="homeGridOverlay" />
      <div className="homeGridVignette" />

      {/* content */}
      <div className="homeWrap">
        <div className="homeCard">
          <div className="homeBadge">
            <span className="badgeDot" />
            Simple security scanning
          </div>

          <h1 className="homeTitle">
            Sentinel<span className="accent">Scan</span>
          </h1>

          <p className="homeSubtitle">
            Scan websites and files, detect risks fast, and generate report-ready results.
          </p>

          <div className="homeActions">
            <Link className="homeBtn homeBtnPrimary" to="/scan/website">
              Scan a Website
            </Link>
            <Link className="homeBtn homeBtnGhost" to="/scan/file">
              Scan a File
            </Link>
            <Link className="homeBtn homeBtnLink" to="/history">
              View History →
            </Link>
          </div>

          {/* Dashboard stats */}
          {stats.total > 0 ? (
            <div className="homeMeta">
              <div className="metaItem">
                <div className="metaTop">{stats.total}</div>
                <div className="metaBottom">Total Scans</div>
              </div>
              <div className="metaDivider" />
              <div className="metaItem">
                <div className="metaTop" style={{ color: "rgba(34,197,94,0.9)" }}>{stats.clean}</div>
                <div className="metaBottom">Clean</div>
              </div>
              <div className="metaDivider" />
              <div className="metaItem">
                <div className="metaTop" style={{ color: stats.threats > 0 ? "rgba(239,68,68,0.9)" : undefined }}>{stats.threats}</div>
                <div className="metaBottom">Threats Found</div>
              </div>
            </div>
          ) : (
            <div className="homeMeta">
              <div className="metaItem">
                <div className="metaTop">Fast</div>
                <div className="metaBottom">Quick checks & signals</div>
              </div>
              <div className="metaDivider" />
              <div className="metaItem">
                <div className="metaTop">Clear</div>
                <div className="metaBottom">Severity-based findings</div>
              </div>
              <div className="metaDivider" />
              <div className="metaItem">
                <div className="metaTop">Exportable</div>
                <div className="metaBottom">Report-ready summaries</div>
              </div>
            </div>
          )}

          {/* Recent scans */}
          {stats.recent.length > 0 ? (
            <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: 1 }}>
                RECENT SCANS
              </div>
              {stats.recent.map((r) => (
                <Link
                  key={r.id}
                  to={`/report/${r.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    textDecoration: "none",
                    color: "rgba(255,255,255,0.75)",
                    fontSize: 13,
                    fontWeight: 700,
                    transition: "background 0.15s"
                  }}
                >
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: r.type === "website" ? "rgba(124,58,237,0.15)" : "rgba(59,130,246,0.15)",
                    color: r.type === "website" ? "rgba(167,139,250,0.9)" : "rgba(147,197,253,0.9)",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase"
                  }}>
                    {r.type}
                  </span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.inputPreview || r.id}
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                    {formatTime(r.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
