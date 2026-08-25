require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Red de seguridad: si algo se escapa de los asyncHandler de las rutas (o de código
// fuera del ciclo de petición/respuesta), lo registramos pero NO dejamos que tumbe
// el proceso completo. Antes de esto, un solo error sin capturar (ej. borrar un
// registro que ya no existía) apagaba el servidor entero para todos los usuarios.
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection (atrapado, el servidor sigue corriendo):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException (atrapado, el servidor sigue corriendo):', err);
});

const authRoutes = require('./routes/auth');
const empleadosRoutes = require('./routes/empleados');
const equiposRoutes = require('./routes/equipos');
const limitesRoutes = require('./routes/limites');
const configRoutes = require('./routes/config');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '15mb' })); // las fotos van en base64, así que subimos el límite

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/limites', limitesRoutes);
app.use('/api/config', configRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API escuchando en el puerto ${PORT}`));
