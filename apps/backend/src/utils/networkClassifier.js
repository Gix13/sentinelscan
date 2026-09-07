import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENABLE_NETWORK_ML = process.env.ENABLE_NETWORK_ML === "true";
const PYTHON = process.env.PYTHON_PATH || path.join(__dirname, "../../../ml/venv/bin/python3");
const PREDICT_SCRIPT = path.resolve(__dirname, "../../../ml/predict_network.py");

/**
 * Classify a host's network attack class (Normal / Probe / DoS / R2L / U2R)
 * from its Nmap scan results. Trained on the NSL-KDD dataset.
 */
export async function classifyNetwork(nmapResult) {
  if (!ENABLE_NETWORK_ML) {
    return { available: false, reason: "Network classifier is disabled (ENABLE_NETWORK_ML=false)" };
  }

  if (!nmapResult || !nmapResult.ports) {
    return { available: false, reason: "No port data to classify" };
  }

  const input = JSON.stringify({ ports: nmapResult.ports });

  try {
    const result = await runPredict(input);
    return {
      available: true,
      attackClass: result.label,
      confidence: result.confidence,
      probabilities: result.probabilities,
      portsAnalyzed: result.ports_analyzed,
      featuresUsed: result.features_used,
      model: result.model,
      modelAccuracy: result.model_accuracy,
    };
  } catch (err) {
    if (err.message?.includes("ENOENT") || err.message?.includes("not found")) {
      return { available: false, reason: "Python is not installed on this server" };
    }
    if (err.message?.includes("Network model not found")) {
      return { available: false, reason: "Network model not trained yet. Run train_network.py first." };
    }
    return { available: false, reason: err.message?.slice(0, 200) };
  }
}

function runPredict(inputJson) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      PYTHON,
      [PREDICT_SCRIPT],
      { timeout: 30_000 },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(stderr || err.message));
        }
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.error) return reject(new Error(parsed.error));
          resolve(parsed);
        } catch {
          reject(new Error(`Invalid JSON from predict_network.py: ${stdout.slice(0, 200)}`));
        }
      }
    );
    child.stdin.write(inputJson);
    child.stdin.end();
  });
}
