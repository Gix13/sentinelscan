import PillNav from "../components/PillNav.jsx";
import logo from "../assets/logo-sentinel.svg";

export default function Navbar() {
  return (
    <PillNav
      logo={logo}
      logoAlt="SentinelScan"
      items={[
        { label: "Home", href: "/home" },
        { label: "Website", href: "/scan/website" },
        { label: "File", href: "/scan/file" },
        { label: "History", href: "/history" },
      ]}
      className="custom-nav"
      ease="power2.easeOut"

      /* Purple theme */
      baseColor="#6d28d9"                 /* purple base */
      pillColor="rgba(255,255,255,0.10)"  /* glass pills */
      pillTextColor="rgba(255,255,255,0.92)"
      hoveredPillTextColor="#0b0f14"

      initialLoadAnimation={false}
    />
  );
}
