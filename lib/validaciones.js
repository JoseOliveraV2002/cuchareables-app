// Reglas de validación compartidas: las usa el servidor (rechaza datos inválidos)
// y la interfaz (marca en rojo cada campo con error). Cada validador devuelve un
// objeto { campo: "mensaje" }; vacío = todo correcto.
const UNIDADES = ["g", "kg", "ml", "l", "m", "cm", "unidad"];
const FAMILIA = { g: "peso", kg: "peso", ml: "volumen", l: "volumen", m: "longitud", cm: "longitud", unidad: "conteo" };
const TIPOS_DOC = ["Boleta", "Factura", "Guía de despacho", "Otro"];
const CATEGORIAS_AJUSTE = ["Merma", "Daño", "Conteo físico", "Otro"];
const CUENTAS_VENTA = ["personal", "empresa", "pendiente"];
const CATEGORIAS_GASTO = ["Mano de obra", "Servicios", "Honorarios", "Alquiler", "Transporte", "Marketing", "Otros"];

/* ---------- utilidades ---------- */
const esNumero = (v) => typeof v === "number" && Number.isFinite(v);
const aFecha = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function fechaValida(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const f = new Date(y, m - 1, d);
  return f.getFullYear() === y && f.getMonth() === m - 1 && f.getDate() === d;
}
// Mensaje de error de una fecha, o null. `futuro`: cuántos días hacia adelante se permiten (null = hasta 2 años).
function errorFecha(s, { futuro = 1, etiqueta = "La fecha" } = {}) {
  if (!s) return `${etiqueta} es obligatoria.`;
  if (!fechaValida(s)) return `${etiqueta} no es válida.`;
  if (s < "2000-01-01") return `${etiqueta} es demasiado antigua.`;
  const lim = new Date();
  lim.setDate(lim.getDate() + (futuro == null ? 730 : futuro));
  if (s > aFecha(lim)) return futuro == null ? `${etiqueta} es demasiado lejana.` : `${etiqueta} no puede ser futura.`;
  return null;
}
function errorTexto(v, { etiqueta = "Este campo", min = 1, max = 100, requerido = true } = {}) {
  const t = String(v == null ? "" : v).trim();
  if (!t) return requerido ? `${etiqueta} es obligatorio.` : null;
  if (t.length < min) return `${etiqueta} debe tener al menos ${min} caracteres.`;
  if (t.length > max) return `${etiqueta} no puede pasar de ${max} caracteres.`;
  return null;
}
// Cantidad positiva. `permitirCero` para campos donde 0 es válido.
function errorCantidad(v, { etiqueta = "La cantidad", max = 10000000, permitirCero = false } = {}) {
  if (!esNumero(v)) return `${etiqueta} debe ser un número.`;
  if (permitirCero ? v < 0 : v <= 0) return permitirCero ? `${etiqueta} no puede ser negativa.` : `${etiqueta} debe ser mayor que 0.`;
  if (v > max) return `${etiqueta} es demasiado grande.`;
  return null;
}
function poner(errores, campo, mensaje) {
  if (mensaje && !errores[campo]) errores[campo] = mensaje;
}
const primerError = (errores) => Object.values(errores)[0] || null;

/* ---------- correo y contraseña ---------- */
function validarEmail(email, { requerido = true } = {}) {
  const e = String(email == null ? "" : email).trim();
  if (!e) return requerido ? "El correo es obligatorio." : null;
  if (e.length > 120) return "El correo es demasiado largo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(e) || /\.\./.test(e) || e.startsWith(".") || /\.@/.test(e)) return "El correo no tiene un formato válido.";
  return null;
}
// Contraseña: mínimo 8 caracteres, al menos una mayúscula y un número.
function reglasClave(p) {
  const s = String(p == null ? "" : p);
  return [
    { id: "largo", ok: s.length >= 8, texto: "Mínimo 8 caracteres" },
    { id: "mayuscula", ok: /[A-ZÁÉÍÓÚÑ]/.test(s), texto: "Una letra mayúscula" },
    { id: "numero", ok: /[0-9]/.test(s), texto: "Un número" },
  ];
}
function validarClave(p, etiqueta = "La contraseña") {
  const s = String(p == null ? "" : p);
  if (!s) return `${etiqueta} es obligatoria.`;
  if (s.length < 8) return `${etiqueta} debe tener al menos 8 caracteres.`;
  if (!/[A-ZÁÉÍÓÚÑ]/.test(s)) return `${etiqueta} debe incluir al menos una letra mayúscula.`;
  if (!/[0-9]/.test(s)) return `${etiqueta} debe incluir al menos un número.`;
  if (s.length > 64) return `${etiqueta} no puede pasar de 64 caracteres.`;
  return null;
}
function errorTelefono(v) {
  const t = String(v == null ? "" : v).trim();
  if (!t) return null;
  if (!/^[0-9+()\-\s]+$/.test(t)) return "El teléfono solo puede tener números, espacios, + - ( ).";
  const digitos = t.replace(/\D/g, "").length;
  if (digitos < 6 || digitos > 15) return "El teléfono debe tener entre 6 y 15 dígitos.";
  return null;
}

