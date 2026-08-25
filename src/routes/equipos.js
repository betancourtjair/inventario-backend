const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireAdminOrCron } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { esViolacionLlaveForanea, esRegistroInexistente } = require('../utils/prismaErrors');
const { calcFiscal, calcGarantia, calcPrestamo } = require('../services/fiscal');
const { siguienteFolioResponsiva, buildResponsivaHTML } = require('../services/responsiva');
const { sendMail } = require('../services/graphEmail');
const assets = require('../assets');
const router = express.Router();
const prisma = new PrismaClient();

async function getConfigValor(clave, porDefecto = null) {
  const row = await prisma.config.findUnique({ where: { clave } });
  return row ? row.valor : porDefecto;
}

router.get('/', requireAuth(), asyncHandler(async (req, res) => {
  const equipos = await prisma.equipo.findMany({ include: { empleado: true, fotosEntrega: true } });
  const conCalculos = equipos.map(eq => ({
    ...eq,
    fiscal: calcFiscal(eq),
    garantia: calcGarantia(eq),
    prestamo: calcPrestamo(eq),
  }));
  res.json(conCalculos);
}));

router.post('/', requireAuth(['admin','super_admin']), asyncHandler(async (req, res) => {
  const data = req.body;
  if (!data.folio || !data.categoria || !data.estado) {
    return res.status(400).json({ error: 'folio, categoria y estado son obligatorios' });
  }
  const existente = await prisma.equipo.findUnique({ where: { folio: data.folio } });
  if (existente) return res.status(409).json({ error: `El folio "${data.folio}" ya existe` });
  const equipo = await prisma.equipo.create({ data: sanitizeEquipoInput(data) });
  res.status(201).json(equipo);
}));

router.put('/:folio', requireAuth(['admin','super_admin']), asyncHandler(async (req, res) => {
  try {
    const equipo = await prisma.equipo.update({
      where: { folio: req.params.folio },
      data: sanitizeEquipoInput(req.body),
    });
    res.json(equipo);
  } catch (e) {
    if (esRegistroInexistente(e)) return res.status(404).json({ error: `No existe un equipo con folio "${req.params.folio}"` });
    throw e;
  }
}));

router.delete('/:folio', requireAuth(['admin','super_admin']), asyncHandler(async (req, res) => {
  try {
    await prisma.equipo.delete({ where: { folio: req.params.folio } });
    res.json({ ok: true });
  } catch (e) {
    if (esRegistroInexistente(e)) return res.status(404).json({ error: `No existe un equipo con folio "${req.params.folio}" (puede que ya se haya eliminado).` });
    if (esViolacionLlaveForanea(e)) {
      return res.status(409).json({ error: 'No se puede eliminar: este equipo tiene historial de responsivas asociado (protección de auditoría). Cambia su estado a "Baja" en vez de borrarlo.' });
    }
    throw e;
  }
}));

/**
 * Endpoint clave: asignar (o reasignar) un equipo a un empleado.
 * body: { empleadoId, enviarCorreo: boolean (opcional), fotos: [base64,...] (opcional) }
 *
 * - Si el modo migración global está activo (Config "modoMigracion" === "true"),
 *   se ignora enviarCorreo y NO se genera folio de responsiva ni se envía correo:
 *   la asignación se guarda "en silencio", pensado para la carga inicial de inventario.
 * - Si no está en modo migración, enviarCorreo decide si se genera la responsiva y se manda el correo.
 */
