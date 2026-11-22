# DECISIONS — MiShowo

Formato: ID · fecha · decisión · motivo · consecuencias. Las más nuevas arriba.

## D-003 · 2026-11-22 · Repo monorepo con `backend/` y `frontend/` separados
- **Decisión:** dos aplicaciones independientes en carpetas distintas, cada una con su `package.json`, `Dockerfile` y tests.
  - `backend/`: API REST en **Node + TypeScript + Fastify**, **Drizzle ORM** + PostgreSQL, Zod, Auth propia (sesiones con cookie httpOnly), sharp, nodemailer, cron scripts. Puerto 4000.
  - `frontend/`: **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**, `output: "standalone"`. SSR/SSG de páginas públicas, editor, panel de negocio y `/admin`. Puerto 3000. Solo habla con el backend por HTTP (`API_URL`).
- **Motivo:** pedido explícito del dueño. Además deja listo escalar o desplegar cada parte por separado.
- **Cambios respecto del PROMPT original (§4.1):**
  - Auth.js se reemplaza por auth en el backend (Auth.js está pensado para vivir dentro de Next). Se mantiene email+contraseña, magic link y 2FA TOTP para admin.
  - Prisma/Drizzle → Drizzle (más liviano en RAM, sin binario de motor).
  - Uploads: el backend los guarda en el volumen y los sirve en `/uploads/*` (vía `StorageProvider`).
- **Consecuencias:**
  - Dos contenedores en Coolify (frontend y backend) + Postgres. Más RAM que un solo proceso: límites bajos recomendados (≈256 MB backend, ≈384 MB frontend), a documentar en `DEPLOY.md`.
  - Dominios: `mishowo.com`, `www`, `admin` y `*.mishowo.com` → frontend; `api.mishowo.com` → backend.
  - Cookie de sesión con `Domain=.mishowo.com`, `SameSite=Lax`, `Secure`, y CORS restringido con credentials. Como los subdominios de negocios comparten el dominio, el contenido de usuario se renderiza siempre escapado y se aplica CSP; las cookies de admin usan nombre y path aparte.
  - Resolución de tenant: el middleware de Next.js lee `Host` y pide el negocio al backend (`GET /public/sites/:slug`), con cache corto.
  - Tipos compartidos: carpeta `packages/shared` NO en MVP; el frontend genera tipos desde el esquema OpenAPI del backend (Fastify + Zod → OpenAPI). Si molesta, se reevalúa.
  - `docker-compose.yml` en la raíz levanta frontend + backend + Postgres + Mailpit.

## D-002 · 2026-11-22 · Cola de trabajos en Postgres, sin Redis
- Según PROMPT §4.1. Tabla `jobs` + scripts de cron ejecutados por Scheduled Tasks de Coolify.

## D-001 · 2026-11-22 · Nombre de la especificación
- El archivo se llama `PROMPT_MiShowo_ClaudeCode.md` (no `PROMPT.md`). `CLAUDE.md` apunta a ese nombre.

## D-004 · 2026-11-22 · ORM: Drizzle; backend se queda en Node/TypeScript
- Elegido por menor consumo de RAM y consultas siempre parametrizadas. Se evaluó Prisma (más veterano, más pesado) y Laravel/PHP (sin ventaja de escala; sumaba un segundo lenguaje y más RAM). Decisión confirmada por el dueño.
