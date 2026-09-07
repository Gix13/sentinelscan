# Model artifacts

Serialized model and evaluation files are intentionally excluded from Git.

After supplying reviewed training data, run the training scripts from `apps/ml/` to create:

- `phishing_classifier.joblib`
- `network_classifier.joblib`

Only load Joblib/Pickle artifacts that you created or obtained from a trusted source. Deserializing an untrusted model can execute arbitrary code.
