const jwt = require('jsonwebtoken');

function requireAuth(rolesPermitidos = ['admin', 'lectura']) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Falta token de autenticación' });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (!rolesPermitidos.includes(payload.rol)) {
        return res.status(403).json({ error: 'No tienes permiso para esta acción' });
      }
      req.usuario = payload;
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  };
}

module.exports = { requireAuth };
