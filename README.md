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

Set `JWT_SECRET`, `MONGO_USER`, and `MONGO_PASSWORD` in `.env` for anything beyond a local demo. Mongo root credentials are only applied when the data volume is empty; use `docker compose down -v` if you previously ran the stack without auth.

Stop and remove containers (keep the Mongo volume):

```bash
docker compose down
```

Reset database volume as well:

```bash
docker compose down -v
```

The SPA and API share one origin through nginx (`/api` → NestJS), so the `SameSite=Strict` auth cookie works in the browser. The API and Mongo ports are not published to the host.

## Security notes

- JWT is cookie-only (`httpOnly`, `SameSite=Strict`); it is never returned in JSON bodies
- Account lockout after 5 failed sign-ins (15 minutes); logout bumps `tokenVersion` so existing cookies stop working
- Per-IP rate limiting is in-memory (fine for a single API instance; use a Redis store for multi-instance)
- Mongo requires authentication inside the compose network
