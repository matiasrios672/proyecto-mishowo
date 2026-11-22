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
- Tabla `jobs` (cola en Postgres, sin Redis). El resto del esquema llega en la Épica 2.
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
