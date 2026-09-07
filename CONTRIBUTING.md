# Contributing

SentinelScan welcomes narrowly scoped improvements that are safe to review and reproduce.

## Pull-request checklist

1. Discuss significant feature or architecture changes in an issue first.
2. Use mock mode, synthetic fixtures, or infrastructure you own.
3. Never commit uploaded samples, credentials, targets, databases, models, datasets, or scan evidence.
4. Keep active integrations opt-in and document every new network or filesystem side effect.
5. Run the backend tests, frontend lint/build, and Python syntax checks described in CI.
6. Explain security assumptions, data handling, and limitations introduced by the change.

Do not submit live malware or third-party vulnerability evidence. Changes that weaken authorization, secret handling, or safe defaults will not be accepted.
