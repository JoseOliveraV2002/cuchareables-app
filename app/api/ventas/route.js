const { denegar } = require("../../../lib/authGuard");
const { respuestaError, ejecutar } = require("../../../lib/api");
const { saveVenta, deleteVenta, actualizarCuentaVenta } = require("../../../lib/db");

export async function POST(request) {
  const body = await request.json();
  // Entregar un pedido registra la venta: basta con tener permiso de Pedidos.
  const no = body.pedidoId ? await denegar(request, "ventas", "pedidos") : await denegar(request, "ventas");
  if (no) return no;
  try {
    await ejecutar(request, "venta", { hacer: () => saveVenta(body), detalle: body.pedidoId ? "Registrada al entregar un pedido" : undefined });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}

export async function PATCH(request) {
  const no = await denegar(request, "ventas");
  if (no) return no;
  const body = await request.json();
  try {
    await ejecutar(request, "venta", { id: body.id, hacer: async () => { await actualizarCuentaVenta(body.id, body.cuenta, body.registradoPor); return body.id; } });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const no = await denegar(request, "ventas");
  if (no) return no;
  const id = new URL(request.url).searchParams.get("id");
  try {
    await ejecutar(request, "venta", { id, borrar: true, hacer: () => deleteVenta(id) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}
