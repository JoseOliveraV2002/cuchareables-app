const { denegar } = require("../../../lib/authGuard");
const { respuestaError, ejecutar } = require("../../../lib/api");
const { guardarCierre, borrarCierre, guardarApertura, borrarApertura } = require("../../../lib/db");

export const dynamic = "force-dynamic";

// Conciliación mensual (saldo real del banco) y saldo de apertura. Permiso: Panel.
export async function POST(request) {
  const no = await denegar(request, "dashboard");
  if (no) return no;
  const body = await request.json();
  try {
    if (body.tipo === "apertura") await ejecutar(request, "caja", { id: "apertura", hacer: () => guardarApertura(body) });
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
    if (u.searchParams.get("tipo") === "apertura") await ejecutar(request, "caja", { id: "apertura", borrar: true, hacer: () => borrarApertura() });
    else await ejecutar(request, "caja", { id: mes, borrar: true, hacer: () => borrarCierre(mes) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}
