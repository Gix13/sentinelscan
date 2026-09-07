import express from "express";
import multer from "multer";
import { validateHttpUrl } from "../utils/validateUrl.js";
import { validateFile } from "../utils/fileValidation.js";
import { sha256File } from "../utils/hash.js";
import { createReport, updateReport, getReport } from "../store/dbStore.js";
import { saveUploadedFile } from "../store/fileStore.js";
import { scanFile } from "../utils/malwareScanner.js";
import { scanWebsite } from "../utils/nmapScanner.js";
import { classifyURL } from "../utils/phishingClassifier.js";
import { classifyNetwork } from "../utils/networkClassifier.js";
import { detectVulns } from "../utils/metasploitDetector.js";

const router = express.Router();

const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 100);
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;

const upload = multer({
  dest: "tmp_uploads/",
  limits: { fileSize: MAX_BYTES }
});

// Risk levels for well-known ports
const PORT_RISK = {
  21:    { severity: "high",     label: "FTP",        reason: "Unencrypted file transfer protocol - credentials sent in plaintext." },
  22:    { severity: "medium",   label: "SSH",        reason: "Remote access service - ensure key-based auth and restrict to trusted IPs." },
  23:    { severity: "critical", label: "Telnet",     reason: "Unencrypted remote access - transmits credentials and data in plaintext." },
  25:    { severity: "medium",   label: "SMTP",       reason: "Mail server - verify that open relaying is disabled." },
  53:    { severity: "low",      label: "DNS",        reason: "Domain name resolution service." },
  80:    { severity: "info",     label: "HTTP",       reason: "Standard web traffic." },
  110:   { severity: "medium",   label: "POP3",       reason: "Unencrypted mail retrieval." },
  135:   { severity: "critical", label: "RPC",        reason: "Windows RPC endpoint mapper - frequent attack target." },
  139:   { severity: "critical", label: "NetBIOS",   reason: "Windows file sharing - frequent attack target." },
  143:   { severity: "medium",   label: "IMAP",       reason: "Unencrypted mail access." },
  443:   { severity: "info",     label: "HTTPS",      reason: "Standard encrypted web traffic." },
  445:   { severity: "critical", label: "SMB",        reason: "Windows file sharing - targeted by EternalBlue and ransomware." },
  1433:  { severity: "high",     label: "MSSQL",      reason: "Microsoft SQL Server database exposed to the internet." },
  3306:  { severity: "high",     label: "MySQL",      reason: "MySQL database exposed to the internet." },
  3389:  { severity: "critical", label: "RDP",        reason: "Remote Desktop Protocol - high-value target for brute-force and exploitation." },
  5432:  { severity: "high",     label: "PostgreSQL", reason: "PostgreSQL database exposed to the internet." },
  6379:  { severity: "high",     label: "Redis",      reason: "Redis cache often runs without authentication when exposed." },
  8080:  { severity: "low",      label: "HTTP-alt",   reason: "Alternative HTTP port." },
  8443:  { severity: "low",      label: "HTTPS-alt",  reason: "Alternative HTTPS port." },
  11211: { severity: "high",     label: "Memcached",  reason: "Memcached cache often runs without authentication when exposed." },
  27017: { severity: "high",     label: "MongoDB",    reason: "MongoDB database exposed to the internet." },
};

function portFindings(ports) {
  const findings = [];

  for (const p of ports) {
    const risk = PORT_RISK[p.port];
    const severity = risk?.severity ?? "low";
    const label = risk?.label ?? p.service ?? "Unknown service";
    const reason = risk?.reason ?? "Uncommon open port - review whether this service needs to be publicly accessible.";

    const versionStr = [p.product, p.version].filter(Boolean).join(" ");
    const detail = versionStr
      ? `${reason} Detected: ${versionStr}.`
      : reason;

    findings.push({
      severity,
      title: `Open port ${p.port}/${p.protocol} - ${label}`,
      detail,
    });
  }

  return findings;
}

