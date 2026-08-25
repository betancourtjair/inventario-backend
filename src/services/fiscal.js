function monthsBetween(d1, d2) {
  let m = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (d2.getDate() < d1.getDate()) m--;
  return Math.max(0, m);
}

// Depreciación en línea recta, SIN factor de actualización por INPC.
// Referencia, no sustituye el cálculo oficial de la declaración anual (LISR Art. 31-37).
function calcFiscal(equipo) {
  const moi = equipo.montoFactura;
  const tasa = equipo.tasaDepreciacion;
  const startDate = equipo.fechaInicioUso || equipo.fechaFactura;
  if (!moi || !tasa || !startDate) return null;

  const start = new Date(startDate);
  const depMensual = (moi * (tasa / 100)) / 12;
  const maxMonths = Math.round(1200 / tasa);
  const monthsElapsed = Math.max(0, Math.min(monthsBetween(start, new Date()), maxMonths));
  const depAcumulada = Math.min(depMensual * monthsElapsed, moi);
  const pendiente = Math.max(moi - depAcumulada, 0);
  const pct = moi > 0 ? (depAcumulada / moi) * 100 : 0;
  const fechaTotal = new Date(start);
  fechaTotal.setMonth(fechaTotal.getMonth() + maxMonths);

  return { moi, tasa, depMensual, monthsElapsed, maxMonths, depAcumulada, pendiente, pct, fechaTotal };
}

function calcGarantia(equipo) {
  const startDate = equipo.fechaFactura || equipo.fechaInicioUso;
  const meses = equipo.garantiaMeses;
  if (!startDate || !meses) return null;

  const start = new Date(startDate);
  const fin = new Date(start);
  fin.setMonth(fin.getMonth() + meses);
  const diasRestantes = Math.round((fin - new Date()) / 86400000);
  let status = 'vigente';
  if (diasRestantes < 0) status = 'vencida';
  else if (diasRestantes <= 30) status = 'porvencer';
  return { fin, diasRestantes, status };
}

module.exports = { calcFiscal, calcGarantia };
