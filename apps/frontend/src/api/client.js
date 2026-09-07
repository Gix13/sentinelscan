import { API_BASE_URL, USE_MOCK_API } from "../config/constants";
import { endpoints } from "./endpoints";

// --------------------
// Mock store (in-memory)
// --------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mockDB = {
  reports: new Map(), // id -> report
  history: [] // newest first
};

function makeId() {
  return Math.random().toString(16).slice(2, 10);
}

async function mockScanWebsite(url) {
  await sleep(500);

  const id = makeId();
  const now = new Date().toISOString();

  const report = {
    id,
    type: "website",
    status: "queued",
    createdAt: now,
    updatedAt: now,
    input: { url },
    summary: null,
    findings: [],
    meta: { engine: "mock-v1" }
  };

  mockDB.reports.set(id, report);
  mockDB.history.unshift({
    id,
    type: "website",
    status: "queued",
    createdAt: now,
    inputPreview: url
  });

  // simulate progress
  (async () => {
    await sleep(700);
    const r1 = mockDB.reports.get(id);
    if (!r1) return;
    mockDB.reports.set(id, { ...r1, status: "running", updatedAt: new Date().toISOString() });
    const h = mockDB.history.find((x) => x.id === id);
    if (h) h.status = "running";

    await sleep(900);
    const r2 = mockDB.reports.get(id);
    if (!r2) return;
    mockDB.reports.set(id, {
      ...r2,
      status: "done",
      updatedAt: new Date().toISOString(),
      summary: "Website scan completed (mock).",
      findings: [
        { severity: "info", title: "Reachability", detail: "Host reachable (mock signal)." },
        { severity: "low", title: "Security headers", detail: "Header checks are stubbed." },
        { severity: "medium", title: "Suspicious patterns", detail: "Heuristics flagged possible risk (mock)." }
      ],
      meta: { ...r2.meta, finishedAt: new Date().toISOString() }
    });
    const h2 = mockDB.history.find((x) => x.id === id);
    if (h2) h2.status = "done";
  })();

  return { reportId: id, status: "queued" };
}

async function mockScanFile(file) {
  await sleep(400);

  const id = makeId();
  const now = new Date().toISOString();

  const report = {
    id,
    type: "file",
    status: "queued",
    createdAt: now,
    updatedAt: now,
    input: {
      originalName: file?.name || "unknown",
      size: file?.size || 0,
      mimeType: file?.type || "application/octet-stream"
    },
    summary: null,
    findings: [],
    meta: { engine: "mock-v1" }
  };

  mockDB.reports.set(id, report);
  mockDB.history.unshift({
    id,
    type: "file",
    status: "queued",
    createdAt: now,
    inputPreview: report.input.originalName
  });

  (async () => {
    await sleep(650);
    const r1 = mockDB.reports.get(id);
    if (!r1) return;
    mockDB.reports.set(id, { ...r1, status: "running", updatedAt: new Date().toISOString() });
    const h = mockDB.history.find((x) => x.id === id);
    if (h) h.status = "running";

    await sleep(900);
    const r2 = mockDB.reports.get(id);
    if (!r2) return;

    // simple "signals" based on extension (mock)
    const name = (r2.input.originalName || "").toLowerCase();
    const ext = name.includes(".") ? name.split(".").pop() : "";
    const risky = ["exe", "dll", "js", "vbs", "scr", "bat", "ps1", "jar"].includes(ext);

    mockDB.reports.set(id, {
      ...r2,
      status: "done",
      updatedAt: new Date().toISOString(),
      summary: "File scan completed (mock).",
      findings: risky
        ? [
            {
              severity: "medium",
              title: "Executable/script type",
              detail: `Extension .${ext} often requires deeper analysis.`
            },
            { severity: "info", title: "Hashing", detail: "SHA256/MD5 not implemented yet (mock)." },
            { severity: "info", title: "AV/YARA", detail: "ClamAV + YARA pipeline not implemented yet (mock)." }
          ]
        : [
            { severity: "info", title: "File received", detail: "No obvious risk signal from extension (mock)." },
            { severity: "info", title: "Hashing", detail: "SHA256/MD5 not implemented yet (mock)." }
          ],
      meta: { ...r2.meta, finishedAt: new Date().toISOString() }
    });

    const h2 = mockDB.history.find((x) => x.id === id);
    if (h2) h2.status = "done";
  })();

  return { reportId: id, status: "queued" };
}

async function mockGetHistory(limit = 50) {
  await sleep(120);
  return { items: mockDB.history.slice(0, limit) };
}

async function mockGetReport(id) {
  await sleep(120);
  const report = mockDB.reports.get(id);
  if (!report) {
    const err = new Error("Report not found");
    err.status = 404;
    throw err;
  }
  return report;
}

// --------------------
// Real HTTP helpers (unwrap { ok, data } from backend)
// --------------------
async function httpJson(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json.data;
}

async function httpForm(path, formData) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json.data;
}

// --------------------
// Public API
// --------------------
export const api = {
  async scanWebsite(url) {
    if (USE_MOCK_API) return mockScanWebsite(url);
    // backend returns { ok:true, data:{ reportId, status } }
    return httpJson(endpoints.scanWebsite, { method: "POST", body: { url } });
  },

  async scanFile(file) {
    if (USE_MOCK_API) return mockScanFile(file);
    const fd = new FormData();
    fd.append("file", file);
    // backend returns { ok:true, data:{ reportId, status, sha256 } }
    return httpForm(endpoints.scanFile, fd);
  },

  async getHistory(limit = 50) {
    if (USE_MOCK_API) return mockGetHistory(limit);
    // backend returns { ok:true, data:{ items } }
    return httpJson(`${endpoints.history}?limit=${limit}`);
  },

  async getReport(id) {
    if (USE_MOCK_API) return mockGetReport(id);
    // backend returns { ok:true, data: report }
    return httpJson(endpoints.report(id));
  }
};
