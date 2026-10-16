const { findSession } = require("./db");

function getCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  const match = raw.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

// Usuario de la sesión actual (o null).
async function requireSession(request) {
  const sid = getCookie(request, "sid");
  if (!sid) return null;
  return (await findSession(sid)) || null;
}

function tienePermiso(user, seccion) {
  return user.rol === "admin" || (user.permisos || []).includes(seccion);
}

// Devuelve una Response de error si el usuario no puede entrar, o null si puede.
// Basta con tener permiso en UNA de las secciones indicadas. Si no se indica ninguna, solo exige sesión.
async function denegar(request, ...secciones) {
  const user = await requireSession(request);
  if (!user) return Response.json({ error: "No autenticado." }, { status: 401 });
  if (user.mustChange) return Response.json({ error: "Debes cambiar tu contraseña provisional antes de continuar." }, { status: 403 });
  if (secciones.length && !secciones.some((s) => tienePermiso(user, s))) {
    return Response.json({ error: "No tienes permiso para esta sección." }, { status: 403 });
  }
  return null;
}
async function denegarAdmin(request) {
  const user = await requireSession(request);
  if (!user) return Response.json({ error: "No autenticado." }, { status: 401 });
  if (user.rol !== "admin") return Response.json({ error: "Solo un administrador puede hacer esto." }, { status: 403 });
  return null;
}

module.exports = { requireSession, tienePermiso, denegar, denegarAdmin };
