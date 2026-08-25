const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', requireAuth(), async (req, res) => {
  const rows = await prisma.config.findMany();
  res.json(Object.fromEntries(rows.map(r => [r.clave, r.valor])));
});

// Ejemplo de body: { "empresaNombre": "Fitness Para Todos", "modoMigracion": "true" }
router.put('/', requireAuth(['admin']), async (req, res) => {
  const entries = Object.entries(req.body);
  for (const [clave, valor] of entries) {
    await prisma.config.upsert({ where: { clave }, update: { valor: String(valor) }, create: { clave, valor: String(valor) } });
  }
  res.json({ ok: true });
});

module.exports = router;
