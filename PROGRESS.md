# PROGRESS — MiShowo (bitácora, lo más nuevo arriba)

## 2026-11-22 — Épica 3 COMPLETA
- 3.1 10 plantillas por rubro con contenido argentino (GET /public/templates). 3.2 /crear con selector y "Contame tu idea" (Próximamente). 3.3 borrador en localStorage + badges Ejemplo. 3.4 stub de IA sin llamadas externas. Además: GET /public/plans lee precios de la DB (D-007, los edita el dueño desde el admin); CORS acepta varios orígenes.
- Tests: backend 28, frontend 22 unit + 8 e2e. Pendiente: review independiente de épicas 1-3.

## 2026-11-22 — Épica 2 COMPLETA
- 2.1 esquema multi-tenant (users, sessions, businesses, categories, products, options, media, orders, plans, payments, audit_log). 2.2 `tenantScope` + tests de aislamiento contra Postgres real (verificado por mutación: rompiendo el filtro el test falla). 2.3 slugs con reservados/prohibidos. 2.4 planes (placeholders de precio) + seed + negocio demo (`SEED_DEMO=1 npm run db:seed`). 2.5 `GET /public/sites/:slug` + `proxy.ts` + `/sites/[slug]`; probado de punta a punta con Host de subdominio.
- Tests: backend 20, frontend 17. D-005 (404 con status 200) y D-006 (tamaño de imágenes) registradas.
- Falta: review independiente de las épicas 1 y 2.

## 2026-11-22 — Épica 1 COMPLETA
- 1.6/1.7/1.9/1.10: Dockerfiles (usuario node, HEALTHCHECK), compose con db+mailpit+backend+frontend sanos, .env.example, ARCHITECTURE.md, CI de GitHub. Imágenes ~310/350 MB sin comprimir (objetivo <300 no alcanzable: la base alpine pesa ~240 MB).
- Falta: review independiente de la épica.
- 1.4/1.5/1.8: shadcn/ui, 9 temas con contraste AA testeado, 4 pares tipográficos, Wordmark, /design-system, Vitest + Playwright (390/1440px). Next 16: middleware se llama `proxy.ts`; next/font exige opciones literales (sin spread).
- 1.1 estructura backend/frontend + git init. 1.2 backend base (config Zod, /api/health, tests). Frontend scaffold Next.js creado.
- 1.3 Drizzle + Postgres (Docker) + migración inicial (tabla jobs). Health chequea la DB real; bug de pg pool sin handler de error corregido (tumbaba el proceso al caerse la DB). ORM confirmado: Drizzle (D-004).

## 2026-11-22 — Planificación (paso 6.1)
- Leída la especificación `PROMPT_MiShowo_ClaudeCode.md`.
- Creados `PLAN.md`, `DECISIONS.md`, `PROGRESS.md`, `CLAUDE.md`.
- Decisión D-003: monorepo con `backend/` y `frontend/` separados.
- **Estado:** OK recibido, desarrollo local (sin deploy por ahora).
