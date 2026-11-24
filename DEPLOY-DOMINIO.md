# Pasar de mishowo.bitenv.site a mishowo.com

El dominio sale de **variables**, no del código: no hay que tocar archivos para cambiarlo, solo Coolify y el DNS.
(Este documento es una guía: no despliega nada. El redeploy lo hacés vos.)

## 1. Comprar y pasar el DNS a Cloudflare
1. Comprá `mishowo.com` en DonWeb.
2. En Cloudflare: *Add a site* → `mishowo.com` → plan Free. Cloudflare te da dos servidores de nombres.
3. En DonWeb, en la zona del dominio, reemplazá los servidores de nombres por los de Cloudflare (tarda de minutos a unas horas).
4. En Cloudflare > DNS, creá (por ahora **sin la nube naranja**, "DNS only"):
   - `A  @   → IP del servidor`
   - `A  *   → IP del servidor`  (cubre `www`, `api`, `mail` y cada negocio: `slug.mishowo.com`)

## 2. Coolify (recurso MiShowo)
- Variables: `ROOT_DOMAIN=mishowo.com` y `API_HOST=api.mishowo.com`.
- Dominios: frontend `https://mishowo.com`, backend `https://api.mishowo.com`, mailpit `https://mail.mishowo.com`.
- En `docker-compose.coolify.yml`, la etiqueta `HostRegexp(...)` de los negocios tiene el dominio escrito a mano (Coolify no expande variables ahí):
  cambiala a ``HostRegexp(`^[a-z0-9-]+\.mishowo\.com`)``.
- `MAIL_FROM` ya sale de `ROOT_DOMAIN` (no-reply@mishowo.com). Para que los mails no caigan en spam, cuando tengas SMTP real agregá SPF/DKIM en Cloudflare.
- Redeploy.

## 3. HTTPS para los negocios (`slug.mishowo.com`)
Hoy los negocios van por HTTP porque Let's Encrypt no emite certificados comodín por HTTP: hace falta validar por DNS. Con Cloudflare es fácil:
1. Cloudflare > My Profile > API Tokens > *Create Token* con permiso **Zone → DNS → Edit** sobre `mishowo.com`.
2. En Coolify > Servers > Proxy (Traefik): agregá un *certresolver* `cloudflare` con `dnsChallenge.provider=cloudflare` y la variable `CF_DNS_API_TOKEN`, y pedí el certificado `*.mishowo.com` + `mishowo.com`.
3. En la etiqueta de los negocios cambiá `entryPoints=http` por `https` y sumá `tls.certresolver=cloudflare` y `tls.domains[0].main=mishowo.com` / `tls.domains[0].sans=*.mishowo.com`.
4. Cambiá el build arg `NEXT_PUBLIC_ROOT_SCHEME: http` a `https` (los links que se muestran pasan a `https://slug.mishowo.com`) y volvé a deployar.
(Alternativa: dejar la nube naranja de Cloudflare en `*` con SSL "Flexible" — Cloudflare pone el HTTPS al visitante y habla HTTP con el servidor. Es lo más rápido pero el tramo Cloudflare → servidor viaja sin cifrar.)

## 4. Después del cambio
- Probá: `https://mishowo.com`, `https://api.mishowo.com/api/health`, `https://demo-ropa.mishowo.com`.
- Las sesiones se pierden al cambiar de dominio (cookies por dominio): hay que volver a ingresar.
- Si no te acordás de tu usuario o contraseña de admin: ver «Recuperar el acceso» en `DEPLOY.md`.
