"""
Inference script for the network attack classifier.
Reads { "ports": [...] } from stdin (Nmap format), outputs classification JSON.
"""

import sys
import os
import json
import joblib
import numpy as np
import pandas as pd

from feature_extractors import extract_network_features, NETWORK_CATEGORICAL

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "network_classifier.joblib")


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
    except Exception as e:
        print(json.dumps({"error": f"Invalid input JSON: {e}"}))
        sys.exit(1)

    if not os.path.exists(MODEL_PATH):
        print(json.dumps({"error": "Network model not found. Run train_network.py first."}))
        sys.exit(1)

    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    scaler = bundle["scaler"]
    le = bundle["label_encoder"]
    feature_names = bundle["feature_names"]  # post one-hot encoded names
    raw_feature_cols = bundle["raw_feature_cols"]
    cat_cols = bundle["categorical_cols"]
    model_name = bundle["model_name"]
    accuracy = bundle["accuracy"]

    ports = data.get("ports", [])
    raw_features = extract_network_features(ports)

    # Build a DataFrame and one-hot encode using the same scheme as training
    row = pd.DataFrame([{c: raw_features.get(c, 0) for c in raw_feature_cols}])
    row_encoded = pd.get_dummies(row, columns=cat_cols, drop_first=False)

    # Align columns: add missing cols (from training but not present here) as 0,
    # drop extra cols (categories present here but not in training)
    for col in feature_names:
        if col not in row_encoded.columns:
            row_encoded[col] = 0
    row_encoded = row_encoded[feature_names]

    feat_vec = row_encoded.values.astype(np.float64)
    feat_scaled = scaler.transform(feat_vec)

    pred = int(model.predict(feat_scaled)[0])
    proba = model.predict_proba(feat_scaled)[0]
    label = le.inverse_transform([pred])[0]
    classes = list(le.classes_)

    result = {
        "label": label,
        "confidence": round(float(max(proba)), 4),
        "probabilities": {classes[i]: round(float(proba[i]), 4) for i in range(len(classes))},
        "model": model_name,
        "model_accuracy": round(float(accuracy), 4),
        "features_used": len(feature_names),
        "ports_analyzed": len(ports),
    }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
