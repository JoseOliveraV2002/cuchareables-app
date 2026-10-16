const bcrypt = require("bcryptjs");
const { randomInt } = require("node:crypto");
const { findUserByEmail, normEmail, guardarRecuperacion, findRecuperacion } = require("../../../../lib/db");
const V = require("../../../../lib/validaciones");
const { registrarAcceso, limitarIp } = require("../../../../lib/api");
const { correoConfigurado, enviarCodigoRecuperacion } = require("../../../../lib/correo");

// Siempre responde igual, exista o no el correo, para no revelar quién tiene cuenta.
export async function POST(request) {
  const lim = await limitarIp(request, "recuperar", 10);
  if (lim) return lim;
  const { email } = await request.json();
  const correo = normEmail(email);
  const respuesta = Response.json({ ok: true, porCorreo: correoConfigurado() });
  const msg = V.validarEmail(correo);
  if (msg) return Response.json({ error: msg, errores: { email: msg } }, { status: 400 });

  const user = await findUserByEmail(correo);
  if (!user || !user.activo) return respuesta;

  const previa = await findRecuperacion(correo);
  if (previa && Date.now() - previa.creado < 60 * 1000) return respuesta; // máximo un código por minuto

  const codigo = String(randomInt(0, 1000000)).padStart(6, "0");
  let enviado = false;
  try {
    enviado = await enviarCodigoRecuperacion(correo, codigo);
  } catch (e) {
    console.error("No se pudo enviar el correo de recuperación:", e.message);
  }
  // Sin correo configurado (o si falló el envío), el código queda a la vista de los administradores.
  await registrarAcceso(request, { id: user.id, email: user.email, nombre: user.nombre }, "recuperacion_pedida", "Pidió un código para recuperar su contraseña");
  await guardarRecuperacion({ email: correo, codigoHash: bcrypt.hashSync(codigo, 8), codigoVisible: enviado ? null : codigo });
  if (!enviado) console.log(`[recuperación] código para ${correo}: ${codigo} (vence en 15 min)`);
  return respuesta;
}
