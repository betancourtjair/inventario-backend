// Prisma normalmente traduce violaciones de llave foránea al código P2003,
// pero para restricciones ON DELETE RESTRICT el error a veces llega "crudo"
// desde Postgres (código 23001/23503) envuelto en un PrismaClientUnknownRequestError,
// sin el código P2003 esperado. Esta función cubre ambos casos.
function esViolacionLlaveForanea(e) {
  if (e && e.code === 'P2003') return true;
  const msg = (e && e.message) || '';
  return msg.includes('foreign key constraint') || msg.includes('violates') || msg.includes('23001') || msg.includes('23503');
}

function esRegistroInexistente(e) {
  return e && e.code === 'P2025';
}

module.exports = { esViolacionLlaveForanea, esRegistroInexistente };