/* ---------- entidades ---------- */
function validarCliente(c) {
  const e = {};
  poner(e, "nombre", errorTexto(c.nombre, { etiqueta: "El nombre", min: 2, max: 100 }));
  poner(e, "telefono", errorTelefono(c.telefono));
  poner(e, "email", validarEmail(c.email, { requerido: false }));
  poner(e, "direccion", errorTexto(c.direccion, { etiqueta: "La dirección", max: 200, requerido: false }));
  poner(e, "notas", errorTexto(c.notas, { etiqueta: "Las notas", max: 500, requerido: false }));
  return e;
}

function validarIngrediente(i) {
  const e = {};
  poner(e, "nombre", errorTexto(i.nombre, { etiqueta: "El nombre", min: 2, max: 80 }));
  if (!UNIDADES.includes(i.unidad)) e.unidad = "Elige una unidad válida.";
  return e;
}

// Acepta un documento con varios insumos (items) o una sola fila de compra.
function validarCompra(c) {
  const e = {};
  poner(e, "fecha", errorFecha(c.fecha));
  if (!TIPOS_DOC.includes(c.tipoDocumento)) e.tipoDocumento = "Elige el tipo de documento.";
  const num = String(c.numero == null ? "" : c.numero).trim();
  if (num && (num.length > 40 || !/^[A-Za-z0-9\-/. ]+$/.test(num))) e.numero = "El número solo puede tener letras, números y - / .";
  if (c.cuenta && !["empresa", "personal"].includes(c.cuenta)) e.cuenta = "Elige con qué dinero se pagó.";
  if (c.fechaPago) poner(e, "fechaPago", errorFecha(c.fechaPago, { futuro: 31, etiqueta: "La fecha de pago" }));
  const items = c.items || [c];
  if (items.length === 0) e.items = "Agrega al menos un insumo.";
  items.forEach((it, i) => {
    if (String(it.marca == null ? "" : it.marca).trim().length > 60) e[`items.${i}.marca`] = "La marca no puede tener más de 60 letras.";
    if (!it.ingredienteId) e[`items.${i}.ingredienteId`] = "Elige un insumo.";
    if (!UNIDADES.includes(it.unidad)) e[`items.${i}.unidad`] = "Elige una unidad válida.";
    poner(e, `items.${i}.cantidad`, errorCantidad(it.cantidad));
    poner(e, `items.${i}.costoTotal`, errorCantidad(it.costoTotal, { etiqueta: "El costo", max: 100000000 }));
  });
  return e;
}

function validarAjuste(a) {
  const e = {};
  if (!["ingrediente", "lote"].includes(a.tipo)) e.tipo = "Tipo de ajuste no válido.";
  if (!a.refId) e.refId = "Falta el elemento a ajustar.";
  poner(e, "fecha", errorFecha(a.fecha));
  if (!CATEGORIAS_AJUSTE.includes(a.categoria)) e.categoria = "Elige una categoría.";
  if (!esNumero(a.cantidad)) e.cantidad = "La cantidad debe ser un número.";
  else if (Math.abs(a.cantidad) < 0.0001) e.cantidad = "La cantidad no puede ser 0.";
  else if (Math.abs(a.cantidad) > 1000000000) e.cantidad = "La cantidad es demasiado grande.";
  if (!UNIDADES.includes(a.unidad)) e.unidad = "Unidad no válida.";
  poner(e, "nota", errorTexto(a.nota, { etiqueta: "La nota", max: 200, requerido: false }));
  return e;
}

