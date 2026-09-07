import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layout/AppLayout.jsx";

import Landing from "./pages/Landing.jsx";
import Home from "./pages/Home.jsx";
import WebsiteScan from "./pages/WebsiteScan.jsx";
import FileScan from "./pages/FileScan.jsx";
import Report from "./pages/Report.jsx";
import History from "./pages/History.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <Routes>
      {/* Landing also uses layout so it gets GridScan */}
      <Route
        path="/"
        element={
          <AppLayout>
            <Landing />
          </AppLayout>
        }
      />

      {/* Everything else */}
      <Route
        path="/*"
        element={
          <AppLayout>
            <Routes>
              <Route path="home" element={<Home />} />
              <Route path="scan/website" element={<WebsiteScan />} />
              <Route path="scan/file" element={<FileScan />} />
              <Route path="report/:id" element={<Report />} />
              <Route path="history" element={<History />} />
              <Route path="scan" element={<Navigate to="/home" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        }
      />
    </Routes>
  );
}
