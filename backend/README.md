# Backend

NestJS API for the auth task.

## Setup

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Start MongoDB from the repo root:

```bash
docker compose up -d mongo
```

3. Install and run:

```bash
npm install
npm run start:dev
```

Health check: `GET http://localhost:3000/health`
