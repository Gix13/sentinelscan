"""
Train + compare 5 ML models on NSL-KDD for network attack classification.

Important caveat: NSL-KDD has 41 features per connection, but Nmap output only
gives us a small subset (port, service, protocol). To make training match what
we can derive at inference time, we train on the FULL feature set but the
inference path uses the same feature names with sensible defaults for
unobservable features. This is a known integration limitation documented
in the FYP report.

Saves the best model to models/network_classifier.joblib.
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

from feature_extractors import NETWORK_FEATURE_NAMES, NETWORK_CATEGORICAL

warnings.filterwarnings("ignore")

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "nsl_train.txt")
TEST_PATH = os.path.join(os.path.dirname(__file__), "data", "nsl_test.txt")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

# NSL-KDD column order (43 columns: 41 features + label + difficulty)
NSL_COLUMNS = [
    "duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes",
    "land", "wrong_fragment", "urgent", "hot", "num_failed_logins", "logged_in",
    "num_compromised", "root_shell", "su_attempted", "num_root", "num_file_creations",
    "num_shells", "num_access_files", "num_outbound_cmds", "is_host_login",
    "is_guest_login", "count", "srv_count", "serror_rate", "srv_serror_rate",
    "rerror_rate", "srv_rerror_rate", "same_srv_rate", "diff_srv_rate",
    "srv_diff_host_rate", "dst_host_count", "dst_host_srv_count",
    "dst_host_same_srv_rate", "dst_host_diff_srv_rate",
    "dst_host_same_src_port_rate", "dst_host_srv_diff_host_rate",
    "dst_host_serror_rate", "dst_host_srv_serror_rate", "dst_host_rerror_rate",
    "dst_host_srv_rerror_rate", "label", "difficulty",
]

# Map specific NSL-KDD attack labels to 5 high-level classes
ATTACK_FAMILY = {
    # Probe / scanning
    "ipsweep": "Probe", "nmap": "Probe", "portsweep": "Probe", "satan": "Probe",
    "saint": "Probe", "mscan": "Probe",
    # DoS
    "back": "DoS", "land": "DoS", "neptune": "DoS", "pod": "DoS", "smurf": "DoS",
    "teardrop": "DoS", "apache2": "DoS", "udpstorm": "DoS", "processtable": "DoS",
    "mailbomb": "DoS",
    # R2L (remote to local)
    "ftp_write": "R2L", "guess_passwd": "R2L", "imap": "R2L", "multihop": "R2L",
    "phf": "R2L", "spy": "R2L", "warezclient": "R2L", "warezmaster": "R2L",
    "snmpgetattack": "R2L", "snmpguess": "R2L", "xlock": "R2L", "xsnoop": "R2L",
    "sendmail": "R2L", "named": "R2L", "worm": "R2L", "httptunnel": "R2L",
    # U2R (user to root)
    "buffer_overflow": "U2R", "loadmodule": "U2R", "perl": "U2R", "rootkit": "U2R",
    "ps": "U2R", "sqlattack": "U2R", "xterm": "U2R",
}


def family_label(label):
    if label == "normal":
        return "Normal"
    return ATTACK_FAMILY.get(label, "Other")


def load_nsl(path):
    df = pd.read_csv(path, header=None, names=NSL_COLUMNS)
    df["family"] = df["label"].apply(family_label)
    return df


def main():
    print("Loading NSL-KDD train + test...")
    train_df = load_nsl(DATA_PATH)
    test_df = load_nsl(TEST_PATH)
    df = pd.concat([train_df, test_df], ignore_index=True)
    # Drop "Other" family if any leaked through (we want the 5 standard classes)
    df = df[df["family"] != "Other"]
    print(f"Loaded {len(df):,} records")
    print(f"Class distribution:\n{df['family'].value_counts()}\n")

    # Restrict columns to NETWORK_FEATURE_NAMES (the ones our extractor produces)
    feat_cols = [c for c in NETWORK_FEATURE_NAMES if c in df.columns]
    cat_cols = [c for c in NETWORK_CATEGORICAL if c in feat_cols]
    num_cols = [c for c in feat_cols if c not in cat_cols]

    # One-hot encode categoricals using fixed vocab so inference matches
    df_encoded = pd.get_dummies(df[feat_cols], columns=cat_cols, drop_first=False)
    feature_cols_final = list(df_encoded.columns)
    print(f"Total features after one-hot: {len(feature_cols_final)}")

    X = df_encoded.values.astype(np.float64)
    y_raw = df["family"].values
    le = LabelEncoder()
    y = le.fit_transform(y_raw)
    print(f"Classes: {list(le.classes_)}\n")

    # Scale
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Split (use train_test_split fresh from combined to balance)
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"Train: {len(X_train):,}, Test: {len(X_test):,}\n")

    models = {
        "RandomForest": RandomForestClassifier(n_estimators=100, n_jobs=-1, random_state=42),
        "XGBoost": XGBClassifier(n_estimators=100, eval_metric="mlogloss", n_jobs=-1, random_state=42, verbosity=0),
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
    print(classification_report(y_test, best_pred, target_names=list(le.classes_), zero_division=0))

    # Save bundle
    os.makedirs(MODELS_DIR, exist_ok=True)
    bundle_path = os.path.join(MODELS_DIR, "network_classifier.joblib")
    joblib.dump({
        "model": best_model,
        "scaler": scaler,
        "label_encoder": le,
        "feature_names": feature_cols_final,
        "raw_feature_cols": feat_cols,
        "categorical_cols": cat_cols,
        "model_name": best_name,
        "accuracy": best_acc,
        "all_results": results,
    }, bundle_path)
    print(f"Saved best model to {bundle_path}")

    joblib.dump({"X_test": X_test, "y_test": y_test, "label_names": list(le.classes_)},
                os.path.join(MODELS_DIR, "network_test_data.joblib"))


if __name__ == "__main__":
    main()
