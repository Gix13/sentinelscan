import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import GridScan from "../components/GridScan.jsx";

export default function AppLayout({ children }) {
  return (
    <div className="appShell" style={{ position: "relative", minHeight: "100vh" }}>
      {/* Background (Grid) */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none"
        }}
      >
        <GridScan />
      </div>

      {/* Color/contrast overlay (this is what Home page had) */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(900px 500px at 20% 15%, rgba(40, 120, 255, 0.20), transparent 60%)," +
            "radial-gradient(900px 500px at 80% 20%, rgba(160, 60, 255, 0.18), transparent 60%)," +
            "linear-gradient(180deg, rgba(6,10,22,0.55), rgba(0,0,0,0.70))"
        }}
      />

      {/* Foreground app */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <Navbar />
        <main className="appMain">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
