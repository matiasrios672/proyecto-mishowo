# MiShowo — Prompt maestro para Claude Code

> Pegá este archivo en la raíz del repo (por ejemplo como `PROMPT.md`) y arrancá Claude Code con:
> `Leé PROMPT.md y seguí las instrucciones al pie de la letra.`

---

## 0. Tu rol

Sos el equipo completo de producto de **MiShowo**: product manager, diseñador UX/UI, desarrollador full‑stack senior, especialista en marketing/growth y QA. Trabajás de forma **autónoma y en bucle** (ver sección 6) hasta completar el MVP, documentando cada decisión.

Idioma del producto: **español rioplatense (voseo)**. Código, nombres de variables y commits: en inglés. Documentación interna: en español.

---

## 1. Qué es MiShowo

**MiShowo** es un SaaS argentino que permite a cualquier emprendedor o pequeño negocio **crear su propia página web desde el celular en minutos**: catálogo o servicios, pedidos por WhatsApp y un link listo para la bio de Instagram.

- **Dominio:** `mishowo.com`
- **URL de cada negocio:** `tunegocio.mishowo.com` (dominio propio en fase 2)
- **Posicionamiento:** *"Tu página que vende y crece con vos."* Igual de simple que la competencia para arrancar, pero con herramientas para cuando el negocio crece.
- **Público:** rotiserías, tiendas de ropa, muebles/deco, eventos y alquileres, gimnasios, oficios del hogar, belleza/estética, profesionales de salud, y "otro rubro" (servicios o productos).
- **Logo:** lo provee el dueño más adelante. Mientras tanto usá un placeholder tipográfico (`MiShowo` en wordmark) y dejá el logo centralizado en un solo componente/asset (`/public/brand/`) para reemplazarlo fácil.

### 1.1 Fuera de alcance (NO implementar)
- ❌ **Mercado Pago** ni ninguna pasarela de pago (ni para cobrar productos ni para el abono).
- ❌ **Envíos** (cálculo, integraciones con correos, costos por zona). Solo queda un campo de texto informativo "Zona de entrega o retiro".
- ❌ **IA** en esta etapa (consume tokens). Va como **"Próximamente"** (ver 3.7): diseñá la arquitectura para sumarla después, pero no llames a ninguna API de IA.

---

## 2. Competencia: Vitrea (mivitrea.com) — análisis de referencia

Usalo como **piso mínimo** en lo que está dentro del alcance.

### 2.1 Landing de Vitrea
- Hero: "Tu negocio, a la vista." + precio + CTA "Crear mi página".
- Ejemplos de páginas por rubro (carpintería, ropa, rotisería, eventos, muebles).
- "Qué incluye la publicación" (6 beneficios), sección de precio, FAQ, footer con soporte por email y WhatsApp.
- **Sin testimonios, sin blog, sin centro de ayuda.**
- Precio único: $25.000/mes por página. Vista previa gratis.
- Subdominio `negocio.mivitrea.com`. **Sin dominio propio.**

### 2.2 Flujo de creación de Vitrea (3 pasos)
1. **¿De qué es tu negocio?** — elegís rubro (plantilla con contenido de ejemplo) o "¿Otro rubro?" (ofrecer servicios / vender productos) o "Empezar con una idea" (texto libre → propuesta de textos).
2. **Contanos sobre tu negocio** (editor).
3. **Publicar.**

### 2.3 Editor de Vitrea (`/editor/nuevo`) — mapa completo
Layout: **panel izquierdo de formulario + vista previa en vivo a la derecha** (toggle Celular / Computadora, pantalla completa, "Comparar en grande" entre diseños). Header con nombre del negocio, estado "Solo en este dispositivo" (borrador local) y botón **Guardar** (pide crear cuenta para guardar y subir fotos). Pestañas: **Negocio · Textos · Fotos · Productos · Ventas · Diseño · Publicar**.

El contenido de ejemplo viene marcado con una etiqueta **"Ejemplo"** hasta que el usuario lo reemplaza.

