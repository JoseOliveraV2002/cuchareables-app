// Envío de correos para recuperar contraseña. Si no hay SMTP configurado, devuelve false
// y el código queda disponible para los administradores en la sección Usuarios.
let nodemailer = null;
try { nodemailer = require("nodemailer"); } catch (e) { nodemailer = null; }

function correoConfigurado() {
  return !!(nodemailer && process.env.SMTP_HOST);
}

async function enviarCodigoRecuperacion(destino, codigo) {
  if (!correoConfigurado()) return false;
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE) === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transporte.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: destino,
    subject: "Código para recuperar tu contraseña",
    text: `Tu código de recuperación es ${codigo}. Vence en 15 minutos.\n\nSi no lo pediste tú, ignora este mensaje.`,
  });
  return true;
}

module.exports = { correoConfigurado, enviarCodigoRecuperacion };
