#!/usr/bin/env bash
# Start local stack: Compose Mongo + Nest API + Vite SPA.
# Usage (from repo root): bash scripts/dev.sh
# Windows: run via Git Bash or WSL.
# Ctrl+C stops API and SPA; Mongo keeps running unless STOP_MONGO=1.
#
# Bootstrap (only when needed):
#   - copies .env from .env.example if missing
#   - npm install if node_modules is missing

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Prefer Docker Desktop's CLI on Windows/Git Bash (avoids WSL unix socket docker).
resolve_docker() {
  if command -v docker.exe >/dev/null 2>&1; then
    echo "docker.exe"
    return 0
  fi
  if command -v docker >/dev/null 2>&1; then
    echo "docker"
    return 0
  fi
  return 1
}

DOCKER="$(resolve_docker)" || {
  echo "error: docker is required (used for Mongo)" >&2
  exit 1
}

ensure_env() {
  local dir="$1"
  if [[ -f "${dir}/.env" ]]; then
    return 0
  fi
  if [[ ! -f "${dir}/.env.example" ]]; then
    echo "error: ${dir}/.env.example missing" >&2
    exit 1
  fi
  echo "Creating ${dir}/.env from .env.example..."
  cp "${dir}/.env.example" "${dir}/.env"
}

ensure_deps() {
  local dir="$1"
  if [[ -d "${dir}/node_modules" ]]; then
    return 0
  fi
  echo "Installing ${dir} dependencies..."
  (cd "${dir}" && npm install)
}

ensure_env backend
ensure_env frontend
ensure_deps backend
ensure_deps frontend

API_PID=""
WEB_PID=""

cleanup() {
  echo ""
  echo "Stopping API and SPA..."
  if [[ -n "${API_PID}" ]] && kill -0 "${API_PID}" 2>/dev/null; then
    kill "${API_PID}" 2>/dev/null || true
    wait "${API_PID}" 2>/dev/null || true
  fi
  if [[ -n "${WEB_PID}" ]] && kill -0 "${WEB_PID}" 2>/dev/null; then
    kill "${WEB_PID}" 2>/dev/null || true
    wait "${WEB_PID}" 2>/dev/null || true
  fi
  if [[ "${STOP_MONGO:-}" == "1" ]]; then
    echo "Stopping Mongo (STOP_MONGO=1)..."
    "$DOCKER" compose stop mongo >/dev/null 2>&1 || true
  else
    echo "Mongo left running (set STOP_MONGO=1 to stop it)."
  fi
}

trap cleanup EXIT INT TERM

echo "Starting Mongo..."
"$DOCKER" compose up mongo -d

echo "Starting API (backend)..."
(cd backend && npm run start:dev) &
API_PID=$!

echo "Starting SPA (frontend)..."
(cd frontend && npm run dev) &
WEB_PID=$!

echo ""
echo "Local stack running:"
echo "  App    http://localhost:5173"
echo "  API    http://localhost:3000"
echo "  Docs   http://localhost:3000/docs"
echo "Ctrl+C to stop API and SPA."
echo ""

wait
