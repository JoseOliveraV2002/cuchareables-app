const bcrypt = require("bcryptjs");
const V = require("../../../../lib/validaciones");
const { registrarAcceso, limitarIp } = require("../../../../lib/api");
const { findUserByEmail, createSession, normEmail, perfilDe, bloqueadoHasta, registrarFallo, limpiarIntentos } = require("../../../../lib/db");

const CLAVE_FALSA = bcrypt.hashSync("clave-falsa", 10); // para tardar lo mismo aunque el correo no exista

function tiempoRestante(ms) {
  const min = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
function respuestaBloqueo(hasta) {
  return Response.json(
    { error: `Acceso bloqueado por demasiados intentos. Podrás volver a intentarlo en ${tiempoRestante(hasta - Date.now())}.`, bloqueadoHasta: hasta },
    { status: 429 }
  );
}

export async function POST(request) {
  const lim = await limitarIp(request, "login", 30);
  if (lim) return lim;
  const { email, password } = await request.json();
  if (!email || !password) {
    return Response.json({ error: "Correo y contraseña son obligatorios." }, { status: 400 });
  }
  const correo = normEmail(email);
  const msgCorreo = V.validarEmail(correo);
  if (msgCorreo) return Response.json({ error: msgCorreo, errores: { email: msgCorreo } }, { status: 400 });

  const bloqueo = await bloqueadoHasta(correo);
  if (bloqueo) return respuestaBloqueo(bloqueo);

  const user = await findUserByEmail(correo);
  const valido = bcrypt.compareSync(password, user ? user.password_hash : CLAVE_FALSA) && !!user && !!user.activo;
  if (!valido) {
    const r = await registrarFallo(correo);
    const quien = user ? { id: user.id, email: user.email, nombre: user.nombre } : { email: correo };
    if (r.bloqueadoHasta) {
      await registrarAcceso(request, quien, "bloqueo", "Acceso bloqueado 2 horas por 3 cierres seguidos");
      return respuestaBloqueo(r.bloqueadoHasta);
    }
    if (r.cierre) {
      await registrarAcceso(request, quien, "cierre", `Acceso cerrado por 3 contraseñas incorrectas (cierre ${r.cierres} de 3)`);
      return Response.json({ error: "Acceso cerrado: escribiste mal la contraseña 3 veces.", cierre: true, cierres: r.cierres }, { status: 401 });
    }
    await registrarAcceso(request, quien, "ingreso_fallido", user ? "Contraseña incorrecta" : "Correo no registrado");
    return Response.json(
      { error: `Correo o contraseña incorrectos. Te ${r.restantes === 1 ? "queda 1 intento" : `quedan ${r.restantes} intentos`} antes de que se cierre el acceso.` },
      { status: 401 }
    );
  }

  await limpiarIntentos(correo);
  const sessionId = await createSession(user.id);
  const { id, email: mail, nombre, rol, permisos, mustChange } = perfilDe(user);
  await registrarAcceso(request, { id, email: mail, nombre }, "ingreso", "Inició sesión");
  const res = Response.json({ ok: true, user: { id, email: mail, nombre, rol, permisos, mustChange } });
  res.headers.set("Set-Cookie", `sid=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${request.headers.get("x-forwarded-proto") === "https" ? "; Secure" : ""}`);
  return res;
}
