# DEPLOY-VPS — MiShowo en un VPS de prueba con dominio temporal

Para mostrar y probar la plataforma **antes** de comprar el dominio definitivo. Todo por HTTP (sin certificado), un solo comando.
Para producción real (HTTPS, wildcard con Cloudflare, SMTP real) usá `DEPLOY.md` (Coolify).

## Qué necesitás
- Un VPS Linux (Ubuntu 22.04/24.04), mínimo **2 GB de RAM** (compilar Next.js lo pide) y 20 GB de disco.
- Puerto **80** abierto en el firewall del proveedor (y en `ufw`, si lo usás).
- Docker con el plugin compose: `curl -fsSL https://get.docker.com | sh`

## Dominio temporal: sslip.io
`sslip.io` resuelve cualquier nombre con tu IP adentro a esa IP, así que no hay que tocar DNS:

| Qué | Ejemplo con la IP 203.0.113.10 |
|---|---|
| Web | `http://203-0-113-10.sslip.io` |
| API | `http://api.203-0-113-10.sslip.io` |
| Cada negocio | `http://lupe.203-0-113-10.sslip.io` |

El script lo arma solo a partir de la IP pública.

## Pasos
```bash
git clone <tu-repo> mishowo && cd mishowo
./scripts/vps-up.sh
```
El script: detecta la IP, genera `.env.vps` con secretos nuevos (Postgres, revalidación, clave del 2FA), compila las imágenes, levanta Traefik + Postgres + backend + frontend + Mailpit, aplica las migraciones y espera a que `/api/health` responda. Al final imprime las URLs.

> **Guardá `.env.vps`** (está en `.gitignore`). Sin `ADMIN_SECRET_KEY` los 2FA ya configurados dejan de funcionar.

## Primer Owner y equipo
1. Registrate en `http://<dominio>/registro`.
2. Dale el rol: `docker compose --env-file .env.vps -f docker-compose.vps.yml exec backend node dist/admin-cli.js tu@email.com owner`
3. Entrá a `/admin` (te pide configurar el 2FA con Google Authenticator/Authy/1Password).
4. **Equipo → «Sumar a una persona nueva»**: nombre, email y rol (Soporte: consultas y denuncias; Admin: además planes y pagos). Le llega un mail para elegir su contraseña; su 2FA lo configura al primer ingreso.
5. **Planes** → cargá los datos de cobro (titular, alias, CBU) que ve el cliente al pagar.

## Los mails en este entorno
No hay SMTP real: los mails (confirmación de cuenta, invitaciones al equipo, avisos de pago) caen en **Mailpit**, que solo escucha en el propio VPS. Para verlos desde tu compu:
```bash
ssh -L 8025:localhost:8025 usuario@<ip-del-vps>
# y abrí http://localhost:8025
```
Cuando quieras mails reales, cargá `SMTP_HOST/PORT/USER/PASS` en `docker-compose.vps.yml` (servicio `backend`) o pasá a `DEPLOY.md`.

## Qué no hace este entorno (a propósito)
- **Sin HTTPS**: las cookies de sesión van sin el flag `Secure` (`COOKIE_SECURE=false`). Usá solo datos de prueba, no contraseñas reales.
- Los certificados wildcard exigen DNS challenge (Cloudflare) con un dominio propio: eso es `DEPLOY.md`.
- Sin backups automáticos (`scripts/backup.sh` si querés).

## Operación
```bash
C="docker compose --env-file .env.vps -f docker-compose.vps.yml"
$C ps                      # estado
$C logs -f backend         # logs
git pull && ./scripts/vps-up.sh   # actualizar (aplica migraciones solo)
$C down                    # apagar (los datos quedan en los volúmenes)
$C down -v                 # apagar y BORRAR la base y las fotos
```
Tareas programadas (recordatorios, vencimientos, comunicados): en el VPS, `crontab -e`:
```
*/5 * * * *  cd /ruta/mishowo && docker compose --env-file .env.vps -f docker-compose.vps.yml exec -T backend node dist/cron.js send-campaigns
0 * * * *    cd /ruta/mishowo && docker compose --env-file .env.vps -f docker-compose.vps.yml exec -T backend node dist/cron.js remind-appointments
0 3 * * *    cd /ruta/mishowo && docker compose --env-file .env.vps -f docker-compose.vps.yml exec -T backend node dist/cron.js expire-plans
0 10 * * *   cd /ruta/mishowo && docker compose --env-file .env.vps -f docker-compose.vps.yml exec -T backend node dist/cron.js remind-expiring
```

## Checklist de verificación
- [ ] `http://<dominio>` carga la landing y `http://api.<dominio>/api/health` dice ok.
- [ ] Registro → mail en Mailpit → link de confirmación → «Tu email quedó confirmado».
- [ ] Crear una página y publicarla → abre en `http://<slug>.<dominio>`.
- [ ] Subir una foto (necesita `API_PUBLIC_URL`, ya configurada).
- [ ] Cliente: Plan y pagos → elegir plan → «Ya pagué» con comprobante → admin lo ve en Pagos, lo confirma → llega «Tu plan está activo».
- [ ] Owner invita a Soporte y a Admin; cada uno configura su 2FA y ve solo lo suyo.
