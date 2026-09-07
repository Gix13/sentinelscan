import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENABLE_PHISHING_ML = process.env.ENABLE_PHISHING_ML === "true";
const PYTHON = process.env.PYTHON_PATH || path.join(__dirname, "../../../ml/venv/bin/python3");
const PREDICT_SCRIPT = path.resolve(__dirname, "../../../ml/predict_phishing.py");

/**
 * Classify a URL as Phishing or Legitimate using a model trained on the
 * PhiUSIIL dataset (real, labeled URLs from UCI ML Repository).
 */
export async function classifyURL(url) {
  if (!ENABLE_PHISHING_ML) {
    return { available: false, reason: "Phishing classifier is disabled (ENABLE_PHISHING_ML=false)" };
  }

  if (!url || typeof url !== "string") {
    return { available: false, reason: "No URL to classify" };
  }

  const input = JSON.stringify({ url });

  try {
    const result = await runPredict(input);
    return {
      available: true,
      label: result.label,
      isPhishing: result.is_phishing,
      confidence: result.confidence,
      probabilities: result.probabilities,
      features: result.features,
      model: result.model,
      modelAccuracy: result.model_accuracy,
    };
  } catch (err) {
    if (err.message?.includes("ENOENT") || err.message?.includes("not found")) {
      return { available: false, reason: "Python is not installed on this server" };
    }
    if (err.message?.includes("Phishing model not found")) {
      return { available: false, reason: "Phishing model not trained yet. Run train_phishing.py first." };
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
          reject(new Error(`Invalid JSON from predict_phishing.py: ${stdout.slice(0, 200)}`));
        }
      }
    );
    child.stdin.write(inputJson);
    child.stdin.end();
  });
}
