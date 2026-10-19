const { denegar } = require("../../../lib/authGuard");
const { respuestaError, ejecutar } = require("../../../lib/api");
const { saveCompra, deleteCompra, marcarReembolsoCompra, asignarFotoCompra, actualizarDocumento } = require("../../../lib/db");

export async function POST(request) {
  const no = await denegar(request, "compras");
  if (no) return no;
  const body = await request.json();
  try {
    await ejecutar(request, "compra", { hacer: () => saveCompra(body) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}

// Edita un documento completo (todos sus ítems).
export async function PUT(request) {
  const no = await denegar(request, "compras");
  if (no) return no;
  const body = await request.json();
  try {
    await ejecutar(request, "compra", { id: (body.ids || [])[0], hacer: () => actualizarDocumento(body) });
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
    await ejecutar(request, "compra", {
      id: body.id,
      hacer: async () => {
        if ("fotoId" in body) await asignarFotoCompra(body.id, body.fotoId || null, !!body.aplicarDocumento);
        else await marcarReembolsoCompra(body.id, body.reembolsado, body.fechaReembolso);
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
    await ejecutar(request, "compra", { id, borrar: true, hacer: () => deleteCompra(id) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}
