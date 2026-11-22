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

## D-005 · 2026-11-22 · Subdominio inexistente responde 200 (con noindex)
- Con `cacheComponents`, leer `params` obliga a usar `<Suspense>`, y el status HTTP ya se envió cuando corre `notFound()`. Un negocio inexistente muestra la página 404 pero con status 200.
- Mitigación: `robots: noindex` en esos casos. A revisar en la Épica 11 (SEO) si hay forma de devolver 404 real (p. ej. validar el slug en `proxy.ts` contra una lista cacheada).

## D-006 · 2026-11-22 · Imágenes Docker >300 MB
- Frontend ~308 MB y backend ~354 MB sin comprimir. La base `node:alpine` ya pesa ~240 MB. No se persigue el objetivo de 300 MB.

## D-007 · 2026-11-22 · Precios, planes y límites se gestionan desde el admin
- Pedido del dueño. La tabla `plans` es la fuente de verdad; `backend/src/config/plans.ts` solo da valores iniciales del seed (que no pisa ediciones).
- Landing, pantalla de planes y límites del backend leen de la DB (`GET /public/plans`). Nada de precios hardcodeados en el frontend.
- El editor de planes del admin se construye en la Épica 13 (13.1); hasta entonces se editan en la tabla `plans`.

## D-008 · 2026-11-22 · El servidor es la fuente de verdad de precios y stock en los pedidos
- `POST /public/orders` solo acepta ids y cantidades. Precio, disponibilidad y stock se calculan en el backend desde la DB; el total que ve el cliente en el mensaje de WhatsApp es el que devolvió el servidor.
- El stock se descuenta al registrar el pedido (transacción con lock por negocio + `UPDATE ... WHERE stock >= cantidad`). Al cancelar un pedido hay que reponerlo (Épica 9, tarea 9.1).
- Sin conexión, el cliente puede enviar el pedido igual por WhatsApp; en ese caso NO queda registrado en el panel (se avisa en pantalla).

## D-009 · 2026-11-22 · Metadata bloqueante para todos los clientes (`htmlLimitedBots: /.*/`)
- Next 16 manda la metadata en streaming a navegadores y bloqueante solo a una lista de bots (que no incluye WhatsApp, Facebook ni Instagram). Los links de los negocios se comparten justo ahí, así que se sirve bloqueante a todos.
- Medido con Lighthouse mobile sobre la página pública (build de producción en Docker, máquina local): rendimiento 98, accesibilidad 100, buenas prácticas 100, SEO 100. Es una medición de laboratorio; falta repetirla en el VPS real.

## D-010 · 2026-11-22 · Cuentas y sesiones
- Contraseñas con argon2id (`@node-rs/argon2`: binarios precompilados, sin compilar en Alpine). Sesión: token aleatorio de 256 bits en cookie `httpOnly` + `SameSite=Lax` (+ `Secure` y `Domain=.mishowo.com` en producción); en la DB solo su hash. Los tokens de email (verificar, restablecer, enlace mágico) también se guardan hasheados, son de un solo uso (consumo atómico) y el nuevo anula al anterior.
- Anti-enumeración: login, "olvidé mi contraseña" y enlace mágico responden igual exista o no la cuenta (login verifica contra un hash de relleno para igualar tiempos). **Excepción consciente:** el registro sí avisa "ya hay una cuenta con ese email" (409), porque es mucho mejor experiencia y el riesgo es bajo; se limita con rate limit.
- CSRF: las rutas de `/auth` solo aceptan POST con `Origin` en la lista explícita `FRONTEND_ORIGIN` (no los subdominios de negocios, que sí pueden llamar a `/public/*`). Las rutas de `/auth` viven en su propio contexto de Fastify para no afectar a las públicas.
- Los enlaces de los emails se consumen con POST desde la página, nunca con GET, y el enlace mágico exige un clic: así los escáneres de links de los clientes de correo no los gastan.
- Restablecer la contraseña cierra todas las sesiones. Entrar por enlace mágico crea la cuenta (ya verificada) si no existía.
- Rate limit por IP en cada ruta de `/auth` (`AUTH_PER_MINUTE`, 10 por defecto). El email de verificación es obligatorio solo para publicar, no para editar.
- Next 16 con `cacheComponents` deja montadas (ocultas) las pantallas anteriores: en los e2e hay que filtrar por `:visible`.

