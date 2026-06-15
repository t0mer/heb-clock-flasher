# Stage 1: build the React/Vite frontend
# Always run on the build host's native platform — Vite/Rollup have native
# binaries that break under QEMU emulation. The output is pure static assets
# (JS/CSS) so it is identical for all target platforms.
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ ./
RUN npm run build
# Output lands in /app/backend/static (vite outDir)

# Stage 2: Python runtime — embeds the built frontend as static files
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

ARG VERSION=dev
ENV APP_VERSION=${VERSION}

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app/ /app/app/

# Embed the built SPA
COPY --from=frontend /app/backend/static /app/static

# Firmware catalogue is mounted at runtime — do not bake binaries into the image
RUN mkdir -p /app/firmware

# Non-root user
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080
VOLUME ["/app/firmware"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/health || exit 1

ENV FIRMWARE_DIR=/app/firmware \
    STATIC_DIR=/app/static \
    PORT=8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
