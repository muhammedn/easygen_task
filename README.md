# Full Stack Auth Task

NestJS + React authentication module with MongoDB, JWT httpOnly cookies, Swagger, and tests.

## Run with Docker

Prerequisites: Docker Desktop (Compose v2).

```bash
# required: copy and set JWT_SECRET (compose fails without it)
cp .env.example .env

docker compose up --build
```

| URL | What |
| --- | --- |
| http://localhost:8080 | App (signup / signin / home) |
| http://localhost:8080/api/health | API via nginx proxy |

Swagger is disabled when `NODE_ENV=production` (Docker). Use local API mode below for `/docs`.

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

### One command

```bash
# Git Bash / WSL / macOS / Linux
bash scripts/dev.sh
```

Copies missing `.env` files from `.env.example` and runs `npm install` when `node_modules` is absent (first run is slower). Then starts Mongo (`docker compose up mongo -d`), Nest, and Vite. Ctrl+C stops the API and SPA; Mongo keeps running (set `STOP_MONGO=1` to stop it too). On Windows Git Bash/WSL the script prefers `docker.exe` (Docker Desktop).

| URL | What |
| --- | --- |
| http://localhost:5173 | App (Vite) |
| http://localhost:3000 | API |
| http://localhost:3000/docs | Swagger UI |

### Manual

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

Useful scripts: `npm run test` / `npm run test:e2e` / `npm run lint` / `npm run format:check` in `backend/`; `npm run test` / `npm run lint` / `npm run build` in `frontend/`. CI runs backend and frontend workflows on push/PR.

## Project structure

```text
easygen_task/
├── backend/src/
│   ├── auth/          # signup/signin/refresh/logout/me, cookies, JWT, refresh sessions
│   ├── users/         # User schema + UsersService
│   ├── config/        # Joi env validation + configuration factory
│   ├── common/        # validation constants, exception filter, logger
│   └── health/
├── frontend/src/
│   ├── features/auth/ # API client, schemas, AuthContext
│   ├── pages/         # SignUp / SignIn / Home
│   ├── components/    # AuthShell, ProtectedRoute, shadcn ui
│   └── lib/           # axios + refresh interceptor
├── docker-compose.yml
├── scripts/dev.sh     # one-command local: mongo + api + spa
└── .github/workflows/ # backend-ci, frontend-ci
```

## Database schema

### `users`

| Field | Type | Notes |
| --- | --- | --- |
| `email` | string | Unique, lowercase, indexed |
| `name` | string | Trimmed |
| `passwordHash` | string | bcrypt; excluded from queries by default (`select: false`) |
| `tokenVersion` | number | Default `0`; bumped on logout / refresh-family burn |
| `failedLoginAttempts` | number | Default `0` |
| `lockUntil` | Date \| null | Account lockout until this time |
| `createdAt` / `updatedAt` | Date | Mongoose timestamps |

### `refresh_sessions`

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | ObjectId | Ref to User; indexed |
| `tokenHash` | string | Unique SHA-256 of the opaque refresh token |
| `familyId` | string | Indexed; shared across rotations for one login chain |
| `expiresAt` | Date | TTL index (`expireAfterSeconds: 0`) |
| `revokedAt` | Date \| null | Set when rotated or revoked |
| `createdAt` / `updatedAt` | Date | Mongoose timestamps |

Raw passwords and raw refresh tokens are never stored.

## API responses

Tokens are never returned in JSON. Successful auth responses set httpOnly cookies (`access_token`, `refresh_token`); see [Session model](#session-model).

| Endpoint | Status | Body / cookies |
| --- | --- | --- |
| `POST /auth/signup` | 201 | `{ "user": { "id", "email", "name" } }` + Set-Cookie `access_token`, `refresh_token` |
| `POST /auth/signin` | 200 | Same as signup |
| `POST /auth/refresh` | 200 | Same user envelope; rotates both cookies |
| `GET /auth/me` | 200 | `{ "user": { "id", "email", "name" } }` |
| `POST /auth/logout` | 204 | Empty body; clears both cookies |
| `GET /health` | 200 | `{ "status", "timestamp", "uptime" }` |

Example success body:

```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "jane@example.com",
    "name": "Jane Doe"
  }
}
```

Error envelope (all failed requests):

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized",
  "timestamp": "2026-09-17T00:00:00.000Z",
  "path": "/auth/signin"
}
```

Common statuses: `400` validation, `401` auth, `409` email already in use, `429` lockout or rate limit.

## Session model

- **Access token**: short-lived JWT in an `access_token` httpOnly cookie (default **15 minutes**, `JWT_EXPIRES_IN`). Never returned in JSON.
- **Refresh token**: opaque random value in a `refresh_token` httpOnly cookie scoped to `/auth/refresh` (default **7 days**, `REFRESH_TOKEN_EXPIRES_IN`). Stored hashed (SHA-256) in Mongo with a session family id.
- **Rotation**: `POST /auth/refresh` atomically claims the presented session and issues a new refresh token in the same family, plus a new access token.
- **Reuse detection**: presenting an already-rotated refresh token within a short grace window returns 401 without burning the family (concurrent tabs). Outside that window the whole family is revoked and `tokenVersion` is bumped.
- **Logout**: bumps `tokenVersion`, deletes all refresh sessions for the user, clears both cookies (logout everywhere).

Behind nginx the refresh cookie path is rewritten to `/api/auth/refresh` so the browser still sends it.

## Security notes / threat model

- JWT access token is cookie-only (`httpOnly`, `SameSite=Strict`); it is never returned in JSON bodies
- CSRF mitigation for this deployment relies on **same-origin** serving (nginx proxies `/api`) plus `SameSite=Strict`. If the API is ever hosted on a different site than the SPA, add a CSRF token or custom-header check on cookie-authenticated POSTs (`/auth/refresh`, `/auth/logout`)
- Account lockout after 5 failed sign-ins (15 minutes) returns **429** for locked accounts and **401** for unknown emails — a small account-enumeration signal accepted for this demo; a stricter design would always return 401 with identical timing
- Logout bumps `tokenVersion` so existing access cookies stop working
- Per-IP rate limiting is in-memory (fine for a single API instance; use a Redis store for multi-instance)
- Mongo requires authentication inside the compose network
- Production Helmet uses default CSP; Swagger (which needs inline scripts) is disabled in production
