const { denegar } = require("../../../lib/authGuard");
const { respuestaError, ejecutar } = require("../../../lib/api");
const { guardarDocumentoGasto, deleteGasto, marcarReembolsoGasto, asignarFotoGasto } = require("../../../lib/db");

export const dynamic = "force-dynamic";

// Gastos operativos: no son insumos ni tocan el costo de las recetas. Van con el permiso de Compras.
// Un documento (boleta, factura, recibo) con una o más líneas; si una línea es un artículo (ej. tapers), se lleva su stock.
export async function POST(request) {
  const no = await denegar(request, "compras");
  if (no) return no;
  const body = await request.json();
  try {
    await ejecutar(request, "gasto", { id: (body.ids || [])[0], hacer: () => guardarDocumentoGasto(body) });
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
    await ejecutar(request, "gasto", {
      id: body.id,
      hacer: async () => {
        if ("fotoId" in body) await asignarFotoGasto(body.id, body.fotoId || null, !!body.aplicarDocumento);
        else await marcarReembolsoGasto(body.id, !!body.reembolsado, body.fechaReembolso);
        return body.id;
      },
    });
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
