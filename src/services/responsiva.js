const { PrismaClient } = require('@prisma/client');
let prisma;
function getPrisma() {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const FOLIO_PREFIJO = 'FPT';

// Folio: FPT-MM-DD-NNN/AAAA, con NNN consecutivo global.
// Ajusta esta función si la convención real de folios cambia.
async function siguienteFolioResponsiva() {
  const counter = await getPrisma().folioCounter.upsert({
    where: { id: 1 },
    update: { ultimoNumero: { increment: 1 } },
    create: { id: 1, ultimoNumero: 1 },
  });
  const hoy = new Date();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  const yyyy = hoy.getFullYear();
  return `${FOLIO_PREFIJO}-${mm}-${dd}-${String(counter.ultimoNumero).padStart(3, '0')}/${yyyy}`;
}

function fmtFechaLarga(d) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${d.getDate()}/${meses[d.getMonth()]}/${d.getFullYear()}`;
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

const CARTA_CSS = `
  body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:28px;font-size:13px;line-height:1.5;}
  .cartalogo{max-width:220px;display:block;margin-bottom:10px;}
  h2{font-size:16px;margin:6px 0 14px;}
  h4{font-size:12.5px;text-transform:uppercase;letter-spacing:.03em;border-bottom:1px solid #ddd;padding-bottom:3px;margin:18px 0 8px;}
  ul, ol{margin:0 0 10px;padding-left:20px;}
  li{margin-bottom:4px;}
  .cartaimgs{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0;}
  .cartaimgs img{max-width:260px;border:1px solid #ccc;border-radius:4px;}
  .cartanote{font-size:12px;color:#444;}
  table.cartafirmas{width:100%;border-collapse:collapse;margin-top:26px;}
  table.cartafirmas td{width:50%;padding:8px 6px;font-size:12.5px;}
`;

/**
 * Construye el HTML de la responsiva. logoB64/loginImg1B64/loginImg2B64 son assets
 * fijos de la plantilla oficial (ver src/assets/). fotos son las que suba el usuario
 * al asignar el equipo (opcional).
 */
function buildResponsivaHTML({ empresa, folio, equipo, empleado, fotos = [], assets }) {
  const fecha = fmtFechaLarga(new Date());
  const tipoEquipo = `${equipo.categoria}${equipo.subtipo ? ' — ' + equipo.subtipo : ''}`;
  const marcaModelo = `${equipo.marca || '—'} ${equipo.modelo || ''}`.trim();
  const esLaptop = equipo.categoria === 'Laptop';

  // Página 2: sección fija para evidencia fotográfica y observaciones capturadas al momento
  // de la asignación. Se fuerza a iniciar página nueva para que siempre quede en la hoja 2,
  // sin importar si el equipo es laptop (con guía de acceso) o no.
  const evidenciaSeccion = `
    ${esLaptop ? '' : '<div style="page-break-before: always;"></div>'}
    <h4>Fotografías y observaciones de la entrega</h4>
    ${fotos.length
      ? `<div class="cartaimgs">${fotos.map(b64 => `<img src="data:image/jpeg;base64,${b64}" alt="Fotografía del equipo al momento de la entrega">`).join('')}</div>`
      : `<p class="cartanote">Sin fotografías adjuntas.</p>`}
    <p><strong>Observaciones:</strong> ${equipo.notas ? esc(equipo.notas) : 'Sin observaciones adicionales.'}</p>
  `;

  const guiaAcceso = esLaptop ? `
    <div style="page-break-before: always;"></div>
    <h4>Para el ingreso al equipo</h4>
    <ul>
      <li>En pantalla de inicio, seleccionar "Otro usuario".</li>
      <li>Ingresar sus credenciales, correo electrónico <strong>${esc(empleado.correo || '')}</strong> y contraseña actual.</li>
    </ul>
    <div class="cartaimgs">
      <img src="data:image/jpeg;base64,${assets.loginImg1B64}" alt="Pantalla de inicio de sesión, seleccionar otro usuario">
      <img src="data:image/jpeg;base64,${assets.loginImg2B64}" alt="Ingreso de correo y contraseña">
    </div>
    <p class="cartanote">El equipo cargará su perfil; este proceso tarda aproximadamente 4 horas. Es necesario que el equipo esté encendido, conectado a la red, y evitar apagarlo, bloquearlo o cerrar la tapa, ya que estas acciones lo desconectarán de la red y el proceso se extenderá.</p>
  ` : '';

  const body = `
  <div class="cartadoc">
    <img class="cartalogo" src="data:image/png;base64,${assets.logoB64}" alt="${esc(empresa)}">
    <h2>Responsiva de Entrega de Equipo de Cómputo</h2>
    <p><strong>Número de referencia:</strong> ${esc(folio)}<br><strong>Fecha:</strong> ${fecha}</p>

    <h4>Datos del empleado</h4>
    <ul>
      <li><strong>Nombre del empleado:</strong> ${esc(empleado.nombre)}</li>
      <li><strong>Puesto:</strong> ${esc(empleado.puesto) || '—'}</li>
      <li><strong>Área o departamento:</strong> ${esc(empleado.departamento) || '—'}</li>
      <li><strong>Correo electrónico:</strong> ${esc(empleado.correo) || '—'}</li>
    </ul>

    <h4>Descripción del equipo entregado</h4>
    <ul>
      <li><strong>Tipo de equipo:</strong> ${esc(tipoEquipo)}</li>
      <li><strong>Marca y modelo:</strong> ${esc(marcaModelo) || '—'}</li>
      <li><strong>Número de serie:</strong> ${esc(equipo.serie) || '—'}</li>
      <li><strong>Accesorios incluidos:</strong> ${esc(equipo.accesorios) || '—'}</li>
      <li><strong>Estado del equipo:</strong> ${esc(equipo.condicion) || '—'}</li>
      <li><strong>Nombre del equipo:</strong> ${esc(equipo.nombreEquipo) || '—'}</li>
    </ul>

    <h4>Condiciones de uso</h4>
    <p>El empleado, <strong>${esc(empleado.nombre)}</strong>, declara haber recibido el equipo descrito anteriormente y acepta las siguientes condiciones:</p>
    <ol>
      <li><strong>Responsabilidad del equipo:</strong> el empleado es responsable del buen uso, cuidado y conservación del equipo entregado. En caso de daño, pérdida o robo por negligencia, será responsable de los costos de reparación o reemplazo según las políticas de la empresa.</li>
      <li><strong>Uso exclusivo laboral:</strong> el equipo es de uso exclusivo para las actividades laborales relacionadas con ${esc(empresa)}. No se permitirá su uso para fines personales, ilegales o que infrinjan las políticas internas de la empresa.</li>
      <li><strong>Seguridad de la información:</strong> el empleado se compromete a proteger la información contenida en el equipo, asegurándose de que los datos sensibles o confidenciales de la empresa estén debidamente resguardados, y a cumplir con las políticas de seguridad informática, incluidas las normas sobre uso de contraseñas y acceso a redes.</li>
      <li><strong>Devolución del equipo:</strong> el empleado se compromete a devolver el equipo en las mismas condiciones en que le fue entregado, al término de la relación laboral o cuando la empresa lo solicite.</li>
    </ol>

    <h4>Declaración del empleado</h4>
    <p>Yo, <strong>${esc(empleado.nombre)}</strong>, declaro haber recibido el equipo de cómputo mencionado y me comprometo a cumplir con las responsabilidades y condiciones de uso establecidas en este documento. Entiendo que el equipo es propiedad de ${esc(empresa)} y me responsabilizo por su cuidado durante el tiempo que esté en mi posesión.</p>

    ${guiaAcceso}

    ${evidenciaSeccion}

    <table class="cartafirmas">
      <tr><td><strong>${esc(empleado.nombre)}:</strong></td><td><strong>Analista de TI:</strong></td></tr>
      <tr><td>________________________</td><td>________________________</td></tr>
      <tr><td><strong>Firma de ${esc(empleado.nombre)}:</strong></td><td><strong>Firma de TI:</strong></td></tr>
      <tr><td>________________________</td><td>________________________</td></tr>
    </table>
    <p><strong>Fecha:</strong> ${fecha}</p>
  </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CARTA_CSS}</style></head><body>${body}</body></html>`;
}

module.exports = { siguienteFolioResponsiva, buildResponsivaHTML };
