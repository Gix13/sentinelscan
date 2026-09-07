"""
Inference script for the phishing URL classifier.
Reads { "url": string } from stdin, outputs classification JSON to stdout.
"""

import sys
import os
import json
import joblib
import numpy as np

from feature_extractors import extract_url_features

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "phishing_classifier.joblib")


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
    except Exception as e:
        print(json.dumps({"error": f"Invalid input JSON: {e}"}))
        sys.exit(1)

    if not os.path.exists(MODEL_PATH):
        print(json.dumps({"error": "Phishing model not found. Run train_phishing.py first."}))
        sys.exit(1)

    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    scaler = bundle["scaler"]
    feature_names = bundle["feature_names"]
    label_names = bundle["label_names"]
    model_name = bundle["model_name"]
    accuracy = bundle["accuracy"]

    url = data.get("url", "")
    raw_features = extract_url_features(url)

    # Build feature vector in the order used during training
    feat_vec = np.array([[raw_features.get(f, 0) for f in feature_names]])
    feat_scaled = scaler.transform(feat_vec)

    pred = int(model.predict(feat_scaled)[0])
    proba = model.predict_proba(feat_scaled)[0]
    label = label_names[pred]

    result = {
        "label": label,
        "is_phishing": label == "Phishing",
        "confidence": round(float(max(proba)), 4),
        "probabilities": {label_names[i]: round(float(proba[i]), 4) for i in range(len(label_names))},
        "features": raw_features,
        "model": model_name,
        "model_accuracy": round(float(accuracy), 4),
    }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
