const { denegarAdmin } = require("../../../lib/authGuard");
const { listarAuditoria } = require("../../../lib/db");

export const dynamic = "force-dynamic";

// Solo administradores: historial de cambios y accesos.
export async function GET(request) {
  const no = await denegarAdmin(request);
  if (no) return no;
  const p = new URL(request.url).searchParams;
  const resultado = await listarAuditoria({
    desde: p.get("desde") || undefined, hasta: p.get("hasta") || undefined, usuario: p.get("usuario") || undefined,
    entidad: p.get("entidad") || undefined, accion: p.get("accion") || undefined, q: p.get("q") || undefined,
    pagina: p.get("pagina") || 0, limite: p.get("limite") || 40,
  });
  return Response.json(resultado);
}