router.post("/website", async (req, res, next) => {
  try {
    const { url } = req.body || {};
    const v = validateHttpUrl(url);

    if (!v.ok) {
      return res.status(400).json({
        ok: false,
        error: { code: "BAD_URL", message: v.error }
      });
    }

    // Create report immediately so frontend can show progress
    const report = await createReport({
      type: "website",
      input: { url: v.url }
    });

    await updateReport(report.id, { status: "running" });

    // Return immediately - frontend will poll GET /api/report/:id
    res.json({
      ok: true,
      data: { reportId: report.id, status: "running" }
    });

    // Run Nmap scan in the background (after response is sent)
    runWebsiteScan(report.id, v.url);
  } catch (err) {
    return next(err);
  }
});

// Background scan - runs after HTTP response is already sent
async function runWebsiteScan(reportId, url) {
  // Safety timeout: if scan hasn't finished in 5 minutes, mark as failed
  const timeout = setTimeout(async () => {
    try {
      const report = await getReport(reportId);
      if (report && report.status === "running") {
        await updateReport(reportId, {
          status: "failed",
          summary: "Scan timed out after 5 minutes.",
          findings: [{ severity: "high", title: "Timeout", detail: "The scan did not complete within the allowed time." }]
        });
      }
    } catch {}
  }, 5 * 60 * 1000);

  try {
    await _runWebsiteScan(reportId, url);
  } catch (err) {
    try {
      await updateReport(reportId, {
        status: "failed",
        summary: `Scan failed: ${err.message}`,
        findings: [{ severity: "high", title: "Unexpected error", detail: err.message }]
      });
    } catch {}
  } finally {
    clearTimeout(timeout);
  }
}