- **Negocio:** nombre*, rubro*, descripción breve* (300 car.), WhatsApp* (+ "Agregar otro WhatsApp"), zona de entrega o retiro, dirección (solo si hay local), horarios (texto libre), Instagram.
- **Textos de portada:** bajada (200 car.); si queda vacía usa nombre y descripción.
- **Fotos y videos de portada:** JPG/PNG/WebP hasta 10 MB (optimizadas al subir), video MP4/MOV/WebM.
- **Productos:** lista con editar/reordenar; switch "Cinta de fotos en movimiento" (carrusel con ≥3 fotos). Modal de producto: nombre*, descripción (400 car.), categoría (agrupa en secciones con menú de anclas), precio base, "Disponible" (si no, muestra "Agotado"), hasta 4 fotos/videos, **opciones/variantes** (ej. Unidad / Media docena / Docena, o talles) cada una con precio propio opcional y check "Agotado".
- **Ventas:** pedido por WhatsApp (el cliente arma el carrito y se abre WhatsApp con el pedido y total). Mensaje inicial personalizable. Switch "Mostrar cantidades". Switch **"Pedir fecha del evento"** (agrega calendario al pedido). "Aviso para tus clientes" (cinta superior) con elección de separador.
- **Diseño:** 2 layouts ("Vidriera" = visual con fotos grandes; "Mostrador" = catálogo compacto en lista) con recomendación automática según contenido; "Probá otros diseños con tus mismos datos: no se pierde nada". **9 temas de color** con nombre y rubro sugerido: Blanco, Marfil, Terracota, Nogal, Glaciar, Medianoche, Salvia, Rosa, Carbón.
- **Publicar:** checklist "Antes de publicar" con barra de progreso y botón "Completar" que lleva a cada campo faltante. Elegir slug ("Verificar y reservar").
- Página pública: cinta de aviso, header, menú de secciones, productos con agregar / elegir cantidad, bloque horario y zona, footer con "Consultar por WhatsApp" y "Página hecha con Vitrea", drawer "Tu pedido".

### 2.4 Lo que a Vitrea le falta (nuestras oportunidades dentro del alcance)
Sin plan gratis ni escalonado · sin quitar la marca · sin panel de pedidos ni historial · sin estadísticas · sin stock numérico · sin cupones · sin turnos con calendario real · sin búsqueda/filtros en catálogo · SEO débil · sin testimonios/blog/ayuda · solo 2 layouts · sin tipografías ni color de marca propio · sin QR.

---

## 3. Qué tiene que tener MiShowo

### 3.1 Onboarding
- Entradas: **por rubro** (plantilla con contenido de ejemplo realista) y **"Otro rubro"** (servicios / productos). La entrada "Contame tu idea" se muestra con badge **"Próximamente"**.
- Contenido de ejemplo marcado con badge "Ejemplo".
- Todo funciona **sin cuenta** hasta que quiere guardar/subir fotos; borrador en localStorage que migra al crear cuenta. Login con email + contraseña y magic link (Google opcional).

### 3.2 Editor (formulario + preview en vivo, mejorado)
- Mobile‑first real: en celular, botón flotante "Ver cómo queda" / alternar entre editar y ver.
- Pestañas: Negocio · Textos · Fotos · Productos · Pedidos/Turnos · Diseño · SEO y compartir · Publicar.
- **Autoguardado** con indicador ("Guardado hace 3 s"). Deshacer/rehacer.
- Productos: todo lo de Vitrea + **stock numérico opcional** (agotado automático en 0), variantes en 2 ejes (talle × color), precio tachado/oferta, carga masiva (CSV y "pegar lista"), duplicar, drag & drop para ordenar, búsqueda en el editor.
- Horarios estructurados por día → "Abierto ahora / Cerrado" en la página.
- Ubicación con mapa (embed OpenStreetMap o Google Maps).
- Múltiples WhatsApp con rol (ventas / soporte).
- **Diseño:** al menos **4 layouts** (Vidriera visual, Mostrador lista, Grilla tienda, Servicios/portfolio) + 9+ temas de color propios **+ color de marca personalizado** (selector, y extracción automática de color del logo con canvas en el navegador, sin IA) + 3–4 pares tipográficos curados + forma de botones. "Comparar diseños" lado a lado.
- Checklist de publicación con progreso + **score de calidad** ("Tu página está al 80%: agregá fotos a 3 productos").

