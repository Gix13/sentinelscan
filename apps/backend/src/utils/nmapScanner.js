import { execFile } from "child_process";
import { promises as dns } from "dns";

const ENABLE_NMAP = process.env.ENABLE_NMAP === "true";

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isPrivateIp(ip) {
  return PRIVATE_RANGES.some((re) => re.test(ip));
}

function isValidHostname(hostname) {
  return /^[a-zA-Z0-9]([a-zA-Z0-9\-_.]{0,251}[a-zA-Z0-9])?$/.test(hostname);
}

function parseNmapXml(xml) {
  const result = { ip: null, hostname: null, ports: [], os: null, scanTime: null };

  const ipMatch = xml.match(/<address addr="([^"]+)" addrtype="ipv4"/);
  if (ipMatch) result.ip = ipMatch[1];

  const hostnameMatch = xml.match(/<hostname name="([^"]+)"/);
  if (hostnameMatch) result.hostname = hostnameMatch[1];

  const elapsedMatch = xml.match(/elapsed="([^"]+)"/);
  if (elapsedMatch) result.scanTime = parseFloat(elapsedMatch[1]);

  const osMatch = xml.match(/<osmatch name="([^"]+)"/);
  if (osMatch) result.os = osMatch[1];

  // Extract each <port> block and parse it
  const portBlocks = [...xml.matchAll(/<port protocol="(\w+)" portid="(\d+)">([\s\S]*?)<\/port>/g)];
  for (const block of portBlocks) {
    const [, protocol, portid, content] = block;

    const stateMatch = content.match(/<state state="(\w+)"/);
    if (!stateMatch || stateMatch[1] !== "open") continue;

    const serviceTag = content.match(/<service([^>]*)>/);
    const attrs = serviceTag?.[1] || "";

    const nameMatch = attrs.match(/\bname="([^"]*)"/);
    const productMatch = attrs.match(/\bproduct="([^"]*)"/);
    const versionMatch = attrs.match(/\bversion="([^"]*)"/);

    result.ports.push({
      port: parseInt(portid, 10),
      protocol,
      state: "open",
      service: nameMatch?.[1] || "unknown",
      product: productMatch?.[1] || null,
      version: versionMatch?.[1] || null,
    });
  }

  return result;
}

function runNmapRaw(hostname) {
  return new Promise((resolve, reject) => {
    const args = [
      "-sV",
      "--version-intensity", "2",  // lighter probing — faster than default (7)
      "-T4",
      "--top-ports", "1000",
      "-oX", "-",
      hostname,
    ];

    execFile("nmap", args, { timeout: 300_000 }, (err, stdout, stderr) => {
      if (err) {
        // nmap exits non-zero on some warnings but still produces valid XML
        if (stdout && stdout.includes("<nmaprun")) {
          return resolve(stdout);
        }
        return reject(new Error(stderr || err.message));
      }
      resolve(stdout);
    });
  });
}

/**
 * Run an Nmap scan against the hostname in a URL.
 * Returns structured scan results or throws on error.
 */
export async function scanWebsite(url) {
  if (!ENABLE_NMAP) {
    return { available: false, reason: "Nmap scanning is disabled (ENABLE_NMAP=false)" };
  }

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error("Invalid URL");
  }

  if (hostname === "localhost") {
    throw new Error("Scanning localhost is not allowed");
  }

  if (!isValidHostname(hostname)) {
    throw new Error(`Invalid hostname characters: ${hostname}`);
  }

  // Resolve DNS first to block private IP targets
  let resolvedIp;
  try {
    const { address } = await dns.lookup(hostname);
    resolvedIp = address;
  } catch {
    throw new Error(`Could not resolve hostname: ${hostname}`);
  }

  if (isPrivateIp(resolvedIp)) {
    throw new Error("Scanning private or internal IP addresses is not allowed");
  }

  let xml;
  try {
    xml = await runNmapRaw(hostname);
  } catch (err) {
    // Nmap not installed
    if (err.message.toLowerCase().includes("enoent") || err.message.toLowerCase().includes("not found")) {
      return { available: false, reason: "Nmap is not installed on this server" };
    }
    throw err;
  }

  const parsed = parseNmapXml(xml);
  const openPorts = parsed.ports;

  return {
    available: true,
    hostname: parsed.hostname || hostname,
    ip: parsed.ip || resolvedIp,
    ports: openPorts,
    os: parsed.os,
    scanTime: parsed.scanTime,
    openPortCount: openPorts.length,
    summary: `${openPorts.length} open port${openPorts.length !== 1 ? "s" : ""} found on ${hostname} (${parsed.ip || resolvedIp})`,
  };
}
