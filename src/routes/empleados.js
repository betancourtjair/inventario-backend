const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', requireAuth(), async (req, res) => {
  const empleados = await prisma.empleado.findMany({
    include: { _count: { select: { equipos: true } } },
    orderBy: { nombre: 'asc' },
  });
  res.json(empleados);
});

router.post('/', requireAuth(['admin','super_admin']), async (req, res) => {
  const { id, nombre, correo, departamento, puesto, estado } = req.body;
  if (!id || !nombre || !correo) return res.status(400).json({ error: 'id, nombre y correo son obligatorios' });
  const existente = await prisma.empleado.findUnique({ where: { id } });
  if (existente) return res.status(409).json({ error: `El ID "${id}" ya existe` });
  const empleado = await prisma.empleado.create({ data: { id, nombre, correo, departamento, puesto, estado: estado || 'Activo' } });
  res.status(201).json(empleado);
});

router.put('/:id', requireAuth(['admin','super_admin']), async (req, res) => {
  const { nombre, correo, departamento, puesto, estado } = req.body;
  const empleado = await prisma.empleado.update({
    where: { id: req.params.id },
    data: { nombre, correo, departamento, puesto, estado },
  });
  res.json(empleado);
});

router.delete('/:id', requireAuth(['admin','super_admin']), async (req, res) => {
  const asignados = await prisma.equipo.count({ where: { empleadoId: req.params.id, estado: { not: 'Baja' } } });
  if (asignados > 0 && req.query.confirmar !== 'true') {
    return res.status(409).json({ error: `Este empleado tiene ${asignados} equipo(s) asignado(s). Reenvía la solicitud con ?confirmar=true para desasignarlos y eliminarlo.` });
  }
  await prisma.equipo.updateMany({ where: { empleadoId: req.params.id }, data: { empleadoId: null } });
  try {
    await prisma.empleado.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2003') {
      return res.status(409).json({ error: 'No se puede eliminar: este empleado tiene historial de responsivas asociado (protección de auditoría). Marca su estado como "Baja" en vez de borrarlo.' });
    }
    throw e;
  }
});

module.exports = router;