### 3.3 Pedidos y operación (el gran diferencial)
- Pedido por WhatsApp con mensaje armado **+ el pedido queda registrado** en un **panel de pedidos** (estados: nuevo, confirmado, listo, entregado, cancelado), con notificación por email y exportación CSV. El pago se coordina por fuera entre negocio y cliente.
- Cupones y promos (% o monto, mínimo de compra) que se reflejan en el mensaje de WhatsApp.
- **Turnos/reservas con calendario real** (servicios, belleza, salud, gimnasios, eventos): disponibilidad por día/horario, duración, bloqueo de fechas, solicitud que llega por WhatsApp y queda en el panel.
- "Pedir fecha del evento" para alquileres.

### 3.4 Crecimiento para el negocio
- **Estadísticas simples:** visitas, productos más vistos, clics en WhatsApp, pedidos, origen del tráfico (Instagram, Google, directo) con UTM automáticos para la bio. Analítica propia (sin terceros, liviana).
- **SEO:** SSR/SSG, metadatos y OG image generada por negocio, schema.org (LocalBusiness, Product), sitemap por subdominio.
- **QR descargable** de la página (PNG/PDF para el mostrador, folletos, bolsas).
- Reseñas reales de clientes, moderadas por el dueño.
- Pixel de Meta y Google Analytics opcionales (plan pago).

### 3.5 Planes y cobro (SIN pasarela)
| Plan | Incluye |
|---|---|
| **Gratis** | Subdominio, hasta ~15 productos, pedidos por WhatsApp, badge "Hecho con MiShowo" |
| **Emprende** | Productos ilimitados, panel de pedidos, cupones, estadísticas básicas |
| **Pro** | Sin marca MiShowo, turnos, estadísticas completas, pixel, varios WhatsApp, dominio propio (fase 2) |

- El cobro es **manual**: el usuario elige plan → ve datos para pagar (transferencia/alias, configurables) → toca "Ya pagué" y sube el comprobante (o avisa por WhatsApp) → el admin lo confirma desde el **panel de administración** (ver 3.7), que activa el plan con fecha de vencimiento, manda recordatorio antes de vencer y degrada a Gratis automáticamente al vencer.
- Precios y límites en un archivo de configuración (`config/plans.ts`). Los precios finales los define el dueño.

### 3.6 Landing y marca de MiShowo
- Hero claro, CTA "Creá tu página gratis", demo interactiva (mini editor que cambia el preview en vivo).
- Ejemplos por rubro (páginas demo navegables), planes, **testimonios** (placeholders marcados hasta tener reales), FAQ, **centro de ayuda** y **blog** para SEO (estructura lista + 3 artículos semilla escritos por vos), sección "Próximamente".
- Programa de referidos (1 mes gratis por negocio referido, aplicado manualmente desde el admin).
- Soporte por WhatsApp visible.
- Legales: términos, privacidad, cancelación, botón de arrepentimiento (Argentina).

### 3.7 Panel de administración de MiShowo (superadmin, para los dueños)
Aplicación interna en `admin.mishowo.com` (o `/admin`), separada del panel de los negocios, con su propio layout. Desktop‑first pero usable en celular.

**Acceso y seguridad**
- Roles: **Owner** (todo), **Admin** (todo menos configuración crítica y gestión de admins), **Soporte** (ver negocios, editar contenido, notas; sin tocar planes ni pagos).
- Login separado + **2FA obligatorio (TOTP)**, sesiones cortas, lista de IPs permitidas opcional.
- **Log de auditoría** de toda acción (quién, qué, cuándo, antes/después), no editable.

**1. Dashboard (inicio)**
- KPIs: negocios totales, publicados, nuevos hoy/semana/mes, activos (con visitas en 7 días), pagos por plan, **MRR estimado**, vencimientos próximos, churn del mes, conversión Gratis → pago.
- Gráficos: altas por día, publicaciones por día, pedidos generados por la plataforma, distribución por rubro y por plan.
- Embudo de onboarding: entró al editor → completó datos → creó cuenta → publicó (para detectar dónde abandonan).
- Alertas: pagos pendientes de confirmar, planes que vencen en 7 días, reportes de contenido, errores del sistema, disco casi lleno.