## D-011 · 2026-11-22 · Guardado del negocio en el servidor
- El editor sigue siendo dueño de un documento completo (el "borrador"). Con sesión se sincroniza entero con `PUT /me/business` y el servidor lo reconcilia contra las tablas por `client_id` (cada fila conserva su uuid, así los pedidos viejos siguen apuntando al producto y al borrarlo conservan nombre y precio).
- Concurrencia: `content_version` + lock por usuario. Un guardado con versión vieja devuelve 409 y el editor pregunta qué versión conservar; nunca se pisa en silencio. Al abrir un dispositivo con borrador local distinto del guardado en la cuenta también se pregunta.
- Sin conexión: se sigue editando, se guarda local, y el motor (`lib/syncEngine.ts`, sin React y con tests de reloj simulado) reintenta con espera creciente (5 s a 60 s) sin perder el último cambio.
- Cerrar sesión sube lo pendiente, borra el borrador y la marca de sincronización del navegador y frena cualquier guardado local posterior (privacidad en compus compartidas).
- CORS: el plugin solo permite GET/HEAD/POST por defecto; hubo que habilitar PUT/DELETE (con test de preflight). Un bug que ni los tests de backend ni `curl` podían ver.

## D-012 · 2026-11-22 · Cerrar sesión: el logout nunca espera a un guardado
- Bug real (intermitente bajo carga): "Salir" subía primero lo pendiente al servidor, aunque no hubiera cambios, y si la persona recargaba o cerraba la pestaña enseguida el pedido de logout no salía y la sesión quedaba abierta en el servidor.
- Ahora: se frena el guardado local, se espera solo si hay cambios sin subir (tope 3 s, `settle()`), se borra lo local y el logout se manda con `keepalive`, que el navegador completa aunque la página se cierre.

## D-013 · 2026-11-22 · Rediseño de las páginas públicas de los negocios
- Concepto: **la comanda**. La portada pone el nombre del negocio enorme y, al lado, un ticket con el menú (puntos guía hasta el precio, borde aserrado) que se "imprime" al cargar; es el único elemento memorable. Cinta de productos en movimiento, "Pedir es fácil" (3 pasos reales), horarios con el día de hoy resaltado, franja final con WhatsApp. El catálogo no usa cajas idénticas: Vidriera (imagen + texto), Mostrador (carta con puntos guía), Grilla, Servicios (barra de color).
- Responsive por **container queries** (`@container` en la raíz), no por viewport: la vista previa del editor (marco de celular de 390 px o de computadora) muestra el diseño real. Los colores y tipografías siguen viniendo de los 9 temas y 4 pares.
- Movimiento: una entrada orquestada, la cinta, y respuestas a acciones (rebote del contador, hoja del pedido). Todo se apaga con `prefers-reduced-motion` (testeado). Sin fade-in por sección.
- Detalle técnico: la utilidad `font-heading` de shadcn apunta a la fuente de texto; las páginas de negocio usan `.site-display` para la fuente de títulos del par elegido.
- Espacio listo para fotos: `cover` en el sitio e `image` en cada producto (hoy null); sin foto se usa una pieza de color del tema con la inicial.

## D-014 · 2026-11-22 · Landing de MiShowo, video con Remotion y contenido
- Identidad propia de MiShowo (solo en el grupo de rutas `(marketing)`): celeste y sol de la bandera sobre tinta azul, Bricolage Grotesque + Figtree, el sol como símbolo. Los clientes mantienen sus 9 temas.
- La portada ofrece una **demo interactiva con el componente real** de las páginas de clientes (`LiveDemo` + `SiteView`): lo que se ve es lo que se entrega, y "Usar este diseño" guarda el borrador y abre el editor con eso ya cargado.
- Video: proyecto Remotion en `video/` (`npm run render` en esa carpeta); salida en `frontend/public/video/` (661 KB, 15 s, 1280x720) con poster. Si cambia el producto, se vuelve a renderizar.
- Rendimiento: la demo viaja ya armada en el primer HTML (el servidor trae el primer rubro; el build de Docker no tiene backend, así que se pide al atender la visita con `connection()`), y las fuentes de los pares tipográficos no se precargan (solo se descarga la que se usa). Lighthouse mobile de la landing: rendimiento 77 -> 100 (LCP 5,0 s -> 1,2 s); computadora 100/100/100/100.
- La demo dentro de la landing renderiza el título del negocio como `h2` (`preview`): la página tiene un solo `h1`.
- Planes de la landing: salen de `/public/plans` (D-007). Testimonios: de ejemplo y marcados como tal hasta tener reales.
- Contenido: blog (3 artículos), centro de ayuda (6), legales (términos, privacidad Ley 25.326, cancelación) y botón de arrepentimiento (10 días) con acuse por email. **Los textos legales son una base: el titular debe completar sus datos con `NEXT_PUBLIC_LEGAL_ENTITY` y hacerlos revisar por un abogado.** Soporte por WhatsApp: variable `NEXT_PUBLIC_SUPPORT_WHATSAPP` (si no está, no se muestra).

