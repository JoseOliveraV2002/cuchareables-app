export const dynamic = "force-dynamic";
const { requireSession, denegar } = require("../../../lib/authGuard");
const { fetchAllData } = require("../../../lib/db");
const { COLECCIONES } = require("../../../lib/permisos");

export async function GET(request) {
  const no = await denegar(request);
  if (no) return no;
  const user = await requireSession(request);
  const todo = await fetchAllData();
  if (user.rol === "admin") return Response.json(todo);
  // Cada usuario recibe solo los datos que necesitan las secciones que tiene activas.
  const permitidas = new Set(user.permisos.flatMap((s) => COLECCIONES[s] || []));
  const filtrado = {};
  Object.keys(todo).forEach((k) => { filtrado[k] = permitidas.has(k) ? todo[k] : []; });
  return Response.json(filtrado);
}