**2. Negocios**
- Tabla con búsqueda y filtros (rubro, plan, estado, fecha de alta, vencimiento, ciudad, sin publicar, inactivos).
- Ficha del negocio: datos, dueño, plan e historial de planes, pagos, estadísticas, pedidos (conteo), productos, link a la página, notas internas, historial de auditoría.
- Acciones: **ver como el usuario (impersonar, con banner visible y quedando en el log)**, editar contenido, cambiar slug, publicar/despublicar, **suspender** (muestra página "temporalmente no disponible") y reactivar, eliminar (soft delete con período de recuperación de 30 días), transferir a otro usuario, marcar como "destacado" para usar de ejemplo en la landing.

**3. Usuarios**
- Lista y ficha (negocios que tiene, último acceso, verificación de email).
- Acciones: reenviar verificación, resetear contraseña (envía link), bloquear, unir cuentas duplicadas, exportar/eliminar datos (pedidos de derecho de acceso/supresión, Ley 25.326).

**4. Planes y cobros (manual)**
- **Bandeja de pagos pendientes**: los avisos "Ya pagué" de los usuarios con comprobante adjunto (imagen/PDF), monto, plan y período.
- Botones: **Confirmar pago** (activa/renueva plan y fija vencimiento), Rechazar (con motivo, avisa por email/WhatsApp).
- Registrar pago manual (si te pagan por fuera): fecha, monto, medio (transferencia, efectivo, otro), período cubierto, nota.
- Vista de vencimientos (calendario/lista): vence hoy, en 7 días, vencidos. Envío de recordatorio en un clic (email y link de WhatsApp con mensaje armado).
- Regalar días/meses, aplicar descuentos o beneficio de referidos, cambiar plan manualmente.
- Reporte de ingresos por mes y por plan, exportable a CSV (para la contabilidad).

**5. Catálogo de la plataforma (sin tocar código)**
- **Rubros y plantillas**: crear/editar rubros, contenido de ejemplo de cada uno, layout y tema recomendados, orden y visibilidad en el onboarding.
- **Temas de color y tipografías**: alta/edición, activar/desactivar.
- **Slugs reservados/prohibidos** (admin, www, api, marcas, palabras ofensivas).
- **Planes y límites**: editar precios, límites (productos, fotos, WhatsApp), features por plan y datos de pago (alias/CBU/titular) que se muestran a los usuarios. (Si se guardan en DB, `config/plans.ts` queda como valores por defecto.)

**6. Contenido del sitio (mini CMS)**
- Landing: textos clave, testimonios, negocios destacados, FAQ.
- Blog y centro de ayuda: artículos con editor de texto enriquecido (Markdown/MDX), borrador/publicado, SEO por artículo.
- **Anuncios**: banner dentro del panel de los negocios (novedades, mantenimiento) y lista "Próximamente".
- Plantillas de emails transaccionales editables (bienvenida, verificación, plan por vencer, pago confirmado, suspensión).

**7. Moderación y soporte**
- Reportes de páginas (botón "Denunciar" discreto en cada página pública): cola con estado (nuevo, revisado, acción tomada).
- Detección simple de contenido prohibido por palabras clave y páginas sospechosas (muchos negocios desde una misma IP, links externos raros).
- Notas internas por negocio/usuario y etiquetas (VIP, moroso, en prueba, referido por X).
- Acceso rápido a "Escribir por WhatsApp" al dueño del negocio con mensaje plantilla.

**8. Sistema (salud del VPS)**
- Estado: uso del volumen de uploads y tamaño de la DB, memoria del proceso Node, versión desplegada (commit SHA inyectado como env en el build) y fecha del último deploy. (El estado del contenedor y del servidor se ve en Coolify; acá lo esencial + link al panel de Coolify.)
- **Backups**: estado del último backup de uploads (y link a los backups de Postgres en Coolify), botón "respaldar uploads ahora".
- Cron jobs: última ejecución y resultado de cada tarea programada.
- Log de errores recientes de la app (y opcional, integración con un notificador por email cuando hay errores).
- Modo mantenimiento global (con mensaje personalizado).

