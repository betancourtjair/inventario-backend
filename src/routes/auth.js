const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// Nota: este es un login básico propio (correo + contraseña) para arrancar rápido.
// Si más adelante quieren que los empleados entren con su cuenta de Microsoft 365,
// esto se reemplaza por el flujo OAuth de Entra ID (login "con Microsoft").
router.post('/login', async (req, res) => {
  const { correo, password } = req.body;
  const usuario = await prisma.usuario.findUnique({ where: { correo } });
  if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });
  const ok = await bcrypt.compare(password, usuario.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
  const token = jwt.sign({ id: usuario.id, correo: usuario.correo, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, rol: usuario.rol });
});

// Utilidad de un solo uso para crear el primer admin (bórrala o protégela después de usarla).
router.post('/bootstrap-admin', async (req, res) => {
  const yaExiste = await prisma.usuario.count();
  if (yaExiste > 0) return res.status(403).json({ error: 'Ya existe al menos un usuario; usa el panel de administración para crear más.' });
  const { correo, password } = req.body;
  if (!correo || !password) return res.status(400).json({ error: 'correo y password son requeridos' });
  const passwordHash = await bcrypt.hash(password, 10);
  const usuario = await prisma.usuario.create({ data: { correo, passwordHash, rol: 'admin' } });
  res.json({ ok: true, correo: usuario.correo });
});

module.exports = router;
