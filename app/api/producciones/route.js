const { denegar } = require("../../../lib/authGuard");
const { respuestaError, ejecutar } = require("../../../lib/api");
const { saveProduccion, deleteProduccion } = require("../../../lib/db");

export async function POST(request) {
  const no = await denegar(request, "recetas");
  if (no) return no;
  const body = await request.json();
  try {
    await ejecutar(request, "lote", { hacer: () => saveProduccion(body) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const no = await denegar(request, "recetas");
  if (no) return no;
  const id = new URL(request.url).searchParams.get("id");
  try {
    await ejecutar(request, "lote", { id, borrar: true, hacer: () => deleteProduccion(id) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}