**9. Configuración general (solo Owner)**
- Datos de MiShowo (nombre, email/WhatsApp de soporte, redes), SMTP, dominios, gestión de administradores y roles, feature flags (activar módulos como turnos o "Próximamente" para ciertos negocios beta).

### 3.8 Próximamente (NO implementar ahora, solo dejar preparado)
Mostrarlo en la landing y en el editor con badge "Próximamente", y dejar en el código interfaces/puntos de extensión vacíos (`lib/ai/` con un provider stub) para sumarlo sin refactor:
- Crear la página describiendo tu idea (textos y secciones con IA).
- Armar el catálogo a partir de fotos.
- Generador de posteos para Instagram.
- Mejorar fotos de producto (quitar fondo).
- Más adelante: cobros online y envíos.

---

## 4. Stack técnico y despliegue: Docker + Coolify (VPS compartida)

El VPS tiene **Coolify** instalado. Todo se despliega como **contenedores Docker** gestionados por Coolify, que ya trae su reverse proxy (**Traefik**) con SSL automático de Let's Encrypt. **No uses Nginx, PM2 ni systemd.** Recursos limitados: imágenes livianas y bajo consumo de RAM. Podés proponer cambios justificados en `DECISIONS.md`.

### 4.1 Aplicación
- **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui**, build `output: "standalone"`.
- **Base de datos:** **PostgreSQL** como recurso de base de datos de Coolify (servicio aparte, no dentro del contenedor de la app). ORM: Prisma o Drizzle, con migraciones que corren automáticamente al iniciar el contenedor (o como paso de pre‑deploy).
- **Auth:** Auth.js (email+contraseña, magic link vía SMTP).
- **Imágenes y videos:** guardados en un **volumen persistente de Docker** (ej. `/app/uploads`, configurable por env), procesados con `sharp` a WebP en varios tamaños y servidos por la app con cache headers largos (nombres de archivo con hash). Dejá una interfaz `StorageProvider` para poder pasar a S3/R2/MinIO más adelante sin refactor. Límites de tamaño por plan.
- **Emails:** SMTP genérico (nodemailer), configurable por env.
- **Multi‑tenant por subdominio wildcard** (`*.mishowo.com`) resuelto en middleware de Next.js por el header `Host`.
- Cuidá la memoria: nada de procesos pesados en caliente; si hace falta una cola, usá una tabla en Postgres (sin Redis en el MVP).

### 4.2 Docker
- **`Dockerfile` multi‑stage** (deps → build → runner) sobre `node:XX-alpine` (o `-slim` si `sharp` lo requiere), usuario no root, solo el output standalone + `public` + `.next/static` en la imagen final. Objetivo: imagen < 300 MB.
- `HEALTHCHECK` contra un endpoint `/api/health` (verifica app y conexión a DB).
- `.dockerignore` completo.
- **`docker-compose.yml`** para desarrollo local (app + Postgres + Mailpit para ver los emails), y un `docker-compose.prod.yml` de referencia por si se despliega en Coolify como "Docker Compose" en vez de "Dockerfile". Documentá cuál recomendás y por qué.
- Variables de entorno: todo por env (Coolify las inyecta). `.env.example` documentado, sin secretos en la imagen.

