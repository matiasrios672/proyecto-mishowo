# Arquitectura de MiShowo

Se lee solo cuando la tarea toca esta parte. Se actualiza junto con los cambios.

## Visión general
```
Navegador ──> frontend (Next.js :3000) ──HTTP──> backend (Fastify :4000) ──> PostgreSQL
                  │ proxy.ts resuelve el negocio por Host         │
                  └── páginas públicas SSR, editor, /admin        └── uploads (volumen), emails (SMTP), cron
```
- `frontend/` nunca toca la base de datos: todo pasa por la API.
- `backend/` es dueño de datos, auth, archivos y tareas programadas.

## Multi-tenant por subdominio
- `slug.mishowo.com` → el `proxy.ts` de Next 16 (antes "middleware") lee el header `Host`, extrae el slug y reescribe a la ruta interna del sitio público.
- Dominios del dueño: `mishowo.com`, `www`, `admin` (panel de administración). `api.mishowo.com` es el backend.
- Slugs reservados: `admin`, `www`, `api`, marcas, palabras ofensivas (editable desde el admin en la Épica 13).
- Todas las queries del backend filtran por `business_id`; hay tests de aislamiento (Épica 2).

## Datos (estado actual)
- Esquema en `backend/src/db/schema.ts`: users, sessions, businesses (slug único, design/settings en jsonb), memberships, categories, products, product_options, media, orders, order_items, plans, subscriptions, payments, audit_log, jobs.
- Toda tabla de un negocio lleva `business_id`. El acceso va por `tenantScope(db, businessId)` (`backend/src/db/tenant.ts`); nunca queries sueltas sobre esas tablas.
- Endpoint público: `GET /public/sites/:slug` (solo publicados; suspendidos devuelven aviso; draft/borrados 404).
- ORM: Drizzle. Migraciones en `backend/drizzle/`, se aplican solas al iniciar el backend (`npm run db:migrate` también).
- Generar migración nueva: editar `backend/src/db/schema.ts` y correr `npm run db:generate`.

## Tema y tipografía
- `frontend/src/lib/themes.ts`: 9 temas, variables CSS aplicadas con `style` en el contenedor de la página; color de marca propio reemplaza el primario y recalcula el color del texto para mantener contraste AA.
- `frontend/src/lib/fonts.ts`: 4 pares tipográficos; una página pública debería aplicar solo el par elegido.
- Marca: un único componente `components/brand/Wordmark.tsx`.

## Imágenes y archivos
- Volumen persistente `/app/uploads` detrás de una interfaz `StorageProvider` (Épica 6), para pasar a S3/R2 sin refactor.

## Convenciones técnicas
- Next 16: `proxy.ts` en vez de `middleware.ts`; `next/font` exige opciones literales.
- Postgres: el pool de `pg` tiene handler de `error`; sin él, una caída de DB tumba el proceso.
- Imágenes Docker: ~310 MB (frontend) y ~350 MB (backend) sin comprimir; la base `node:alpine` pesa ~240 MB.

## Editor y página pública
- `frontend/src/lib/draft.ts`: borrador en localStorage (con normalización de versiones viejas). `draftOps.ts`: operaciones inmutables. `history.ts`: deshacer/rehacer con agrupación de tipeo. `score.ts`: checklist y puntaje. `bulk.ts`, `hours.ts`, `whatsapp.ts`, `color.ts`, `recommend.ts`: lógica pura con tests.
- `components/editor/`: `Editor.tsx` (layout), `useEditor.ts` (estado + autoguardado), `tabs/` (una por pestaña).
- `components/site/SiteView.tsx` dibuja la página desde un `SiteModel` (`lib/site.ts`: `draftToSite` para la vista previa, `publicToSite` para la página pública).
- "Abierto ahora" se calcula en el navegador (`OpenBadge`): la página pública se sirve cacheada.
- El frontend no debe pedir datos a la API durante el build (Docker no tiene backend): usar `await connection()` o `use cache` solo donde corresponda.

## Pedidos (Épica 5)
- Flujo: cliente arma carrito (`lib/cart.ts`, `components/site/cart/`) -> `POST /public/orders` (ids y cantidades) -> el backend recalcula todo y responde con ítems y total -> el cliente abre `wa.me` con el mensaje armado (`lib/orderMessage.ts`) con esos datos.
- `backend/src/routes/orders.ts`: transacción, `pg_advisory_xact_lock` por negocio (numeración), descuento de stock condicional. Rate limit por IP (`ORDERS_PER_MINUTE`).
- Denuncias: `POST /public/reports` -> tabla `reports` (cola de revisión en el admin, Épica 13).
- CORS: `FRONTEND_ORIGIN` (lista) + cualquier subdominio de `ROOT_DOMAIN`.
- Metadata bloqueante para todos (`htmlLimitedBots` en next.config.ts) para que WhatsApp/Instagram muestren la vista previa.
