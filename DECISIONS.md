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
