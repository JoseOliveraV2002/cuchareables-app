const { denegar } = require("../../../lib/authGuard");
const { respuestaError, ejecutar } = require("../../../lib/api");
const { saveIngrediente, deleteIngrediente } = require("../../../lib/db");

export async function POST(request) {
  const no = await denegar(request, "compras");
  if (no) return no;
  const body = await request.json();
  try {
    await ejecutar(request, "insumo", { id: body.id, hacer: () => saveIngrediente(body) });
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
    await ejecutar(request, "insumo", { id, borrar: true, hacer: () => deleteIngrediente(id) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}
