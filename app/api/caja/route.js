const { denegar } = require("../../../lib/authGuard");
const { respuestaError, ejecutar } = require("../../../lib/api");
const { guardarCierre, borrarCierre, guardarApertura, borrarApertura, guardarAjusteCaja, borrarAjusteCaja } = require("../../../lib/db");

export const dynamic = "force-dynamic";

// Conciliación mensual (saldo real del banco) y saldo de apertura. Permiso: Panel.
export async function POST(request) {
  const no = await denegar(request, "dashboard");
  if (no) return no;
  const body = await request.json();
  try {
    if (body.tipo === "ajuste") {
      const { id: _x, tipo: _t, ...a } = body;
      await ejecutar(request, "caja", { hacer: async () => { const id = await guardarAjusteCaja({ ...a, tipo: body.movimiento }); return `ajuste:${id}`; } });
    } else if (body.tipo === "apertura") await ejecutar(request, "caja", { id: "apertura", hacer: () => guardarApertura(body) });
    else await ejecutar(request, "caja", { id: body.mes, hacer: () => guardarCierre(body) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const no = await denegar(request, "dashboard");
  if (no) return no;
  const u = new URL(request.url);
  const mes = u.searchParams.get("mes");
  try {
    if (u.searchParams.get("tipo") === "ajuste") { const aid = u.searchParams.get("id"); await ejecutar(request, "caja", { id: `ajuste:${aid}`, borrar: true, hacer: () => borrarAjusteCaja(aid) }); }
    else if (u.searchParams.get("tipo") === "apertura") await ejecutar(request, "caja", { id: "apertura", borrar: true, hacer: () => borrarApertura() });
    else await ejecutar(request, "caja", { id: mes, borrar: true, hacer: () => borrarCierre(mes) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}
