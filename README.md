# Full Stack Auth Task

NestJS + React authentication module with MongoDB, JWT httpOnly cookies, Swagger, and tests.

## Run with Docker

Prerequisites: Docker Desktop (Compose v2).

```bash
# optional: set real secrets
cp .env.example .env

docker compose up --build
```

| URL | What |
| --- | --- |
| http://localhost:8080 | App (signup / signin / home) |
| http://localhost:8080/api/health | API via nginx proxy |
| http://localhost:8080/api/docs/ | Swagger UI |

Swagger Try it out prefixes `/api` automatically. Manual curls must use `/api/...` (e.g. `http://localhost:8080/api/health`); a bare `/health` path hits the SPA.

Set `JWT_SECRET`, `MONGO_USER`, and `MONGO_PASSWORD` in `.env` for anything beyond a local demo. Mongo root credentials are only applied when the data volume is empty; use `docker compose down -v` if you previously ran the stack without auth.

Stop and remove containers (keep the Mongo volume):

```bash
docker compose down
```

Reset database volume as well:

```bash
docker compose down -v
```

The SPA and API share one origin through nginx (`/api` → NestJS), so the `SameSite=Strict` auth cookie works in the browser. The API is not published to the host; Mongo is bound to `127.0.0.1:27018` for local tooling only (avoids clashing with a host `mongod` on 27017).

## Local development

Run Mongo via Compose, then the API and SPA with npm (Node 22+).

```bash
# from repo root — Mongo only (auth credentials match backend/.env.example)
docker compose up mongo -d

# API
cd backend
cp .env.example .env
npm install
npm run start:dev

# SPA (second terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

| URL | What |
| --- | --- |
| http://localhost:5173 | App (Vite) |
| http://localhost:3000 | API |
| http://localhost:3000/docs | Swagger UI |

Useful scripts: `npm run test` / `npm run test:e2e` / `npm run lint` in `backend/`.

## Security notes

- JWT is cookie-only (`httpOnly`, `SameSite=Strict`); it is never returned in JSON bodies
- Account lockout after 5 failed sign-ins (15 minutes); logout bumps `tokenVersion` so existing cookies stop working
- Per-IP rate limiting is in-memory (fine for a single API instance; use a Redis store for multi-instance)
- Mongo requires authentication inside the compose network
