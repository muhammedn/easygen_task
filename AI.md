# AI Assistance

This project was built with AI as a force multiplier: scaffolding and boilerplate first, then human review, correction, and ownership of every decision.

## Workflow

Work was split into small, reviewable steps:

1. Monorepo + NestJS backend skeleton (config, Mongoose, Helmet, CORS, `/health`, request logging)
2. Users + Auth modules: signup/signin/`/auth/me`, validation, JWT, throttling, global exception filter
3. Swagger at `/docs` + AuthService unit tests + e2e suite with `mongodb-memory-server`
4. Frontend (Vite + React 18 + shadcn/ui) plus httpOnly cookie session on the backend
5. Dockerize: multi-stage API + nginx SPA images, `docker compose up` for mongo/api/web

Between steps: run the app, exercise endpoints, fix what AI got wrong, then continue.

## What AI generated vs. what was hand-adjusted

**Mostly generated as-is**

- NestJS module/controller/service layout for `users` and `auth`
- `class-validator` DTOs, bcrypt hashing (cost 12), Passport JWT strategy/guard
- Global `HttpExceptionFilter` shape and Throttler wiring
- Shared password/name validation constants for FE/BE alignment later
- Swagger decorators on DTOs/controllers, e2e skeleton with memory server, AuthService unit tests
- Vite/React scaffold, shadcn components, SignUp/SignIn/Home page layout
- Multi-stage Dockerfiles, nginx SPA config, compose service wiring

**Hand-adjusted or forced by review**

- ESM imports for CJS packages (`joi`, `passport-jwt`, `bcrypt`): default import, not `import * as`
- Duplicate-key detection without depending on a direct `mongodb` import (duck-type `code === 11000`)
- Rate limiting on signup/signin (~10 req/min): I suggested adding throttling as a production-readiness
- JWT cookie extractor ordered before bearer; session restore always via `GET /auth/me`; 401 event bus so Axios stays router-agnostic
- UX polish accepted from AI suggestions: redirect-after-login, public-only routes, password hint, pending submit state, friendly 429/network errors
- HttpOnly SameSite Secure cookie instead of localStorage — AI first suggested storing the JWT in localStorage. I asked for cookies with httpOnly, SameSite=Strict, and Secure in production instead. That keeps the token out of JavaScript (XSS) and blocks cross-site cookie sends (CSRF mitigation for this API). Frontend never persists accessToken; it relies on withCredentials and session restore via /auth/me
- Docker: `node:22-bookworm-slim` instead of alpine so `bcrypt` uses prebuilt glibc binaries; nginx `/api` proxy so the cookie stays same-origin; `COOKIE_SECURE` and `TRUST_PROXY` as explicit env flags; `npm ci --omit=dev` so `mongodb-memory-server` never runs in the image

## Prompts / approaches that worked well

- Scoped prompts (“skeleton only, no auth yet”) so output stayed reviewable
- Explicit security requirements in the prompt: generic `401 Invalid credentials`, `409` on duplicate email, `passwordHash` never returned, throttle auth routes
- Asking for a shared validation constants file early so FE and BE rules do not drift later
- Asking AI for UX improvements before implementing the frontend, then picking what to keep