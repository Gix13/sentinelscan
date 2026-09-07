import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const ENABLE_METASPLOIT = process.env.ENABLE_METASPLOIT === "true";
const MSFCONSOLE = process.env.MSFCONSOLE_PATH || "msfconsole";
const SCAN_TIMEOUT_MS = 180_000;

// Map detected services -> Metasploit detection-only modules
// Each entry returns { module, action?, requiresService?, requiresVersionMatch? }
const MODULE_MAP = {
  ssh: [
    { module: "auxiliary/scanner/ssh/ssh_version", severity: "info", label: "SSH version" },
  ],
  http: [
    { module: "auxiliary/scanner/http/http_version", severity: "info", label: "HTTP server version" },
    { module: "auxiliary/scanner/http/options", severity: "info", label: "HTTP allowed methods" },
  ],
  https: [
    { module: "auxiliary/scanner/http/http_version", severity: "info", label: "HTTPS server version", extra: "set SSL true" },
    { module: "auxiliary/scanner/ssl/openssl_heartbleed", severity: "critical", label: "Heartbleed (CVE-2014-0160)" },
  ],
  smb: [
    { module: "auxiliary/scanner/smb/smb_version", severity: "info", label: "SMB version" },
    { module: "exploit/windows/smb/ms17_010_eternalblue", severity: "critical", label: "EternalBlue (CVE-2017-0144)", action: "check" },
  ],
  ftp: [
    { module: "auxiliary/scanner/ftp/anonymous", severity: "high", label: "Anonymous FTP login" },
  ],
};

// Translate Nmap port + service into our internal service categories
function categorizePort(port) {
  const services = [];
  if (port.port === 22 || port.service === "ssh") services.push("ssh");
  if (port.port === 21 || port.service === "ftp") services.push("ftp");
  if (port.port === 80 || port.port === 8080 || port.service === "http") services.push("http");
  if (port.port === 443 || port.port === 8443 || (port.service === "https") || (port.service === "http" && port.product?.toLowerCase().includes("ssl"))) services.push("https");
  if ([139, 445].includes(port.port) || port.service === "microsoft-ds" || port.service === "netbios-ssn" || port.service === "smb") services.push("smb");
  return services;
}

// Build the resource script that msfconsole will execute
function buildResourceScript(host, ports) {
  const lines = ["spool /tmp/sentinel-msf-spool.log", `setg RHOSTS ${host}`];
  const planned = []; // [{ module, port, severity, label, action? }]

  for (const p of ports) {
    const services = categorizePort(p);
    for (const service of services) {
      const modules = MODULE_MAP[service] || [];
      for (const m of modules) {
        lines.push(`use ${m.module}`);
        lines.push(`set RHOSTS ${host}`);
        lines.push(`set RPORT ${p.port}`);
        if (m.extra) lines.push(m.extra);
        if (m.action === "check") lines.push("check");
        else lines.push("run");
        planned.push({ module: m.module, port: p.port, severity: m.severity, label: m.label });
      }
    }
  }

  lines.push("exit -y");
  return { script: lines.join("\n"), planned };
}

// Strip ANSI escape codes (color codes etc.) from a line
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\[[0-9;]*m/g, "").replace(/\[[0-9;]+m/g, "");
}

// Parse msfconsole stdout into per-module findings.
function parseOutput(stdout, planned) {
  const findings = [];
  const linesOut = stdout.split(/\r?\n/);

  let plannedIdx = -1;
  let currentVulnerable = false;
  let currentSafe = false;
  let currentDetail = "";

  function flushCurrent() {
    if (plannedIdx < 0) return;
    const meta = planned[plannedIdx];
    if (!meta) return;
    const detail = currentDetail || (currentVulnerable ? "Vulnerability detected" : currentSafe ? "Not vulnerable" : "Module executed (no notable findings)");
    let severity = meta.severity || "info";
    if (currentVulnerable && (meta.severity === "critical" || meta.severity === "high")) {
      severity = meta.severity;
    } else if (currentSafe && meta.severity === "critical") {
      severity = "info";
    } else if (!currentVulnerable && !currentSafe && meta.severity === "critical") {
      severity = "info";
    }
    findings.push({
      name: meta.module,
      port: meta.port,
      severity,
      finding: detail.slice(0, 400),
      vulnerable: currentVulnerable,
    });
  }

  for (const raw of linesOut) {
    const line = stripAnsi(raw).trim();
    if (!line) continue;

    // Detect "use <module>" in both `msf6 > use ...` and `resource (path)> use ...`.
    const useMatch = line.match(/(?:^|>\s*)use\s+(\S+)/);
    if (useMatch) {
      flushCurrent();
      const moduleName = useMatch[1];
      const next = planned.findIndex((p, i) => i > plannedIdx && p.module === moduleName);
      plannedIdx = next >= 0 ? next : -1;
      currentVulnerable = false;
      currentSafe = false;
      currentDetail = "";
      continue;
    }

    if (plannedIdx < 0) continue;

    // Vulnerability indicators (in [+] lines)
    if (/^\[\+\][\s\S]*?(VULNERABLE|appears? vulnerable|is vulnerable|Heartbleed|EternalBlue|Anonymous READ|Anonymous WRITE|anonymous login allowed)/i.test(line)) {
      currentVulnerable = true;
      const m = line.match(/\[\+\]\s*(.+)$/);
      if (m && !currentDetail) currentDetail = m[1];
      continue;
    }

    // Safe / not vulnerable indicators
    if (/(not vulnerable|does not appear vulnerable|target is patched|no vulnerability detected)/i.test(line)) {
      currentSafe = true;
      if (!currentDetail) currentDetail = "Not vulnerable";
      continue;
    }

    // Useful info findings (versions, banners, allowed methods)
    if (/^\[[+*]\]/.test(line)) {
      const m = line.match(/^\[[+*]\]\s*(.+)$/);
      if (m) {
        const text = m[1];
        if (!currentDetail && /(version|server|banner|apache|nginx|openssh|microsoft|samba|allowed|methods|smb|http|ssh)/i.test(text)) {
          // Skip "Scanned X of Y hosts" lines
          if (!/Scanned \d+ of \d+ hosts/i.test(text)) {
            currentDetail = text;
          }
        }
      }
    }
  }

  flushCurrent();

  // Cover any planned modules that weren't reached
  while (plannedIdx + 1 < planned.length) {
    plannedIdx += 1;
    const meta = planned[plannedIdx];
    findings.push({
      name: meta.module,
      port: meta.port,
      severity: "info",
      finding: "Module did not produce output (skipped or timed out).",
      vulnerable: false,
    });
  }

  return findings;
}

