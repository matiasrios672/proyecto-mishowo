# DEPLOY — MiShowo en Coolify

> Para un VPS de prueba con dominio temporal y sin HTTPS: ver `DEPLOY-VPS.md`.

Arquitectura: Coolify (Traefik) → `frontend` (Next standalone, :3000) y `backend` (Fastify, :4000) + Postgres + volumen de uploads.
Sin Nginx, PM2, systemd ni Redis. Referencia: `docker-compose.prod.yml` y `.env.production.example`.

## 1. DNS y certificado wildcard (Cloudflare)
1. Comprá/apuntá `mishowo.com` a Cloudflare (nameservers en DonWeb si el dominio está ahí).
2. Registros DNS (solo DNS, nube gris o naranja con SSL "Full"):
   - `A  mishowo.com → IP del servidor`
   - `A  *.mishowo.com → IP del servidor` (cada negocio vive en `slug.mishowo.com`)
   - `A  api.mishowo.com → IP del servidor`
3. Token de API de Cloudflare con permisos `Zone:DNS:Edit` y `Zone:Zone:Read` solo para esa zona.
4. En Coolify: *Servers → Proxy → Configuration* y agregar el resolver DNS challenge de Traefik con el token
   (`CF_DNS_API_TOKEN`). Necesario porque Let's Encrypt solo emite wildcard por DNS challenge.

## 2. Proyecto en Coolify
1. *New Resource → Docker Compose* desde el repo, archivo `docker-compose.prod.yml`.
2. Cargá las variables de `.env.production.example` (generá los secretos con los comandos que figuran ahí).
3. Dominios:
   - `frontend` → `https://mishowo.com,https://*.mishowo.com`
   - `backend` → `https://api.mishowo.com`
4. Volúmenes: `pgdata` y `uploads` son persistentes: no los borres al redeployar.
5. Deploy. El backend aplica las migraciones al arrancar (`node dist/migrate.js`) y expone `/api/health`.

> Las variables `NEXT_PUBLIC_*` se incrustan al **compilar**: si cambiás el dominio, el WhatsApp de soporte o la razón social, hay que redeployar con *rebuild*.

## 3. Primer arranque
1. Registrate en `https://mishowo.com/registro` con el email que va a ser Owner.
2. En la terminal del contenedor `backend`: `node dist/admin-cli.js <email> owner`. Al ingresar a `/admin` te pide configurar el 2FA (requiere `ADMIN_SECRET_KEY`).
3. Desde `/admin`: cargá **precios finales de los planes**, datos de cobro (transferencia), SMTP de prueba (mandate un mail) y contenido legal.
4. (Opcional) Negocios de ejemplo para los links de la landing (`lupe-empanadas`, `demo-ropa`…): `SEED_DEMO=1 node dist/seed.js` en el contenedor `backend`. Crea un usuario demo: cambiale la contraseña o borralo antes de abrir al público.

## 4. Tareas programadas (Coolify → *Scheduled Tasks*, contenedor `backend`)
| Frecuencia | Comando | Para qué |
|---|---|---|
| diaria 03:00 | `node dist/cron.js expire-plans` | pasa a gratis los planes vencidos |
| diaria 10:00 | `node dist/cron.js remind-expiring` | avisa vencimientos próximos |
| cada 5 min | `node dist/cron.js send-campaigns` | comunicados programados |
| cada hora | `node dist/cron.js remind-appointments` | recordatorio de turnos (24 h antes) |
| diaria 11:00 | `node dist/cron.js nudge-leads` | aviso a quien no terminó (apagado de fábrica desde el admin) |

## 5. Backups
`scripts/backup.sh` (base con `pg_dump` + tar de uploads, 14 días de retención). Agendalo en el host a diario y **copiá la carpeta fuera del servidor**. Restaurar: ver el final del script. Probá una restauración antes de abrir al público.

## 6. Rollback
En Coolify, *Deployments → Redeploy* sobre el commit anterior. Las migraciones son solo aditivas hasta ahora (columnas/tablas nuevas, sin borrados), por lo que volver a una imagen anterior es seguro; ante una migración destructiva futura, restaurá el backup primero.

## 7. Verificación después de deployar
- `https://api.mishowo.com/api/health` → `ok` con la base conectada.
- `https://mishowo.com` carga; `https://cualquiera.mishowo.com` responde 404 propio (no error de certificado).
- Crear cuenta → llega el mail de verificación → crear y publicar una página → verla en su subdominio.
- Subir una foto (necesita `API_PUBLIC_URL`) y hacer un pedido de prueba.
- Lighthouse móvil sobre la landing y sobre una página publicada.

## 8. Antes de abrir al público (decisiones tuyas, no del código)
- Revisión legal de términos, privacidad y botón de arrepentimiento; completar `LEGAL_ENTITY`.
- Precios finales y datos de cobro reales.
- Cuotas sin interés: MiShowo solo las **muestra** (el negocio las ofrece y cobra por su medio). No hay pasarela de pagos.
