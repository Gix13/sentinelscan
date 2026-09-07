# SentinelScan backend container
# Includes: Node 22, Python 3, Nmap, ClamAV, scikit-learn, XGBoost, LightGBM
# Excludes: Metasploit (too large, ~2GB; gracefully handled as "unavailable")

FROM node:22-bookworm-slim

# Install system dependencies (Nmap, ClamAV, Python)
RUN apt-get update && apt-get install -y --no-install-recommends \
        nmap \
        clamav clamav-daemon clamav-freshclam \
        python3 python3-pip python3-venv \
        ca-certificates curl \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------- Python ML environment ----------
COPY apps/ml/requirements.txt /app/apps/ml/requirements.txt
RUN python3 -m venv /app/apps/ml/venv \
    && /app/apps/ml/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /app/apps/ml/venv/bin/pip install --no-cache-dir -r /app/apps/ml/requirements.txt

# Copy ML inference code. Model artifacts and training data are deliberately
# excluded from the public image; mount reviewed models and opt in explicitly.
COPY apps/ml/feature_extractors.py /app/apps/ml/
COPY apps/ml/predict_phishing.py /app/apps/ml/
COPY apps/ml/predict_network.py /app/apps/ml/
RUN mkdir -p /app/apps/ml/models

# ---------- Node backend ----------
COPY apps/backend/package*.json /app/apps/backend/
WORKDIR /app/apps/backend
RUN npm ci --omit=dev

# Prisma client generation (uses the schema we copy next)
COPY apps/backend/prisma /app/apps/backend/prisma
RUN npx prisma generate

# Copy backend source
COPY apps/backend/src /app/apps/backend/src

# Create writable directories for uploads + database
RUN mkdir -p /app/apps/backend/uploads /app/apps/backend/uploads/quarantine \
             /app/apps/backend/prisma/prisma

# Production env defaults (overridable via Render env vars)
ENV NODE_ENV=production \
    PORT=5001 \
    DATABASE_URL=file:/app/apps/backend/prisma/prisma/dev.db \
    UPLOAD_DIR=/app/apps/backend/uploads \
    PYTHON_PATH=/app/apps/ml/venv/bin/python3 \
    ENABLE_NMAP=false \
    ENABLE_CLAMSCAN=false \
    ENABLE_PHISHING_ML=false \
    ENABLE_NETWORK_ML=false \
    ENABLE_METASPLOIT=false \
    MAX_FILE_MB=100

# Initialize the database schema on first run, then start the server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/server.js"]

EXPOSE 5001
