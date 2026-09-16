# Frontend

React auth UI for the EasyGen task.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Requires the backend on `VITE_API_URL` (default `http://localhost:3000`).

## Scripts

- `npm run dev` — Vite on port 5173
- `npm run build` — typecheck + production build
- `npm run lint` — oxlint

Auth uses an httpOnly cookie set by the API (`withCredentials`). The app never stores the JWT in `localStorage`.
