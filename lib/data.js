"use client";

async function req(url, options) {
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Error en ${url}`);
    err.errores = body.errores || null;
    throw err;
  }
  return res.json();
}

export async function fetchAll() {
  return req("/api/data");
}

/* Clientes */
export async function saveCliente(c) {
  return req("/api/clientes", { method: "POST", body: JSON.stringify(c) });
}
export async function deleteCliente(id) {
  return req(`/api/clientes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* Ingredientes */
export async function saveIngrediente(i) {
  return req("/api/ingredientes", { method: "POST", body: JSON.stringify(i) });
}
export async function deleteIngrediente(id) {
  return req(`/api/ingredientes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* Compras — un documento puede traer varios insumos a la vez */
export async function saveCompra(payload) {
  const items = payload.items || [payload];
  await Promise.all(
    items.map((it) =>
      req("/api/compras", {
        method: "POST",
        body: JSON.stringify({
          fecha: payload.fecha,
          tipoDocumento: payload.tipoDocumento,
          numero: payload.numero,
          ingredienteId: it.ingredienteId,
          cantidad: it.cantidad,
          unidad: it.unidad,
          costoTotal: it.costoTotal,
          cuenta: payload.cuenta,
          registradoPor: payload.registradoPor,
          marca: it.marca || null,
        }),
      })
    )
  );
}
export async function deleteCompra(id) {
  return req(`/api/compras?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function marcarReembolso(id, reembolsado) {
  return req("/api/compras", { method: "PATCH", body: JSON.stringify({ id, reembolsado }) });
}

/* Recetas base */
export async function saveRecetaBase(r) {
  return req("/api/recetas-base", { method: "POST", body: JSON.stringify(r) });
}
export async function deleteRecetaBase(id) {
  return req(`/api/recetas-base?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* Producción (lotes) */
export async function saveProduccion(p) {
  return req("/api/producciones", { method: "POST", body: JSON.stringify(p) });
}
export async function deleteProduccion(id) {
  return req(`/api/producciones?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* Productos */
export async function saveProducto(p) {
  return req("/api/productos", { method: "POST", body: JSON.stringify(p) });
}
export async function deleteProducto(id) {
  return req(`/api/productos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* Ventas */
export async function saveVenta(v) {
  return req("/api/ventas", { method: "POST", body: JSON.stringify(v) });
}
export async function deleteVenta(id) {
  return req(`/api/ventas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function actualizarCuentaVenta(id, cuenta, registradoPor) {
  return req("/api/ventas", { method: "PATCH", body: JSON.stringify({ id, cuenta, registradoPor }) });
}

/* Pedidos */
export async function savePedido(p) {
  return req("/api/pedidos", { method: "POST", body: JSON.stringify(p) });
}
export async function deletePedido(id) {
  return req(`/api/pedidos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function cambiarPagoPedido(id, pago) {
  return req("/api/pedidos", { method: "PATCH", body: JSON.stringify({ id, pago }) });
}

/* Ajustes de inventario */
export async function saveAjuste(a) {
  return req("/api/ajustes", { method: "POST", body: JSON.stringify(a) });
}
export async function deleteAjuste(id) {
  return req(`/api/ajustes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* Usuarios y permisos (solo administradores) */
export async function fetchUsuarios() {
  return req("/api/usuarios");
}
export async function crearUsuario(u) {
  return req("/api/usuarios", { method: "POST", body: JSON.stringify(u) });
}
export async function actualizarUsuario(u) {
  return req("/api/usuarios", { method: "PATCH", body: JSON.stringify(u) });
}
export async function eliminarUsuario(id) {
  return req(`/api/usuarios?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* Auditoría (solo administradores) */
export async function fetchAuditoria(filtros = {}) {
  const q = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => { if (v !== "" && v != null) q.set(k, v); });
  return req(`/api/auditoria?${q.toString()}`);
}
