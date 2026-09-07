import { useNavigate } from "react-router-dom";
import "../styles/landing.css";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <div className="landingBg">
        <div className="landingGlow" />
        <div className="landingVignette" />
      </div>

      <header className="landingTop">
        <div className="landingTopBrand">SentinelScan</div>
        <button className="landingTopBtn" onClick={() => navigate("/home")}>
          Enter
        </button>
      </header>

      <main className="landingHero">
        <div className="landingContent">
          <div className="landingKicker">SECURITY PLATFORM</div>

          <h1 className="landingTitle">
            Scan faster.
            <br />
            Understand risks.
          </h1>

          <p className="landingSubtitle">
            Website scanning, file scanning, and report-ready findings, built for clarity, speed, and clean results.
          </p>

          <div className="landingActions">
            <button className="landingCta" onClick={() => navigate("/home")}>
              Get started
            </button>
          </div>

          <div className="landingFine">
            No account. No clutter. Just scans and clean reports.
          </div>
        </div>
      </main>
    </div>
  );
}