async function _runWebsiteScan(reportId, url) {
  let nmapResult;
  try {
    nmapResult = await scanWebsite(url);
  } catch (err) {
    await updateReport(reportId, {
      status: "failed",
      summary: `Scan failed: ${err.message}`,
      findings: [
        { severity: "info", title: "URL validated", detail: "URL format and protocol checks passed." },
        { severity: "high", title: "Scan error", detail: err.message }
      ]
    });
    return;
  }

  const findings = [
    { severity: "info", title: "URL validated", detail: "URL format and protocol checks passed." }
  ];

  if (!nmapResult.available) {
    findings.push({
      severity: "info",
      title: "Nmap unavailable",
      detail: nmapResult.reason
    });

    await updateReport(reportId, {
      status: "done",
      summary: "URL validated. Nmap scanning not available on this server.",
      findings,
      "meta.scan": { nmap: nmapResult }
    });
    return;
  }

  // Add summary finding
  findings.push({
    severity: "info",
    title: "Nmap scan summary",
    detail: nmapResult.summary + (nmapResult.os ? ` OS: ${nmapResult.os}.` : "") + (nmapResult.scanTime ? ` Scan took ${nmapResult.scanTime}s.` : "")
  });

  // Add per-port findings
  const portFinds = portFindings(nmapResult.ports);
  findings.push(...portFinds);

  // Determine overall summary
  const criticalCount = portFinds.filter((f) => f.severity === "critical").length;
  const highCount = portFinds.filter((f) => f.severity === "high").length;
  let summary = nmapResult.summary;
  if (criticalCount > 0 || highCount > 0) {
    summary += ` - ${criticalCount} critical, ${highCount} high risk port${highCount !== 1 ? "s" : ""} found.`;
  } else if (nmapResult.openPortCount > 0) {
    summary += " - No high-risk ports detected.";
  } else {
    summary += " - No open ports detected.";
  }

  // Run both ML classifiers in parallel (real-data models)
  //   1. Phishing URL classifier (PhiUSIIL-trained)
  //   2. Network attack classifier (NSL-KDD-trained)
  const [phishingResult, networkResult] = await Promise.all([
    classifyURL(url).catch(() => null),
    classifyNetwork(nmapResult).catch(() => null),
  ]);

  if (phishingResult?.available) {
    const isPhish = phishingResult.isPhishing;
    findings.push({
      severity: isPhish ? "critical" : "info",
      title: `Phishing Detection - ${phishingResult.label}`,
      detail: `${phishingResult.model} classified this URL as ${phishingResult.label} with ${(phishingResult.confidence * 100).toFixed(1)}% confidence. Model accuracy on PhiUSIIL test set: ${(phishingResult.modelAccuracy * 100).toFixed(1)}%.`,
    });
    if (isPhish) {
      summary += ` Phishing classifier flagged this URL (${(phishingResult.confidence * 100).toFixed(0)}% confidence).`;
    }
  }

  if (networkResult?.available) {
    const cls = networkResult.attackClass;
    const sev = cls === "Normal" ? "info" : (cls === "DoS" || cls === "U2R") ? "high" : "medium";
    findings.push({
      severity: sev,
      title: `Network Attack Classification - ${cls}`,
      detail: `${networkResult.model} classified this host's network profile as ${cls} with ${(networkResult.confidence * 100).toFixed(1)}% confidence. Model trained on NSL-KDD (test accuracy: ${(networkResult.modelAccuracy * 100).toFixed(1)}%).`,
    });
    if (cls !== "Normal") {
      summary += ` Network classifier classified host as ${cls} (${(networkResult.confidence * 100).toFixed(0)}% confidence).`;
    }
  }

  // Run Metasploit detection-only modules (auxiliary scanners + check actions)
  let metasploitResult = null;
  try {
    metasploitResult = await detectVulns(nmapResult);
  } catch {
    // Metasploit failure should not break the scan
  }

  if (metasploitResult?.available) {
    findings.push({
      severity: metasploitResult.vulnerabilitiesFound > 0 ? "high" : "info",
      title: "Metasploit detection summary",
      detail: metasploitResult.summary
    });

    for (const m of metasploitResult.modules) {
      if (m.vulnerable && (m.severity === "critical" || m.severity === "high")) {
        findings.push({
          severity: m.severity,
          title: `Metasploit - ${m.name.split("/").pop()}`,
          detail: `${m.finding} (Port ${m.port}/tcp)`
        });
      }
    }

    if (metasploitResult.vulnerabilitiesFound > 0) {
      summary += ` Metasploit confirmed ${metasploitResult.vulnerabilitiesFound} known vulnerabilit${metasploitResult.vulnerabilitiesFound === 1 ? "y" : "ies"}.`;
    }
  }

  await updateReport(reportId, {
    status: "done",
    summary,
    findings,
    "meta.scan": { nmap: nmapResult, phishing: phishingResult, network: networkResult, metasploit: metasploitResult }
  });
}

function buildFileRiskAssessment(scanResult) {
  const clamInfected = scanResult.clamscan?.available && scanResult.clamscan.infected;
  const vtPositives = scanResult.virusTotal?.available && scanResult.virusTotal.found && scanResult.virusTotal.positives > 0;
  const vtCount = scanResult.virusTotal?.positives || 0;
  const vtTotal = scanResult.virusTotal?.total || 0;

  if (clamInfected || vtCount >= 5) {
    return {
      riskLevel: "Dangerous",
      confidence: clamInfected && vtPositives ? 0.99 : 0.90,
      detail: clamInfected
        ? `ClamAV detected malware.${vtPositives ? ` VirusTotal: ${vtCount}/${vtTotal} engines flagged.` : ""}`
        : `VirusTotal: ${vtCount}/${vtTotal} engines flagged this file.`,
    };
  }

  if (vtCount > 0 && vtCount < 5) {
    return {
      riskLevel: "Suspicious",
      confidence: 0.70,
      detail: `VirusTotal: ${vtCount}/${vtTotal} engines flagged - low detection count, possibly a false positive or emerging threat.`,
    };
  }

  return {
    riskLevel: "Safe",
    confidence: scanResult.clamscan?.available ? 0.95 : 0.60,
    detail: scanResult.clamscan?.available
      ? "ClamAV reports clean." + (scanResult.virusTotal?.available ? " No VirusTotal detections." : "")
      : "Limited scan coverage - ClamAV not available.",
  };
}

