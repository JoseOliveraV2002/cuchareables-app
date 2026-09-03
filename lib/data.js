"use client";
import { supabase } from "./supabaseClient";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

async function run(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export async function fetchAll() {
  const [clientes, ingredientes, compras, recetasBase, producciones, productos, ventas] = await Promise.all([
    run(supabase.from("clientes").select("id, nombre, telefono, email, direccion, notas").order("nombre"), "clientes"),
    run(supabase.from("ingredientes").select("id, nombre, unidad").order("nombre"), "ingredientes"),
    run(
      supabase
        .from("compras")
        .select("id, fecha, tipoDocumento:tipo_documento, numero, ingredienteId:ingrediente_id, cantidad, unidad, costoTotal:costo_total")
        .order("fecha", { ascending: false }),
      "compras"
    ),
    run(
      supabase
        .from("recetas_base")
        .select("id, nombre, unidadRendimiento:unidad_rendimiento, ingredientes:receta_base_ingredientes(ingredienteId:ingrediente_id, cantidad, unidad)")
        .order("nombre"),
      "recetas base"
    ),
    run(
      supabase
        .from("producciones")
        .select(
          "id, recetaBaseId:receta_base_id, fecha, rendimientoReal:rendimiento_real, unidadRendimiento:unidad_rendimiento, notas, ingredientesUsados:produccion_ingredientes(ingredienteId:ingrediente_id, cantidad, unidad)"
        )
        .order("fecha", { ascending: false }),
      "producciones"
    ),
    run(
      supabase
        .from("productos")
        .select("id, nombre, precioVenta:precio_venta, componentes:producto_componentes(tipo, refId:ref_id, cantidad, unidad)")
        .order("nombre"),
      "productos"
    ),
    run(
      supabase
        .from("ventas")
        .select("id, fecha, clienteId:cliente_id, total, items:venta_items(productoId:producto_id, cantidad, precioUnitario:precio_unitario)")
        .order("fecha", { ascending: false }),
      "ventas"
    ),
  ]);

  return { clientes, ingredientes, compras, recetasBase, producciones, productos, ventas };
}

/* Clientes */
export async function saveCliente(c) {
  const row = { id: c.id || uid(), nombre: c.nombre, telefono: c.telefono || null, email: c.email || null, direccion: c.direccion || null, notas: c.notas || null };
  await run(supabase.from("clientes").upsert(row), "guardar cliente");
  return row;
}
export async function deleteCliente(id) {
  await run(supabase.from("clientes").delete().eq("id", id), "eliminar cliente");
}

/* Ingredientes */
export async function saveIngrediente(i) {
  const row = { id: uid(), nombre: i.nombre, unidad: i.unidad };
  await run(supabase.from("ingredientes").insert(row), "guardar insumo");
  return row;
}

/* Compras */
export async function saveCompra(c) {
  const row = {
    id: uid(),
    fecha: c.fecha,
    tipo_documento: c.tipoDocumento,
    numero: c.numero || null,
    ingrediente_id: c.ingredienteId,
    cantidad: Number(c.cantidad),
    unidad: c.unidad,
    costo_total: Number(c.costoTotal),
  };
  await run(supabase.from("compras").insert(row), "guardar compra");
}
export async function deleteCompra(id) {
  await run(supabase.from("compras").delete().eq("id", id), "eliminar compra");
}

/* Recetas base */
export async function saveRecetaBase(r) {
  const id = r.id || uid();
  await run(supabase.from("recetas_base").upsert({ id, nombre: r.nombre, unidad_rendimiento: r.unidadRendimiento }), "guardar receta base");
  await run(supabase.from("receta_base_ingredientes").delete().eq("receta_base_id", id), "limpiar ingredientes receta base");
  const filas = r.ingredientes.map((i) => ({ id: uid(), receta_base_id: id, ingrediente_id: i.ingredienteId, cantidad: Number(i.cantidad), unidad: i.unidad }));
  if (filas.length) await run(supabase.from("receta_base_ingredientes").insert(filas), "guardar ingredientes receta base");
}
export async function deleteRecetaBase(id) {
  await run(supabase.from("recetas_base").delete().eq("id", id), "eliminar receta base");
}

/* Producción (lotes) */
export async function saveProduccion(p) {
  const id = uid();
  await run(
    supabase.from("producciones").insert({
      id,
      receta_base_id: p.recetaBaseId,
      fecha: p.fecha,
      rendimiento_real: Number(p.rendimientoReal),
      unidad_rendimiento: p.unidadRendimiento,
      notas: p.notas || null,
    }),
    "guardar lote"
  );
  const filas = p.ingredientesUsados.map((i) => ({ id: uid(), produccion_id: id, ingrediente_id: i.ingredienteId, cantidad: Number(i.cantidad) || 0, unidad: i.unidad }));
  if (filas.length) await run(supabase.from("produccion_ingredientes").insert(filas), "guardar insumos del lote");
}
export async function deleteProduccion(id) {
  await run(supabase.from("producciones").delete().eq("id", id), "eliminar lote");
}

/* Productos */
export async function saveProducto(p) {
  const id = p.id || uid();
  await run(supabase.from("productos").upsert({ id, nombre: p.nombre, precio_venta: Number(p.precioVenta) || 0 }), "guardar producto");
  await run(supabase.from("producto_componentes").delete().eq("producto_id", id), "limpiar componentes producto");
  const filas = p.componentes.map((c) => ({ id: uid(), producto_id: id, tipo: c.tipo, ref_id: c.refId, cantidad: Number(c.cantidad), unidad: c.unidad }));
  if (filas.length) await run(supabase.from("producto_componentes").insert(filas), "guardar componentes producto");
}
export async function deleteProducto(id) {
  await run(supabase.from("productos").delete().eq("id", id), "eliminar producto");
}

/* Ventas */
export async function saveVenta(v) {
  const id = uid();
  const total = v.items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0), 0);
  await run(supabase.from("ventas").insert({ id, fecha: v.fecha, cliente_id: v.clienteId || null, total }), "guardar venta");
  const filas = v.items.map((it) => ({ id: uid(), venta_id: id, producto_id: it.productoId, cantidad: Number(it.cantidad), precio_unitario: Number(it.precioUnitario) || 0 }));
  if (filas.length) await run(supabase.from("venta_items").insert(filas), "guardar productos de la venta");
}
export async function deleteVenta(id) {
  await run(supabase.from("ventas").delete().eq("id", id), "eliminar venta");
}
