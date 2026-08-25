const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', requireAuth(), async (req, res) => {
  const categorias = await prisma.limiteCategoria.findMany();
  const subtipos = await prisma.limiteSubtipo.findMany();
  res.json({ categorias, subtipos });
});

router.put('/categoria/:categoria', requireAuth(['admin']), async (req, res) => {
  const { limite } = req.body;
  const row = await prisma.limiteCategoria.upsert({
    where: { categoria: req.params.categoria },
    update: { limite },
    create: { categoria: req.params.categoria, limite },
  });
  res.json(row);
});

router.put('/subtipo/:subtipo', requireAuth(['admin']), async (req, res) => {
  const { limite } = req.body;
  const row = await prisma.limiteSubtipo.upsert({
    where: { subtipo: req.params.subtipo },
    update: { limite },
    create: { subtipo: req.params.subtipo, limite },
  });
  res.json(row);
});

router.delete('/subtipo/:subtipo', requireAuth(['admin']), async (req, res) => {
  await prisma.limiteSubtipo.delete({ where: { subtipo: req.params.subtipo } });
  res.json({ ok: true });
});

module.exports = router;
