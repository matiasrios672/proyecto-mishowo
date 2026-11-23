#!/usr/bin/env bash
# Levanta MiShowo en un VPS de prueba con dominio temporal sslip.io (sin certificado, por HTTP).
# Requisitos: Linux con Docker + plugin compose, puerto 80 libre y abierto en el firewall del proveedor.
# Uso:  ./scripts/vps-up.sh                 -> detecta la IP pública, genera .env.vps y levanta todo
#       PUBLIC_IP=1.2.3.4 ./scripts/vps-up.sh   -> si la detección falla
#       ROOT_DOMAIN=mishowo.midominio.com ./scripts/vps-up.sh -> con un dominio propio (apuntá A @ y A * a la IP)
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.vps"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.vps.yml)

command -v docker >/dev/null || { echo "Falta Docker: https://docs.docker.com/engine/install/"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Falta el plugin 'docker compose'."; exit 1; }

if [ ! -f "$ENV_FILE" ]; then
  if [ -z "${ROOT_DOMAIN:-}" ]; then
    IP="${PUBLIC_IP:-$(curl -fsS --max-time 8 https://api.ipify.org || true)}"
    [[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "No pude detectar la IP pública. Corré: PUBLIC_IP=<ip> $0"; exit 1; }
    ROOT_DOMAIN="${IP//./-}.sslip.io" # 203.0.113.10 -> 203-0-113-10.sslip.io (y cualquier subdominio resuelve a la misma IP)
  fi
  umask 077
  cat > "$ENV_FILE" <<EOF
ROOT_DOMAIN=$ROOT_DOMAIN
POSTGRES_PASSWORD=$(openssl rand -hex 24)
REVALIDATE_SECRET=$(openssl rand -hex 24)
ADMIN_SECRET_KEY=$(openssl rand -base64 32)
# Datos que se ven en la web (se incrustan al compilar):
LEGAL_ENTITY=MiShowo
SUPPORT_WHATSAPP=
EOF
  echo "Generé $ENV_FILE (secretos nuevos). Guardalo: sin él no se pueden descifrar los 2FA del admin."
fi

"${COMPOSE[@]}" up -d --build

ROOT="$(grep '^ROOT_DOMAIN=' "$ENV_FILE" | cut -d= -f2)"
echo "Esperando que la API responda..."
for _ in $(seq 1 60); do
  if curl -fsS --max-time 3 -H "Host: api.$ROOT" http://127.0.0.1/api/health >/dev/null 2>&1; then OK=1; break; fi
  sleep 3
done
[ "${OK:-0}" = 1 ] || { echo "La API no respondió a tiempo. Mirá: ${COMPOSE[*]} logs backend"; exit 1; }

cat <<EOF

Listo.
  Web:      http://$ROOT
  API:      http://api.$ROOT/api/health
  Negocios: http://<slug>.$ROOT
  Mails de prueba (Mailpit): ssh -L 8025:localhost:8025 usuario@<ip-del-vps>  y abrí http://localhost:8025

Primer Owner: registrate en http://$ROOT/registro y después
  ${COMPOSE[*]} exec backend node dist/admin-cli.js tu@email.com owner
EOF
