const bcrypt = require("bcryptjs");
const V = require("../../../../lib/validaciones");
const { registrarAcceso, limitarIp } = require("../../../../lib/api");
const { findUserByEmail, normEmail, findRecuperacion, sumarIntentoRecuperacion, borrarRecuperacion, setPassword, deleteSessionsOfUser, limpiarIntentos } = require("../../../../lib/db");

const INVALIDO = () => Response.json({ error: "El código no es válido o ya venció." }, { status: 400 });

export async function POST(request) {
  const lim = await limitarIp(request, "restablecer", 10);
  if (lim) return lim;
  const { email, codigo, password } = await request.json();
  const correo = normEmail(email);
  const msg = V.validarClave(password, "La contraseña nueva");
  if (msg) return Response.json({ error: msg, errores: { password: msg } }, { status: 400 });
  const rec = await findRecuperacion(correo);
  const user = await findUserByEmail(correo);
  if (!rec || !user || !user.activo || rec.expira < Date.now() || rec.intentos >= 5) return INVALIDO();
  if (!bcrypt.compareSync(String(codigo || "").trim(), rec.codigo_hash)) {
    await sumarIntentoRecuperacion(correo);
    return INVALIDO();
  }
  await setPassword(user.id, bcrypt.hashSync(String(password), 10), false);
  await registrarAcceso(request, { id: user.id, email: user.email, nombre: user.nombre }, "clave_recuperada", "Creó una contraseña nueva con un código de recuperación");
  await borrarRecuperacion(correo);
  await limpiarIntentos(correo);
  await deleteSessionsOfUser(user.id);
  return Response.json({ ok: true });
}