router.post('/:folio/asignar', requireAuth(['admin','super_admin']), asyncHandler(async (req, res) => {
  const { empleadoId, enviarCorreo, fotos } = req.body;
  const equipo = await prisma.equipo.findUnique({ where: { folio: req.params.folio } });
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  const empleado = empleadoId ? await prisma.empleado.findUnique({ where: { id: empleadoId } }) : null;
  if (empleadoId && !empleado) return res.status(404).json({ error: 'Empleado no encontrado' });

  await prisma.equipo.update({ where: { folio: equipo.folio }, data: { empleadoId: empleadoId || null } });

  if (Array.isArray(fotos) && fotos.length) {
    await prisma.foto.deleteMany({ where: { equipoFolio: equipo.folio } });
    await prisma.foto.createMany({ data: fotos.slice(0, 4).map(b64 => ({ equipoFolio: equipo.folio, dataBase64: b64 })) });
  }

  const modoMigracion = (await getConfigValor('modoMigracion', 'false')) === 'true';

  if (!empleado || modoMigracion) {
    return res.json({ ok: true, responsivaGenerada: false, motivo: modoMigracion ? 'modo_migracion' : 'sin_empleado' });
  }

  const folioResponsiva = await siguienteFolioResponsiva();
  const empresa = await getConfigValor('empresaNombre', 'Fitness Para Todos');
  const html = buildResponsivaHTML({
    empresa,
    folio: folioResponsiva,
    equipo,
    empleado,
    fotos: fotos || [],
    assets,
  });

  let correoEnviado = false;
  let correoError = null;
  if (enviarCorreo) {
    try {
      await sendMail({
        to: empleado.correo,
        subject: `Responsiva de equipo — ${folioResponsiva}`,
        htmlBody: html,
      });
      correoEnviado = true;
    } catch (e) {
      correoError = e.message;
    }
  }

  const responsiva = await prisma.responsiva.create({
    data: {
      folioResponsiva,
      equipoFolio: equipo.folio,
      empleadoId: empleado.id,
      htmlSnapshot: html,
      correoEnviado,
      correoError,
    },
  });

  res.json({ ok: true, responsivaGenerada: true, folioResponsiva, correoEnviado, correoError, responsivaId: responsiva.id });
}));

// Descarga el HTML de una responsiva ya generada (para imprimir/adjuntar manualmente si no se envió por correo).
router.get('/responsivas/:id/html', requireAuth(), asyncHandler(async (req, res) => {
  const responsiva = await prisma.responsiva.findUnique({ where: { id: req.params.id } });
  if (!responsiva) return res.status(404).send('No encontrada');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(responsiva.htmlSnapshot);
}));

/**
 * Importación masiva (CSV ya parseado en el frontend a JSON).
 * body: { equipos: [...], modoMigracion: boolean }
 * Si modoMigracion es true, ninguno de los registros genera responsiva ni correo,
 * sin importar lo que diga la config global — pensado para la carga inicial.
 */
router.post('/importar', requireAuth(['admin','super_admin']), asyncHandler(async (req, res) => {
  const { equipos } = req.body;
  if (!Array.isArray(equipos)) return res.status(400).json({ error: 'Se esperaba un arreglo "equipos"' });
  let agregados = 0, omitidos = 0;
  for (const raw of equipos) {
    if (!raw.folio || !raw.categoria || !raw.estado) { omitidos++; continue; }
    const existe = await prisma.equipo.findUnique({ where: { folio: raw.folio } });
    if (existe) { omitidos++; continue; }
    await prisma.equipo.create({ data: sanitizeEquipoInput(raw) });
    agregados++;
  }
  res.json({ agregados, omitidos });
}));

router.get('/duplicados', requireAuth(), asyncHandler(async (req, res) => {
  const limCategorias = await prisma.limiteCategoria.findMany();
  const limSubtipos = await prisma.limiteSubtipo.findMany();
  const limCatMap = Object.fromEntries(limCategorias.map(l => [l.categoria, l.limite]));
  const limSubMap = Object.fromEntries(limSubtipos.map(l => [l.subtipo, l.limite]));

  const equipos = await prisma.equipo.findMany({ where: { empleadoId: { not: null }, estado: { not: 'Baja' } }, include: { empleado: true } });
  const grupos = {};
  for (const eq of equipos) {
    const subtipo = eq.categoria === 'Otro' ? (eq.subtipo || '').trim() : '';
    const key = `${eq.empleadoId}|${eq.categoria}|${subtipo}`;
    grupos[key] = grupos[key] || { empleado: eq.empleado, categoria: eq.categoria, subtipo, folios: [] };
    grupos[key].folios.push(eq.folio);
  }
  const resultado = [];
  for (const g of Object.values(grupos)) {
    const limite = g.subtipo && limSubMap[g.subtipo] !== undefined ? limSubMap[g.subtipo] : (limCatMap[g.categoria] ?? Infinity);
    if (g.folios.length > limite) resultado.push({ ...g, cantidad: g.folios.length, limite });
  }
  res.json(resultado);
}));

