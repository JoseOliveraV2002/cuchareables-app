const { denegar } = require("../../../lib/authGuard");
const { respuestaError, ejecutar } = require("../../../lib/api");
const { saveGasto, deleteGasto, marcarReembolsoGasto } = require("../../../lib/db");

export const dynamic = "force-dynamic";

// Gastos operativos: no son insumos, no tocan el stock. Van con el permiso de Compras.
export async function POST(request) {
  const no = await denegar(request, "compras");
  if (no) return no;
  const body = await request.json();
  try {
    await ejecutar(request, "gasto", { id: body.id, hacer: () => saveGasto(body) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}

export async function PATCH(request) {
  const no = await denegar(request, "compras");
  if (no) return no;
  const body = await request.json();
  try {
    await ejecutar(request, "gasto", { id: body.id, hacer: async () => { await marcarReembolsoGasto(body.id, !!body.reembolsado, body.fechaReembolso); return body.id; } });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const no = await denegar(request, "compras");
  if (no) return no;
  const id = new URL(request.url).searchParams.get("id");
  try {
    await ejecutar(request, "gasto", { id, borrar: true, hacer: () => deleteGasto(id) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}
