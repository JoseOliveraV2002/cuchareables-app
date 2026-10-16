const { denegar } = require("../../../lib/authGuard");
const { respuestaError, ejecutar } = require("../../../lib/api");
const { saveCliente, deleteCliente } = require("../../../lib/db");

export async function POST(request) {
  const no = await denegar(request, "clientes");
  if (no) return no;
  const body = await request.json();
  try {
    await ejecutar(request, "cliente", { id: body.id, hacer: () => saveCliente(body) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const no = await denegar(request, "clientes");
  if (no) return no;
  const id = new URL(request.url).searchParams.get("id");
  try {
    await ejecutar(request, "cliente", { id, borrar: true, hacer: () => deleteCliente(id) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}
