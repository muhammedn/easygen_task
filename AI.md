# AI Assistance

This project was built with AI as a force multiplier: scaffolding and boilerplate first, then human review, correction, and ownership of every decision.

## Workflow

Work was split into small, reviewable steps:

1. Monorepo + NestJS backend skeleton (config, Mongoose, Helmet, CORS, `/health`, request logging)
2. Users + Auth modules: signup/signin/`/auth/me`, validation, JWT, throttling, global exception filter
3. Swagger at `/docs` + AuthService unit tests + e2e suite with `mongodb-memory-server`

Between steps: run the app, exercise endpoints, fix what AI got wrong, then continue.

## What AI generated vs. what was hand-adjusted

**Mostly generated as-is**

- NestJS module/controller/service layout for `users` and `auth`
- `class-validator` DTOs, bcrypt hashing (cost 12), Passport JWT strategy/guard
- Global `HttpExceptionFilter` shape and Throttler wiring
- Shared password/name validation constants for FE/BE alignment later
- Swagger decorators on DTOs/controllers, e2e skeleton with memory server, AuthService unit tests

**Hand-adjusted or forced by review**

- ESM imports for CJS packages (`joi`, `passport-jwt`, `bcrypt`): default import, not `import * as`
- Duplicate-key detection without depending on a direct `mongodb` import (duck-type `code === 11000`)
- Rate limiting on signup/signin (~10 req/min): I suggested adding throttling as a production-readiness

## Prompts / approaches that worked well

- Scoped prompts (“skeleton only, no auth yet”) so output stayed reviewable
- Explicit security requirements in the prompt: generic `401 Invalid credentials`, `409` on duplicate email, `passwordHash` never returned, throttle auth routes
- Asking for a shared validation constants file early so FE and BE rules do not drift later
