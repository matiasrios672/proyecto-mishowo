# PLAN — MiShowo MVP

## Visión y alcance
Que un usuario nuevo, desde el celular, llegue de la landing a tener `slug.mishowo.com` publicado, con pedidos que llegan por WhatsApp y quedan en un panel; y que los dueños de MiShowo administren negocios, pagos manuales y planes desde un admin con 2FA. Ver definición de "terminado" en PROMPT §6.5.

**Arquitectura:** monorepo, `backend/` (Fastify + Drizzle + Postgres) y `frontend/` (Next.js). Ver DECISIONS D-003.

| Entra al MVP | Fase 2 | "Próximamente" (solo stub + badge) |
|---|---|---|
| Épicas 1–14 | Dominio propio de clientes, Google login, Pixel/GA avanzado, mail.com.ar | IA (crear con idea, catálogo desde fotos, posteos IG, quitar fondo), cobros online, envíos |

Criterio general de aceptación por tarea: typecheck + lint + tests verdes; para UI, Playwright con screenshots 390px y 1440px revisados.

---

## Épica 1 — Setup, Docker y design system
- [x] 1.1 Crear estructura `backend/` y `frontend/`, `.gitignore`, `git init`, `.editorconfig`. *AC: ambas carpetas con package.json y TS compilando.*
- [x] 1.2 Backend base: Fastify, config por env (Zod), `GET /api/health` (app + DB), logger. *AC: health responde 200 con DB arriba, 503 sin DB.*
- [x] 1.3 Drizzle + conexión Postgres + migraciones automáticas al iniciar. *AC: migración inicial corre en contenedor limpio.*
- [ ] 1.4 Frontend base: Next.js standalone, Tailwind, shadcn/ui, fuentes. *AC: página de inicio renderiza en dev y build.*
- [ ] 1.5 Design system: tokens, tipografía, 9+ temas de color, componentes base, wordmark `MiShowo` en un solo componente. *AC: página `/_design` con todos los componentes, AA de contraste.*
- [ ] 1.6 `Dockerfile` backend y frontend (multi-stage, no root, HEALTHCHECK, <300 MB), `.dockerignore`. *AC: ambas imágenes buildean y arrancan.*
- [ ] 1.7 `docker-compose.yml` dev (frontend + backend + Postgres + Mailpit) y `.env.example`. *AC: `docker compose up` deja todo sano.*
- [ ] 1.8 Vitest en ambos, Playwright en frontend, ESLint/Prettier, scripts npm. *AC: un test de ejemplo pasa en cada uno.*
- [ ] 1.9 `docs/ARCHITECTURE.md` inicial y CLAUDE.md con comandos reales. *AC: comandos documentados funcionan.*
- [ ] 1.10 GitHub Actions opcional (lint, typecheck, test, build de imágenes).

## Épica 2 — Modelo de datos multi-tenant
- [ ] 2.1 Esquema: users, sessions, businesses (slug único), memberships, categories, products, product_options, media, orders, order_items, plans, subscriptions, payments, audit_log, jobs.
- [ ] 2.2 Helper de acceso por tenant (todas las queries filtran por `business_id`) + tests de aislamiento. *AC: test que prueba que A no lee datos de B.*
- [ ] 2.3 Slugs: validación, reservados, unicidad. *AC: `admin`, `www`, `api` rechazados.*
- [ ] 2.4 Seed de rubros, planes (`config/plans.ts` como defaults) y datos demo.
- [ ] 2.5 Resolución de tenant por `Host`: endpoint público `GET /public/sites/:slug` + middleware Next.js. *AC: `demo.localhost` muestra el negocio demo.*

## Épica 3 — Onboarding por rubro
- [ ] 3.1 Contenido de ejemplo realista (rotisería, ropa, muebles/deco, eventos/alquileres, gimnasio, oficios, belleza, salud, otro rubro productos/servicios), sin lorem ipsum.
- [ ] 3.2 Pantalla "¿De qué es tu negocio?" con tarjetas de rubro + "Otro rubro" + "Contame tu idea" con badge Próximamente.
- [ ] 3.3 Borrador en localStorage y badge "Ejemplo" en contenido sin reemplazar.
- [ ] 3.4 Stub `backend/src/lib/ai/` (interfaz provider vacía, sin llamadas).

## Épica 4 — Editor con preview en vivo
- [ ] 4.1 Layout editor: formulario + preview (toggle celular/compu, pantalla completa); en móvil botón flotante "Ver cómo queda".
- [ ] 4.2 Pestaña Negocio (datos, múltiples WhatsApp con rol, Instagram, zona de entrega texto).
- [ ] 4.3 Horarios estructurados por día + "Abierto ahora / Cerrado".
- [ ] 4.4 Ubicación con mapa embebido (OpenStreetMap).
- [ ] 4.5 Pestaña Textos.
- [ ] 4.6 Pestaña Fotos (portada, límites).
- [ ] 4.7 Pestaña Productos: CRUD, categorías, orden drag & drop, duplicar, búsqueda.
- [ ] 4.8 Variantes en 2 ejes (talle × color), precio tachado/oferta, stock numérico opcional.
- [ ] 4.9 Carga masiva: CSV y "pegar lista".
- [ ] 4.10 Pestaña Diseño: 4 layouts (Vidriera, Mostrador, Grilla, Servicios), 9+ temas, color de marca + extracción del logo con canvas, 3–4 pares tipográficos, forma de botones, "Comparar diseños".
- [ ] 4.11 Autoguardado con indicador, deshacer/rehacer.
- [ ] 4.12 Pestaña Pedidos/Turnos (config) y SEO y compartir (base).
- [ ] 4.13 Checklist de publicación + score de calidad.

