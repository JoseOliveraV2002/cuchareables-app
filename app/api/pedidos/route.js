const { denegar } = require("../../../lib/authGuard");
const { respuestaError, ejecutar } = require("../../../lib/api");
const { savePedido, cambiarPagoPedido, deletePedido } = require("../../../lib/db");

export async function POST(request) {
  const no = await denegar(request, "pedidos");
  if (no) return no;
  const body = await request.json();
  try {
    await ejecutar(request, "pedido", { id: body.id, hacer: () => savePedido(body) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}

export async function PATCH(request) {
  const no = await denegar(request, "pedidos");
  if (no) return no;
  const body = await request.json();
  try {
    await ejecutar(request, "pedido", { id: body.id, hacer: async () => { await cambiarPagoPedido(body.id, body.pago); return body.id; } });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const no = await denegar(request, "pedidos");
  if (no) return no;
  const id = new URL(request.url).searchParams.get("id");
  try {
    await ejecutar(request, "pedido", { id, borrar: true, hacer: () => deletePedido(id) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}
