import { nanoid } from "nanoid";

const reports = new Map(); // id -> report
const history = []; // newest first

export function createReport({ type, input }) {
  const id = nanoid(10);
  const now = new Date().toISOString();

  const report = {
    id,
    type,
    status: "done", // baseline checks are instant; later you’ll do queued/running
    createdAt: now,
    updatedAt: now,
    input,
    summary: null,
    findings: [],
    meta: {}
  };

  reports.set(id, report);
  history.unshift({
    id,
    type,
    status: report.status,
    createdAt: now,
    inputPreview: type === "website" ? input.url : input.originalName
  });

  return report;
}

export function updateReport(id, patch) {
  const current = reports.get(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  reports.set(id, next);

  const h = history.find((x) => x.id === id);
  if (h && patch.status) h.status = patch.status;

  return next;
}

export function getReport(id) {
  return reports.get(id) || null;
}

export function getHistory(limit = 50) {
  return history.slice(0, limit);
}
