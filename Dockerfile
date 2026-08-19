# ---- Stage 1 : build du frontend Vite -------------------------------------
FROM node:20-slim AS frontend

WORKDIR /build/frontend

# Les manifestes d'abord : cette couche reste en cache tant que les
# dépendances ne changent pas.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build          # -> /build/frontend/dist

# ---- Stage 2 : le serveur FastAPI -----------------------------------------
FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/

# `static_files.py` remonte au repo root depuis backend/src/api/ (parents[3]),
# donc l'image doit reproduire l'arborescence du repo : /app/backend et
# /app/frontend/dist. Le dist vient du stage Node, jamais du disque local.
COPY --from=frontend /build/frontend/dist frontend/dist

# Render injecte $PORT ; on garde 8000 par défaut pour un `docker run` nu.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000}"]
