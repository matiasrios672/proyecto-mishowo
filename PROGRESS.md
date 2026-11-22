# PROGRESS — MiShowo (bitácora, lo más nuevo arriba)

## 2026-11-22 — Panel del cliente por módulos, identidad en login/panel/admin, pedidos opcionales
- **Panel del cliente con barra lateral izquierda** (AppShell compartido con el admin; accesible: salto al contenido, landmarks, aria-current, 44 px, foco visible, menú móvil con Escape). Módulos: Inicio (resumen + checklist con enlaces directos), Catálogo, Pedidos, Cupones, Turnos, Estadísticas, QR, Mi página, Ajustes, Plan. El editor completo y guiado se mantiene para la primera vez y para quien no tiene cuenta (/editor).
- **Un único editor compartido** por Catálogo / Mi página / Ajustes (vive en el layout): al cambiar de módulo no se desmonta. Antes de salir a otras pantallas, una guarda de navegación espera a que se guarde lo último que se tipeó.
- **Login y registro rediseñados** con la identidad de MiShowo (panel de marca, pestañas con flechas, mostrar/ocultar contraseña, campos de 44 px y 16 px). Login: quien ya tiene página va a Inicio; quien no, al editor; el equipo de MiShowo, a /admin; `?next=` siempre gana.
- **Pedidos opcionales** por negocio (`ordersEnabled`): sin carrito, con "Consultar" por WhatsApp; el panel oculta Pedidos y Cupones.
- **Logo propio del negocio** (barra, portada, pie, SEO) y vista previa del editor con logo, portada y fotos reales.
- Cupones, turnos, admin v2 (denuncias, contenido, slugs reservados, estado, mantenimiento).
- Bugs reales atrapados: el editor leía el borrador local en cada render y, al cambiar de módulo, confundía lo que él mismo había guardado con un conflicto ("Ya tenés una página guardada"); Next mantiene montada la pantalla anterior (dos editores a la vez); decisión de sincronización ahora fija al abrir.
- Tests: backend 341, frontend 146 unitarios + 178 e2e.

## 2026-11-22 — Épica 11 (parcial): estadísticas, QR y SEO por negocio
- Analítica propia sin cookies ni IP guardada (visitante = hash diario): visitas únicas por día, vistas de producto, clics a WhatsApp, origen (utm_source/QR, Instagram, Google…). Filtra robots, valida que el producto sea del negocio, límite por IP. Panel /panel/estadisticas (7/30/90 días).
- QR /panel/qr (PNG + imprimir/PDF) con utm_source=qr.
- SEO por negocio: title/description/canonical/OpenGraph/Twitter, JSON-LD LocalBusiness con catálogo (escapado contra inyección de </script>), robots.txt y sitemap.xml propios por subdominio (antes el proxy los salteaba), 404 real si no existe.
- Bugs reales: route handlers prerenderizados sin backend en el build de Docker; el escape de JSON-LD era un no-op (< evaluado como <) — lo atrapó un test.
- Falta de la Épica 11: reseñas, píxel/GA opcional, imagen OG generada para negocios sin fotos.
- Tests: backend 273, frontend 132 unitarios + 158 e2e.

## 2026-11-22 — Épica 6: fotos y videos
- Backend: POST/GET/DELETE /me/media (sharp → WebP 400/800/1600 con srcset, orientación EXIF aplicada, **metadatos y GPS borrados**, límite de píxeles), videos MP4/MOV/WebM detectados por bytes (1 por negocio), límites por plan leídos de la tabla de planes (fotos por producto, MB), hasta 5 fotos de portada, deduplicación por hash (borrar una copia no rompe la otra), servicio público /uploads/media con caché inmutable, nosniff y Range (Safari); solo sirve nombres generados por MiShowo (los comprobantes de pago nunca salen por acá).
- Frontend: pestaña Fotos (portada y por producto, errores claros), fotos en vidriera/grilla y miniaturas en mostrador/servicios, portada con srcset y video de portada.
- Verificado por mutación: sin borrar metadatos, sin el filtro de archivos públicos y sin rechazar documentos fallan tests.
- Tests: backend 260, frontend 124 unitarios + 155 e2e.

## 2026-11-22 — Épicas 7 y 8: interfaz de planes y administración
- Frontend: /panel/plan (elegir plan, datos para transferir con copiar, Ya pagué + comprobante, historial), /planes (enlace corto), /admin con puerta de 2FA (QR para configurarlo), resumen con KPIs y gráfico, pagos (confirmar/rechazar/registrar manual), negocios (lista, ficha y acciones), usuarios, planes y datos de cobro, auditoría y equipo.
- Bugs reales: Suspense en rutas dinámicas (rompía el build de Docker); mensaje de guardado que desaparecía al remontar el formulario.
- e2e: recorrido completo pago → confirmación → plan activo → email → auditoría, 2FA con código incorrecto y sesión nueva, precio editado visible en la landing, ajustes de cobro, Soporte sin acceso a pagos.
- Tests: backend 244; frontend 124 unitarios + 151 e2e.

