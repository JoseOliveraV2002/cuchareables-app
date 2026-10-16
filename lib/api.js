// Utilidades comunes de las rutas: respuesta de errores y registro de auditoría.
const { requireSession } = require("./authGuard");
const { describir, registrarAuditoria, ErrorValidacion, limitar } = require("./db");

// Convierte un error en respuesta 400 con el mensaje (y los campos con error, si los hay).
function respuestaError(e) {
  if (e instanceof ErrorValidacion) return Response.json({ error: e.message, errores: e.errores }, { status: 400 });
  return Response.json({ error: e.message || "No se pudo completar la operación." }, { status: 400 });
}

// Ejecuta un cambio y deja constancia de quién lo hizo, qué había antes y qué quedó.
//   entidad: "cliente" | "insumo" | "compra" | ...  ·  id: registro afectado (si ya existe)
//   hacer(): realiza el cambio y devuelve el id resultante (o nada al eliminar)
async function ejecutar(request, entidad, { id, borrar = false, hacer, detalle }) {
  const usuario = await requireSession(request);
  const antes = id ? await describir(entidad, id) : null;
  const nuevoId = await hacer();
  const finalId = nuevoId || id;
  const despues = borrar ? null : await describir(entidad, finalId);
  if (borrar) {
    if (!antes) return nuevoId; // ya no existía: nada que registrar
    await registrarAuditoria({ usuario, accion: "eliminar", entidad, entidadId: id, antes, detalle });
  } else {
    const accion = antes ? "editar" : "crear";
    if (accion === "editar" && JSON.stringify(antes) === JSON.stringify(despues)) return nuevoId; // sin cambios reales
    await registrarAuditoria({ usuario, accion, entidad, entidadId: finalId, antes, despues, detalle });
  }
  return nuevoId;
}

// Eventos de acceso (ingresos, bloqueos, cambios de contraseña...).
async function registrarAcceso(request, usuario, accion, detalle) {
  await registrarAuditoria({ usuario: usuario || await requireSession(request), accion, entidad: "acceso", detalle });
}

// Limita peticiones por IP; devuelve una Response 429 si se pasó, o null.
async function limitarIp(request, nombre, max, minutos = 15) {
  const ip = (request.headers.get("x-forwarded-for") || "desconocida").split(",")[0].trim();
  if (await limitar(`${nombre}:${ip}`, max, minutos * 60 * 1000)) return null;
  return Response.json({ error: "Demasiados intentos desde tu conexión. Espera unos minutos e inténtalo de nuevo." }, { status: 429 });
}

module.exports = { limitarIp, respuestaError, ejecutar, registrarAcceso };