function validarRecetaBase(r) {
  const e = {};
  poner(e, "nombre", errorTexto(r.nombre, { etiqueta: "El nombre", min: 2, max: 80 }));
  if (!UNIDADES.includes(r.unidadRendimiento)) e.unidadRendimiento = "Elige una unidad válida.";
  const ings = r.ingredientes || [];
  if (ings.length === 0) e.ingredientes = "Agrega al menos un insumo.";
  const vistos = new Set();
  ings.forEach((it, i) => {
    if (!it.ingredienteId) e[`ingredientes.${i}.ingredienteId`] = "Elige un insumo.";
    else if (vistos.has(it.ingredienteId)) e[`ingredientes.${i}.ingredienteId`] = "Este insumo está repetido.";
    vistos.add(it.ingredienteId);
    if (!UNIDADES.includes(it.unidad)) e[`ingredientes.${i}.unidad`] = "Unidad no válida.";
    poner(e, `ingredientes.${i}.cantidad`, errorCantidad(it.cantidad));
  });
  return e;
}

function validarProduccion(p) {
  const e = {};
  if (!p.recetaBaseId) e.recetaBaseId = "Falta la receta base.";
  poner(e, "fecha", errorFecha(p.fecha));
  poner(e, "rendimientoReal", errorCantidad(p.rendimientoReal, { etiqueta: "El rendimiento" }));
  if (!UNIDADES.includes(p.unidadRendimiento)) e.unidadRendimiento = "Elige una unidad válida.";
  const cod = String(p.codigo == null ? "" : p.codigo).trim();
  if (cod && !/^[A-Za-z0-9-]{2,20}$/.test(cod)) e.codigo = "El código solo puede tener letras, números y guion (2 a 20).";
  if (p.pesoEnvase != null && p.pesoEnvase !== "") poner(e, "pesoEnvase", errorCantidad(p.pesoEnvase, { etiqueta: "El peso del envase", permitirCero: true }));
  const usados = p.ingredientesUsados || [];
  usados.forEach((it, i) => {
    if (!it.ingredienteId) e[`ingredientesUsados.${i}.ingredienteId`] = "Insumo no válido.";
    poner(e, `ingredientesUsados.${i}.cantidad`, errorCantidad(it.cantidad, { permitirCero: true }));
  });
  if (usados.length > 0 && !usados.some((it) => esNumero(it.cantidad) && it.cantidad > 0)) {
    e["ingredientesUsados.0.cantidad"] = e["ingredientesUsados.0.cantidad"] || "Indica la cantidad usada de al menos un insumo.";
  }
  poner(e, "notas", errorTexto(p.notas, { etiqueta: "Las notas", max: 300, requerido: false }));
  return e;
}

function validarProducto(p) {
  const e = {};
  poner(e, "nombre", errorTexto(p.nombre, { etiqueta: "El nombre", min: 2, max: 100 }));
  poner(e, "precioVenta", errorCantidad(p.precioVenta, { etiqueta: "El precio", max: 1000000 }));
  const comps = p.componentes || [];
  if (comps.length === 0) e.componentes = "Agrega al menos un componente.";
  const vistos = new Set();
  comps.forEach((c, i) => {
    if (!["ingrediente", "receta_base"].includes(c.tipo) || !c.refId) e[`componentes.${i}.refId`] = "Elige un componente.";
    else if (vistos.has(`${c.tipo}:${c.refId}`)) e[`componentes.${i}.refId`] = "Este componente está repetido.";
    vistos.add(`${c.tipo}:${c.refId}`);
    if (!UNIDADES.includes(c.unidad)) e[`componentes.${i}.unidad`] = "Unidad no válida.";
    poner(e, `componentes.${i}.cantidad`, errorCantidad(c.cantidad));
  });
  return e;
}

function validarVenta(v) {
  const e = {};
  poner(e, "fecha", errorFecha(v.fecha));
  if (!CUENTAS_VENTA.includes(v.cuenta)) e.cuenta = "Elige dónde está el dinero.";
  const items = v.items || [];
  if (items.length === 0) e.items = "Agrega al menos un producto.";
  items.forEach((it, i) => {
    if (!it.productoId) e[`items.${i}.productoId`] = "Elige un producto.";
    poner(e, `items.${i}.cantidad`, errorCantidad(it.cantidad, { max: 100000 }));
    poner(e, `items.${i}.precioUnitario`, errorCantidad(it.precioUnitario, { etiqueta: "El precio", max: 1000000, permitirCero: true }));
    Object.values(it.distribucion || {}).forEach((filas) => (filas || []).forEach((fl) => {
      if (!esNumero(Number(fl.cantidad)) || Number(fl.cantidad) < 0) e[`items.${i}.distribucion`] = "Las cantidades por lote no pueden ser negativas.";
    }));
  });
  return e;
}
function validarCuentaVenta(v) {
  const e = {};
  if (v.cuenta !== "pendiente" && v.fechaCobro) poner(e, "fechaCobro", errorFecha(v.fechaCobro, { etiqueta: "La fecha de cobro" }));
  if (!CUENTAS_VENTA.includes(v.cuenta)) e.cuenta = "Elige dónde está el dinero.";
  if (v.cuenta === "personal") poner(e, "registradoPor", errorTexto(v.registradoPor, { etiqueta: "El nombre", min: 2, max: 60 }));
  return e;
}