## Épica 5 — Página pública, carrito y pedido por WhatsApp
- [ ] 5.1 Render SSR de los 4 layouts con temas y tipografías.
- [ ] 5.2 Cinta de aviso, menú de anclas, buscador/filtros de catálogo.
- [ ] 5.3 Carrito (drawer "Tu pedido"), variantes, cantidades, fecha de evento opcional.
- [ ] 5.4 Mensaje de WhatsApp armado con total + `POST /public/orders` que registra el pedido. *AC: abre wa.me con texto correcto y el pedido queda en DB.*
- [ ] 5.5 Footer con badge "Hecho con MiShowo" según plan, botón Denunciar, página "temporalmente no disponible".
- [ ] 5.6 Performance: Lighthouse mobile ≥ 90.

## Épica 6 — Auth, guardado y fotos
- [ ] 6.1 Registro/login email+contraseña (argon2), verificación de email, reset.
- [ ] 6.2 Magic link por SMTP (Mailpit en dev).
- [ ] 6.3 Sesiones con cookie httpOnly, CORS, CSRF, rate limiting.
- [ ] 6.4 Migración del borrador local al crear cuenta.
- [ ] 6.5 `StorageProvider` (disco) + upload validado (tipo real, tamaño por plan) + sharp a WebP multi-tamaño, nombres con hash.
- [ ] 6.6 Video MP4/MOV/WebM con límite por plan.

## Épica 7 — Publicación, slug y planes con cobro manual
- [ ] 7.1 Elegir y reservar slug, publicar/despublicar.
- [ ] 7.2 Límites por plan aplicados en backend (productos, fotos, WhatsApp).
- [ ] 7.3 Pantalla de planes, datos de pago configurables, "Ya pagué" con comprobante.
- [ ] 7.4 Cron `expire-plans` (degrada a Gratis) y recordatorios previos.

## Épica 8 — Panel de administración v1
- [ ] 8.1 Layout `/admin`, login separado, roles Owner/Admin/Soporte.
- [ ] 8.2 2FA TOTP obligatorio, sesiones cortas, IPs permitidas opcional.
- [ ] 8.3 Log de auditoría inmutable (antes/después).
- [ ] 8.4 Dashboard: KPIs, gráficos, embudo de onboarding, alertas.
- [ ] 8.5 Negocios: tabla con filtros, ficha, acciones (impersonar con banner, suspender, soft delete 30 días, transferir, destacar).
- [ ] 8.6 Usuarios: lista, ficha, acciones, exportar/eliminar datos (Ley 25.326).
- [ ] 8.7 Bandeja de pagos: confirmar/rechazar, registrar pago manual, vencimientos, recordatorios, regalar días, reporte CSV.

## Épica 9 — Panel de pedidos del negocio
- [ ] 9.1 Lista y detalle de pedidos con estados (nuevo, confirmado, listo, entregado, cancelado).
- [ ] 9.2 Notificación por email al negocio y exportación CSV.

## Épica 10 — Landing, legales y "Próximamente"
- [ ] 10.1 Landing: hero, demo interactiva, ejemplos por rubro navegables, planes, testimonios placeholder, FAQ, sección Próximamente.
- [ ] 10.2 Centro de ayuda y blog (MDX) con 3 artículos semilla.
- [ ] 10.3 Referidos, WhatsApp de soporte visible.
- [ ] 10.4 Legales: términos, privacidad, cancelación, botón de arrepentimiento.

## Épica 11 — Estadísticas, SEO y QR
- [ ] 11.1 Analítica propia liviana (visitas, productos vistos, clics WhatsApp, origen, UTM).
- [ ] 11.2 Vista de estadísticas por plan.
- [ ] 11.3 SEO: metadatos, OG image por negocio, schema.org, sitemap por subdominio, robots.
- [ ] 11.4 QR descargable PNG/PDF.
- [ ] 11.5 Reseñas moderadas; Pixel Meta / GA opcionales (plan pago).

## Épica 12 — Cupones y turnos
- [ ] 12.1 Cupones (% o monto, mínimo) reflejados en el mensaje de WhatsApp.
- [ ] 12.2 Turnos: disponibilidad, duración, bloqueo de fechas, solicitud por WhatsApp + panel.

## Épica 13 — Panel de administración v2
- [ ] 13.1 Catálogo editable: rubros/plantillas, temas, tipografías, slugs reservados, planes y límites.
- [ ] 13.2 Mini CMS: landing, blog/ayuda, anuncios, plantillas de email.
- [ ] 13.3 Moderación y soporte: reportes, palabras clave, notas y etiquetas, WhatsApp rápido.
- [ ] 13.4 Sistema: salud, backups, cron, errores, modo mantenimiento.
- [ ] 13.5 Configuración general (Owner): SMTP, admins, feature flags.

## Épica 14 — Deploy en Coolify
- [ ] 14.1 `docker-compose.prod.yml` de referencia y recomendación (Dockerfile por app vs Compose).
- [ ] 14.2 `scripts/cron.js`, `scripts/backup-uploads.sh`.
- [ ] 14.3 `DEPLOY.md`: Cloudflare, DonWeb, token, resolver wildcard, proyecto/Postgres/apps en Coolify, dominios (incluido `api.`), volumen, scheduled tasks, backups, rollback, límites de memoria.
- [ ] 14.4 Verificación final con subdominio de prueba y Lighthouse.