router.post("/file", upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    const v = validateFile({ file, maxBytes: MAX_BYTES });

    if (!v.ok) {
      if (file?.path) {
        const fs = await import("fs");
        fs.default.rmSync(file.path, { force: true });
      }
      return res.status(400).json({
        ok: false,
        error: { code: "BAD_FILE", message: v.error }
      });
    }

    // Create initial report
    const report = await createReport({
      type: "file",
      input: {
        originalName: file.originalname,
        size: file.size,
        mimeType: v.mimeType
      }
    });

    // Calculate hash and save file
    const hash = await sha256File(file.path);
    const savedFile = saveUploadedFile(file.path, report.id, file.originalname);

    if (!savedFile.success) {
      throw new Error(`Failed to save file: ${savedFile.error}`);
    }

    // Run malware scans (ClamAV and optional VirusTotal lookup)
    const scanResult = await scanFile(savedFile.storagePath, { sha256: hash, reportId: report.id });

    // Build findings from scan result
    const scanFindings = [];
    if (scanResult.clamscan?.available) {
      if (scanResult.clamscan.infected) {
        scanFindings.push({ severity: "critical", title: "ClamAV", detail: scanResult.clamscan.output || scanResult.clamscan.error });
      } else {
        scanFindings.push({ severity: "info", title: "ClamAV", detail: "No detection reported by ClamAV." });
      }
    }

    if (scanResult.virusTotal?.available) {
      if (scanResult.virusTotal.found) {
        scanFindings.push({ severity: "critical", title: "VirusTotal", detail: `${scanResult.virusTotal.positives}/${scanResult.virusTotal.total} engines flagged` });
      } else {
        scanFindings.push({ severity: "info", title: "VirusTotal", detail: "No known detections in VirusTotal." });
      }
    }

    // Build file risk assessment
    const fileRisk = buildFileRiskAssessment(scanResult);

    // Add risk finding
    if (fileRisk) {
      scanFindings.push({
        severity: fileRisk.riskLevel === "Dangerous" ? "critical"
          : fileRisk.riskLevel === "Suspicious" ? "medium"
          : "info",
        title: `File Risk Assessment - ${fileRisk.riskLevel}`,
        detail: fileRisk.detail
      });
    }

    // Persist scan metadata into report
    const metaUpdate = { "meta.scan": { ...scanResult, fileRisk } };

    // If infected by any provider, mark critical and quarantine info
    if (scanResult.verdict === "infected") {
      const findings = [
        { severity: "critical", title: "Malware detected", detail: "One or more malware scanners flagged this file." },
        ...scanFindings
      ];

      await updateReport(report.id, {
        status: "done",
        summary: "Malware detected in uploaded file.",
        findings,
        ...metaUpdate
      });

      return res.status(200).json({ ok: true, data: { reportId: report.id, status: "done", malware: true, scan: scanResult } });
    }

    // Update report with completion data and include scan metadata
    await updateReport(report.id, {
      status: "done",
      summary: fileRisk?.riskLevel === "Safe" ? "File scanned - no threats detected." : "Baseline file checks completed.",
      "input.sha256": hash,
      "input.filePath": savedFile.storagePath,
      "meta.sha256": hash,
      ...metaUpdate,
      findings: [
        { severity: "info", title: "File accepted", detail: "Size and type validation passed." },
        { severity: "info", title: "SHA-256", detail: hash },
        ...scanFindings
      ]
    });

    return res.json({
      ok: true,
      data: {
        reportId: report.id,
        status: "done",
        sha256: hash,
        scan: scanResult
      }
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
