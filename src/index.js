require('dotenv').config();
const express = require('express');
const cors = require('cors');

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
