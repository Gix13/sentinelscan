"""
Evaluate the saved network attack classifier on its held-out test set.
Generates confusion matrix PNG and prints per-class metrics.
"""

import os
import joblib
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")


def main():
    bundle = joblib.load(os.path.join(MODELS_DIR, "network_classifier.joblib"))
    test = joblib.load(os.path.join(MODELS_DIR, "network_test_data.joblib"))

    model = bundle["model"]
    le = bundle["label_encoder"]
    model_name = bundle["model_name"]
    all_results = bundle["all_results"]
    label_names = list(le.classes_)

    X_test = test["X_test"]
    y_test = test["y_test"]
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    print("=" * 70)
    print("NETWORK ATTACK CLASSIFIER: Real-data ML on NSL-KDD")
    print("=" * 70)
    print(f"Best model: {model_name}")
    print(f"Test accuracy: {acc:.4f} ({acc*100:.2f}%)\n")

    print("Model comparison (all 5 models from training):")
    print(f"{'Model':<20} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1':>10}")
    for name, r in all_results.items():
        marker = " ← best" if name == model_name else ""
        print(f"{name:<20} {r['accuracy']:>10.4f} {r['precision']:>10.4f} {r['recall']:>10.4f} {r['f1']:>10.4f}{marker}")
    print()

    print(classification_report(y_test, y_pred, target_names=label_names, zero_division=0))

    cm = confusion_matrix(y_test, y_pred)
    print("Confusion matrix:")
    print(cm)

    # Per-class FPR / FNR
    print("\nPer-class FPR / FNR:")
    for i, cls in enumerate(label_names):
        tp = cm[i, i]
        fn = sum(cm[i, :]) - tp
        fp = sum(cm[:, i]) - tp
        tn = cm.sum() - tp - fn - fp
        fpr = fp / (fp + tn) if (fp + tn) else 0
        fnr = fn / (fn + tp) if (fn + tp) else 0
        print(f"  {cls}: FPR={fpr*100:.2f}%, FNR={fnr*100:.2f}%")

    fig, ax = plt.subplots(figsize=(8, 6))
    im = ax.imshow(cm, cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)
    ax.set(xticks=range(len(label_names)), yticks=range(len(label_names)),
           xticklabels=label_names, yticklabels=label_names,
           xlabel="Predicted", ylabel="Actual",
           title=f"Network Attack: {model_name} ({acc:.1%})")
    plt.setp(ax.get_xticklabels(), rotation=30, ha="right")
    thresh = cm.max() / 2
    for i in range(len(label_names)):
        for j in range(len(label_names)):
            ax.text(j, i, format(cm[i, j], "d"), ha="center", va="center",
                    color="white" if cm[i, j] > thresh else "black",
                    fontsize=11, fontweight="bold")
    plt.tight_layout()
    out_path = os.path.join(MODELS_DIR, "network_confusion_matrix.png")
    plt.savefig(out_path, dpi=150)
    print(f"\nConfusion matrix saved to {out_path}")


if __name__ == "__main__":
    main()
