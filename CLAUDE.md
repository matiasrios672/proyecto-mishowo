# MiShowo

SaaS argentino para que emprendedores creen su página web desde el celular: catálogo/servicios, pedidos por WhatsApp, link para Instagram. Cada negocio vive en `slug.mishowo.com`.
Especificación completa: `PROMPT_MiShowo_ClaudeCode.md` (no copiarla acá). Plan: `PLAN.md`. Bitácora: `PROGRESS.md`. Decisiones: `DECISIONS.md`.

## Stack
- `backend/`: Node + TypeScript + Fastify, Drizzle ORM, PostgreSQL, Zod, sharp, nodemailer. API REST en :4000.
- `frontend/`: Next.js App Router + TypeScript + Tailwind + shadcn/ui (standalone). :3000. Solo consume la API del backend.
- Docker + Coolify (Traefik, SSL wildcard con Cloudflare DNS challenge). Sin Nginx/PM2/systemd/Redis.

## Comandos (se completan en Épica 1)
- Dev: `docker compose up`
- Backend: `cd backend && npm run dev | test | lint | typecheck | db:migrate | db:seed | build`
- Frontend: `cd frontend && npm run dev | test | lint | typecheck | build`
- E2E: `cd frontend && npx playwright test`

## Mapa del repo
- `backend/` — API, modelo de datos, auth, uploads, cron scripts.
- `frontend/` — UI: landing, onboarding, editor, páginas públicas de negocios, panel de negocio, `/admin`.
- `docs/` — ARCHITECTURE.md (modelo de datos y flujos; leer solo si la tarea lo toca).
- `scripts/` — backup de uploads y utilidades de deploy.

## Convenciones
- Código, variables y commits en inglés (conventional commits). Producto y docs en español rioplatense (voseo).
- Validación con Zod en cada borde. Cada query del backend filtra por `tenant`/`business_id`.
- Logo en un único componente/asset (`frontend/public/brand/`).

## Reglas duras
- Fuera de alcance: Mercado Pago/pasarelas, envíos, llamadas a IA (solo stub en `backend/src/lib/ai/` y badges "Próximamente").
- Aislamiento estricto por tenant. Nada de copiar textos/diseño/assets de Vitrea.
- Frenar y preguntar: precios finales, datos de cobro, logo, credenciales (Cloudflare, SMTP), decisiones irreversibles.

## Estado actual
- Fase: Épica 1 en curso, desarrollo local.
- Próximo paso: 1.3 (ORM + migraciones), luego 1.4 frontend base y design system.
