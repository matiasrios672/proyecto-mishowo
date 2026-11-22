# MiShowo

SaaS argentino para que emprendedores creen su página web desde el celular: catálogo/servicios, pedidos por WhatsApp, link para Instagram. Cada negocio vive en `slug.mishowo.com`.
Especificación completa: `PROMPT_MiShowo_ClaudeCode.md` (no copiarla acá). Plan: `PLAN.md`. Bitácora: `PROGRESS.md`. Decisiones: `DECISIONS.md`.

## Stack
- `backend/`: Node + TypeScript + Fastify, Drizzle ORM, PostgreSQL, Zod, sharp, nodemailer. API REST en :4000.
- `frontend/`: Next.js App Router + TypeScript + Tailwind + shadcn/ui (standalone). :3000. Solo consume la API del backend.
- Docker + Coolify (Traefik, SSL wildcard con Cloudflare DNS challenge). Sin Nginx/PM2/systemd/Redis.

## Comandos (se completan en Épica 1)
- Dev: `docker compose up --build` (frontend :3000, backend :4000, mailpit :8025)
- Backend: `cd backend && npm run dev | test | lint | typecheck | db:generate | db:migrate | build` (Postgres: `docker compose up -d db`)
- Frontend: `cd frontend && npm run dev | test | e2e | lint | typecheck | build`. Next 16: usar `proxy.ts` (no middleware); leer `node_modules/next/dist/docs/` ante dudas.
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
- Fase: Épicas 1-13 completas salvo detalles (ver PLAN.md: reseñas/píxeles, referidos, embudo de onboarding, edición de rubros/temas desde el admin). Falta: deploy (14, fuera de alcance por ahora).
- Próximo paso: revisión independiente (/code-review), cargar datos reales de cobro y revisión legal, luego deploy. Panel del cliente por módulos en `/panel/*` (editor único en `(workspace)/layout`); primer Owner: `npm run admin:promote -- email owner` (2FA exige ADMIN_SECRET_KEY); fotos exigen API_PUBLIC_URL.
