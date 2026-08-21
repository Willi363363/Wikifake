# ---- Stage 1: build the Vite frontend -------------------------------------
FROM node:20-slim AS frontend

WORKDIR /build/frontend

# Manifests first: this layer stays cached as long as the dependencies do
# not change.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build          # -> /build/frontend/dist

# ---- Stage 2: the FastAPI server ------------------------------------------
FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/

# `static_files.py` walks up to the repo root from backend/src/api/
# (parents[3]), so the image must reproduce the repository layout:
# /app/backend and /app/frontend/dist. The dist comes from the Node stage,
# never from the local disk.
COPY --from=frontend /build/frontend/dist frontend/dist

# Render injects $PORT; 8000 stays the default for a bare `docker run`.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000}"]