### 4.3 Coolify
- Deploy desde el **repo Git** (GitHub/GitLab) con build por Dockerfile; **auto‑deploy** por push a `main` (webhook de Coolify).
- **Dominios en Coolify:** `mishowo.com`, `www.mishowo.com`, `admin.mishowo.com` y **wildcard `*.mishowo.com`** apuntando a la misma app. El SSL wildcard en Traefik requiere **DNS challenge** con Cloudflare (ver 4.4): documentá en `DEPLOY.md` cómo configurarlo en Coolify (resolver de certificados de Traefik + token de la API del DNS). DNS: registros `A` para `@` y `*` apuntando al VPS.
- **Volumen persistente** para uploads, configurado en Coolify (y que sobreviva a redeploys).
- **Tareas programadas** (vencimiento de planes, recordatorios, agregados de estadísticas, limpieza): usá las **Scheduled Tasks de Coolify** que ejecutan un comando dentro del contenedor (ej. `node scripts/cron.js expire-plans`), o un endpoint protegido con token. Nada de crontab del host.
- **Backups:** backups programados de Postgres desde Coolify (idealmente a un bucket S3‑compatible) + script/tarea para respaldar el volumen de uploads. Documentá la restauración.
- Dominios propios de clientes (fase 2): documentá el enfoque (agregar el dominio en Coolify/Traefik vía API de Coolify al verificar el DNS del cliente).
- Zero‑downtime: healthcheck correcto para que Coolify no cambie al contenedor nuevo hasta que esté sano.

### 4.4 Datos fijos de infraestructura (no preguntar)
- **Dominio:** `mishowo.com`, registrado en **DonWeb** (se renueva ahí).
- **DNS:** gestionados en **Cloudflare** (plan gratis); los nameservers del dominio en DonWeb apuntan a Cloudflare. Si se suma `mishowo.com.ar`, se delega a Cloudflare desde NIC Argentina.
- **Registros DNS:** `A @` y `A *` → IP del VPS, en modo **"DNS only" (nube gris)** para que Traefik maneje el SSL sin conflictos.
- **SSL wildcard:** Traefik de Coolify con **DNS challenge usando el proveedor `cloudflare`** de lego y un **API Token de Cloudflare** con permiso `Zone:DNS:Edit` limitado a la zona `mishowo.com` (nunca la Global API Key). El token va como variable de entorno en la config del proxy de Coolify, no en el repo.
- `DEPLOY.md` debe incluir el paso a paso: crear la zona en Cloudflare, cambiar nameservers en DonWeb, crear el token, configurar el certificate resolver en el proxy de Coolify, y verificar con un subdominio de prueba.

### 4.5 Entregables de deploy
`Dockerfile`, `.dockerignore`, `docker-compose.yml` (dev), `docker-compose.prod.yml` (referencia), `.env.example`, `scripts/cron.js`, `scripts/backup-uploads.sh` y **`DEPLOY.md`**: paso a paso en Coolify (crear proyecto, recurso Postgres, app desde Git, variables, dominios + wildcard SSL, volumen, scheduled tasks, backups, cómo hacer rollback).

### 4.6 Tests
Vitest (unidad) + **Playwright** (e2e + screenshots mobile/desktop), corriendo contra el stack de `docker-compose.yml`. Opcional: GitHub Actions que corra lint, typecheck, tests y build de la imagen antes de que Coolify despliegue.

---

## 5. Skills y especialistas a usar

Antes de empezar, revisá qué skills tenés disponibles (`/skills` o `.claude/skills/`) y usá las específicas para cada tarea. Si una no existe, **creala** en `.claude/skills/<nombre>/SKILL.md` con instrucciones concisas y usala.

| Área | Skills / subagentes | Para qué |
|---|---|---|
| **Diseño UI/UX** | `frontend-design` (y cualquier skill de diseño/UI disponible) | Dirección estética distintiva (no "template genérico"), design system, editor, páginas públicas, temas |
| **Marketing / copy** | skills de copywriting, CRO de landing, pricing, onboarding, SEO, email (instalalas o crealas) | Landing, microcopy en voseo, nombres de planes, emails, blog |
| **SEO técnico** | skill de SEO / schema | Metadatos, OG, schema.org, sitemaps por tenant |
| **DevOps** | skill de Docker/Coolify (creala si no existe) | Dockerfile, compose, Coolify, Traefik, SSL wildcard, volúmenes, scheduled tasks, backups |
| **Testing / QA** | `webapp-testing` o Playwright | E2E, screenshots 390px y 1440px, accesibilidad |
| **Arquitectura** | subagente **Plan** | Plan técnico antes de cada épica |
| **Exploración** | subagente **Explore** | Buscar en el repo cuando crezca |
| **Revisión** | subagente de code review independiente | Revisar cada épica antes de cerrarla |

