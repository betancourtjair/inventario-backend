const fs = require('fs');
const path = require('path');

// Assets fijos de la plantilla oficial "Responsiva de Entrega de Equipo de Cómputo".
// Si el logo o las capturas de inicio de sesión cambian, solo hay que reemplazar estos 3 archivos .b64.
const logoB64 = fs.readFileSync(path.join(__dirname, 'logo.b64'), 'utf8').trim();
const loginImg1B64 = fs.readFileSync(path.join(__dirname, 'login1.b64'), 'utf8').trim();
const loginImg2B64 = fs.readFileSync(path.join(__dirname, 'login2.b64'), 'utf8').trim();

module.exports = { logoB64, loginImg1B64, loginImg2B64 };
