const bcrypt = require("bcryptjs");
const { requireSession } = require("../../../../lib/authGuard");
const V = require("../../../../lib/validaciones");
const { registrarAcceso } = require("../../../../lib/api");
const { findUserByEmail, setPassword, deleteSessionsOfUser, createSession } = require("../../../../lib/db");

export async function POST(request) {
  const sesion = await requireSession(request);
  if (!sesion) return Response.json({ error: "No autenticado." }, { status: 401 });
  const { actual, nueva } = await request.json();
  const user = await findUserByEmail(sesion.email);
  if (!actual || !bcrypt.compareSync(String(actual), user.password_hash)) {
    return Response.json({ error: "La contraseña actual no es correcta." }, { status: 400 });
  }
  const msg = V.validarClave(nueva, "La contraseña nueva");
  if (msg) return Response.json({ error: msg, errores: { nueva: msg } }, { status: 400 });
  if (String(nueva) === String(actual)) {
    return Response.json({ error: "La contraseña nueva debe ser distinta de la actual." }, { status: 400 });
  }
  await setPassword(user.id, bcrypt.hashSync(String(nueva), 10), false);
  await registrarAcceso(request, { id: user.id, email: user.email, nombre: user.nombre }, "clave_cambiada", "Cambió su contraseña");
  await deleteSessionsOfUser(user.id); // cierra las demás sesiones abiertas con la clave anterior
  const sid = await createSession(user.id);
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${request.headers.get("x-forwarded-proto") === "https" ? "; Secure" : ""}`);
  return res;
}
