import express from "express";
import { listQuarantine, getQuarantineFilePath, restoreQuarantinedFile, deleteQuarantinedFile } from "../store/fileStore.js";
import { updateReport } from "../store/dbStore.js";
import path from "path";

const router = express.Router();

// Simple token-based admin auth
router.use((req, res, next) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(403).json({ ok: false, error: { code: "NO_ADMIN_TOKEN", message: "Admin token not configured" } });
  const provided = req.headers["x-admin-token"];
  if (!provided || provided !== token) return res.status(401).json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid admin token" } });
  next();
});

// List quarantined files. Optional ?reportId= to filter
router.get("/quarantine", (req, res) => {
  const { reportId } = req.query;
  const items = listQuarantine(reportId);
  return res.json({ ok: true, data: items });
});

// Download a quarantined file
router.get("/quarantine/:reportId/:filename", (req, res) => {
  const { reportId, filename } = req.params;
  const p = getQuarantineFilePath(reportId, filename);
  if (!p) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND" } });
  return res.download(p, filename);
});

// Restore a quarantined file back to the report directory
router.post("/quarantine/:reportId/:filename/restore", async (req, res) => {
  const { reportId, filename } = req.params;
  const { destReportId } = req.body || {};
  const r = restoreQuarantinedFile(reportId, filename, destReportId);
  if (!r.success) return res.status(400).json({ ok: false, error: { code: "RESTORE_FAILED", message: r.error } });

  // Update report metadata to reflect restoration
  try {
    await updateReport(destReportId || reportId, {
      status: "done",
      summary: "File restored from quarantine by admin.",
      findings: [{ severity: "warning", title: "Quarantine restored", detail: filename }]
    });
  } catch (err) {
    // non-fatal
  }

  return res.json({ ok: true, data: r });
});

// Permanently delete a quarantined file
router.delete("/quarantine/:reportId/:filename", (req, res) => {
  const { reportId, filename } = req.params;
  const r = deleteQuarantinedFile(reportId, filename);
  if (!r.success) return res.status(400).json({ ok: false, error: { code: "DELETE_FAILED", message: r.error } });
  return res.json({ ok: true });
});

export default router;
