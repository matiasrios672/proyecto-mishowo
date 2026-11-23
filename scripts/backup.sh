#!/bin/sh
# Backup de la base y de las fotos/videos subidos. Pensado para correr en el host (cron diario) o en una Scheduled Task de Coolify.
# Uso: DB_CONTAINER=<contenedor db> UPLOADS_VOLUME=<volumen uploads> BACKUP_DIR=/var/backups/mishowo ./scripts/backup.sh
# Guarda 14 días. Copiá BACKUP_DIR fuera del servidor (rclone, rsync, S3...): un backup en el mismo disco no es un backup.
set -eu

DB_CONTAINER="${DB_CONTAINER:?definir DB_CONTAINER}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:?definir UPLOADS_VOLUME}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mishowo}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

docker exec "$DB_CONTAINER" pg_dump -U mishowo -d mishowo --format=custom > "$BACKUP_DIR/db-$STAMP.dump"
docker run --rm -v "$UPLOADS_VOLUME":/data:ro -v "$BACKUP_DIR":/out alpine \
  tar czf "/out/uploads-$STAMP.tar.gz" -C /data .

find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "Backup listo: $BACKUP_DIR (db-$STAMP.dump, uploads-$STAMP.tar.gz)"
# Restaurar: docker exec -i <db> pg_restore -U mishowo -d mishowo --clean --if-exists < db-XXXX.dump
