import { useState } from "react";
import { api } from "../api/client";

export function useScan() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function scanWebsite(url) {
    setError("");
    setLoading(true);
    try {
      return await api.scanWebsite(url); // { reportId, status }
    } catch (e) {
      setError(e?.message || "Website scan failed");
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function scanFile(file) {
    setError("");
    setLoading(true);
    try {
      return await api.scanFile(file); // { reportId, status }
    } catch (e) {
      setError(e?.message || "File scan failed");
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return { scanWebsite, scanFile, loading, error, setError };
}