function runMsfconsole(scriptPath) {
  // Strip env vars that conflict with Metasploit's Rails/ActiveRecord setup.
  // DATABASE_URL is set for Prisma (file:./prisma/dev.db) and Rails will try to
  // parse it as an ActiveRecord URL, which fails. Same risk for RAILS_* etc.
  const cleanEnv = { ...process.env };
  delete cleanEnv.DATABASE_URL;
  delete cleanEnv.RAILS_ENV;
  delete cleanEnv.RACK_ENV;

  return new Promise((resolve, reject) => {
    execFile(MSFCONSOLE, ["-q", "-r", scriptPath], { timeout: SCAN_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024, env: cleanEnv }, (err, stdout, stderr) => {
      if (err) {
        if (err.code === "ENOENT" || /not found|ENOENT|command not found/i.test(err.message)) {
          err.notInstalled = true;
        }
        // Attach stdout/stderr so caller can log them for debugging
        err.stdout = stdout;
        err.stderr = stderr;
        if (stdout && stdout.length > 0 && stdout.includes("Auxiliary module execution completed")) {
          // msfconsole sometimes exits non-zero but still produced useful output
          return resolve(stdout);
        }
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

/**
 * Detect known vulnerabilities on the target by running a focused set of
 * Metasploit auxiliary scanners + check actions. Read-only, no exploitation.
 *
 * @param {object} nmapResult - Output from scanWebsite() in nmapScanner.js
 * @returns {object} - { available, hostname, modules, vulnerabilitiesFound, scanTime, summary } | { available: false, reason }
 */
export async function detectVulns(nmapResult) {
  if (!ENABLE_METASPLOIT) {
    return { available: false, reason: "Metasploit detection is disabled (ENABLE_METASPLOIT=false)" };
  }

  if (!nmapResult || !nmapResult.ports || nmapResult.ports.length === 0) {
    return { available: false, reason: "No open ports to probe" };
  }

  const host = nmapResult.hostname || nmapResult.ip;
  if (!host) {
    return { available: false, reason: "No hostname/IP available from Nmap result" };
  }

  // Build resource script
  const { script, planned } = buildResourceScript(host, nmapResult.ports);
  if (planned.length === 0) {
    return {
      available: true,
      hostname: host,
      modules: [],
      vulnerabilitiesFound: 0,
      modulesRun: 0,
      scanTime: 0,
      summary: "No services detected that match Metasploit detection modules.",
    };
  }

  // Write script to temp file
  const tmpName = `sentinel-msf-${crypto.randomBytes(6).toString("hex")}.rc`;
  const scriptPath = path.join(os.tmpdir(), tmpName);
  await fs.writeFile(scriptPath, script, "utf8");

  const start = Date.now();
  let stdout;
  try {
    stdout = await runMsfconsole(scriptPath);
  } catch (err) {
    if (err.notInstalled) {
      return { available: false, reason: "Metasploit is not installed on this server" };
    }
    console.error("[metasploit] FULL ERROR:", err.message);
    console.error("[metasploit] STDOUT:", err.stdout?.slice(0, 2000));
    console.error("[metasploit] STDERR:", err.stderr?.slice(0, 2000));
    return { available: false, reason: err.message?.slice(0, 200) || "Metasploit execution failed" };
  } finally {
    fs.unlink(scriptPath).catch(() => {});
  }

  const scanTime = Number(((Date.now() - start) / 1000).toFixed(2));
  const modules = parseOutput(stdout, planned);
  const vulnerabilitiesFound = modules.filter((m) => m.vulnerable && (m.severity === "critical" || m.severity === "high")).length;

  let summary;
  if (vulnerabilitiesFound > 0) {
    summary = `Metasploit ran ${planned.length} detection modules. ${vulnerabilitiesFound} vulnerabilit${vulnerabilitiesFound === 1 ? "y" : "ies"} found.`;
  } else {
    summary = `Metasploit ran ${planned.length} detection modules. No vulnerabilities found.`;
  }

  return {
    available: true,
    hostname: host,
    modules,
    vulnerabilitiesFound,
    modulesRun: planned.length,
    scanTime,
    summary,
  };
}
