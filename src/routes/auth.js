const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
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

// Utilidad de un solo uso para nombrar al primer super_admin (se autobloquea después).
// Requiere estar logueado como admin (cualquiera de los admins existentes puede ejecutarla una vez).
router.post('/bootstrap-superadmin', requireAuth(['admin']), async (req, res) => {
  const yaExisteSuperAdmin = await prisma.usuario.count({ where: { rol: 'super_admin' } });
  if (yaExisteSuperAdmin > 0) return res.status(403).json({ error: 'Ya existe un super_admin; pídele a esa persona que use el endpoint de cambio de rol.' });
  const { correo } = req.body;
  if (!correo) return res.status(400).json({ error: 'correo es requerido' });
  const usuario = await prisma.usuario.findUnique({ where: { correo } });
  if (!usuario) return res.status(404).json({ error: `No existe un usuario con el correo ${correo}` });
  await prisma.usuario.update({ where: { correo }, data: { rol: 'super_admin' } });
  res.json({ ok: true, correo });
});

/* ---- Gestión de usuarios (solo super_admin) ---- */
router.get('/usuarios', requireAuth(['super_admin']), async (req, res) => {
  const usuarios = await prisma.usuario.findMany({ select: { id: true, correo: true, rol: true, creadoEn: true }, orderBy: { correo: 'asc' } });
  res.json(usuarios);
});

router.post('/usuarios', requireAuth(['super_admin']), async (req, res) => {
  const { correo, password, rol } = req.body;
  if (!correo || !password || !rol) return res.status(400).json({ error: 'correo, password y rol son obligatorios' });
  if (!['admin', 'lectura', 'super_admin'].includes(rol)) return res.status(400).json({ error: 'rol debe ser "admin", "lectura" o "super_admin"' });
  const existe = await prisma.usuario.findUnique({ where: { correo } });
  if (existe) return res.status(409).json({ error: `Ya existe un usuario con el correo ${correo}` });
  const passwordHash = await bcrypt.hash(password, 10);
  const usuario = await prisma.usuario.create({ data: { correo, passwordHash, rol } });
  res.status(201).json({ id: usuario.id, correo: usuario.correo, rol: usuario.rol });
});

router.delete('/usuarios/:id', requireAuth(['super_admin']), async (req, res) => {
  await prisma.usuario.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// El admin resetea la contraseña de cualquier usuario (ej. si a alguien se le olvidó).
router.put('/usuarios/:id/password', requireAuth(['super_admin']), async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  const passwordHash = await bcrypt.hash(password, 10);
  const usuario = await prisma.usuario.update({ where: { id: req.params.id }, data: { passwordHash } });
  res.json({ ok: true, correo: usuario.correo });
});

// Cambiar el rol de un usuario existente (solo super_admin).
router.put('/usuarios/:id/rol', requireAuth(['super_admin']), async (req, res) => {
  const { rol } = req.body;
  if (!['admin', 'lectura', 'super_admin'].includes(rol)) return res.status(400).json({ error: 'rol debe ser "admin", "lectura" o "super_admin"' });
  const usuario = await prisma.usuario.update({ where: { id: req.params.id }, data: { rol } });
  res.json({ id: usuario.id, correo: usuario.correo, rol: usuario.rol });
});

// Cualquier usuario autenticado cambia su propia contraseña, confirmando la actual.
router.post('/cambiar-password', requireAuth(['admin','lectura','super_admin']), async (req, res) => {
  const { passwordActual, passwordNueva } = req.body;
  if (!passwordActual || !passwordNueva) return res.status(400).json({ error: 'passwordActual y passwordNueva son obligatorios' });
  if (passwordNueva.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const ok = await bcrypt.compare(passwordActual, usuario.passwordHash);
  if (!ok) return res.status(401).json({ error: 'La contraseña actual no es correcta' });
  const passwordHash = await bcrypt.hash(passwordNueva, 10);
  await prisma.usuario.update({ where: { id: usuario.id }, data: { passwordHash } });
  res.json({ ok: true });
});

module.exports = router;
