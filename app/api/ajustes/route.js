const { denegar } = require("../../../lib/authGuard");
const { respuestaError, ejecutar } = require("../../../lib/api");
const { saveAjusteInventario, deleteAjusteInventario } = require("../../../lib/db");

export async function POST(request) {
  const no = await denegar(request, "stock", "recetas");
  if (no) return no;
  const body = await request.json();
  try {
    await ejecutar(request, "ajuste", { hacer: () => saveAjusteInventario(body) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const no = await denegar(request, "stock", "recetas");
  if (no) return no;
  const id = new URL(request.url).searchParams.get("id");
  try {
    await ejecutar(request, "ajuste", { id, borrar: true, hacer: () => deleteAjusteInventario(id) });
  } catch (e) {
    return respuestaError(e);
  }
  return Response.json({ ok: true });
}
