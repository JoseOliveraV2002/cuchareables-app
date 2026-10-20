const { denegar } = require("../../../../lib/authGuard");
const { respuestaError } = require("../../../../lib/api");
const { congelarCostosVentas } = require("../../../../lib/db");

export const dynamic = "force-dynamic";

// Guarda el costo de producción de ventas antiguas que aún no lo tenían (solo rellena vacíos).
export async function POST(request) {
  const no = await denegar(request, "ventas");
  if (no) return no;
  try {
    const body = await request.json();
    const n = await congelarCostosVentas(body.items);
    return Response.json({ ok: true, n });
  } catch (e) {
    return respuestaError(e);
  }
}