function sanitizeEquipoInput(data) {
  const campos = ['folio','categoria','subtipo','marca','modelo','serie','estado','ubicacion','nombreEquipo','condicion','accesorios','empleadoId','proveedor','rfcProveedor','numeroFactura','notas'];
  const out = {};
  for (const c of campos) if (data[c] !== undefined) out[c] = data[c] || null;
  if (data.fechaFactura) out.fechaFactura = new Date(data.fechaFactura);
  if (data.fechaInicioUso) out.fechaInicioUso = new Date(data.fechaInicioUso);
  if (data.fechaDevolucionEsperada !== undefined) {
    out.fechaDevolucionEsperada = data.fechaDevolucionEsperada ? new Date(data.fechaDevolucionEsperada) : null;
    out.correoPrestamoVencidoEnviado = false; // si se cambia/renueva la fecha, vuelve a poder notificar
  }
  if (data.montoFactura !== undefined) out.montoFactura = data.montoFactura ? parseFloat(data.montoFactura) : null;
  if (data.tasaDepreciacion !== undefined) out.tasaDepreciacion = data.tasaDepreciacion ? parseFloat(data.tasaDepreciacion) : null;
  if (data.garantiaMeses !== undefined) out.garantiaMeses = data.garantiaMeses ? parseInt(data.garantiaMeses) : null;
  return out;
}

/**
 * Revisa préstamos vencidos (estado "Prestado" + fechaDevolucionEsperada ya pasada)
 * y envía UN solo correo por préstamo (a quien lo tiene Y a TI en copia), marcando
 * correoPrestamoVencidoEnviado para no repetirlo. Pensado para llamarse una vez al día
 * desde un programador externo (ver README, sección "Préstamos vencidos"), pero también
 * se puede disparar a mano con un admin logueado.
 */
router.post('/verificar-prestamos-vencidos', requireAdminOrCron, asyncHandler(async (req, res) => {
  const vencidos = await prisma.equipo.findMany({
    where: {
      estado: 'Prestado',
      correoPrestamoVencidoEnviado: false,
      fechaDevolucionEsperada: { lt: new Date() },
      empleadoId: { not: null },
    },
    include: { empleado: true },
  });

  const correoAdminTI = await getConfigValor('correoAdminTI', null);
  const empresa = await getConfigValor('empresaNombre', 'Fitness Para Todos');
  const resultados = [];

  for (const eq of vencidos) {
    const dias = Math.abs(Math.round((new Date(eq.fechaDevolucionEsperada) - new Date()) / 86400000));
    const subject = `Préstamo vencido — ${eq.folio}`;
    const html = `
      <p>Hola ${eq.empleado.nombre},</p>
      <p>El equipo en préstamo con folio <strong>${eq.folio}</strong> (${eq.categoria}${eq.subtipo ? ' — ' + eq.subtipo : ''}, ${eq.marca || ''} ${eq.modelo || ''})
      tenía fecha de devolución el <strong>${new Date(eq.fechaDevolucionEsperada).toLocaleDateString('es-MX')}</strong> y ya pasaron ${dias} día(s).</p>
      <p>Por favor coordina su devolución con el área de TI de ${empresa} a la brevedad.</p>
    `;
    try {
      await sendMail({
        to: eq.empleado.correo,
        cc: correoAdminTI ? [correoAdminTI] : [],
        subject,
        htmlBody: html,
      });
      await prisma.equipo.update({ where: { folio: eq.folio }, data: { correoPrestamoVencidoEnviado: true } });
      resultados.push({ folio: eq.folio, ok: true });
    } catch (e) {
      resultados.push({ folio: eq.folio, ok: false, error: e.message });
    }
  }

  res.json({ revisados: vencidos.length, resultados });
}));

module.exports = router;
