const { denegar } = require("../../../lib/authGuard");
const { respuestaError } = require("../../../lib/api");
const { guardarFoto, obtenerFoto } = require("../../../lib/db");

export const dynamic = "force-dynamic";

// Sube la foto de una boleta o factura (ya reducida por el navegador). Devuelve su id.
export async function POST(request) {
  const no = await denegar(request, "compras");
  if (no) return no;
  try {
    const body = await request.json();
    const id = await guardarFoto(body.dataUrl);
    return Response.json({ id });
  } catch (e) {
    return respuestaError(e);
  }
}

// Entrega la imagen solo a quien tiene sesión y permiso de Compras.
export async function GET(request) {
  const no = await denegar(request, "compras");
  if (no) return no;
  const id = new URL(request.url).searchParams.get("id");
  const foto = id ? await obtenerFoto(id) : null;
  if (!foto) return Response.json({ error: "La foto no existe." }, { status: 404 });
  return new Response(foto.buf, {
    headers: {
      "Content-Type": foto.mime,
      "Cache-Control": "private, max-age=3600",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
