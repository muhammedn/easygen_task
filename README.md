# Full Stack Auth Task

NestJS + React authentication module with MongoDB, JWT httpOnly cookies, Swagger, and tests.

## Run with Docker

Prerequisites: Docker Desktop (Compose v2).

```bash
# optional: set a real JWT secret
cp .env.example .env

docker compose up --build
```

| URL | What |
| --- | --- |
| http://localhost:8080 | App (signup / signin / home) |
| http://localhost:8080/api/health | API via nginx proxy |
| http://localhost:3000/docs | Swagger UI |

Stop and remove containers (keep the Mongo volume):

```bash
docker compose down
```

Reset database volume as well:

```bash
docker compose down -v
```

The SPA and API share one origin through nginx (`/api` → NestJS), so the `SameSite=Strict` auth cookie works in the browser.
