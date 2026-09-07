import { prisma } from "../config/db.js";
import { nanoid } from "nanoid";

/**
 * Create a new report in the database
 */
export async function createReport({ type, input, userId = "anonymous" }) {
  const id = nanoid(10);

  const report = await prisma.report.create({
    data: {
      id,
      type,
      status: "queued",
      userId,
      inputOriginalName: input?.originalName,
      inputSize: input?.size,
      inputMimeType: input?.mimeType,
      inputUrl: input?.url,
      summary: null,
      engine: "sentinelscan-v1"
    }
  });

  return formatReport(report);
}

/**
 * Update an existing report
 */
export async function updateReport(reportId, updates) {
  // Prepare data object
  const data = {};

  // Map input fields from dot notation
  if (updates["input.originalName"]) data.inputOriginalName = updates["input.originalName"];
  if (updates["input.sha256"]) data.inputSha256 = updates["input.sha256"];
  if (updates["input.filePath"]) data.inputFilePath = updates["input.filePath"];

  // Map meta fields
  if (updates["meta.sha256"]) data.sha256 = updates["meta.sha256"];
  if (updates["meta.scan"]) data.scanData = JSON.stringify(updates["meta.scan"]);

  // Direct fields
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.summary !== undefined) data.summary = updates.summary;

  // Handle findings - delete old and create new
  if (updates.findings) {
    await prisma.finding.deleteMany({ where: { reportId } });
    data.findings = {
      create: updates.findings.map((f) => ({
        severity: f.severity,
        title: f.title,
        detail: f.detail
      }))
    };
  }

  const report = await prisma.report.update({
    where: { id: reportId },
    data,
    include: { findings: true }
  });

  if (!report) {
    throw new Error(`Report ${reportId} not found`);
  }

  return formatReport(report);
}

/**
 * Get a single report by ID
 */
export async function getReport(reportId) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { findings: true }
  });

  return report ? formatReport(report) : null;
}

/**
 * Get report history with pagination
 */
export async function getHistory(limit = 50, userId = "anonymous") {
  const reports = await prisma.report.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { findings: true }
  });

  return reports.map((doc) => {
    const formatted = formatReport(doc);
    // Create inputPreview for UI
    formatted.inputPreview =
      formatted.type === "file" ? doc.inputOriginalName : doc.inputUrl;
    return formatted;
  });
}

/**
 * Search reports
 */
export async function searchReports(query = {}, limit = 50) {
  const reports = await prisma.report.findMany({
    where: query,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { findings: true }
  });

  return reports.map((r) => formatReport(r));
}

/**
 * Get stats for dashboard
 */
export async function getStats(userId = "anonymous") {
  const [total, completed, failed] = await Promise.all([
    prisma.report.count({ where: { userId } }),
    prisma.report.count({ where: { userId, status: "done" } }),
    prisma.report.count({ where: { userId, status: "failed" } })
  ]);

  return {
    total,
    completed,
    failed,
    pending: total - completed - failed
  };
}

/**
 * Delete old reports (cleanup)
 */
export async function deleteOldReports(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await prisma.report.deleteMany({
    where: { createdAt: { lt: cutoffDate } }
  });

  return result.count;
}

/**
 * Helper: Format report for API response
 */
function formatReport(dbReport) {
  return {
    id: dbReport.id,
    type: dbReport.type,
    status: dbReport.status,
    input: {
      originalName: dbReport.inputOriginalName,
      size: dbReport.inputSize,
      mimeType: dbReport.inputMimeType,
      url: dbReport.inputUrl,
      sha256: dbReport.inputSha256,
      filePath: dbReport.inputFilePath
    },
    summary: dbReport.summary,
    findings: (dbReport.findings || []).map((f) => ({
      severity: f.severity,
      title: f.title,
      detail: f.detail
    })),
    meta: {
      engine: dbReport.engine,
      sha256: dbReport.sha256,
      scan: dbReport.scanData ? JSON.parse(dbReport.scanData) : null,
      finishedAt: dbReport.finishedAt,
      processingTime: dbReport.processingTime
    },
    error: dbReport.errorCode
      ? {
          code: dbReport.errorCode,
          message: dbReport.errorMessage
        }
      : null,
    userId: dbReport.userId,
    createdAt: dbReport.createdAt.toISOString(),
    updatedAt: dbReport.updatedAt.toISOString()
  };
}