Reglas de diseño: mobile‑first, tipografía cuidada, contraste AA, estados vacíos con ejemplo, nada de lorem ipsum (contenido argentino realista por rubro: empanadas, remeras, plomería, uñas, etc.).

---

## 6. Modo de trabajo: PLAN + BUCLE

### 6.1 Primer paso (no escribas código todavía)
1. Leé este archivo completo.
2. Creá **`PLAN.md`** con:
   - Visión y alcance del MVP (qué entra, qué es fase 2, qué es "Próximamente").
   - **Épicas** numeradas con **tareas pequeñas** (≤ 2 h) y criterio de aceptación verificable.
   - Orden sugerido: (1) setup + design system + marca placeholder → (2) modelo de datos multi‑tenant → (3) onboarding por rubro + contenido de ejemplo → (4) editor con preview en vivo → (5) página pública + carrito + pedido por WhatsApp → (6) auth + guardado + subida de fotos → (7) publicación + slug + planes con cobro manual → (8) **panel de administración v1** (acceso con 2FA, roles, auditoría, dashboard, negocios, usuarios, bandeja de pagos y vencimientos) → (9) panel de pedidos del negocio → (10) landing de MiShowo + legales + "Próximamente" → (11) estadísticas + SEO + QR → (12) cupones + turnos → (13) **panel de administración v2** (catálogo de rubros/temas, mini CMS, moderación, sistema y backups, configuración) → (14) deploy en Coolify (Dockerfile, Postgres, dominios + wildcard SSL, volumen, scheduled tasks, backups).
   - Importante: el `Dockerfile` y el `docker-compose.yml` de desarrollo se crean en la **épica 1**, para que todo se desarrolle y pruebe en Docker desde el día uno.
3. Creá **`PROGRESS.md`** (bitácora), **`DECISIONS.md`** (decisiones con motivo) y un **`CLAUDE.md`** inicial (ver 6.4).
4. Mostrame el plan y **esperá mi OK** antes de programar.

### 6.2 El bucle (después del OK)
Repetí este ciclo **tarea por tarea** sin detenerte, hasta terminar la épica en curso:

```
LOOP:
  1. Leé PLAN.md y PROGRESS.md → elegí la siguiente tarea pendiente.
  2. Si la tarea es de diseño/copy/SEO/deploy → cargá la skill correspondiente primero.
  3. Implementá la tarea (cambios chicos y enfocados).
  4. Verificá:
       - typecheck + lint
       - tests unitarios
       - Playwright e2e del flujo afectado + screenshot mobile (390px) y desktop (1440px); mirá los screenshots.
  5. Si algo falla → corregí y volvé a 4 (máx. 3 intentos; si sigue fallando, anotá el bloqueo en PROGRESS.md y pasá a otra tarea).
  6. Marcá [x] en PLAN.md, registrá en PROGRESS.md, actualizá "Estado actual / Próximo paso" en CLAUDE.md (ver 6.4), commit (conventional commits).
  7. Si terminaste una ÉPICA → review con subagente independiente, aplicá correcciones y dame un resumen corto (qué hay, cómo probarlo, screenshots).
  8. Volvé a LOOP.
```

### 6.3 Cuándo frenar y preguntarme
- Decisiones irreversibles o con costo.
- Precios finales de los planes y datos de cobro (alias/CBU).
- Cuando necesites el **logo**, datos del Coolify (versión, si hay bucket S3 para backups, recursos del VPS) o el token de Cloudflare o credenciales SMTP: dejá mocks y `.env.example`, y avisame.
- Si algo de este documento se contradice.

### 6.4 Memoria del proyecto (para no releer todo en cada sesión)
El dueño abre y cierra sesiones seguido. **Nunca escanees el repo completo para "entender el proyecto"**: la memoria vive en archivos que mantenés vos.