## 2026-11-22 — Épicas 7 y 8 (backend): cobro manual, admin con 2FA, auditoría y vencimientos
- Backend completo: /me/plan, /me/payments (+comprobante), /admin/* (2FA, dashboard, negocios, usuarios, pagos, planes, ajustes de cobro, administradores, auditoría), jobs de vencimiento y recordatorio, CLI admin:promote. Migración 0007.
- Verificado con mutaciones: sin 2FA fallan 3 tests; sin trigger de auditoría falla el de inmutabilidad; sin lock de activación y sin la condición del pago pendiente fallan los de concurrencia.
- Tests de backend: más de 260 (incluye vectores RFC del TOTP).
- Falta: interfaz de /planes y de /admin (frontend), "ver como el usuario", embudo de onboarding.

## 2026-11-22 — Épica 9: panel de pedidos
- Backend: GET /me/orders (filtro, paginación por cursor), /summary, /orders.csv, /:id y PATCH /:id/status (transiciones, reposición de stock, lock). Aviso por email al dueño. Migración 0006 (order_items.option_id).
- Frontend: /panel/pedidos (filtros con contadores, actualización cada 30 s, acciones por estado, cancelación con confirmación, WhatsApp al cliente, CSV, estados vacíos), PanelShell con guardia de sesión.
- Bugs reales: CORS sin PATCH; búsqueda perdida antes de hidratar (flaky bajo carga).
- Tests: backend 152; frontend 124 unitarios + 145 e2e (3 corridas seguidas sin fallos).

## 2026-11-22 — Épica 7 (parte 1): publicar y límites del plan
- Backend: GET /me/slug, POST /me/business/publish y /unpublish (requisitos, link único y reservado, límite del plan, suspendido), límite del plan también al guardar, aviso de cambio al frontend. API pública oculta productos de ejemplo.
- Frontend: pestaña Publicar real (link con chequeo en vivo, errores explicados, copiar, cambiar link, despublicar), /api/revalidate seguro, proxy con 404 reales.
- Bugs reales: (1) dos personas con el mismo link daban 500 (error de Postgres envuelto en cause); (2) tras despublicar la URL seguía en 200.
- Tests: backend 130; frontend 119 unitarios + 136 e2e.
- Falta de la épica 7: 7.3 planes y pago manual, 7.4 vencimiento automático.

## 2026-11-22 — Épica 10: landing de MiShowo, Remotion, contenido y legales
- Landing con identidad propia, demo interactiva real, video Remotion, ejemplos, beneficios, pasos, planes desde la DB, testimonios de ejemplo, FAQ con JSON-LD, Próximamente. Blog (3), ayuda (6), legales, arrepentimiento + contacto con acuse por email (POST /public/contact, tabla contact_requests), sitemap y robots.
- Rediseño de las páginas de clientes (D-013) cerrado con tests.
- Bugs reales: dos h1 (demo dentro de la landing); desborde horizontal en celular (grilla sin minmax(0,1fr)); contraste del precio en la cinta (opacity); LCP 5 s por demo que dependía de JS + fetch.
- Tests: backend 108; frontend 109 unitarios + 124 e2e.
- Pendiente de 10.3: programa de referidos (necesita el admin, Épica 8).

## 2026-11-22 — Épica 6, tramo B: guardado en la cuenta (6.4)
- Backend: GET/PUT /me/business (documento completo, reconciliación por client_id, versión + lock, validación con límites), migración 0004. Frontend: motor de sincronización con reintentos, migración del borrador al crear la cuenta, avisos de conflicto/sesión vencida/sin conexión, chooser cuando hay versión local y de cuenta distintas, cierre de sesión sin rastro.
- Bugs reales hallados por los e2e: (1) CORS bloqueaba PUT desde el navegador (todo guardado fallaba como sin conexión); (2) elegir la versión de la cuenta abría igual el borrador viejo por el orden de las comprobaciones.
- Mutaciones: sin chequeo de versión fallan 4 tests; sin lock por usuario fallan 2.
- Tests: backend 104, frontend 97 unitarios + 65 e2e.
- Pedido del dueño en curso: rediseñar las páginas públicas de los clientes (animaciones, marketing, compu y celular) antes del tramo C (fotos).

## 2026-11-22 — Épica 6, tramo A: cuentas y sesiones (6.1-6.3)
- Backend: /auth/register, login, logout, me, verify, resend-verification, forgot, reset, magic, magic/consume. argon2id, sesiones hasheadas, tokens de un solo uso hasheados, anti-enumeración, CSRF por Origin, rate limit. Mailer SMTP (Mailpit en dev) con emails en voseo.
- Frontend: /registro, /ingresar (contraseña o enlace), /recuperar, /restablecer, /verificar, /enlace; estado de sesión; editor con "Guardar mi página", cuenta/Salir y aviso de email sin confirmar.
- Verificado con mutaciones: sin chequeo de vencimiento de sesión y sin consumo único de token los tests fallan.
- Tests: backend 73, frontend 82 unitarios + 51 e2e (incluye leer los emails reales desde Mailpit).
- Falta de la épica: 6.4 guardar el negocio en el servidor + migrar el borrador, 6.5/6.6 fotos y videos.

## 2026-11-22 — Épica 5 COMPLETA (página pública, carrito y pedido)
- Backend: POST /public/orders (precios y stock recalculados en el servidor, numeración correlativa con lock por negocio, rate limit), POST /public/reports + tabla reports, CORS para subdominios de negocios (ROOT_DOMAIN).
- Frontend: carrito por negocio (persiste, funciona sin localStorage), selector de opciones, panel "Tu pedido" con nombre/notas/fecha de evento, mensaje de WhatsApp armado con los datos del servidor, plan B sin conexión, buscador del catálogo (sin tildes), botón Denunciar.
- Verificado en la base: pedidos con total correcto (2 x 1.700 + 19.200 = 22.600) y numeración 1, 2.
- Mutación: sin el lock de numeración el test de pedidos simultáneos falla; el de stock sigue protegido por el UPDATE condicional (doble defensa).
- Bugs reales: contraste AA roto en productos agotados (opacity global; ahora color de tema + token danger por tema); metadata en streaming no llegaba a WhatsApp/Instagram (D-009).
- Lighthouse mobile: 98 / 100 / 100 / 100. Tests: backend 46, frontend 77 unitarios + 37 e2e.
- Pendiente: review independiente (épicas 1-5).

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
