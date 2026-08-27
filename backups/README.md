# Respaldos de la base de datos

Cada respaldo es un archivo `.dump` (formato binario de `pg_dump`, comprimido) con
una copia completa de la base de datos al momento en que se generó. Se guardan aquí
automáticamente todos los días a las 3:00 AM hora de Ciudad de México, mediante el
GitHub Action `.github/workflows/respaldo-db.yml`. Se conservan los últimos 30 días;
los más antiguos se borran solos.

## Cómo restaurar un respaldo

**Importante:** restaurar sobrescribe los datos existentes en la base destino. Úsalo
sobre una base nueva/vacía (por ejemplo, una rama de Neon creada para pruebas), no
directamente sobre producción, a menos que sepas que quieres reemplazar todo.

```bash
# 1. Instala el cliente de PostgreSQL si no lo tienes
#    (en Ubuntu/Debian: sudo apt-get install postgresql-client)

# 2. Restaura el respaldo elegido a la base destino:
pg_restore --no-owner --no-acl -d "TU_CADENA_DE_CONEXION_DESTINO" backups/backup-2026-08-27.dump
```

## Restaurar manualmente en cualquier momento (sin esperar al horario programado)

Ve a la pestaña **Actions** del repositorio en GitHub → selecciona
"Respaldo de base de datos" → botón **Run workflow**.

## Configuración necesaria (ya hecha, solo como referencia)

Este workflow requiere un secret del repositorio llamado `DIRECT_URL_BACKUP` con la
cadena de conexión **directa** (sin pooling) de Neon. Se configura en
**Settings → Secrets and variables → Actions**.
