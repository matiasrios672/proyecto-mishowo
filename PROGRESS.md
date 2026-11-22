# PROGRESS — MiShowo (bitácora, lo más nuevo arriba)

## 2026-11-22 — Épica 4 (editor) casi completa
- Editor real en /editor: 8 pestañas, vista previa en vivo (celular/compu/pantalla completa, botón flotante en móvil), autoguardado con indicador, deshacer/rehacer (botones y Ctrl+Z), checklist y score de calidad, carga masiva (CSV y pegar lista), variantes en 2 ejes, stock, precio tachado, drag & drop, horarios con Abierto/Cerrado, WhatsApp argentino validado, 4 layouts + recomendación, color de marca (incl. extracción del logo con canvas), comparar diseños.
- SiteView es compartido entre vista previa y página pública (se ven idénticas).
- Bugs reales encontrados verificando: (1) el build de Docker fallaba porque /crear pedía datos a la API al compilar -> ahora se piden al atender la visita; (2) desborde horizontal en celular por falta de min-w-0 en la grilla.
- Parcial: mapa embebido (solo link), subida de fotos (Épica 6), cupones/turnos (Épica 12), SEO avanzado (Épica 11).
- Tests: frontend 68 unitarios + 25 e2e; backend 28.

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
