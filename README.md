# Backend — Control de Inventario, Finanzas y Responsivas

API en Node.js/Express + PostgreSQL (Prisma) que reemplaza el almacenamiento del
prototipo (artifact) por una base de datos real, con historial de responsivas y
envío de correo opcional vía Microsoft 365.

**Stack de despliegue: Render (backend, plan free) + Neon (Postgres, plan free).**
Ambos gratis sin tarjeta. La única contra real es el "cold start" de Render: si nadie
usa la app por un rato, la primera petición tras la inactividad tarda ~30-50 segundos.

> Nota de validación: en el sandbox donde se escribió este backend no había acceso de
> red al servidor de binarios de Prisma, así que la migración inicial (`prisma/migrations/`)
> se escribió a mano en vez de generarse con `prisma migrate dev`. Se probó aplicándola
> contra un PostgreSQL real (inserciones, la detección de duplicados, el contador de folio,
> y la protección de auditoría que impide borrar equipos/empleados con responsivas) y
> funcionó correctamente. Render sí tiene internet completo, así que `prisma generate` y
> `prisma migrate deploy` van a funcionar ahí sin este rodeo.

## 1. Crear la base de datos en Neon (gratis)

1. Entra a [neon.tech](https://neon.tech) → crea cuenta (con GitHub es lo más rápido) → "New Project".
2. Copia el **connection string** que te da (algo como `postgresql://usuario:password@ep-xxxx.neon.tech/neondb?sslmode=require`).
   Ese es tu `DATABASE_URL` completo — Neon ya incluye `sslmode=require`, no lo quites.

## 2. Desplegar el backend en Render (gratis)

1. Sube este código a un repositorio de GitHub (Render despliega desde GitHub/GitLab).
2. Entra a [render.com](https://render.com) → crea cuenta → "New +" → "Web Service" → conecta el repo.
3. Render detecta el archivo `render.yaml` incluido aquí y preconfigura build/start commands.
   Si prefieres hacerlo a mano en vez de con el yaml:
   - Build command: `npm install && npx prisma generate`
   - Start command: `npx prisma migrate deploy && npm start`
   - Plan: **Free**
4. En la pestaña **Environment**, agrega las variables (ver sección 4).
5. Deploy. La primera vez tarda unos minutos porque corre la migración inicial contra Neon.

## 3. Configurar Microsoft 365 (para que el correo salga desde su cuenta real)

Esto lo hace quien tenga permisos de administrador global o de aplicaciones en Microsoft 365
— este paso **no debe automatizarse con un navegador**, porque otorga permiso para enviar
correo como cualquier usuario del tenant; hazlo tú mismo viéndolo en pantalla.

1. Entra a [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **Registros de aplicaciones** → **Nuevo registro**.
   - Nombre: "Inventario TI - Envío de responsivas"
   - Tipo de cuenta: "Solo este directorio organizacional"
2. Copia:
   - **Id. de aplicación (cliente)** → `AZURE_CLIENT_ID`
   - **Id. de directorio (inquilino)** → `AZURE_TENANT_ID`
3. **Certificados y secretos** → **Nuevo secreto de cliente** → cópialo de inmediato → `AZURE_CLIENT_SECRET`
4. **Permisos de API** → **Agregar un permiso** → **Microsoft Graph** → **Permisos de aplicación** → **Mail.Send** → **Agregar permisos**
5. Botón **"Conceder consentimiento de administrador"** — sin este clic el envío falla.
6. Define `GRAPH_SENDER_MAILBOX` con el correo real de envío (ej. `ti@fitnessparatodos.com`); ese buzón debe existir en el tenant.

## 4. Variables de entorno en Render

```
DATABASE_URL=...          # de Neon (paso 1)
JWT_SECRET=...            # cualquier cadena larga y aleatoria
AZURE_TENANT_ID=...       # paso 3
AZURE_CLIENT_ID=...       # paso 3
AZURE_CLIENT_SECRET=...   # paso 3
GRAPH_SENDER_MAILBOX=...  # paso 3
CORS_ORIGIN=*             # restringir al dominio real del frontend cuando lo tengan
```

## 5. Primer usuario admin

Una sola vez, después del primer deploy exitoso:

```bash
curl -X POST https://TU-APP.onrender.com/api/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"correo":"ti@fitnessparatodos.com","password":"defineUnaContraseñaFuerte"}'
```

Este endpoint se autobloquea en cuanto existe un usuario, así que no hace falta borrarlo.

## 6. El "modo migración" para cargar los 1,000+ activos existentes

Antes de importar el inventario real:

```bash
curl -X PUT https://TU-APP.onrender.com/api/config \
  -H "Authorization: Bearer TU_TOKEN" -H "Content-Type: application/json" \
  -d '{"modoMigracion":"true"}'
```

Con esto activo, `/api/equipos/importar` y `/api/equipos/:folio/asignar` **no generan folio
de responsiva ni envían correo**, sin importar lo que mande el frontend. Al terminar la
carga, regresa `modoMigracion` a `"false"`.

## 7. Qué falta para estar 100% listo

- **Frontend**: adaptar el HTML/artifact para llamar a esta API en vez de `window.storage`.
- **Fotos de equipo**: hoy se guardan como base64 en la tabla `Foto`. Funciona bien a este
  tamaño; si el volumen crece mucho, conviene moverlas a almacenamiento de objetos.
- **Cold start de Render free**: si notan que el primer uso del día siempre tarda,
  considerar el plan pagado más económico (~$7 USD/mes) que mantiene la instancia despierta.
- **Backups de Neon**: revisar la política de retención del plan free y, si el negocio lo
  requiere, programar un respaldo adicional (`pg_dump` semanal a un bucket propio).
