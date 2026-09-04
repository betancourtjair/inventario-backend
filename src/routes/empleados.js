const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { esViolacionLlaveForanea, esRegistroInexistente } = require('../utils/prismaErrors');
const router = express.Router();
const prisma = new PrismaClient();

const DEPARTAMENTOS_VALIDOS = ['DIRECCION', 'FINANZAS', 'LEGAL', 'CRECIMIENTO HUMANO', 'OPERACIONES', 'MARKETING', 'CONSTRUCCION', 'EXPANSION', 'TI']; // LEGAL pertenece a la dirección de Finanzas
function quitarAcentos(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function normalizarDepartamento(valor) {
  if (!valor) return valor;
  const limpio = quitarAcentos(String(valor).trim()).toUpperCase();
  const match = DEPARTAMENTOS_VALIDOS.find(d => quitarAcentos(d).toUpperCase() === limpio);
  return match || String(valor).trim(); // si no coincide con la lista, se deja tal cual (recortado) en vez de perder el dato
}

router.get('/', requireAuth(), asyncHandler(async (req, res) => {
  const empleados = await prisma.empleado.findMany({
    include: { _count: { select: { equipos: true } } },
    orderBy: { nombre: 'asc' },
  });
  res.json(empleados);
}));

router.post('/', requireAuth(['admin','super_admin']), asyncHandler(async (req, res) => {
  const { id, nombre, correo, departamento, puesto, estado } = req.body;
  if (!id || !nombre || !correo) return res.status(400).json({ error: 'id, nombre y correo son obligatorios' });
  const existente = await prisma.empleado.findUnique({ where: { id } });
  if (existente) return res.status(409).json({ error: `El ID "${id}" ya existe` });
  const empleado = await prisma.empleado.create({ data: { id, nombre, correo, departamento: normalizarDepartamento(departamento), puesto, estado: estado || 'Activo' } });
  res.status(201).json(empleado);
}));

router.put('/:id', requireAuth(['admin','super_admin']), asyncHandler(async (req, res) => {
  const { nombre, correo, departamento, puesto, estado } = req.body;
  try {
    const empleado = await prisma.empleado.update({
      where: { id: req.params.id },
      data: { nombre, correo, departamento: departamento !== undefined ? normalizarDepartamento(departamento) : undefined, puesto, estado },
    });
    res.json(empleado);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: `No existe un empleado con ID "${req.params.id}"` });
    throw e;
  }
}));

router.delete('/:id', requireAuth(['admin','super_admin']), asyncHandler(async (req, res) => {
  const asignados = await prisma.equipo.count({ where: { empleadoId: req.params.id, estado: { not: 'Baja' } } });
  if (asignados > 0 && req.query.confirmar !== 'true') {
    return res.status(409).json({ error: `Este empleado tiene ${asignados} equipo(s) asignado(s). Reenvía la solicitud con ?confirmar=true para desasignarlos y eliminarlo.` });
  }
  await prisma.equipo.updateMany({ where: { empleadoId: req.params.id }, data: { empleadoId: null } });
  try {
    await prisma.empleado.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    if (esRegistroInexistente(e)) return res.status(404).json({ error: `No existe un empleado con ID "${req.params.id}" (puede que ya se haya eliminado).` });
    if (esViolacionLlaveForanea(e)) {
      return res.status(409).json({ error: 'No se puede eliminar: este empleado tiene historial de responsivas asociado (protección de auditoría). Marca su estado como "Baja" en vez de borrarlo.' });
    }
    throw e;
  }
}));

module.exports = router;
