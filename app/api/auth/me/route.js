const { requireSession } = require("../../../../lib/authGuard");

export async function GET(request) {
  const u = await requireSession(request);
  if (!u) return Response.json({ user: null });
  return Response.json({ user: { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, permisos: u.permisos, mustChange: u.mustChange } });
}