// Gasto operativo (OpEx): mano de obra puntual, servicios, honorarios... No es un insumo ni toca el stock.
function validarGasto(g) {
  const e = {};
  poner(e, "fecha", errorFecha(g.fecha));
  if (g.fechaPago) poner(e, "fechaPago", errorFecha(g.fechaPago, { futuro: 31, etiqueta: "La fecha de pago" }));
  if (!CATEGORIAS_GASTO.includes(g.categoria)) e.categoria = "Elige la categoría del gasto.";
  poner(e, "descripcion", errorTexto(g.descripcion, { etiqueta: "La descripción", min: 3, max: 120 }));
  poner(e, "monto", errorCantidad(g.monto, { etiqueta: "El monto", max: 100000000 }));
  if (!["empresa", "personal"].includes(g.cuenta)) e.cuenta = "Elige con qué dinero se pagó.";
  if (g.cuenta === "personal") poner(e, "registradoPor", errorTexto(g.registradoPor, { etiqueta: "El nombre", min: 2, max: 60 }));
  return e;
}
// Conciliación: saldo real del banco/caja al cierre de un mes.
function validarCierre(c) {
  const e = {};
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(c.mes || ""))) e.mes = "El mes no es válido.";
  if (!esNumero(c.saldoBanco)) e.saldoBanco = "El saldo debe ser un número.";
  else if (Math.abs(c.saldoBanco) > 1000000000) e.saldoBanco = "El saldo es demasiado grande.";
  poner(e, "nota", errorTexto(c.nota, { etiqueta: "La nota", max: 200, requerido: false }));
  return e;
}
// Saldo con el que arranca el sistema (dinero que ya había en la cuenta de la empresa en esa fecha).
function validarApertura(a) {
  const e = {};
  poner(e, "fecha", errorFecha(a.fecha, { futuro: 0 }));
  if (!esNumero(a.monto)) e.monto = "El saldo debe ser un número.";
  else if (Math.abs(a.monto) > 1000000000) e.monto = "El saldo es demasiado grande.";
  return e;
}

function validarPedido(p) {
  const e = {};
  poner(e, "fecha", errorFecha(p.fecha, { futuro: null, etiqueta: "La fecha de entrega" }));
  if (!["pagado", "pendiente"].includes(p.pago)) e.pago = "Elige el estado de pago.";
  poner(e, "notas", errorTexto(p.notas, { etiqueta: "Las notas", max: 300, requerido: false }));
  const items = p.items || [];
  if (items.length === 0) e.items = "Agrega al menos un producto.";
  items.forEach((it, i) => {
    if (!it.productoId) e[`items.${i}.productoId`] = "Elige un producto.";
    poner(e, `items.${i}.cantidad`, errorCantidad(it.cantidad, { max: 100000 }));
  });
  return e;
}

// Alta de usuario (por un administrador).
function validarUsuario(u, { creando = true } = {}) {
  const e = {};
  poner(e, "nombre", errorTexto(u.nombre, { etiqueta: "El nombre", min: 2, max: 60 }));
  if (creando) {
    poner(e, "email", validarEmail(u.email));
    poner(e, "password", validarClave(u.password, "La contraseña provisional"));
  }
  if (u.rol !== "admin" && (!u.permisos || u.permisos.length === 0)) e.permisos = "Activa al menos una sección.";
  return e;
}

module.exports = {
  UNIDADES, FAMILIA, TIPOS_DOC, CATEGORIAS_AJUSTE, CUENTAS_VENTA, CATEGORIAS_GASTO,
  fechaValida, errorFecha, errorTexto, errorCantidad, errorTelefono, primerError,
  validarEmail, validarClave, reglasClave,
  validarCliente, validarIngrediente, validarCompra, validarAjuste, validarRecetaBase,
  validarGasto, validarCierre, validarApertura, validarProduccion, validarProducto, validarVenta, validarCuentaVenta, validarPedido, validarUsuario,
};
