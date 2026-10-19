const path = require("path");
const { randomUUID } = require("node:crypto");
const { createClient } = require("@libsql/client");
const V = require("./validaciones");

// Datos inválidos: lleva un mapa campo -> mensaje para que la interfaz marque cada campo.
class ErrorValidacion extends Error {
  constructor(errores) {
    super(Object.values(errores)[0] || "Datos no válidos.");
    this.errores = errores;
  }
}
const exigir = (errores) => { if (Object.keys(errores).length) throw new ErrorValidacion(errores); };

// Base de datos libSQL (SQLite): en producción es Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN);
// sin esas variables usa el archivo local data.sqlite (DATA_DIR opcional).
const LOCAL_URL = `file:${path.join(process.env.DATA_DIR || process.cwd(), "data.sqlite")}`;
const SCHEMA_VERSION = "8";

// Código de lote: 3 letras de la receta + número correlativo (ej. MAN-001).
function prefijoLote(nombre) {
  const base = String(nombre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3);
  return base || "LOT";
}
async function generarCodigoLote(db, nombreReceta) {
  const pre = prefijoLote(nombreReceta);
  let max = 0;
  (await db.prepare("select codigo from producciones where codigo like ?").all(`${pre}-%`)).forEach(({ codigo }) => {
    const n = parseInt(String(codigo).slice(pre.length + 1), 10);
    if (n > max) max = n;
  });
  return `${pre}-${String(max + 1).padStart(3, "0")}`;
}