**Archivos de memoria (creálos en la épica 1, en la raíz):**
- **`CLAUDE.md`** — se carga solo al iniciar cada sesión de Claude Code. Corto (máx. ~150 líneas), solo lo que se necesita siempre:
  - Qué es MiShowo en 3 líneas y link a este `PROMPT.md` (la especificación completa, no copiarla).
  - Stack y versiones.
  - **Comandos**: levantar dev (`docker compose up`), tests, lint, typecheck, migraciones, seed, build.
  - **Mapa del repo**: carpetas principales y qué hay en cada una (1 línea por carpeta).
  - Convenciones (nombres, estructura de componentes, manejo de errores, i18n/voseo, commits).
  - Reglas duras (fuera de alcance: Mercado Pago, envíos, IA; aislamiento por tenant; nada de copiar a Vitrea).
  - **Estado actual**: épica y tarea en curso, último commit relevante, bloqueos, **próximo paso concreto**.
- **`docs/ARCHITECTURE.md`** — modelo de datos (entidades y relaciones), flujo multi‑tenant, flujo de pedidos, flujo de planes/cobro manual, módulos y dónde está cada cosa. Se lee **solo** cuando la tarea toca esa parte.
- **`PLAN.md`**, **`PROGRESS.md`** (bitácora, la entrada más nueva arriba), **`DECISIONS.md`** — como en 6.1.

**Al iniciar cada sesión:**
1. Leé `CLAUDE.md` (ya cargado) y las **últimas 3 entradas** de `PROGRESS.md`.
2. Retomá desde "Próximo paso". Leé solo los archivos que la tarea necesita.
3. Si hace falta buscar algo en el código, usá el subagente **Explore** (así la búsqueda no llena tu contexto) o `grep`/`glob` puntual; nunca leer carpetas enteras.

**Al terminar cada tarea (parte del paso 6 del bucle):**
- Actualizá "Estado actual" y "Próximo paso" en `CLAUDE.md`.
- Si cambiaste estructura, comandos, convenciones o modelo de datos → actualizá `CLAUDE.md` / `docs/ARCHITECTURE.md` en el mismo commit.
- Mantené `CLAUDE.md` corto: lo detallado va a `docs/`, lo histórico a `PROGRESS.md`.

**Antes de cerrar la sesión o si el contexto se está llenando:** guardá el estado (los tres pasos de arriba) y hacé commit, para que la próxima sesión arranque exactamente donde quedó.

### 6.5 Definición de "terminado" del MVP
Un usuario nuevo, desde el celular, puede: entrar a la landing → elegir rubro → editar con preview en vivo → cargar productos con variantes y fotos → elegir diseño y color → crear cuenta → elegir su slug → publicar en plan Gratis → compartir `slug.mishowo.com` (y descargar su QR) → un cliente arma un pedido que llega por WhatsApp **y** queda en el panel de pedidos. El usuario puede elegir un plan pago y subir su comprobante; el admin (con 2FA) lo ve en la bandeja de pagos, lo confirma y el plan queda activo con vencimiento; el dashboard muestra los KPIs reales y toda acción del admin queda en el log de auditoría. Todo con tests e2e pasando, Lighthouse mobile ≥ 90 en la página pública y `DEPLOY.md` probado: la app corre en Coolify con `mishowo.com`, `admin.mishowo.com` y un subdominio de negocio con HTTPS.

---

## 7. Calidad no negociable
- Accesibilidad (labels, foco, contraste, teclado).
- Performance: página pública liviana (SSR/SSG, imágenes optimizadas, poco JS); bajo consumo de RAM del contenedor (definí límites de memoria recomendados en `DEPLOY.md`).
- Seguridad: aislamiento estricto por tenant (checks en cada query), validación con Zod, rate limiting, subida de archivos validada (tipo real, tamaño), headers de seguridad desde Next.js (`headers()` / middleware), contenedor sin root.
- Privacidad: Ley 25.326 (datos personales, Argentina).
- Textos en voseo, cálidos y claros, sin jerga técnica.
- Nunca copiar textos, diseño visual ni assets de Vitrea: inspirarse en la funcionalidad y crear identidad propia.

---

**Empezá ahora por el paso 6.1.** (En sesiones siguientes: arrancá por 6.4 → "Al iniciar cada sesión".)
