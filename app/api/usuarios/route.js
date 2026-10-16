const bcrypt = require("bcryptjs");
const { denegarAdmin, requireSession } = require("../../../lib/authGuard");
const { IDS } = require("../../../lib/permisos");
const V = require("../../../lib/validaciones");
const { ejecutar, registrarAcceso } = require("../../../lib/api");
const { correoConfigurado } = require("../../../lib/correo");
const {
  listUsers, createUser, updateUser, deleteUser, findUserByEmail, normEmail,
  setPassword, deleteSessionsOfUser, limpiarIntentos, recuperacionesPendientes,
} = require("../../../lib/db");

const error = (mensaje, status = 400, errores) => Response.json({ error: mensaje, ...(errores ? { errores } : {}) }, { status });
const conErrores = (errores) => error(V.primerError(errores), 400, errores);

export async function GET(request) {
  const no = await denegarAdmin(request);
  if (no) return no;
  return Response.json({ usuarios: await listUsers(), recuperaciones: await recuperacionesPendientes(), correoConfigurado: correoConfigurado() });
}

export async function POST(request) {
  const no = await denegarAdmin(request);
  if (no) return no;
  const b = await request.json();
  const email = normEmail(b.email);
  const rol = b.rol === "admin" ? "admin" : "usuario";
  const permisos = (b.permisos || []).filter((p) => IDS.includes(p));
  const errores = V.validarUsuario({ nombre: b.nombre, email, password: b.password, rol, permisos });
  if (!errores.email && await findUserByEmail(email)) errores.email = "Ya existe un usuario con ese correo.";
  if (Object.keys(errores).length) return conErrores(errores);
  // La contraseña es provisional: la persona debe cambiarla al entrar por primera vez.
  await ejecutar(request, "usuario", {
    hacer: () => createUser({ email, nombre: String(b.nombre || "").trim(), passwordHash: bcrypt.hashSync(String(b.password), 10), rol, permisos, mustChange: true }),
  });
  return Response.json({ ok: true });
}

export async function PATCH(request) {
  const no = await denegarAdmin(request);
  if (no) return no;
  const yo = await requireSession(request);
  const b = await request.json();
  try {
    if (b.accion === "desbloquear") {
      const u = (await listUsers()).find((x) => x.id === b.id);
      if (!u) return error("El usuario no existe.", 404);
      await limpiarIntentos(u.email);
      await registrarAcceso(request, yo, "desbloqueo", `Desbloqueó el acceso de ${u.email}`);
    } else if (b.accion === "clave") {
      const msg = V.validarClave(b.password, "La contraseña provisional");
      if (msg) return error(msg, 400, { password: msg });
      const u = (await listUsers()).find((x) => x.id === b.id);
      if (!u) return error("El usuario no existe.", 404);
      await setPassword(b.id, bcrypt.hashSync(String(b.password), 10), true);
      await deleteSessionsOfUser(b.id);
      await limpiarIntentos(u.email);
      await registrarAcceso(request, yo, "clave_restablecida", `Restableció la contraseña de ${u.email} (provisional)`);
    } else {
      if (b.id === yo.id && b.activo === false) return error("No puedes desactivar tu propia cuenta.");
      if (b.id === yo.id && b.rol && b.rol !== "admin") return error("No puedes quitarte a ti mismo el rol de administrador.");
      const rol = b.rol;
      if (b.nombre !== undefined) {
        const msg = V.errorTexto(b.nombre, { etiqueta: "El nombre", min: 2, max: 60 });
        if (msg) return error(msg, 400, { nombre: msg });
      }
      if (rol === "usuario" && Array.isArray(b.permisos) && b.permisos.length === 0) return error("Activa al menos una sección para este usuario.", 400, { permisos: "Activa al menos una sección." });
      await ejecutar(request, "usuario", { id: b.id, hacer: async () => { await updateUser(b.id, { nombre: b.nombre, rol, permisos: b.permisos, activo: b.activo }); return b.id; } });
    }
  } catch (e) {
    return error(e.message);
  }
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const no = await denegarAdmin(request);
  if (no) return no;
  const yo = await requireSession(request);
  const id = new URL(request.url).searchParams.get("id");
  if (id === yo.id) return error("No puedes eliminar tu propia cuenta.");
  try {
    await ejecutar(request, "usuario", { id, borrar: true, hacer: () => deleteUser(id) });
  } catch (e) {
    return error(e.message);
  }
  return Response.json({ ok: true });
}
