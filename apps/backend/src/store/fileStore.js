import fs from "fs";
import path from "path";

const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || "./uploads";

export function safePathSegment(value, fallback = "item") {
  const basename = path.basename(String(value || ""));
  const cleaned = basename.replace(/[^A-Za-z0-9._-]/g, "_");
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  return cleaned;
}

/**
 * Get organized upload directory path based on date and report ID
 * Structure: /uploads/YYYY/MM/DD/reportId/
 */
export function getReportUploadDir(reportId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return path.join(
    UPLOAD_BASE_DIR,
    year.toString(),
    month,
    day,
    safePathSegment(reportId, "unknown-report")
  );
}

/**
 * Initialize upload directory for a report
 */
export function initializeReportDir(reportId) {
  const uploadDir = getReportUploadDir(reportId);
  fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
}

/**
 * Save uploaded file to organized directory
 * Renames it from multer's temporary name to original filename
 */
export function saveUploadedFile(multerFilePath, reportId, originalFilename) {
  try {
    const uploadDir = initializeReportDir(reportId);
    const storedFilename = safePathSegment(originalFilename, "uploaded-file");
    const savedFilePath = path.join(uploadDir, storedFilename);

    // Copy file from temp location to final location
    fs.copyFileSync(multerFilePath, savedFilePath);

    // Clean up temp file
    if (fs.existsSync(multerFilePath)) {
      fs.rmSync(multerFilePath, { force: true });
    }

    return {
      success: true,
      storagePath: savedFilePath,
      relativePath: path.relative(UPLOAD_BASE_DIR, savedFilePath)
    };
  } catch (err) {
    console.error("Save file error:", err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Get file by report ID and filename
 */
export function getReportFile(reportId, filename) {
  const uploadDir = getReportUploadDir(reportId);
  const filePath = path.join(uploadDir, safePathSegment(filename, "invalid-file"));

  // Security check - ensure file is within the report directory
  if (!filePath.startsWith(uploadDir)) {
    return null;
  }

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  return null;
}

/**
 * Delete report directory and all files
 */
export function deleteReportFiles(reportId) {
  try {
    const uploadDir = getReportUploadDir(reportId);
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
      return true;
    }
    return false;
  } catch (err) {
    console.error("Delete files error:", err.message);
    return false;
  }
}

/**
 * Quarantine helpers
 */
export function getQuarantineBase() {
  return process.env.QUARANTINE_DIR || path.join(UPLOAD_BASE_DIR, "quarantine");
}

export function listQuarantine(reportId) {
  try {
    const base = getQuarantineBase();
    if (reportId) {
      const dir = path.join(base, reportId);
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).map((f) => ({ reportId, filename: f, path: path.join(dir, f) }));
    }

    if (!fs.existsSync(base)) return [];
    const reports = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    const out = [];
    for (const r of reports) {
      const dir = path.join(base, r);
      const files = fs.readdirSync(dir);
      for (const f of files) out.push({ reportId: r, filename: f, path: path.join(dir, f) });
    }
    return out;
  } catch (err) {
    return [];
  }
}

export function getQuarantineFilePath(reportId, filename) {
  const base = getQuarantineBase();
  const p = path.join(
    base,
    safePathSegment(reportId, "invalid-report"),
    safePathSegment(filename, "invalid-file")
  );
  if (fs.existsSync(p)) return p;
  return null;
}

export function restoreQuarantinedFile(reportId, filename, destReportId) {
  try {
    const src = getQuarantineFilePath(reportId, filename);
    if (!src) return { success: false, error: "not_found" };
    const targetReportId = destReportId || reportId;
    const destDir = initializeReportDir(targetReportId);
    const dest = path.join(destDir, safePathSegment(filename, "restored-file"));
    fs.renameSync(src, dest);
    return { success: true, path: dest };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function deleteQuarantinedFile(reportId, filename) {
  try {
    const p = getQuarantineFilePath(reportId, filename);
    if (!p) return { success: false, error: "not_found" };
    fs.rmSync(p, { force: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Initialize base upload directory
 */
export function initializeUploadDir() {
  try {
    fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
    // Ensure quarantine dir exists when used by malware scanner
    const quarantineDir = process.env.QUARANTINE_DIR || path.join(UPLOAD_BASE_DIR, "quarantine");
    try {
      fs.mkdirSync(quarantineDir, { recursive: true });
    } catch (err) {
      // ignore - we'll log below
    }

    console.log(`✓ Upload directory ready: ${UPLOAD_BASE_DIR}`);
    console.log(`✓ Quarantine directory ready: ${quarantineDir}`);
    return true;
  } catch (err) {
    console.error("Failed to initialize upload directory:", err.message);
    return false;
  }
}
