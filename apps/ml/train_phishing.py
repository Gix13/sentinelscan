"""
Train + compare 5 ML models on the PhiUSIIL Phishing URL Dataset.
Saves the best model to models/phishing_classifier.joblib.
"""

import os
import time
import warnings
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
import joblib

from feature_extractors import URL_FEATURE_NAMES

warnings.filterwarnings("ignore")

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "phishing_urls.csv")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")


def main():
    from feature_extractors import extract_url_features

    print(f"Loading {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df):,} URLs")

    # IMPORTANT: We recompute ALL features using our own extractor so that
    # train-time and inference-time features match exactly. PhiUSIIL ships
    # pre-computed features, but their exact computation differs from ours.
    # Recomputing guarantees zero feature-distribution mismatch.
    print(f"Recomputing {len(URL_FEATURE_NAMES)} URL features for {len(df):,} URLs (~30s)...")
    feat_dicts = df["URL"].fillna("").apply(extract_url_features)
    feat_df = pd.DataFrame(list(feat_dicts))
    feature_cols = list(feat_df.columns)
    print(f"Features computed: {len(feature_cols)}")

    X = feat_df.fillna(0).values
    y = df["label"].values  # 1 = legitimate, 0 = phishing
    print(f"Label distribution: {pd.Series(y).value_counts().to_dict()}\n")

    # Scale
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"Train: {len(X_train):,}, Test: {len(X_test):,}\n")

    # Define models
    models = {
        "RandomForest": RandomForestClassifier(n_estimators=100, n_jobs=-1, random_state=42),
        "XGBoost": XGBClassifier(n_estimators=100, eval_metric="logloss", n_jobs=-1, random_state=42, verbosity=0),
        "LightGBM": LGBMClassifier(n_estimators=100, n_jobs=-1, random_state=42, verbose=-1),
        "LogisticRegression": LogisticRegression(max_iter=1000, n_jobs=-1, random_state=42),
        "LinearSVM": CalibratedClassifierCV(LinearSVC(max_iter=2000, random_state=42), cv=3),
    }

    print("=" * 70)
    print(f"{'Model':<20} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1':>10} {'Time (s)':>10}")
    print("=" * 70)

    results = {}
    best_name = None
    best_acc = -1
    best_model = None
    best_pred = None

    for name, model in models.items():
        t0 = time.time()
        model.fit(X_train, y_train)
        train_time = time.time() - t0
        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        p, r, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="weighted", zero_division=0)
        results[name] = {"accuracy": acc, "precision": p, "recall": r, "f1": f1, "train_time": train_time}
        print(f"{name:<20} {acc:>10.4f} {p:>10.4f} {r:>10.4f} {f1:>10.4f} {train_time:>10.2f}")
        if acc > best_acc:
            best_acc = acc
            best_name = name
            best_model = model
            best_pred = y_pred

    print("=" * 70)
    print(f"\nBEST MODEL: {best_name} (accuracy: {best_acc:.4f})\n")
    print("Full classification report on test set:")
    print(classification_report(y_test, best_pred, target_names=["Phishing", "Legitimate"]))

    # Save best model
    os.makedirs(MODELS_DIR, exist_ok=True)
    bundle_path = os.path.join(MODELS_DIR, "phishing_classifier.joblib")
    joblib.dump({
        "model": best_model,
        "scaler": scaler,
        "feature_names": feature_cols,
        "label_names": ["Phishing", "Legitimate"],
        "model_name": best_name,
        "accuracy": best_acc,
        "all_results": results,
    }, bundle_path)
    print(f"Saved best model to {bundle_path}")

    # Save test set for evaluate.py
    joblib.dump({"X_test": X_test, "y_test": y_test, "feature_cols": feature_cols},
                os.path.join(MODELS_DIR, "phishing_test_data.joblib"))


if __name__ == "__main__":
    main()