let _client;
let _listo;
const cliente = () => {
  if (!_client && process.env.VERCEL && !process.env.TURSO_DATABASE_URL) throw new Error("Falta configurar TURSO_DATABASE_URL en Vercel.");
  if (!_client) _client = createClient({ url: process.env.TURSO_DATABASE_URL || LOCAL_URL, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
  return _client;
};
const ESQUEMA = `
    create table if not exists users (
      id text primary key,
      email text unique not null,
      password_hash text not null,
      nombre text
    );
    create table if not exists fotos (
      id text primary key,
      mime text not null,
      data blob not null,
      bytes integer not null,
      created_at integer not null
    );
    create table if not exists gastos (
      id text primary key,
      fecha text not null,
      fecha_pago text,
      categoria text not null,
      descripcion text not null,
      monto real not null,
      cuenta text not null,
      registrado_por text,
      reembolsado integer not null default 0,
      fecha_reembolso text,
      created_at integer
    );
    create table if not exists cierres (
      mes text primary key,
      saldo_banco real not null,
      nota text
    );
    create table if not exists limites (
      clave text primary key,
      n integer not null,
      desde integer not null
    );
    create table if not exists sessions (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      created_at integer not null
    );
    create table if not exists clientes (
      id text primary key,
      nombre text not null,
      telefono text,
      email text,
      direccion text,
      notas text
    );
    create table if not exists ingredientes (
      id text primary key,
      nombre text not null,
      unidad text not null
    );
    create table if not exists compras (
      id text primary key,
      fecha text not null,
      tipo_documento text not null,
      numero text,
      ingrediente_id text not null references ingredientes(id),
      cantidad real not null,
      unidad text not null,
      costo_total real not null,
      cuenta text,
      registrado_por text,
      reembolsado integer default 0
    );
    create table if not exists recetas_base (
      id text primary key,
      nombre text not null,
      unidad_rendimiento text not null
    );
    create table if not exists receta_base_ingredientes (
      id text primary key,
      receta_base_id text not null references recetas_base(id) on delete cascade,
      ingrediente_id text not null references ingredientes(id),
      cantidad real not null,
      unidad text not null
    );
    create table if not exists producciones (
      id text primary key,
      receta_base_id text not null references recetas_base(id) on delete cascade,
      fecha text not null,
      rendimiento_real real not null,
      unidad_rendimiento text not null,
      notas text,
      costo_total real,
      peso_envase real,
      codigo text
    );
    create table if not exists produccion_ingredientes (
      id text primary key,
      produccion_id text not null references producciones(id) on delete cascade,
      ingrediente_id text not null references ingredientes(id),
      cantidad real not null default 0,
      unidad text not null
    );
    create table if not exists productos (
      id text primary key,
      nombre text not null,
      precio_venta real not null default 0
    );
    create table if not exists producto_componentes (
      id text primary key,
      producto_id text not null references productos(id) on delete cascade,
      tipo text not null,
      ref_id text not null,
      cantidad real not null,
      unidad text not null
    );
    create table if not exists ventas (
      id text primary key,
      fecha text not null,
      cliente_id text references clientes(id) on delete set null,
      total real not null default 0,
      cuenta text,
      registrado_por text
    );
    create table if not exists venta_items (
      id text primary key,
      venta_id text not null references ventas(id) on delete cascade,
      producto_id text not null references productos(id),
      cantidad real not null,
      precio_unitario real not null default 0
    );
    create table if not exists ajustes_inventario (
      id text primary key,
      tipo text not null,
      ref_id text not null,
      fecha text not null,
      cantidad real not null,
      unidad text not null,
      categoria text not null,
      nota text,
      created_at integer not null
    );
    create table if not exists venta_consumos (
      id text primary key,
      venta_id text not null references ventas(id) on delete cascade,
      venta_item_id text not null references venta_items(id) on delete cascade,
      producto_id text not null,
      tipo text not null,
      ref_id text,
      receta_base_id text,
      cantidad real not null,
      unidad text not null
    );
    create table if not exists pedidos (
      id text primary key,
      fecha text not null,
      cliente_id text references clientes(id) on delete set null,
      pago text not null default 'pendiente',
      notas text,
      venta_id text references ventas(id) on delete set null,
      created_at integer
    );
    create table if not exists login_intentos (
      email text primary key,
      fallos integer not null default 0,
      cierres integer not null default 0,
      bloqueado_hasta integer not null default 0
    );
    create table if not exists recuperaciones (
      email text primary key,
      codigo_hash text not null,
      codigo_visible text,
      expira integer not null,
      intentos integer not null default 0,
      creado integer not null
    );
    create table if not exists auditoria (
      id text primary key,
      ts integer not null,
      usuario_id text,
      usuario_email text,
      usuario_nombre text,
      accion text not null,
      entidad text not null,
      entidad_id text,
      etiqueta text,
      antes text,
      despues text,
      detalle text
    );
    create index if not exists idx_auditoria_ts on auditoria(ts desc);
    create table if not exists pedido_items (
      id text primary key,
      pedido_id text not null references pedidos(id) on delete cascade,
      producto_id text not null references productos(id),
      cantidad real not null
    );
  `;

// Crea tablas y migra columnas. Se anota la versión para no repetirlo en cada arranque.
async function iniciar() {
  const c = cliente();
  await c.execute("create table if not exists meta (k text primary key, v text)");
  const v = (await c.execute("select v from meta where k = 'schema'")).rows[0];
  if (v && v.v === SCHEMA_VERSION) return;
  await c.executeMultiple(ESQUEMA);
  const base = wrapper(true);
  const cols = async (t) => (await base.prepare(`pragma table_info(${t})`).all()).map((x) => x.name);
  const agregar = async (t, existentes, nombre, def) => { if (!existentes.includes(nombre)) await c.execute(`alter table ${t} add column ${nombre} ${def}`); };
  const colsVentas = await cols("ventas");
  await agregar("ventas", colsVentas, "cuenta", "text");
  await agregar("ventas", colsVentas, "registrado_por", "text");
  const colsProd = await cols("producciones");
  await agregar("producciones", colsProd, "costo_total", "real");
  await agregar("producciones", colsProd, "peso_envase", "real");
  await agregar("producciones", colsProd, "codigo", "text");
  // Los lotes anteriores a los códigos reciben el suyo, en orden de fecha.
  const sinCodigo = await base.prepare("select p.id, rb.nombre from producciones p join recetas_base rb on rb.id = p.receta_base_id where p.codigo is null or p.codigo = '' order by p.fecha, p.rowid").all();
  for (const p of sinCodigo) await base.prepare("update producciones set codigo = ? where id = ?").run(await generarCodigoLote(base, p.nombre), p.id);
  await c.execute("create unique index if not exists idx_producciones_codigo on producciones(codigo)");
  const colsUsers = await cols("users");
  await agregar("users", colsUsers, "rol", "text not null default 'admin'");
  await agregar("users", colsUsers, "permisos", "text not null default '[]'");
  await agregar("users", colsUsers, "activo", "integer not null default 1");
  await agregar("users", colsUsers, "must_change", "integer not null default 0");
  const colsCompras = await cols("compras");
  await agregar("compras", colsCompras, "cuenta", "text");
  await agregar("compras", colsCompras, "registrado_por", "text");
  await agregar("compras", colsCompras, "marca", "text");
  await agregar("compras", colsCompras, "foto_id", "text");
  await agregar("compras", colsCompras, "reembolsado", "integer default 0");
  await agregar("compras", colsCompras, "fecha_pago", "text");
  await agregar("compras", colsCompras, "fecha_reembolso", "text");
  await agregar("ventas", colsVentas, "fecha_cobro", "text");
  // Ventas anteriores: se consideran cobradas el mismo día de la venta (salvo las pendientes).
  await c.execute("update ventas set fecha_cobro = fecha where fecha_cobro is null and coalesce(cuenta, '') <> 'pendiente'");
  await c.execute({ sql: "insert into meta (k, v) values ('schema', ?) on conflict(k) do update set v = excluded.v", args: [SCHEMA_VERSION] });
}

const plano = (r, columnas) => { const o = {}; columnas.forEach((k) => { o[k] = r[k]; }); return o; };
// Interfaz parecida a la de SQLite, pero asíncrona: prepare(sql).get/all/run(...) devuelven promesas.
function wrapper(sinEspera) {
  const ejecutar = async (sql, args) => {
    if (!sinEspera) { if (!_listo) _listo = iniciar().catch((e) => { _listo = null; throw e; }); await _listo; }
    return cliente().execute({ sql, args });
  };
  return {
    prepare: (sql) => ({
      get: async (...args) => { const r = await ejecutar(sql, args); return r.rows[0] ? plano(r.rows[0], r.columns) : undefined; },
      all: async (...args) => { const r = await ejecutar(sql, args); return r.rows.map((x) => plano(x, r.columns)); },
      run: async (...args) => { const r = await ejecutar(sql, args); return { changes: r.rowsAffected }; },
    }),
  };
}
const _wrapper = wrapper(false);
const getDb = () => _wrapper;

const uid = () => randomUUID();

const FAMILIA = { g: "peso", kg: "peso", ml: "volumen", l: "volumen", m: "longitud", cm: "longitud", unidad: "conteo" };
const A_BASE = { g: 1, kg: 1000, ml: 1, l: 1000, m: 100, cm: 1, unidad: 1 };
const BASE_DE = { peso: "g", volumen: "ml", longitud: "cm", conteo: "unidad" };
const toBase = (cantidad, unidad) => (Number(cantidad) || 0) * (A_BASE[unidad] || 1);
const baseUnidadDe = (unidad) => BASE_DE[FAMILIA[unidad]] || unidad;
const sumBase = (rows) => rows.reduce((s, r) => s + toBase(r.cantidad, r.unidad), 0);

// Precio por unidad base (g/ml/unidad) según la COMPRA MÁS RECIENTE de ese insumo,
// no el promedio histórico — así un lote nuevo refleja lo que cuesta comprarlo hoy.
async function costoRecienteIngrediente(ingredienteId) {
  const row = await getDb()
    .prepare("select cantidad, unidad, costo_total from compras where ingrediente_id = ? order by fecha desc, rowid desc limit 1")
    .get(ingredienteId);
  if (!row) return null;
  const base = toBase(row.cantidad, row.unidad);
  return base > 0 ? row.costo_total / base : null;
}

// Stock restante (en unidad base) de un lote de producción específico:
// lo que rindió, menos lo ya consumido en ventas, más/menos ajustes manuales.
async function stockLoteBase(produccionId) {
  const db = getDb();
  const p = await db.prepare("select rendimiento_real as cantidad, unidad_rendimiento as unidad from producciones where id = ?").get(produccionId);
  if (!p) return 0;
  const consumido = await db.prepare("select cantidad, unidad from venta_consumos where tipo = 'receta_base' and ref_id = ?").all(produccionId);
  const ajustes = await db.prepare("select cantidad, unidad from ajustes_inventario where tipo = 'lote' and ref_id = ?").all(produccionId);
  return toBase(p.cantidad, p.unidad) - sumBase(consumido) + sumBase(ajustes);
}

// Reparte una cantidad necesaria (en unidad base) entre los lotes de una receta base,
// del más antiguo al más nuevo (FIFO), completando con el siguiente si el primero no alcanza.
async function asignarLotesFIFO(recetaBaseId, necesarioBase) {
  const db = getDb();
  const lotes = await db.prepare("select id from producciones where receta_base_id = ? order by fecha asc, rowid asc").all(recetaBaseId);
  let restante = necesarioBase;
  const asignaciones = [];
  for (const l of lotes) {
    if (restante <= 0) break;
    const disponible = await stockLoteBase(l.id);
    if (disponible <= 0) continue;
    const tomar = Math.min(disponible, restante);
    asignaciones.push({ produccionId: l.id, cantidadBase: tomar });
    restante -= tomar;
  }
  return { asignaciones, faltanteBase: Math.max(0, restante) };
}

/* ---------- usuarios / sesiones ---------- */
const normEmail = (e) => String(e || "").trim().toLowerCase();
async function findUserByEmail(email) {
  return await getDb().prepare("select * from users where email = ?").get(normEmail(email));
}
async function createUser({ email, passwordHash, nombre, rol, permisos, mustChange }) {
  const id = uid();
  await getDb()
    .prepare("insert into users (id, email, password_hash, nombre, rol, permisos, activo, must_change) values (?, ?, ?, ?, ?, ?, 1, ?)")
    .run(id, normEmail(email), passwordHash, nombre || null, rol === "usuario" ? "usuario" : "admin", JSON.stringify(permisos || []), mustChange ? 1 : 0);
  return id;
}
// La sesión se cierra tras 3 horas sin actividad. created_at guarda la última actividad.
const DURACION_SESION = 3 * 60 * 60 * 1000;
async function limitar(clave, max, ventanaMs) {
  const db = getDb();
  const ahora = Date.now();
  const f = await db.prepare("select n, desde from limites where clave = ?").get(clave);
  if (!f || ahora - f.desde > ventanaMs) {
    await db.prepare("insert into limites (clave, n, desde) values (?, 1, ?) on conflict(clave) do update set n = 1, desde = excluded.desde").run(clave, ahora);
    return true;
  }
  if (f.n >= max) return false;
  await db.prepare("update limites set n = n + 1 where clave = ?").run(clave);
  return true;
}
async function createSession(userId) {
  const id = uid();
  await getDb().prepare("delete from sessions where created_at < ?").run(Date.now() - DURACION_SESION);
  await getDb().prepare("insert into sessions (id, user_id, created_at) values (?, ?, ?)").run(id, userId, Date.now());
  return id;
}
// Datos de la sesión tal como los usa la app. Se leen en cada petición: un cambio de permisos rige de inmediato.
function perfilDe(u) {
  let permisos = [];
  try { permisos = JSON.parse(u.permisos || "[]"); } catch (e) { permisos = []; }
  return { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, permisos, activo: !!u.activo, mustChange: !!u.must_change };
}
async function findSession(sessionId) {
  const u = await getDb()
    .prepare("select s.id as session_id, s.created_at as ultima, u.* from sessions s join users u on u.id = s.user_id where s.id = ? and u.activo = 1 and s.created_at > ?")
    .get(sessionId, Date.now() - DURACION_SESION);
  if (!u) return null;
  if (Date.now() - u.ultima > 5 * 60 * 1000) await getDb().prepare("update sessions set created_at = ? where id = ?").run(Date.now(), sessionId);
  return { ...perfilDe(u), sessionId: u.session_id };
}
async function deleteSession(sessionId) {
  await getDb().prepare("delete from sessions where id = ?").run(sessionId);
}
async function deleteSessionsOfUser(userId) {
  await getDb().prepare("delete from sessions where user_id = ?").run(userId);
}

/* ---------- control de intentos de ingreso ---------- */
// 3 contraseñas incorrectas = 1 cierre de acceso. Con 3 cierres seguidos se bloquea 2 horas.
const FALLOS_POR_CIERRE = 3;
const CIERRES_PARA_BLOQUEO = 3;
const BLOQUEO_MS = 2 * 60 * 60 * 1000;
async function estadoIntentos(email) {
  return await getDb().prepare("select * from login_intentos where email = ?").get(normEmail(email)) || { email: normEmail(email), fallos: 0, cierres: 0, bloqueado_hasta: 0 };
}
async function guardarIntentos(e) {
  await getDb()
    .prepare("insert into login_intentos (email, fallos, cierres, bloqueado_hasta) values (?, ?, ?, ?) on conflict(email) do update set fallos=excluded.fallos, cierres=excluded.cierres, bloqueado_hasta=excluded.bloqueado_hasta")
    .run(e.email, e.fallos, e.cierres, e.bloqueado_hasta);
}
async function bloqueadoHasta(email) {
  const e = await estadoIntentos(email);
  return e.bloqueado_hasta > Date.now() ? e.bloqueado_hasta : 0;
}
async function registrarFallo(email) {
  const e = await estadoIntentos(email);
  e.fallos += 1;
  let cierre = false;
  if (e.fallos >= FALLOS_POR_CIERRE) {
    cierre = true;
    e.fallos = 0;
    e.cierres += 1;
    if (e.cierres >= CIERRES_PARA_BLOQUEO) {
      e.cierres = 0;
      e.bloqueado_hasta = Date.now() + BLOQUEO_MS;
    }
  }
  await guardarIntentos(e);
  return { cierre, cierres: e.cierres, restantes: FALLOS_POR_CIERRE - e.fallos, bloqueadoHasta: e.bloqueado_hasta > Date.now() ? e.bloqueado_hasta : 0 };
}
async function limpiarIntentos(email) {
  await getDb().prepare("delete from login_intentos where email = ?").run(normEmail(email));
}

/* ---------- administración de usuarios ---------- */
async function listUsers() {
  const ahora = Date.now();
  const filas = await getDb().prepare("select * from users order by rol, nombre, email").all();
  const lista = [];
  for (const u of filas) {
    const hasta = (await bloqueadoHasta(u.email)) || 0;
    lista.push({ ...perfilDe(u), bloqueadoHasta: hasta, bloqueado: hasta > ahora });
  }
  return lista;
}
async function contarAdminsActivos(exceptoId) {
  return (await getDb().prepare("select count(*) as n from users where rol = 'admin' and activo = 1 and id != ?").get(exceptoId || "")).n;
}
async function updateUser(id, cambios) {
  const db = getDb();
  const u = await db.prepare("select * from users where id = ?").get(id);
  if (!u) throw new Error("El usuario no existe.");
  const nuevoRol = cambios.rol ? (cambios.rol === "usuario" ? "usuario" : "admin") : u.rol;
  const nuevoActivo = cambios.activo == null ? u.activo : cambios.activo ? 1 : 0;
  if ((u.rol === "admin" && u.activo) && (nuevoRol !== "admin" || !nuevoActivo) && await contarAdminsActivos(id) === 0) {
    throw new Error("Debe quedar al menos un administrador activo.");
  }
  const permisos = cambios.permisos ? cambios.permisos.filter((x) => require("./permisos").IDS.includes(x)) : JSON.parse(u.permisos || "[]");
  await db.prepare("update users set nombre = ?, rol = ?, permisos = ?, activo = ? where id = ?").run(
    cambios.nombre != null ? String(cambios.nombre).trim() || null : u.nombre, nuevoRol, JSON.stringify(permisos), nuevoActivo, id
  );
  if (!nuevoActivo) await deleteSessionsOfUser(id);
}
async function setPassword(id, passwordHash, mustChange) {
  await getDb().prepare("update users set password_hash = ?, must_change = ? where id = ?").run(passwordHash, mustChange ? 1 : 0, id);
}
async function deleteUser(id) {
  const u = await getDb().prepare("select * from users where id = ?").get(id);
  if (!u) return;
  if (u.rol === "admin" && u.activo && await contarAdminsActivos(id) === 0) throw new Error("Debe quedar al menos un administrador activo.");
  await getDb().prepare("delete from sessions where user_id = ?").run(id);
  await getDb().prepare("delete from users where id = ?").run(id);
}

/* ---------- recuperar contraseña ---------- */
async function guardarRecuperacion({ email, codigoHash, codigoVisible }) {
  await getDb()
    .prepare("insert into recuperaciones (email, codigo_hash, codigo_visible, expira, intentos, creado) values (?, ?, ?, ?, 0, ?) on conflict(email) do update set codigo_hash=excluded.codigo_hash, codigo_visible=excluded.codigo_visible, expira=excluded.expira, intentos=0, creado=excluded.creado")
    .run(normEmail(email), codigoHash, codigoVisible || null, Date.now() + 15 * 60 * 1000, Date.now());
}
async function findRecuperacion(email) {
  return await getDb().prepare("select * from recuperaciones where email = ?").get(normEmail(email));
}
async function sumarIntentoRecuperacion(email) {
  await getDb().prepare("update recuperaciones set intentos = intentos + 1 where email = ?").run(normEmail(email));
}
async function borrarRecuperacion(email) {
  await getDb().prepare("delete from recuperaciones where email = ?").run(normEmail(email));
}
async function recuperacionesPendientes() {
  return await getDb().prepare("select email, codigo_visible as codigo, expira from recuperaciones where codigo_visible is not null and expira > ? order by creado desc").all(Date.now());
}

/* ---------- lectura de todos los datos ---------- */
async function fetchAllData() {
  const db = getDb();
  const clientes = await db.prepare("select * from clientes order by nombre").all();
  const ingredientes = await db.prepare("select * from ingredientes order by nombre").all();
  const compras = await db
    .prepare(
      "select id, fecha, tipo_documento as tipoDocumento, numero, ingrediente_id as ingredienteId, cantidad, unidad, costo_total as costoTotal, cuenta, registrado_por as registradoPor, reembolsado, marca, foto_id as fotoId, fecha_pago as fechaPago, fecha_reembolso as fechaReembolso from compras order by fecha desc"
    )
    .all();

  const recetasBaseRows = await db.prepare("select id, nombre, unidad_rendimiento as unidadRendimiento from recetas_base order by nombre").all();
  const rbIngredientes = await db.prepare("select receta_base_id, ingrediente_id as ingredienteId, cantidad, unidad from receta_base_ingredientes").all();
  const recetasBase = recetasBaseRows.map((r) => ({ ...r, ingredientes: rbIngredientes.filter((i) => i.receta_base_id === r.id).map(({ receta_base_id, ...rest }) => rest) }));

  const produccionesRows = await db
    .prepare("select id, receta_base_id as recetaBaseId, fecha, rendimiento_real as rendimientoReal, unidad_rendimiento as unidadRendimiento, notas, costo_total as costoTotalLote, peso_envase as pesoEnvase, codigo from producciones order by fecha desc, rowid desc")
    .all();
  const prodIngredientes = await db.prepare("select produccion_id, ingrediente_id as ingredienteId, cantidad, unidad from produccion_ingredientes").all();
  const producciones = produccionesRows.map((p) => ({ ...p, ingredientesUsados: prodIngredientes.filter((i) => i.produccion_id === p.id).map(({ produccion_id, ...rest }) => rest) }));

  const productosRows = await db.prepare("select id, nombre, precio_venta as precioVenta from productos order by nombre").all();
  const productoComponentes = await db.prepare("select producto_id, tipo, ref_id as refId, cantidad, unidad from producto_componentes").all();
  const productos = productosRows.map((p) => ({ ...p, componentes: productoComponentes.filter((c) => c.producto_id === p.id).map(({ producto_id, ...rest }) => rest) }));

  const ventasRows = await db.prepare("select id, fecha, cliente_id as clienteId, total, cuenta, registrado_por as registradoPor, fecha_cobro as fechaCobro from ventas order by fecha desc").all();
  const ventaItems = await db.prepare("select id, venta_id, producto_id as productoId, cantidad, precio_unitario as precioUnitario from venta_items").all();
  const ventaConsumos = await db
    .prepare(
      `select vc.id, vc.venta_id, vc.venta_item_id, vc.producto_id as productoId, vc.tipo, vc.ref_id as refId, vc.receta_base_id as recetaBaseId, vc.cantidad, vc.unidad,
              p.fecha as loteFecha, p.codigo as loteCodigo, rb.nombre as recetaBaseNombre, ing.nombre as ingredienteNombre
       from venta_consumos vc
       left join producciones p on vc.tipo = 'receta_base' and p.id = vc.ref_id
       left join recetas_base rb on rb.id = vc.receta_base_id
       left join ingredientes ing on vc.tipo = 'ingrediente' and ing.id = vc.ref_id`
    )
    .all();
  const ventas = ventasRows.map((v) => ({
    ...v,
    items: ventaItems
      .filter((i) => i.venta_id === v.id)
      .map(({ venta_id, ...rest }) => ({ ...rest, consumos: ventaConsumos.filter((c) => c.venta_item_id === rest.id).map(({ venta_id, venta_item_id, ...c }) => c) })),
  }));

  const ajustesInventario = await db
    .prepare("select id, tipo, ref_id as refId, fecha, cantidad, unidad, categoria, nota from ajustes_inventario order by fecha desc, rowid desc")
    .all();

  const pedidosRows = await db.prepare("select id, fecha, cliente_id as clienteId, pago, notas, venta_id as ventaId, (select total from ventas v where v.id = pedidos.venta_id) as ventaTotal from pedidos order by fecha, created_at").all();
  const pedidoItems = await db.prepare("select id, pedido_id, producto_id as productoId, cantidad from pedido_items").all();
  const pedidos = pedidosRows.map((p) => ({
    ...p,
    items: pedidoItems.filter((i) => i.pedido_id === p.id).map(({ pedido_id, ...rest }) => rest),
  }));

  const gastos = await db.prepare("select id, fecha, fecha_pago as fechaPago, categoria, descripcion, monto, cuenta, registrado_por as registradoPor, reembolsado, fecha_reembolso as fechaReembolso from gastos order by fecha desc, created_at desc").all();
  const cierres = await db.prepare("select mes, saldo_banco as saldoBanco, nota from cierres order by mes").all();
  const ap = await db.prepare("select k, v from meta where k in ('caja_apertura_monto', 'caja_apertura_fecha')").all();
  const apm = ap.find((x) => x.k === "caja_apertura_monto"), apf = ap.find((x) => x.k === "caja_apertura_fecha");
  const cajaConfig = apm && apf ? [{ monto: Number(apm.v), fecha: apf.v }] : [];
  return { clientes, ingredientes, compras, recetasBase, producciones, productos, ventas, ajustesInventario, pedidos, gastos, cierres, cajaConfig };
}

/* ---------- clientes ---------- */
async function saveCliente(c) {
  const db = getDb();
  exigir(V.validarCliente(c));
  c = { ...c, nombre: c.nombre.trim() };
  const id = c.id || uid();
  await db.prepare(
    `insert into clientes (id, nombre, telefono, email, direccion, notas) values (?, ?, ?, ?, ?, ?)
     on conflict(id) do update set nombre=excluded.nombre, telefono=excluded.telefono, email=excluded.email, direccion=excluded.direccion, notas=excluded.notas`
  ).run(id, c.nombre, (c.telefono || "").trim() || null, (c.email || "").trim() || null, (c.direccion || "").trim() || null, (c.notas || "").trim() || null);
  return id;
}
async function deleteCliente(id) {
  const db = getDb();
  await db.prepare("update ventas set cliente_id = null where cliente_id = ?").run(id);
  await db.prepare("update pedidos set cliente_id = null where cliente_id = ?").run(id);
  await db.prepare("delete from clientes where id = ?").run(id);
}

/* ---------- ingredientes ---------- */
async function nombreRepetido(tabla, nombre, exceptoId) {
  return !!await getDb().prepare(`select 1 from ${tabla} where lower(trim(nombre)) = lower(trim(?)) and id != ?`).get(nombre, exceptoId || "");
}
// ¿El insumo ya se usa en compras, recetas, lotes, productos, ajustes o ventas?
async function insumoTieneHistorial(id) {
  const db = getDb();
  for (const [t, extra] of [["compras", ""], ["receta_base_ingredientes", ""], ["produccion_ingredientes", ""], ["producto_componentes", " and tipo = 'ingrediente'"], ["ajustes_inventario", " and tipo = 'ingrediente'"], ["venta_consumos", " and tipo = 'ingrediente'"]]) {
    const col = ["producto_componentes", "ajustes_inventario", "venta_consumos"].includes(t) ? "ref_id" : "ingrediente_id";
    if (await db.prepare(`select 1 from ${t} where ${col} = ?${extra}`).get(id)) return true;
  }
  return false;
}
async function saveIngrediente(i) {
  exigir(V.validarIngrediente(i));
  const db = getDb();
  const nombre = i.nombre.trim();
  if (i.id) {
    const actual = await db.prepare("select * from ingredientes where id = ?").get(i.id);
    if (!actual) exigir({ nombre: "El insumo ya no existe." });
    if (await nombreRepetido("ingredientes", nombre, i.id)) exigir({ nombre: "Ya existe un insumo con ese nombre." });
    // Cambiar a otra familia (ej. g -> ml) rompería las cantidades ya registradas.
    if (actual.unidad !== i.unidad && V.FAMILIA[actual.unidad] !== V.FAMILIA[i.unidad] && await insumoTieneHistorial(i.id)) {
      exigir({ unidad: `Este insumo ya tiene movimientos: solo puedes cambiar a una unidad de la misma familia que ${actual.unidad}.` });
    }
    await db.prepare("update ingredientes set nombre = ?, unidad = ? where id = ?").run(nombre, i.unidad, i.id);
    return i.id;
  }
  if (await nombreRepetido("ingredientes", nombre)) exigir({ nombre: "Ya existe un insumo con ese nombre." });
  const id = uid();
  await db.prepare("insert into ingredientes (id, nombre, unidad) values (?, ?, ?)").run(id, nombre, i.unidad);
  return id;
}
async function deleteIngrediente(id) {
  const db = getDb();
  if (await insumoTieneHistorial(id)) throw new Error("No se puede eliminar: el insumo tiene compras, recetas, productos o ventas asociadas.");
  await db.prepare("delete from ingredientes where id = ?").run(id);
}

/* ---------- compras ---------- */
async function saveCompra(c) {
  exigir(V.validarCompra(c));
  const ing = await getDb().prepare("select unidad from ingredientes where id = ?").get(c.ingredienteId);
  if (!ing) exigir({ "items.0.ingredienteId": "El insumo ya no existe." });
  if (V.FAMILIA[c.unidad] !== V.FAMILIA[ing.unidad]) exigir({ "items.0.unidad": `La unidad debe ser de la misma familia que la del insumo (${ing.unidad}).` });
  if (c.fotoId && !await getDb().prepare("select 1 from fotos where id = ?").get(c.fotoId)) exigir({ foto: "La foto ya no está disponible: vuelve a adjuntarla." });
  const id = uid();
  await getDb()
    .prepare("insert into compras (id, fecha, tipo_documento, numero, ingrediente_id, cantidad, unidad, costo_total, cuenta, registrado_por, reembolsado, marca, foto_id, fecha_pago) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)")
    .run(id, c.fecha, c.tipoDocumento, String(c.numero || "").trim() || null, c.ingredienteId, Number(c.cantidad), c.unidad, Number(c.costoTotal), c.cuenta || null, c.registradoPor || null, String(c.marca || "").trim() || null, c.fotoId || null, c.fechaPago || null);
  return id;
}
// Edita un documento completo: actualiza los ítems existentes (con id), agrega los nuevos
// y elimina los que ya no están en la lista. Devuelve el id de un ítem para la auditoría.
async function actualizarDocumento(d) {
  const db = getDb();
  const ids = Array.isArray(d.ids) ? d.ids : [];
  if (ids.length === 0) throw new Error("La compra ya no existe.");
  exigir(V.validarCompra({ ...d, items: d.items || [] }));
  const existentes = [];
  for (const id of ids) {
    const r = await db.prepare("select id, foto_id, reembolsado from compras where id = ?").get(id);
    if (r) existentes.push(r);
  }
  if (existentes.length === 0) throw new Error("La compra ya no existe.");
  const porId = new Map(existentes.map((r) => [r.id, r]));
  const fotoId = (existentes.find((r) => r.foto_id) || {}).foto_id || null;
  for (let i = 0; i < d.items.length; i++) {
    const it = d.items[i];
    const ing = await db.prepare("select unidad from ingredientes where id = ?").get(it.ingredienteId);
    if (!ing) exigir({ [`items.${i}.ingredienteId`]: "El insumo ya no existe." });
    if (V.FAMILIA[it.unidad] !== V.FAMILIA[ing.unidad]) exigir({ [`items.${i}.unidad`]: `La unidad debe ser de la misma familia que la del insumo (${ing.unidad}).` });
    if (it.id && !porId.has(it.id)) exigir({ items: "Una de las compras ya no existe: cierra y vuelve a abrir el documento." });
  }
  const numero = String(d.numero || "").trim() || null;
  const personal = d.cuenta === "personal";
  const conservados = new Set();
  let ultimo = null;
  for (const it of d.items) {
    const marca = String(it.marca || "").trim() || null;
    if (it.id) {
      conservados.add(it.id);
      const reemb = personal ? porId.get(it.id).reembolsado : 0;
      await db.prepare("update compras set fecha = ?, tipo_documento = ?, numero = ?, ingrediente_id = ?, cantidad = ?, unidad = ?, costo_total = ?, cuenta = ?, registrado_por = ?, reembolsado = ?, marca = ?, fecha_pago = ?, fecha_reembolso = case when ? = 1 then fecha_reembolso else null end where id = ?")
        .run(d.fecha, d.tipoDocumento, numero, it.ingredienteId, Number(it.cantidad), it.unidad, Number(it.costoTotal), d.cuenta || null, personal ? d.registradoPor || null : null, reemb, marca, d.fechaPago || null, reemb ? 1 : 0, it.id);
      ultimo = ultimo || it.id;
    } else {
      const id = uid();
      await db.prepare("insert into compras (id, fecha, tipo_documento, numero, ingrediente_id, cantidad, unidad, costo_total, cuenta, registrado_por, reembolsado, marca, foto_id, fecha_pago) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)")
        .run(id, d.fecha, d.tipoDocumento, numero, it.ingredienteId, Number(it.cantidad), it.unidad, Number(it.costoTotal), d.cuenta || null, personal ? d.registradoPor || null : null, marca, fotoId, d.fechaPago || null);
      ultimo = ultimo || id;
    }
  }
  for (const r of existentes) if (!conservados.has(r.id)) await db.prepare("delete from compras where id = ?").run(r.id);
  return ultimo;
}
async function deleteCompra(id) {
  const c = await getDb().prepare("select foto_id from compras where id = ?").get(id);
  await getDb().prepare("delete from compras where id = ?").run(id);
  if (c && c.foto_id) await borrarFotoSiSinUso(c.foto_id);
}

/* ---------- fotos de boletas y facturas ---------- */
const MAX_FOTO = 2 * 1024 * 1024;
const FIRMAS = { "image/jpeg": [0xff, 0xd8, 0xff], "image/png": [0x89, 0x50, 0x4e, 0x47] };
// Acepta solo JPG, PNG o WebP reales (se revisan los primeros bytes, no solo el nombre).
function leerImagen(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) exigir({ foto: "La foto debe ser una imagen JPG, PNG o WebP." });
  const buf = Buffer.from(m[2], "base64");
  if (buf.length < 12) exigir({ foto: "La imagen está vacía o dañada." });
  if (buf.length > MAX_FOTO) exigir({ foto: "La foto pesa demasiado (máximo 2 MB)." });
  const firma = FIRMAS[m[1]];
  const ok = firma ? firma.every((b, i) => buf[i] === b) : (buf.slice(0, 4).toString("latin1") === "RIFF" && buf.slice(8, 12).toString("latin1") === "WEBP");
  if (!ok) exigir({ foto: "El archivo no es una imagen válida." });
  return { mime: m[1], buf };
}
async function borrarFotoSiSinUso(fotoId) {
  const db = getDb();
  if (!await db.prepare("select 1 from compras where foto_id = ?").get(fotoId)) await db.prepare("delete from fotos where id = ?").run(fotoId);
}
async function guardarFoto(dataUrl) {
  const { mime, buf } = leerImagen(dataUrl);
  const db = getDb();
  // Fotos subidas hace más de un día que ninguna compra usa (por ejemplo, un guardado que falló).
  await db.prepare("delete from fotos where created_at < ? and id not in (select foto_id from compras where foto_id is not null)").run(Date.now() - 24 * 60 * 60 * 1000);
  const id = uid();
  await db.prepare("insert into fotos (id, mime, data, bytes, created_at) values (?, ?, ?, ?, ?)").run(id, mime, buf, buf.length, Date.now());
  return id;
}
async function obtenerFoto(id) {
  const f = await getDb().prepare("select mime, data from fotos where id = ?").get(id);
  return f ? { mime: f.mime, buf: Buffer.from(f.data) } : null;
}
// Pone, cambia o quita (fotoId = null) la foto de una compra. Con aplicarDocumento también
// la pone en las demás compras del mismo documento (misma fecha, tipo y número).
async function asignarFotoCompra(id, fotoId, aplicarDocumento) {
  const db = getDb();
  const c = await db.prepare("select id, fecha, tipo_documento, numero from compras where id = ?").get(id);
  if (!c) throw new Error("La compra ya no existe.");
  if (fotoId && !await db.prepare("select 1 from fotos where id = ?").get(fotoId)) exigir({ foto: "La foto ya no está disponible: vuelve a adjuntarla." });
  let ids = [id];
  if (aplicarDocumento && c.numero) {
    ids = (await db.prepare("select id from compras where fecha = ? and tipo_documento = ? and numero = ?").all(c.fecha, c.tipo_documento, c.numero)).map((x) => x.id);
  }
  const previas = new Set();
  for (const x of ids) {
    const r = await db.prepare("select foto_id from compras where id = ?").get(x);
    if (r && r.foto_id) previas.add(r.foto_id);
    await db.prepare("update compras set foto_id = ? where id = ?").run(fotoId || null, x);
  }
  for (const p of previas) if (p !== fotoId) await borrarFotoSiSinUso(p);
}
async function marcarReembolsoCompra(id, reembolsado, fechaReembolso) {
  if (!await getDb().prepare("select 1 from compras where id = ?").get(id)) throw new Error("La compra ya no existe.");
  if (reembolsado && fechaReembolso) exigir(poner1("fechaReembolso", V.errorFecha(fechaReembolso, { etiqueta: "La fecha del reembolso" })));
  await getDb().prepare("update compras set reembolsado = ?, fecha_reembolso = ? where id = ?").run(reembolsado ? 1 : 0, reembolsado ? fechaReembolso || null : null, id);
}
const poner1 = (campo, msg) => (msg ? { [campo]: msg } : {});

/* ---------- gastos operativos (OpEx) ---------- */
async function saveGasto(g) {
  const db = getDb();
  exigir(V.validarGasto(g));
  const id = g.id || uid();
  if (g.id) {
    const previo = await db.prepare("select reembolsado, fecha_reembolso from gastos where id = ?").get(g.id);
    if (!previo) throw new Error("El gasto ya no existe.");
    const personal = g.cuenta === "personal";
    await db.prepare("update gastos set fecha = ?, fecha_pago = ?, categoria = ?, descripcion = ?, monto = ?, cuenta = ?, registrado_por = ?, reembolsado = ?, fecha_reembolso = ? where id = ?")
      .run(g.fecha, g.fechaPago || null, g.categoria, g.descripcion.trim(), Number(g.monto), g.cuenta, personal ? g.registradoPor.trim() : null, personal ? previo.reembolsado : 0, personal ? previo.fecha_reembolso : null, id);
  } else {
    await db.prepare("insert into gastos (id, fecha, fecha_pago, categoria, descripcion, monto, cuenta, registrado_por, reembolsado, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)")
      .run(id, g.fecha, g.fechaPago || null, g.categoria, g.descripcion.trim(), Number(g.monto), g.cuenta, g.cuenta === "personal" ? g.registradoPor.trim() : null, Date.now());
  }
  return id;
}
async function deleteGasto(id) { await getDb().prepare("delete from gastos where id = ?").run(id); }
async function marcarReembolsoGasto(id, reembolsado, fechaReembolso) {
  const g = await getDb().prepare("select cuenta from gastos where id = ?").get(id);
  if (!g) throw new Error("El gasto ya no existe.");
  if (g.cuenta !== "personal") throw new Error("Solo los gastos pagados con cuenta personal se reembolsan.");
  if (reembolsado && fechaReembolso) exigir(poner1("fechaReembolso", V.errorFecha(fechaReembolso, { etiqueta: "La fecha del reembolso" })));
  await getDb().prepare("update gastos set reembolsado = ?, fecha_reembolso = ? where id = ?").run(reembolsado ? 1 : 0, reembolsado ? fechaReembolso || null : null, id);
}

/* ---------- caja: conciliación y saldo de apertura ---------- */
async function guardarCierre(c) {
  exigir(V.validarCierre(c));
  await getDb().prepare("insert into cierres (mes, saldo_banco, nota) values (?, ?, ?) on conflict(mes) do update set saldo_banco = excluded.saldo_banco, nota = excluded.nota")
    .run(c.mes, Number(c.saldoBanco), String(c.nota || "").trim() || null);
  return c.mes;
}
async function borrarCierre(mes) { await getDb().prepare("delete from cierres where mes = ?").run(mes); }
async function guardarApertura(a) {
  exigir(V.validarApertura(a));
  const q = "insert into meta (k, v) values (?, ?) on conflict(k) do update set v = excluded.v";
  await getDb().prepare(q).run("caja_apertura_monto", String(Number(a.monto)));
  await getDb().prepare(q).run("caja_apertura_fecha", a.fecha);
  return "apertura";
}
async function borrarApertura() { await getDb().prepare("delete from meta where k in ('caja_apertura_monto', 'caja_apertura_fecha')").run(); }

/* ---------- recetas base ---------- */
// Comprueba que cada insumo exista y que la unidad sea de su misma familia (peso, volumen o conteo).
async function revisarInsumos(lista, prefijo, errores) {
  for (let i = 0; i < lista.length; i++) {
    const it = lista[i];
    if (!it.ingredienteId) continue;
    const ing = await getDb().prepare("select nombre, unidad from ingredientes where id = ?").get(it.ingredienteId);
    if (!ing) errores[`${prefijo}.${i}.ingredienteId`] = "El insumo ya no existe.";
    else if (V.FAMILIA[it.unidad] !== V.FAMILIA[ing.unidad]) errores[`${prefijo}.${i}.unidad`] = `${ing.nombre} se mide en ${ing.unidad}: usa una unidad de la misma familia.`;
  }
}
async function saveRecetaBase(r) {
  const db = getDb();
  const errores = V.validarRecetaBase(r);
  if (!errores.nombre && await nombreRepetido("recetas_base", r.nombre, r.id)) errores.nombre = "Ya existe una receta base con ese nombre.";
  await revisarInsumos(r.ingredientes || [], "ingredientes", errores);
  exigir(errores);
  r = { ...r, nombre: r.nombre.trim() };
  const id = r.id || uid();
  await db.prepare(
    `insert into recetas_base (id, nombre, unidad_rendimiento) values (?, ?, ?)
     on conflict(id) do update set nombre=excluded.nombre, unidad_rendimiento=excluded.unidad_rendimiento`
  ).run(id, r.nombre, r.unidadRendimiento);
  await db.prepare("delete from receta_base_ingredientes where receta_base_id = ?").run(id);
  const insert = await db.prepare("insert into receta_base_ingredientes (id, receta_base_id, ingrediente_id, cantidad, unidad) values (?, ?, ?, ?, ?)");
  for (const i of r.ingredientes) await insert.run(uid(), id, i.ingredienteId, Number(i.cantidad), i.unidad);
  return id;
}
async function deleteRecetaBase(id) {
  const db = getDb();
  for (const l of await db.prepare("select id from producciones where receta_base_id = ?").all(id)) {
    await db.prepare("delete from produccion_ingredientes where produccion_id = ?").run(l.id);
  }
  await db.prepare("delete from producciones where receta_base_id = ?").run(id);
  await db.prepare("delete from receta_base_ingredientes where receta_base_id = ?").run(id);
  await db.prepare("delete from recetas_base where id = ?").run(id);
}

/* ---------- producciones (lotes) ---------- */
async function saveProduccion(p) {
  const db = getDb();
  const id = uid();
  const errores = V.validarProduccion(p);
  const receta = await db.prepare("select nombre, unidad_rendimiento as unidad from recetas_base where id = ?").get(p.recetaBaseId);
  if (!receta) errores.recetaBaseId = "La receta base ya no existe.";
  else if (V.FAMILIA[p.unidadRendimiento] !== V.FAMILIA[receta.unidad]) errores.unidadRendimiento = `El rendimiento de esta receta se mide en ${receta.unidad}: usa una unidad de la misma familia.`;
  await revisarInsumos(p.ingredientesUsados || [], "ingredientesUsados", errores);
  let codigo = String(p.codigo || "").trim().toUpperCase();
  if (codigo && !errores.codigo && await db.prepare("select 1 from producciones where codigo = ?").get(codigo)) errores.codigo = `Ya existe un lote con el código ${codigo}.`;
  exigir(errores);
  if (!codigo) {
    codigo = await generarCodigoLote(db, receta?.nombre);
  }
  const ingredientesUsados = p.ingredientesUsados || [];
  let costoTotal = 0;
  for (const i of ingredientesUsados) {
    const precio = await costoRecienteIngrediente(i.ingredienteId);
    costoTotal += precio == null ? 0 : precio * toBase(i.cantidad, i.unidad);
  }
  await db.prepare("insert into producciones (id, receta_base_id, fecha, rendimiento_real, unidad_rendimiento, notas, costo_total, peso_envase, codigo) values (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    id,
    p.recetaBaseId,
    p.fecha,
    Number(p.rendimientoReal),
    p.unidadRendimiento,
    p.notas || null,
    costoTotal,
    p.pesoEnvase != null && p.pesoEnvase !== "" ? Number(p.pesoEnvase) : null,
    codigo
  );
  const insert = await db.prepare("insert into produccion_ingredientes (id, produccion_id, ingrediente_id, cantidad, unidad) values (?, ?, ?, ?, ?)");
  for (const i of ingredientesUsados) await insert.run(uid(), id, i.ingredienteId, Number(i.cantidad) || 0, i.unidad);
  return id;
}
async function deleteProduccion(id) {
  await getDb().prepare("delete from produccion_ingredientes where produccion_id = ?").run(id);
  await getDb().prepare("delete from producciones where id = ?").run(id);
}

/* ---------- productos ---------- */
async function saveProducto(p) {
  const db = getDb();
  const errores = V.validarProducto(p);
  if (!errores.nombre && await nombreRepetido("productos", p.nombre, p.id)) errores.nombre = "Ya existe un producto con ese nombre.";
  for (const [i, c] of (p.componentes || []).entries()) {
    if (!c.refId) continue;
    const ref = c.tipo === "ingrediente"
      ? await db.prepare("select unidad from ingredientes where id = ?").get(c.refId)
      : await db.prepare("select unidad_rendimiento as unidad from recetas_base where id = ?").get(c.refId);
    if (!ref) errores[`componentes.${i}.refId`] = "El componente ya no existe.";
    else if (V.FAMILIA[c.unidad] !== V.FAMILIA[ref.unidad]) errores[`componentes.${i}.unidad`] = `Este componente se mide en ${ref.unidad}: usa una unidad de la misma familia.`;
  }
  exigir(errores);
  p = { ...p, nombre: p.nombre.trim() };
  const id = p.id || uid();
  await db.prepare(
    `insert into productos (id, nombre, precio_venta) values (?, ?, ?)
     on conflict(id) do update set nombre=excluded.nombre, precio_venta=excluded.precio_venta`
  ).run(id, p.nombre, Number(p.precioVenta) || 0);
  await db.prepare("delete from producto_componentes where producto_id = ?").run(id);
  const insert = await db.prepare("insert into producto_componentes (id, producto_id, tipo, ref_id, cantidad, unidad) values (?, ?, ?, ?, ?, ?)");
  for (const c of p.componentes) await insert.run(uid(), id, c.tipo, c.refId, Number(c.cantidad), c.unidad);
  return id;
}
async function deleteProducto(id) {
  const db = getDb();
  if (await db.prepare("select 1 from venta_items where producto_id = ?").get(id) || await db.prepare("select 1 from pedido_items where producto_id = ?").get(id)) {
    throw new Error("No se puede eliminar: hay ventas o pedidos registrados con este producto.");
  }
  await db.prepare("delete from producto_componentes where producto_id = ?").run(id);
  await db.prepare("delete from productos where id = ?").run(id);
}

/* ---------- ajustes de inventario ---------- */
async function saveAjusteInventario(a) {
  const errores = V.validarAjuste(a);
  if (!errores.refId && !errores.tipo) {
    const ref = a.tipo === "lote"
      ? await getDb().prepare("select unidad_rendimiento as unidad from producciones where id = ?").get(a.refId)
      : await getDb().prepare("select unidad from ingredientes where id = ?").get(a.refId);
    if (!ref) errores.refId = a.tipo === "lote" ? "El lote ya no existe." : "El insumo ya no existe.";
    else if (!errores.unidad && V.FAMILIA[a.unidad] !== V.FAMILIA[ref.unidad]) errores.unidad = "La unidad no coincide con la del elemento.";
  }
  exigir(errores);
  const id = uid();
  await getDb()
    .prepare("insert into ajustes_inventario (id, tipo, ref_id, fecha, cantidad, unidad, categoria, nota, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, a.tipo, a.refId, a.fecha, Number(a.cantidad), a.unidad, a.categoria, (a.nota || "").trim() || null, Date.now());
  return id;
}
async function deleteAjusteInventario(id) {
  await getDb().prepare("delete from ajustes_inventario where id = ?").run(id);
}

/* ---------- ventas ---------- */
async function saveVenta(v) {
  const db = getDb();
  const errores = V.validarVenta(v);
  for (const [i, it] of (v.items || []).entries()) { if (it.productoId && !(await db.prepare("select 1 from productos where id = ?").get(it.productoId))) errores[`items.${i}.productoId`] = "El producto ya no existe."; }
  if (v.clienteId && !await db.prepare("select 1 from clientes where id = ?").get(v.clienteId)) errores.clienteId = "El cliente ya no existe.";
  exigir(errores);
  if (v.pedidoId) {
    const ped = await db.prepare("select venta_id from pedidos where id = ?").get(v.pedidoId);
    if (!ped) throw new Error("El pedido ya no existe.");
    if (ped.venta_id) throw new Error("Este pedido ya fue entregado y registrado como venta.");
  }
  const id = uid();
  const total = v.items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0), 0);
  await db.prepare("insert into ventas (id, fecha, cliente_id, total, cuenta, registrado_por, fecha_cobro) values (?, ?, ?, ?, ?, ?, ?)").run(
    id, v.fecha, v.clienteId || null, total, v.cuenta || null, v.registradoPor || null, v.cuenta === "pendiente" ? null : v.fecha
  );

  const insertItem = await db.prepare("insert into venta_items (id, venta_id, producto_id, cantidad, precio_unitario) values (?, ?, ?, ?, ?)");
  const insertConsumo = await db.prepare("insert into venta_consumos (id, venta_id, venta_item_id, producto_id, tipo, ref_id, receta_base_id, cantidad, unidad) values (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const getComponentes = await db.prepare("select tipo, ref_id as refId, cantidad, unidad from producto_componentes where producto_id = ?");

  for (const it of v.items) {
    const itemId = uid();
    await insertItem.run(itemId, id, it.productoId, Number(it.cantidad), Number(it.precioUnitario) || 0);

    const componentes = await getComponentes.all(it.productoId);
    for (const comp of componentes) {
      const necesarioBase = toBase(Number(it.cantidad) * Number(comp.cantidad), comp.unidad);
      if (comp.tipo === "ingrediente") {
        await insertConsumo.run(uid(), id, itemId, it.productoId, "ingrediente", comp.refId, null, necesarioBase, baseUnidadDe(comp.unidad));
      } else {
        const override = it.distribucion && it.distribucion[comp.refId];
        if (override && override.length > 0) {
          // El usuario revisó/corrigió a mano de qué lote sale esto (ej. porque sabe que un lote
          // tiene menos de lo que el sistema cree). Se respeta tal cual.
          let asignadoBase = 0;
          for (const a of override) {
            const cant = Number(a.cantidad) || 0;
            if (cant <= 0) continue;
            await insertConsumo.run(uid(), id, itemId, it.productoId, "receta_base", a.produccionId, comp.refId, cant, baseUnidadDe(comp.unidad));
            asignadoBase += cant;
          }
          if (necesarioBase - asignadoBase > 0.0001) {
            await insertConsumo.run(uid(), id, itemId, it.productoId, "receta_base", null, comp.refId, necesarioBase - asignadoBase, baseUnidadDe(comp.unidad));
          }
        } else {
          const { asignaciones, faltanteBase } = await asignarLotesFIFO(comp.refId, necesarioBase);
          for (const a of asignaciones) {
            await insertConsumo.run(uid(), id, itemId, it.productoId, "receta_base", a.produccionId, comp.refId, a.cantidadBase, baseUnidadDe(comp.unidad));
          }
          if (faltanteBase > 0) {
            await insertConsumo.run(uid(), id, itemId, it.productoId, "receta_base", null, comp.refId, faltanteBase, baseUnidadDe(comp.unidad));
          }
        }
      }
    }
  }
  // Si la venta nace de un pedido, queda vinculada: así el pedido pasa a "entregado".
  if (v.pedidoId) await db.prepare("update pedidos set venta_id = ? where id = ?").run(id, v.pedidoId);
  return id;
}
async function actualizarCuentaVenta(id, cuenta, registradoPor, fechaCobro) {
  exigir(V.validarCuentaVenta({ cuenta, registradoPor, fechaCobro }));
  if (!await getDb().prepare("select 1 from ventas where id = ?").get(id)) throw new Error("La venta ya no existe.");
  const v = await getDb().prepare("select fecha from ventas where id = ?").get(id);
  await getDb().prepare("update ventas set cuenta = ?, registrado_por = ?, fecha_cobro = ? where id = ?").run(cuenta, cuenta === "personal" ? String(registradoPor).trim() : null, cuenta === "pendiente" ? null : fechaCobro || v.fecha, id);
}
async function deleteVenta(id) {
  const db = getDb();
  await db.prepare("delete from venta_consumos where venta_id = ?").run(id);
  await db.prepare("delete from venta_items where venta_id = ?").run(id);
  await db.prepare("update pedidos set venta_id = null where venta_id = ?").run(id);
  await db.prepare("delete from ventas where id = ?").run(id);
}

/* ---------- pedidos ---------- */
async function savePedido(p) {
  const db = getDb();
  const errores = V.validarPedido(p);
  for (const [i, it] of (p.items || []).entries()) { if (it.productoId && !(await db.prepare("select 1 from productos where id = ?").get(it.productoId))) errores[`items.${i}.productoId`] = "El producto ya no existe."; }
  if (p.clienteId && !await db.prepare("select 1 from clientes where id = ?").get(p.clienteId)) errores.clienteId = "El cliente ya no existe.";
  exigir(errores);
  if (p.id) {
    const previo = await db.prepare("select venta_id from pedidos where id = ?").get(p.id);
    if (previo && previo.venta_id) throw new Error("Este pedido ya fue entregado y no se puede editar.");
  }
  const id = p.id || uid();
  await db.prepare(
    `insert into pedidos (id, fecha, cliente_id, pago, notas, created_at) values (?, ?, ?, ?, ?, ?)
     on conflict(id) do update set fecha=excluded.fecha, cliente_id=excluded.cliente_id, pago=excluded.pago, notas=excluded.notas`
  ).run(id, p.fecha, p.clienteId || null, p.pago === "pagado" ? "pagado" : "pendiente", p.notas || null, Date.now());
  await db.prepare("delete from pedido_items where pedido_id = ?").run(id);
  const insert = await db.prepare("insert into pedido_items (id, pedido_id, producto_id, cantidad) values (?, ?, ?, ?)");
  for (const it of p.items || []) await insert.run(uid(), id, it.productoId, Number(it.cantidad));
  return id;
}
async function cambiarPagoPedido(id, pago) {
  if (!["pagado", "pendiente"].includes(pago)) exigir({ pago: "Elige el estado de pago." });
  const ped = await getDb().prepare("select venta_id from pedidos where id = ?").get(id);
  if (!ped) throw new Error("El pedido ya no existe.");
  if (ped.venta_id) throw new Error("Este pedido ya fue entregado.");
  await getDb().prepare("update pedidos set pago = ? where id = ?").run(pago === "pagado" ? "pagado" : "pendiente", id);
}
async function deletePedido(id) {
  await getDb().prepare("delete from pedido_items where pedido_id = ?").run(id);
  await getDb().prepare("delete from pedidos where id = ?").run(id);
}

/* ---------- auditoría ---------- */
const soles = (n) => `S/ ${(Number(n) || 0).toFixed(2)}`;
const cant = (n, u) => `${Math.round((Number(n) || 0) * 10000) / 10000} ${u}`;
const orNull = (v) => (v == null || v === "" ? null : v);

// Foto legible de un registro (con nombres en vez de ids). Se guarda antes y después de cada cambio.
async function describir(entidad, id) {
  if (!id) return null;
  const db = getDb();
  const nombreDe = async (tabla, i) => (i ? (await db.prepare(`select nombre from ${tabla} where id = ?`).get(i))?.nombre || null : null);
  switch (entidad) {
    case "cliente": {
      const r = await db.prepare("select * from clientes where id = ?").get(id);
      return r && { "Nombre": r.nombre, "Teléfono": orNull(r.telefono), "Correo": orNull(r.email), "Dirección": orNull(r.direccion), "Notas": orNull(r.notas) };
    }
    case "insumo": {
      const r = await db.prepare("select * from ingredientes where id = ?").get(id);
      return r && { "Nombre": r.nombre, "Unidad": r.unidad };
    }
    case "compra": {
      const r = await db.prepare("select * from compras where id = ?").get(id);
      return r && {
        "Fecha": r.fecha, "Documento": `${r.tipo_documento}${r.numero ? ` #${r.numero}` : ""}`, "Insumo": await nombreDe("ingredientes", r.ingrediente_id) || "(eliminado)", "Marca": orNull(r.marca), "Documento adjunto": r.foto_id ? "Sí" : null,
        "Cantidad": cant(r.cantidad, r.unidad), "Costo total": soles(r.costo_total),
        "Pagado con": r.cuenta === "personal" ? `Cuenta personal${r.registrado_por ? ` (${r.registrado_por})` : ""}` : r.cuenta === "empresa" ? "Cuenta de la empresa" : null,
        "Reembolsado": r.cuenta === "personal" ? (r.reembolsado ? `Sí${r.fecha_reembolso ? ` (${r.fecha_reembolso})` : ""}` : "No") : null,
        "Fecha de pago": orNull(r.fecha_pago),
      };
    }
    case "gasto": {
      const r = await db.prepare("select * from gastos where id = ?").get(id);
      return r && {
        "Fecha": r.fecha, "Fecha de pago": orNull(r.fecha_pago), "Categoría": r.categoria, "Descripción": r.descripcion, "Monto": soles(r.monto),
        "Pagado con": r.cuenta === "personal" ? `Cuenta personal${r.registrado_por ? ` (${r.registrado_por})` : ""}` : "Cuenta de la empresa",
        "Reembolsado": r.cuenta === "personal" ? (r.reembolsado ? `Sí${r.fecha_reembolso ? ` (${r.fecha_reembolso})` : ""}` : "No") : null,
      };
    }
    case "caja": {
      if (id === "apertura") {
        const m = await db.prepare("select v from meta where k = 'caja_apertura_monto'").get();
        const f = await db.prepare("select v from meta where k = 'caja_apertura_fecha'").get();
        return m && f ? { "Saldo de apertura": soles(m.v), "Desde": f.v } : null;
      }
      const r = await db.prepare("select * from cierres where mes = ?").get(id);
      return r && { "Mes": r.mes, "Saldo real en banco": soles(r.saldo_banco), "Nota": orNull(r.nota) };
    }
    case "receta": {
      const r = await db.prepare("select * from recetas_base where id = ?").get(id);
      if (!r) return null;
      const ings = await db.prepare("select i.nombre, x.cantidad, x.unidad from receta_base_ingredientes x join ingredientes i on i.id = x.ingrediente_id where x.receta_base_id = ? order by i.nombre").all(id);
      const lotes = (await db.prepare("select codigo from producciones where receta_base_id = ? order by fecha, rowid").all(id)).map((l) => l.codigo);
      return { "Nombre": r.nombre, "Unidad de rendimiento": r.unidad_rendimiento, "Insumos": ings.map((i) => `${i.nombre}: ${cant(i.cantidad, i.unidad)}`), "Lotes": lotes.length ? lotes : null };
    }
    case "lote": {
      const r = await db.prepare("select * from producciones where id = ?").get(id);
      if (!r) return null;
      const ings = await db.prepare("select i.nombre, x.cantidad, x.unidad from produccion_ingredientes x join ingredientes i on i.id = x.ingrediente_id where x.produccion_id = ? order by i.nombre").all(id);
      const usos = (await db.prepare("select count(*) as n from venta_consumos where tipo = 'receta_base' and ref_id = ?").get(id)).n;
      return {
        "Código": r.codigo, "Receta": await nombreDe("recetas_base", r.receta_base_id), "Fecha": r.fecha, "Rendimiento": cant(r.rendimiento_real, r.unidad_rendimiento),
        "Costo del lote": soles(r.costo_total), "Insumos usados": ings.map((i) => `${i.nombre}: ${cant(i.cantidad, i.unidad)}`),
        "Peso del envase": r.peso_envase != null ? cant(r.peso_envase, r.unidad_rendimiento) : null, "Notas": orNull(r.notas),
        "Usado en ventas": usos ? `${usos} consumo(s)` : null,
      };
    }
    case "producto": {
      const r = await db.prepare("select * from productos where id = ?").get(id);
      if (!r) return null;
      const comps = [];
      for (const c of await db.prepare("select * from producto_componentes where producto_id = ?").all(id)) comps.push(`${(await nombreDe(c.tipo === "ingrediente" ? "ingredientes" : "recetas_base", c.ref_id)) || "(eliminado)"}: ${cant(c.cantidad, c.unidad)}`);
      return { "Nombre": r.nombre, "Precio de venta": soles(r.precio_venta), "Componentes": comps };
    }
    case "venta": {
      const r = await db.prepare("select * from ventas where id = ?").get(id);
      if (!r) return null;
      const items = [];
      for (const i of await db.prepare("select * from venta_items where venta_id = ?").all(id)) items.push(`${i.cantidad}× ${(await nombreDe("productos", i.producto_id)) || "(eliminado)"} a ${soles(i.precio_unitario)}`);
      return {
        "Fecha": r.fecha, "Cliente": await nombreDe("clientes", r.cliente_id), "Total": soles(r.total),
        "Fecha de cobro": orNull(r.fecha_cobro),
        "Dinero": r.cuenta === "personal" ? `Cuenta personal${r.registrado_por ? ` (${r.registrado_por})` : ""}` : r.cuenta === "empresa" ? "Cuenta de la empresa" : r.cuenta === "pendiente" ? "Pendiente de pago" : null,
        "Productos": items,
      };
    }
    case "pedido": {
      const r = await db.prepare("select * from pedidos where id = ?").get(id);
      if (!r) return null;
      const items = [];
      for (const i of await db.prepare("select * from pedido_items where pedido_id = ?").all(id)) items.push(`${i.cantidad}× ${(await nombreDe("productos", i.producto_id)) || "(eliminado)"}`);
      return { "Fecha de entrega": r.fecha, "Cliente": await nombreDe("clientes", r.cliente_id), "Pago": r.pago === "pagado" ? "Pagado" : "Pendiente", "Estado": r.venta_id ? "Entregado" : "Por entregar", "Productos": items, "Notas": orNull(r.notas) };
    }
    case "ajuste": {
      const r = await db.prepare("select * from ajustes_inventario where id = ?").get(id);
      if (!r) return null;
      const elemento = r.tipo === "lote"
        ? await (async () => { const l = await db.prepare("select p.codigo, rb.nombre from producciones p left join recetas_base rb on rb.id = p.receta_base_id where p.id = ?").get(r.ref_id); return l ? `Lote ${l.codigo} (${l.nombre || "receta eliminada"})` : "Lote eliminado"; })()
        : `Insumo ${(await nombreDe("ingredientes", r.ref_id)) || "eliminado"}`;
      return { "Fecha": r.fecha, "Elemento": elemento, "Cantidad": `${r.cantidad > 0 ? "+" : ""}${cant(r.cantidad, r.unidad)}`, "Categoría": r.categoria, "Nota": orNull(r.nota) };
    }
    case "usuario": {
      const u = await db.prepare("select * from users where id = ?").get(id);
      if (!u) return null;
      const perfil = perfilDe(u);
      const nombresSecc = require("./permisos").SECCIONES;
      return {
        "Nombre": u.nombre, "Correo": u.email, "Rol": u.rol === "admin" ? "Administrador" : "Usuario",
        "Secciones": u.rol === "admin" ? ["Todas"] : perfil.permisos.map((x) => nombresSecc.find((s) => s.id === x)?.label || x),
        "Cuenta": u.activo ? "Activa" : "Desactivada",
      };
    }
    default:
      return null;
  }
}
// Nombre corto para reconocer el registro en la lista de auditoría.
function etiquetaDe(entidad, f) {
  if (!f) return null;
  switch (entidad) {
    case "cliente": case "insumo": case "producto": case "receta": return f["Nombre"];
    case "compra": return `${f["Insumo"]} · ${f["Fecha"]}`;
    case "gasto": return `${f["Descripción"]} · ${f["Fecha"]}`;
    case "caja": return f["Mes"] ? `Conciliación ${f["Mes"]}` : "Saldo de apertura";
    case "lote": return `${f["Código"]} (${f["Receta"]})`;
    case "venta": return `${f["Fecha"]} · ${f["Total"]}`;
    case "pedido": return `${f["Fecha de entrega"]}${f["Cliente"] ? ` · ${f["Cliente"]}` : ""}`;
    case "ajuste": return `${f["Elemento"]} · ${f["Cantidad"]}`;
    case "usuario": return f["Nombre"] || f["Correo"];
    default: return null;
  }
}
async function registrarAuditoria({ usuario, accion, entidad, entidadId, etiqueta, antes, despues, detalle }) {
  try {
    await getDb()
      .prepare("insert into auditoria (id, ts, usuario_id, usuario_email, usuario_nombre, accion, entidad, entidad_id, etiqueta, antes, despues, detalle) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        uid(), Date.now(), usuario?.id || null, usuario?.email || null, usuario?.nombre || null, accion, entidad, entidadId || null,
        etiqueta || etiquetaDe(entidad, despues || antes) || null,
        antes ? JSON.stringify(antes) : null, despues ? JSON.stringify(despues) : null, detalle || null
      );
  } catch (e) {
    console.error("No se pudo registrar la auditoría:", e.message);
  }
}
async function listarAuditoria({ desde, hasta, usuario, entidad, accion, q, limite = 40, pagina = 0 } = {}) {
  const db = getDb();
  const where = [];
  const args = [];
  const ms = (f, fin) => { const [y, m, d] = String(f).split("-").map(Number); return new Date(y, m - 1, d + (fin ? 1 : 0)).getTime(); };
  if (desde && V.fechaValida(desde)) { where.push("ts >= ?"); args.push(ms(desde, false)); }
  if (hasta && V.fechaValida(hasta)) { where.push("ts < ?"); args.push(ms(hasta, true)); }
  if (usuario) { where.push("usuario_email = ?"); args.push(usuario); }
  if (entidad) { where.push("entidad = ?"); args.push(entidad); }
  if (accion === "acceso") where.push("entidad = 'acceso'");
  else if (accion === "cambios") where.push("entidad != 'acceso'");
  else if (accion) { where.push("accion = ?"); args.push(accion); }
  if (q) { where.push("(lower(coalesce(etiqueta,'')) like ? or lower(coalesce(detalle,'')) like ? or lower(coalesce(usuario_email,'')) like ?)"); const t = `%${String(q).toLowerCase()}%`; args.push(t, t, t); }
  const cond = where.length ? `where ${where.join(" and ")}` : "";
  const total = (await db.prepare(`select count(*) as n from auditoria ${cond}`).get(...args)).n;
  const lim = Math.min(Math.max(parseInt(limite, 10) || 40, 1), 200);
  const filas = await db.prepare(`select * from auditoria ${cond} order by ts desc, rowid desc limit ? offset ?`).all(...args, lim, Math.max(0, parseInt(pagina, 10) || 0) * lim);
  const parse = (t) => { try { return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  const usuarios = (await db.prepare("select distinct usuario_email as email from auditoria where usuario_email is not null order by usuario_email").all()).map((r) => r.email);
  return {
    total, limite: lim, usuarios,
    items: filas.map((r) => ({
      id: r.id, ts: r.ts, usuarioEmail: r.usuario_email, usuarioNombre: r.usuario_nombre, accion: r.accion, entidad: r.entidad, entidadId: r.entidad_id,
      etiqueta: r.etiqueta, antes: parse(r.antes), despues: parse(r.despues), detalle: r.detalle,
    })),
  };
}

module.exports = {
  limitar, getDb, uid, ErrorValidacion, exigir,
  describir, registrarAuditoria, listarAuditoria,
  findUserByEmail, createUser, createSession, findSession, deleteSession,
  fetchAllData,
  saveCliente, deleteCliente,
  saveIngrediente, deleteIngrediente,
  saveCompra, deleteCompra, marcarReembolsoCompra, saveGasto, deleteGasto, marcarReembolsoGasto, guardarCierre, borrarCierre, guardarApertura, borrarApertura, actualizarDocumento, guardarFoto, obtenerFoto, asignarFotoCompra,
  saveRecetaBase, deleteRecetaBase,
  saveProduccion, deleteProduccion,
  saveProducto, deleteProducto,
  saveVenta, deleteVenta, actualizarCuentaVenta,
  saveAjusteInventario, deleteAjusteInventario,
  savePedido, cambiarPagoPedido, deletePedido,
  normEmail, perfilDe, deleteSessionsOfUser,
  bloqueadoHasta, registrarFallo, limpiarIntentos,
  listUsers, updateUser, setPassword, deleteUser,
  guardarRecuperacion, findRecuperacion, sumarIntentoRecuperacion, borrarRecuperacion, recuperacionesPendientes,
};