## D-015 · 2026-11-22 · Publicación, límites del plan y 404 reales (resuelve D-005)
- Publicar exige email verificado, nombre propio, WhatsApp válido y al menos un producto propio (los de ejemplo nunca se publican: la API pública los oculta). El link se valida (formato, reservados, prohibidos, único) y la unicidad la garantiza el índice de la DB: dos personas publicando el mismo link a la vez → una gana y la otra recibe 409 (el error de Postgres viene envuelto en `cause`).
- Límites del plan: se leen de la tabla `plans` (D-007) al guardar y al publicar; solo cuentan los productos propios. Rate limit configurable en publicar.
- Actualización instantánea: el backend avisa a `POST /api/revalidate` del frontend (secreto compartido `REVALIDATE_SECRET`, comparación en tiempo constante) y este llama `revalidateTag('site:<slug>', { expire: 0 })`. Si el aviso falla, la página se actualiza sola al vencer el caché.
- **404 reales:** el `proxy.ts` consulta si el negocio existe (`siteExists`, caché de 15 s en memoria con tope de 2000 entradas, que el aviso de revalidación limpia) y responde 404 para negocios inexistentes o despublicados. Resuelve D-005 (antes respondía 200 con un "no encontrado" dentro). Un error del backend no bloquea a nadie ni se cachea.

## D-016 · 2026-11-22 · Panel de pedidos del negocio
- Estados: nuevo → confirmado → listo → entregado; se puede cancelar hasta antes de entregar; entregado y cancelado son finales (reglas en `backend/src/orders/status.ts`, testeadas). El cambio de estado y la creación de pedidos comparten el lock por negocio.
- Cancelar repone el stock que el pedido descontó (en la opción si controla stock, si no en el producto), una sola vez aunque lleguen dos cancelaciones a la vez (verificado por mutación). Para eso `order_items` guarda `option_id`.
- CSV para Excel en español: separador `;`, BOM UTF-8 y coma decimal; **toda celda que empiece con `= + - @` se neutraliza** para que un cliente no pueda inyectar fórmulas. Máx. 5000 pedidos.
- Aviso por email al dueño en cada pedido (best effort: si el mail falla el pedido igual queda). La respuesta pública del pedido no expone datos del dueño.
- CORS: faltaba `PATCH` (mismo problema que `PUT`): los tests de backend no pasan por el navegador y no lo veían; ahora hay tests de preflight para ambos.
- Hidratación: el buscador del catálogo expone `data-hydrated`; lo escrito antes de hidratar se perdía y volvía flaky el e2e bajo carga.

## D-017 · 2026-11-22 · Cobro manual, panel de administración y vencimientos
- **Cobro manual:** el usuario elige plan y meses (el monto lo calcula SIEMPRE el servidor con el precio vigente de la tabla `plans`), ve los datos para transferir (editables por el Owner, `app_settings`), avisa "Ya pagué" y sube el comprobante. El admin lo confirma o lo rechaza con motivo. Confirmar es atómico (`UPDATE ... WHERE status='pendiente'`) y usa un lock por negocio: dos confirmaciones no duplican ni se pisan (verificado por mutación). Renovar el mismo plan vigente suma al vencimiento actual; cambiar de plan o renovar uno vencido cuenta desde hoy. Meses de calendario sin desbordes (31/1 + 1 = 28/2).
- **Archivos:** `StorageProvider` (disco hoy; S3/R2 después sin tocar el resto). El tipo real se detecta por los bytes (no por extensión ni Content-Type): imagen/PDF para comprobantes; se rechazan ejecutables, HTML y SVG. Los comprobantes son privados y se sirven con `nosniff` y CSP `sandbox`. Tope de 5 MB.
- **Admin:** roles Owner/Admin/Soporte (Soporte mira y deja notas; Admin gestiona negocios, pagos y planes; solo Owner toca ajustes de cobro y administradores). **2FA TOTP obligatorio** (RFC 6238, validado con los vectores oficiales; secreto cifrado AES-256-GCM con `ADMIN_SECRET_KEY`), verificación válida 8 h, sesión de admin de 12 h, límite de intentos del código, IP permitida opcional (`ADMIN_ALLOWED_IPS`) y chequeo de origen. Sin la clave de cifrado el 2FA no se activa (no queda a medio configurar). El primer Owner se nombra por consola: `npm run admin:promote -- email owner` (a propósito no se puede desde la web).
- **Auditoría inmutable:** cada acción guarda quién, qué, antes, después e IP en la misma transacción, y un trigger de Postgres impide UPDATE y DELETE (verificado). Los intentos fallidos de 2FA también se registran.
- **Vencimientos:** `node dist/cron.js expire-plans|remind-expiring|all` (Scheduled Task de Coolify). Idempotentes y a prueba de corridas simultáneas; los productos que pasan el límite gratuito se conservan. Un plan que vence no se renueva solo.
- Pendiente del admin v1: embudo de onboarding (necesita la analítica propia de la Épica 11) y "ver como el usuario".
