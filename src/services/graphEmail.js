const { ConfidentialClientApplication } = require('@azure/msal-node');
const fetch = require('node-fetch');

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
};

let cca = null;
function getClient() {
  if (!cca) cca = new ConfidentialClientApplication(msalConfig);
  return cca;
}

async function getAccessToken() {
  const result = await getClient().acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  if (!result || !result.accessToken) throw new Error('No se pudo obtener token de Microsoft Graph');
  return result.accessToken;
}

/**
 * Envía un correo desde el buzón configurado (GRAPH_SENDER_MAILBOX) vía Microsoft Graph.
 * Requiere que la app de Entra ID tenga el permiso de aplicación "Mail.Send" con consentimiento de administrador.
 */
async function sendMail({ to, cc = [], subject, htmlBody, attachments = [] }) {
  const token = await getAccessToken();
  const mailbox = process.env.GRAPH_SENDER_MAILBOX;
  if (!mailbox) throw new Error('GRAPH_SENDER_MAILBOX no está configurado');

  const message = {
    message: {
      subject,
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: [{ emailAddress: { address: to } }],
      ccRecipients: cc.filter(Boolean).map(addr => ({ emailAddress: { address: addr } })),
      attachments: attachments.map(a => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: a.filename,
        contentType: a.contentType || 'text/html',
        contentBytes: a.base64Content,
      })),
    },
    saveToSentItems: true,
  };

  const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Graph sendMail falló (${resp.status}): ${errText}`);
  }
  return true;
}

module.exports = { sendMail };
