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
          fotoId: payload.fotoId || null,
          fechaPago: payload.fechaPago || null,
        }),
      })
    )
  );
}
export async function deleteCompra(id) {
  return req(`/api/compras?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function actualizarDocumento(payload) {
  return req("/api/compras", { method: "PUT", body: JSON.stringify(payload) });
}
export async function marcarReembolso(id, reembolsado, fechaReembolso) {
  return req("/api/compras", { method: "PATCH", body: JSON.stringify({ id, reembolsado, fechaReembolso }) });
}

/* Gastos operativos */
export async function saveGasto(g) {
  return req("/api/gastos", { method: "POST", body: JSON.stringify(g) });
}
export async function deleteGasto(id) {
  return req(`/api/gastos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function marcarReembolsoGasto(id, reembolsado, fechaReembolso) {
  return req("/api/gastos", { method: "PATCH", body: JSON.stringify({ id, reembolsado, fechaReembolso }) });
}

/* Caja: conciliación y apertura */
export async function guardarCierre(c) {
  return req("/api/caja", { method: "POST", body: JSON.stringify(c) });
}
export async function borrarCierre(mes) {
  return req(`/api/caja?mes=${encodeURIComponent(mes)}`, { method: "DELETE" });
}
export async function guardarApertura(a) {
  return req("/api/caja", { method: "POST", body: JSON.stringify({ ...a, tipo: "apertura" }) });
}
export async function borrarApertura() {
  return req("/api/caja?tipo=apertura", { method: "DELETE" });
}

/* Fotos de boletas y facturas */
export async function subirFoto(dataUrl) {
  const r = await req("/api/fotos", { method: "POST", body: JSON.stringify({ dataUrl }) });
  return r.id;
}
export async function asignarFoto(id, fotoId, aplicarDocumento) {
  return req("/api/compras", { method: "PATCH", body: JSON.stringify({ id, fotoId, aplicarDocumento: !!aplicarDocumento }) });
}
// Reduce la foto en el navegador (máx. 1600 px, JPG) para que pese poco y se guarde rápido.
export function comprimirImagen(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error("Elige una imagen (foto o captura)."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let q = 0.8, out = c.toDataURL("image/jpeg", q);
      while (out.length > 2.4 * 1024 * 1024 && q > 0.3) { q -= 0.15; out = c.toDataURL("image/jpeg", q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen. Prueba con JPG o PNG.")); };
    img.src = url;
  });
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
export async function congelarCostos(items) {
  return req("/api/ventas/costos", { method: "POST", body: JSON.stringify({ items }) });
}
export async function actualizarCuentaVenta(id, cuenta, registradoPor, fechaCobro) {
  return req("/api/ventas", { method: "PATCH", body: JSON.stringify({ id, cuenta, registradoPor, fechaCobro }) });
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
export async function asignarFotoGasto(id, fotoId, aplicarDocumento) {
  return req("/api/gastos", { method: "PATCH", body: JSON.stringify({ id, fotoId, aplicarDocumento: !!aplicarDocumento }) });
}
