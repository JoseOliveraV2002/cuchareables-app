"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, ShoppingCart, FlaskConical, Package, Receipt, LayoutDashboard,
  Plus, Trash2, Pencil, X, ChevronRight, AlertTriangle, TrendingUp, Loader2, Search, LogOut,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  fetchAll, saveCliente, deleteCliente, saveIngrediente, saveCompra, deleteCompra,
  saveRecetaBase, deleteRecetaBase, saveProduccion, deleteProduccion,
  saveProducto, deleteProducto, saveVenta, deleteVenta,
} from "../lib/data";

/* ---------------- paleta / helpers ---------------- */
const C = {
  bg: "#FBF7F1", surface: "#FFFFFF", line: "#E7DCC9", ink: "#3A2A1E", inkSoft: "#7A6A57",
  caramel: "#A15C2B", caramelDark: "#7E4620", sage: "#5F7355", sageBg: "#EEF2E9",
  brick: "#A23E3E", brickBg: "#F7EAEA", chip: "#F3EADA",
};
const UNIDADES = ["g", "kg", "ml", "l", "unidad"];
const FAMILIA = { g: "peso", kg: "peso", ml: "volumen", l: "volumen", unidad: "conteo" };
const A_BASE = { g: 1, kg: 1000, ml: 1, l: 1000, unidad: 1 };
const BASE_DE = { peso: "g", volumen: "ml", conteo: "unidad" };
const TIPOS_DOC = ["Boleta", "Factura", "Guía de despacho", "Otro"];
const clp = (n) => (isFinite(n) ? n : 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fmtNum = (n, d = 2) => (isFinite(n) ? n : 0).toLocaleString("es-CL", { maximumFractionDigits: d });
const toBase = (cantidad, unidad) => (Number(cantidad) || 0) * (A_BASE[unidad] || 1);
const baseUnidadDe = (unidad) => BASE_DE[FAMILIA[unidad]] || unidad;
const hoy = () => new Date().toISOString().slice(0, 10);
const DATA_VACIA = { clientes: [], ingredientes: [], compras: [], recetasBase: [], producciones: [], productos: [], ventas: [] };

function useFonts() {
  useEffect(() => {
    if (document.getElementById("gc-fonts")) return;
    const link = document.createElement("link");
    link.id = "gc-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

/* ---------------- costeo ---------------- */
function useCosteo(data) {
  const costoBaseIngrediente = useMemo(() => {
    const map = {};
    data.ingredientes.forEach((ing) => {
      const compras = data.compras.filter((c) => c.ingredienteId === ing.id);
      const totalGasto = compras.reduce((s, c) => s + (Number(c.costoTotal) || 0), 0);
      const totalBase = compras.reduce((s, c) => s + toBase(c.cantidad, c.unidad), 0);
      map[ing.id] = totalBase > 0 ? totalGasto / totalBase : 0;
    });
    return map;
  }, [data.ingredientes, data.compras]);

  const costoIngredienteEnCantidad = useCallback(
    (ingredienteId, cantidad, unidad) => (costoBaseIngrediente[ingredienteId] || 0) * toBase(cantidad, unidad),
    [costoBaseIngrediente]
  );

  const costoLoteProduccion = useCallback(
    (prod) => (prod.ingredientesUsados || []).reduce((s, i) => s + costoIngredienteEnCantidad(i.ingredienteId, i.cantidad, i.unidad), 0),
    [costoIngredienteEnCantidad]
  );

  const costoPorUnidadRecetaBase = useMemo(() => {
    const map = {};
    data.recetasBase.forEach((rb) => {
      const lotes = data.producciones.filter((p) => p.recetaBaseId === rb.id);
      let totalCosto = 0, totalRendimientoBase = 0;
      lotes.forEach((p) => {
        totalCosto += costoLoteProduccion(p);
        totalRendimientoBase += toBase(p.rendimientoReal, p.unidadRendimiento);
      });
      map[rb.id] = totalRendimientoBase > 0 ? totalCosto / totalRendimientoBase : null;
    });
    return map;
  }, [data.recetasBase, data.producciones, costoLoteProduccion]);

  const costoProducto = useCallback(
    (producto) => {
      let costo = 0, incompleto = false;
      (producto.componentes || []).forEach((comp) => {
        if (comp.tipo === "ingrediente") {
          costo += costoIngredienteEnCantidad(comp.refId, comp.cantidad, comp.unidad);
        } else {
          const cpu = costoPorUnidadRecetaBase[comp.refId];
          if (cpu == null) incompleto = true;
          else costo += cpu * toBase(comp.cantidad, comp.unidad);
        }
      });
      return { costo, incompleto };
    },
    [costoIngredienteEnCantidad, costoPorUnidadRecetaBase]
  );

  return { costoBaseIngrediente, costoIngredienteEnCantidad, costoLoteProduccion, costoPorUnidadRecetaBase, costoProducto };
}

/* ---------------- UI genérica ---------------- */
function Shell({ children }) {
  return <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: C.ink }}>{children}</div>;
}
function Card({ children, style, ...rest }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, ...style }} {...rest}>{children}</div>;
}
function Btn({ children, variant = "primary", onClick, type = "button", style, disabled }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: disabled ? "default" : "pointer", border: "1px solid transparent", opacity: disabled ? 0.5 : 1 };
  const variants = {
    primary: { background: C.caramel, color: "#fff" },
    ghost: { background: "transparent", color: C.ink, border: `1px solid ${C.line}` },
    danger: { background: C.brickBg, color: C.brick },
  };
  return <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}
function Field({ label, children, hint }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
      <span style={{ color: C.inkSoft, fontWeight: 600 }}>{label}</span>
      {children}
      {hint && <span style={{ color: C.inkSoft, fontSize: 12 }}>{hint}</span>}
    </label>
  );
}
const inputStyle = { border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", color: C.ink, background: "#FFFDFA", outline: "none" };
function Input(props) { return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function Select(props) { return <select {...props} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(58,42,30,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, width: "100%", maxWidth: wide ? 640 : 460, borderRadius: "16px 16px 0 0", padding: 20, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 -8px 30px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: C.inkSoft }}>
      <Icon size={28} style={{ marginBottom: 10, color: C.caramel }} />
      <div style={{ fontWeight: 600, color: C.ink, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, marginBottom: 16 }}>{desc}</div>
      {action}
    </div>
  );
}
function Th({ children, right }) { return <th style={{ textAlign: right ? "right" : "left", padding: "8px 10px", fontSize: 12, color: C.inkSoft, fontWeight: 600, borderBottom: `1px solid ${C.line}` }}>{children}</th>; }
function Td({ children, right, style }) { return <td style={{ textAlign: right ? "right" : "left", padding: "9px 10px", fontSize: 13.5, borderBottom: `1px solid ${C.line}`, ...style }}>{children}</td>; }

/* ---------------- LOGIN ---------------- */
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Correo o contraseña incorrectos.");
    setLoading(false);
  };

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, marginBottom: 6 }}>Gestión de cucharables</div>
        <div style={{ color: C.inkSoft, fontSize: 14, marginBottom: 24 }}>Inicia sesión para continuar</div>
        <form onSubmit={entrar} style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
          <Field label="Correo"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
          <Field label="Contraseña"><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {error && <div style={{ color: C.brick, fontSize: 13 }}>{error}</div>}
          <Btn type="submit" disabled={loading} style={{ justifyContent: "center", marginTop: 6 }}>{loading ? "Entrando…" : "Entrar"}</Btn>
        </form>
        <div style={{ marginTop: 20, fontSize: 12, color: C.inkSoft, maxWidth: 300, textAlign: "center" }}>
          Las cuentas se crean desde el panel de Supabase (Authentication → Users). No hay registro abierto.
        </div>
      </div>
    </Shell>
  );
}

/* ---------------- APP RAÍZ ---------------- */
export default function Page() {
  useFonts();
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <Shell><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", gap: 8, color: C.inkSoft }}><Loader2 size={18} /> Cargando…</div></Shell>;
  }
  if (!session) return <LoginScreen />;
  return <MainApp session={session} />;
}

function MainApp({ session }) {
  const [data, setData] = useState(DATA_VACIA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const d = await fetchAll();
      setData(d);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoaded(true));
  }, [reload]);

  const wrap = (fn) => async (...args) => {
    setBusy(true);
    setError("");
    try {
      await fn(...args);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const actions = {
    guardarCliente: wrap(saveCliente),
    eliminarCliente: wrap(deleteCliente),
    guardarIngrediente: wrap(saveIngrediente),
    guardarCompra: wrap(saveCompra),
    eliminarCompra: wrap(deleteCompra),
    guardarRecetaBase: wrap(saveRecetaBase),
    eliminarRecetaBase: wrap(deleteRecetaBase),
    guardarProduccion: wrap(saveProduccion),
    eliminarProduccion: wrap(deleteProduccion),
    guardarProducto: wrap(saveProducto),
    eliminarProducto: wrap(deleteProducto),
    guardarVenta: wrap(saveVenta),
    eliminarVenta: wrap(deleteVenta),
  };

  const costeo = useCosteo(data);

  if (!loaded) {
    return <Shell><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", gap: 8, color: C.inkSoft }}><Loader2 size={18} /> Cargando datos…</div></Shell>;
  }

  const NAV = [
    { id: "dashboard", label: "Panel", icon: LayoutDashboard },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "compras", label: "Compras", icon: ShoppingCart },
    { id: "recetas", label: "Recetas base", icon: FlaskConical },
    { id: "productos", label: "Productos", icon: Package },
    { id: "ventas", label: "Ventas", icon: Receipt },
  ];

  return (
    <Shell>
      <div style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 90 }}>
        <header style={{ padding: "18px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600 }}>Gestión de cucharables</div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>{session.user.email} {busy && <span>· guardando…</span>}</div>
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", color: C.inkSoft, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <LogOut size={14} /> salir
          </button>
        </header>

        {error && <div style={{ margin: "0 16px 10px", background: C.brickBg, color: C.brick, padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>{error}</div>}

        <main style={{ padding: "6px 16px" }}>
          {tab === "dashboard" && <Dashboard data={data} costeo={costeo} />}
          {tab === "clientes" && <Clientes data={data} {...actions} />}
          {tab === "compras" && <Compras data={data} costeo={costeo} {...actions} />}
          {tab === "recetas" && <RecetasBase data={data} costeo={costeo} {...actions} />}
          {tab === "productos" && <Productos data={data} costeo={costeo} {...actions} />}
          {tab === "ventas" && <Ventas data={data} costeo={costeo} {...actions} />}
        </main>
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-around", padding: "8px 4px", maxWidth: 720, margin: "0 auto" }}>
        {NAV.map((n) => {
          const active = tab === n.id;
          const Icon = n.icon;
          return (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: active ? C.caramel : C.inkSoft, fontSize: 10.5, fontWeight: 600, padding: "4px 6px" }}>
              <Icon size={19} />{n.label}
            </button>
          );
        })}
      </nav>
    </Shell>
  );
}

/* ---------------- DASHBOARD ---------------- */
function Dashboard({ data, costeo }) {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const ventasMes = data.ventas.filter((v) => new Date(v.fecha) >= inicioMes);
  const totalVentasMes = ventasMes.reduce((s, v) => s + (Number(v.total) || 0), 0);

  let costoMes = 0;
  const porProducto = {};
  ventasMes.forEach((v) => {
    (v.items || []).forEach((it) => {
      const prod = data.productos.find((p) => p.id === it.productoId);
      const nombre = prod ? prod.nombre : "Producto eliminado";
      if (!porProducto[it.productoId]) porProducto[it.productoId] = { nombre, cantidad: 0 };
      porProducto[it.productoId].cantidad += Number(it.cantidad) || 0;
      if (prod) costoMes += costeo.costoProducto(prod).costo * (Number(it.cantidad) || 0);
    });
  });
  const margenMes = totalVentasMes - costoMes;
  const ranking = Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
  const maxCant = ranking[0]?.cantidad || 1;
  const productosSinCosto = data.productos.filter((p) => costeo.costoProducto(p).incompleto);

  const stats = [
    { label: "Ventas del mes", value: clp(totalVentasMes) },
    { label: "Costo estimado", value: clp(costoMes) },
    { label: "Margen del mes", value: clp(margenMes), color: margenMes >= 0 ? C.sage : C.brick },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {stats.map((s) => (
          <Card key={s.label} style={{ padding: "12px 10px" }}>
            <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, color: s.color || C.ink }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <TrendingUp size={16} color={C.caramel} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Productos más vendidos este mes</div>
        </div>
        {ranking.length === 0 ? (
          <div style={{ fontSize: 13, color: C.inkSoft }}>Aún no hay ventas registradas este mes.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ranking.map((r) => (
              <div key={r.nombre}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span>{r.nombre}</span><span style={{ color: C.inkSoft }}>{fmtNum(r.cantidad, 0)} vendidos</span></div>
                <div style={{ background: C.chip, borderRadius: 6, height: 7 }}><div style={{ width: `${(r.cantidad / maxCant) * 100}%`, background: C.caramel, height: 7, borderRadius: 6 }} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {productosSinCosto.length > 0 && (
        <Card style={{ padding: 14, borderColor: "#E8CFAE", background: "#FFF8EC" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertTriangle size={16} color={C.caramelDark} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 13 }}><b>{productosSinCosto.length} producto(s) sin costo calculable:</b> {productosSinCosto.map((p) => p.nombre).join(", ")}. Registra al menos una producción de la receta base que usan.</div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------- CLIENTES ---------------- */
function Clientes({ data, guardarCliente, eliminarCliente }) {
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState("");
  const filtrados = data.clientes.filter((c) => c.nombre.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 9, top: 10, color: C.inkSoft }} />
          <Input placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 28, width: "100%" }} />
        </div>
        <Btn onClick={() => setModal({})}><Plus size={15} /> Nuevo</Btn>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState icon={Users} title="Sin clientes aún" desc="Registra tu primer cliente." action={<Btn onClick={() => setModal({})}>Agregar cliente</Btn>} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtrados.map((c) => (
            <Card key={c.id} style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nombre}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{[c.telefono, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setModal(c)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}><Pencil size={16} /></button>
                <button onClick={() => eliminarCliente(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={16} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {modal && <ClienteModal cliente={modal} onClose={() => setModal(null)} onSave={async (c) => { await guardarCliente(c); setModal(null); }} />}
    </div>
  );
}
function ClienteModal({ cliente, onClose, onSave }) {
  const [f, setF] = useState({ nombre: "", telefono: "", email: "", direccion: "", notas: "", ...cliente });
  return (
    <Modal title={cliente.id ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Nombre"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus /></Field>
        <Field label="Teléfono"><Input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></Field>
        <Field label="Email"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Dirección"><Input value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></Field>
        <Field label="Notas"><Input value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Field>
        <Btn disabled={!f.nombre.trim()} onClick={() => onSave(f)} style={{ justifyContent: "center", marginTop: 6 }}>Guardar cliente</Btn>
      </div>
    </Modal>
  );
}

/* ---------------- COMPRAS ---------------- */
function Compras({ data, costeo, guardarCompra, eliminarCompra, guardarIngrediente }) {
  const [modal, setModal] = useState(null);
  const [modalIng, setModalIng] = useState(null);
  const ordenadas = data.compras;

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Btn onClick={() => setModal({})} style={{ flex: 1, justifyContent: "center" }}><Plus size={15} /> Registrar compra</Btn>
        <Btn variant="ghost" onClick={() => setModalIng({})}>Nuevo insumo</Btn>
      </div>

      {data.ingredientes.length === 0 && (
        <Card style={{ padding: 12, marginBottom: 12, background: "#FFF8EC", borderColor: "#E8CFAE" }}>
          <div style={{ fontSize: 13 }}>Primero crea tus insumos con "Nuevo insumo", luego registra las compras.</div>
        </Card>
      )}

      {ordenadas.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="Sin compras registradas" desc="Cada compra actualiza el costo promedio de tus insumos." />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><Th>Fecha</Th><Th>Doc.</Th><Th>Insumo</Th><Th right>Cant.</Th><Th right>C. unit.</Th><Th right>Total</Th><Th></Th></tr></thead>
            <tbody>
              {ordenadas.map((c) => {
                const ing = data.ingredientes.find((i) => i.id === c.ingredienteId);
                const cu = Number(c.cantidad) > 0 ? Number(c.costoTotal) / Number(c.cantidad) : 0;
                return (
                  <tr key={c.id}>
                    <Td>{c.fecha}</Td>
                    <Td>{c.tipoDocumento} {c.numero && <span style={{ color: C.inkSoft }}>#{c.numero}</span>}</Td>
                    <Td>{ing ? ing.nombre : "—"}</Td>
                    <Td right>{fmtNum(c.cantidad)} {c.unidad}</Td>
                    <Td right>{clp(cu)}</Td>
                    <Td right>{clp(c.costoTotal)}</Td>
                    <Td right><button onClick={() => eliminarCompra(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={14} /></button></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.ingredientes.length > 0 && (
        <Card style={{ padding: 14, marginTop: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Costo promedio actual por insumo</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.ingredientes.map((ing) => (
              <div key={ing.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{ing.nombre}</span>
                <span style={{ color: C.inkSoft }}>{costeo.costoBaseIngrediente[ing.id] ? `${clp(costeo.costoBaseIngrediente[ing.id])} / ${baseUnidadDe(ing.unidad)}` : "sin compras aún"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {modal && <CompraModal data={data} onClose={() => setModal(null)} onSave={async (c) => { await guardarCompra(c); setModal(null); }} onNuevoIngrediente={() => setModalIng({})} />}
      {modalIng && <IngredienteModal onClose={() => setModalIng(null)} onSave={async (i) => { await guardarIngrediente(i); setModalIng(null); }} />}
    </div>
  );
}
function IngredienteModal({ onClose, onSave }) {
  const [f, setF] = useState({ nombre: "", unidad: "g" });
  return (
    <Modal title="Nuevo insumo" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Nombre"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej: Leche condensada" autoFocus /></Field>
        <Field label="Unidad en que lo compras/usas" hint="kg y g se combinan solos, igual ml y l.">
          <Select value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })}>{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
        </Field>
        <Btn disabled={!f.nombre.trim()} onClick={() => onSave(f)} style={{ justifyContent: "center", marginTop: 6 }}>Guardar insumo</Btn>
      </div>
    </Modal>
  );
}
function CompraModal({ data, onClose, onSave, onNuevoIngrediente }) {
  const [f, setF] = useState({ fecha: hoy(), tipoDocumento: "Boleta", numero: "", ingredienteId: data.ingredientes[0]?.id || "", cantidad: "", unidad: data.ingredientes[0]?.unidad || "g", costoTotal: "" });
  const ing = data.ingredientes.find((i) => i.id === f.ingredienteId);
  const unidadesPosibles = ing ? UNIDADES.filter((u) => FAMILIA[u] === FAMILIA[ing.unidad]) : UNIDADES;
  const valido = f.ingredienteId && Number(f.cantidad) > 0 && Number(f.costoTotal) > 0;

  return (
    <Modal title="Registrar compra" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Fecha"><Input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
          <Field label="Tipo de documento"><Select value={f.tipoDocumento} onChange={(e) => setF({ ...f, tipoDocumento: e.target.value })}>{TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        </div>
        <Field label="N° de documento"><Input value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} /></Field>
        {data.ingredientes.length === 0 ? (
          <div style={{ fontSize: 13, color: C.inkSoft }}>No tienes insumos creados. <button onClick={onNuevoIngrediente} style={{ color: C.caramel, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Crea uno primero</button>.</div>
        ) : (
          <Field label="Insumo">
            <Select value={f.ingredienteId} onChange={(e) => { const ni = data.ingredientes.find((i) => i.id === e.target.value); setF({ ...f, ingredienteId: e.target.value, unidad: ni?.unidad || f.unidad }); }}>
              {data.ingredientes.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </Select>
          </Field>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Cantidad"><Input type="number" min="0" value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} /></Field>
          <Field label="Unidad"><Select value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })}>{unidadesPosibles.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
        </div>
        <Field label="Costo total pagado"><Input type="number" min="0" value={f.costoTotal} onChange={(e) => setF({ ...f, costoTotal: e.target.value })} /></Field>
        {Number(f.cantidad) > 0 && Number(f.costoTotal) > 0 && <div style={{ fontSize: 12, color: C.inkSoft }}>Costo unitario: {clp(Number(f.costoTotal) / Number(f.cantidad))} / {f.unidad}</div>}
        <Btn disabled={!valido} onClick={() => onSave(f)} style={{ justifyContent: "center", marginTop: 6 }}>Guardar compra</Btn>
      </div>
    </Modal>
  );
}

/* ---------------- RECETAS BASE + PRODUCCIÓN ---------------- */
function RecetasBase({ data, costeo, guardarRecetaBase, eliminarRecetaBase, guardarProduccion, eliminarProduccion }) {
  const [modal, setModal] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const recetaActual = detalle ? data.recetasBase.find((r) => r.id === detalle) : null;

  if (recetaActual) {
    return <DetalleRecetaBase receta={recetaActual} data={data} costeo={costeo} guardarProduccion={guardarProduccion} eliminarProduccion={eliminarProduccion} onBack={() => setDetalle(null)} />;
  }

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Btn onClick={() => setModal({})}><Plus size={15} /> Nueva receta base</Btn>
      </div>
      {data.recetasBase.length === 0 ? (
        <EmptyState icon={FlaskConical} title="Sin recetas base" desc="Ej: Manjar — leche + leche condensada, que al hervir reduce su rendimiento. Regístrala y luego anota cuánto dio cada vez que la preparas." action={<Btn onClick={() => setModal({})}>Crear receta base</Btn>} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.recetasBase.map((r) => {
            const cpu = costeo.costoPorUnidadRecetaBase[r.id];
            return (
              <Card key={r.id} style={{ padding: 12, cursor: "pointer" }} onClick={() => setDetalle(r.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.nombre}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>{r.ingredientes.length} insumo(s) · {data.producciones.filter((p) => p.recetaBaseId === r.id).length} lote(s)</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: cpu != null ? C.sage : C.inkSoft }}>{cpu != null ? `${clp(cpu)}/${baseUnidadDe(r.unidadRendimiento)}` : "sin lotes aún"}</div>
                    <ChevronRight size={16} color={C.inkSoft} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {modal && <RecetaBaseModal receta={modal} data={data} onClose={() => setModal(null)} onSave={async (r) => { await guardarRecetaBase(r); setModal(null); }} />}
    </div>
  );
}
function RecetaBaseModal({ receta, data, onClose, onSave }) {
  const [f, setF] = useState({ nombre: "", unidadRendimiento: "g", ingredientes: [], ...receta });
  const addIng = () => { if (data.ingredientes.length === 0) return; setF({ ...f, ingredientes: [...f.ingredientes, { ingredienteId: data.ingredientes[0].id, cantidad: "", unidad: data.ingredientes[0].unidad }] }); };
  const setIng = (idx, patch) => { const arr = [...f.ingredientes]; arr[idx] = { ...arr[idx], ...patch }; setF({ ...f, ingredientes: arr }); };
  const delIng = (idx) => setF({ ...f, ingredientes: f.ingredientes.filter((_, i) => i !== idx) });
  const valido = f.nombre.trim() && f.ingredientes.length > 0 && f.ingredientes.every((i) => i.ingredienteId && Number(i.cantidad) > 0);

  return (
    <Modal title={receta.id ? "Editar receta base" : "Nueva receta base"} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Nombre" hint="Ej: Manjar, Base de crema pastelera"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus /></Field>
        <Field label="Unidad en que mides el rendimiento final" hint="Ej: gramos de manjar que resultan al terminar de hervir">
          <Select value={f.unidadRendimiento} onChange={(e) => setF({ ...f, unidadRendimiento: e.target.value })}>{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
        </Field>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Ingredientes (cantidades de referencia)</div>
        {data.ingredientes.length === 0 && <div style={{ fontSize: 12, color: C.inkSoft }}>Crea insumos primero en la pestaña Compras.</div>}
        {f.ingredientes.map((it, idx) => {
          const ing = data.ingredientes.find((i) => i.id === it.ingredienteId);
          const unidadesPosibles = ing ? UNIDADES.filter((u) => FAMILIA[u] === FAMILIA[ing.unidad]) : UNIDADES;
          return (
            <div key={idx} style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
              <Select value={it.ingredienteId} onChange={(e) => { const ni = data.ingredientes.find((i) => i.id === e.target.value); setIng(idx, { ingredienteId: e.target.value, unidad: ni?.unidad }); }} style={{ flex: 2 }}>
                {data.ingredientes.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </Select>
              <Input type="number" min="0" placeholder="Cant." value={it.cantidad} onChange={(e) => setIng(idx, { cantidad: e.target.value })} style={{ flex: 1, width: 0 }} />
              <Select value={it.unidad} onChange={(e) => setIng(idx, { unidad: e.target.value })} style={{ flex: 1 }}>{unidadesPosibles.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
              <button onClick={() => delIng(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={16} /></button>
            </div>
          );
        })}
        {data.ingredientes.length > 0 && <Btn variant="ghost" onClick={addIng}><Plus size={14} /> Agregar insumo</Btn>}
        <Btn disabled={!valido} onClick={() => onSave(f)} style={{ justifyContent: "center", marginTop: 8 }}>Guardar receta base</Btn>
      </div>
    </Modal>
  );
}
function DetalleRecetaBase({ receta, data, costeo, guardarProduccion, eliminarProduccion, onBack }) {
  const [modalLote, setModalLote] = useState(null);
  const lotes = data.producciones.filter((p) => p.recetaBaseId === receta.id);
  const cpu = costeo.costoPorUnidadRecetaBase[receta.id];

  return (
    <div style={{ paddingTop: 8 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.inkSoft, fontSize: 13, cursor: "pointer", marginBottom: 10 }}>&larr; Recetas base</button>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, marginBottom: 4 }}>{receta.nombre}</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 14 }}>Costo por {baseUnidadDe(receta.unidadRendimiento)}: {cpu != null ? clp(cpu) : "aún sin lotes registrados"}</div>
      <Btn onClick={() => setModalLote({})} style={{ marginBottom: 14 }}><Plus size={15} /> Registrar producción (lote)</Btn>
      {lotes.length === 0 ? (
        <EmptyState icon={FlaskConical} title="Sin lotes registrados" desc="Cada vez que prepares esta receta, anota cuánto rindió realmente." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lotes.map((l) => {
            const costoLote = costeo.costoLoteProduccion(l);
            const cpuLote = toBase(l.rendimientoReal, l.unidadRendimiento) > 0 ? costoLote / toBase(l.rendimientoReal, l.unidadRendimiento) : 0;
            return (
              <Card key={l.id} style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{l.fecha}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>Rindió {fmtNum(l.rendimientoReal)} {l.unidadRendimiento} · costo lote {clp(costoLote)}</div>
                    <div style={{ fontSize: 12, color: C.sage }}>{clp(cpuLote)} / {baseUnidadDe(l.unidadRendimiento)}</div>
                  </div>
                  <button onClick={() => eliminarProduccion(l.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick, height: "fit-content" }}><Trash2 size={14} /></button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {modalLote && <LoteModal receta={receta} data={data} onClose={() => setModalLote(null)} onSave={async (l) => { await guardarProduccion({ ...l, recetaBaseId: receta.id }); setModalLote(null); }} />}
    </div>
  );
}
function LoteModal({ receta, data, onClose, onSave }) {
  const [f, setF] = useState({ fecha: hoy(), rendimientoReal: "", unidadRendimiento: receta.unidadRendimiento, ingredientesUsados: receta.ingredientes.map((i) => ({ ...i })), notas: "" });
  const setIng = (idx, patch) => { const arr = [...f.ingredientesUsados]; arr[idx] = { ...arr[idx], ...patch }; setF({ ...f, ingredientesUsados: arr }); };
  const valido = Number(f.rendimientoReal) > 0;
  return (
    <Modal title={`Registrar lote — ${receta.nombre}`} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Fecha"><Input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Cantidades realmente usadas</div>
        {f.ingredientesUsados.map((it, idx) => {
          const ing = data.ingredientes.find((i) => i.id === it.ingredienteId);
          return (
            <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              <span style={{ flex: 2 }}>{ing?.nombre}</span>
              <Input type="number" min="0" value={it.cantidad} onChange={(e) => setIng(idx, { cantidad: e.target.value })} style={{ flex: 1, width: 0 }} />
              <span style={{ width: 40, color: C.inkSoft }}>{it.unidad}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Rendimiento real obtenido"><Input type="number" min="0" value={f.rendimientoReal} onChange={(e) => setF({ ...f, rendimientoReal: e.target.value })} /></Field>
          <Field label="Unidad"><Select value={f.unidadRendimiento} onChange={(e) => setF({ ...f, unidadRendimiento: e.target.value })}>{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
        </div>
        <Field label="Notas (opcional)"><Input value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Field>
        <Btn disabled={!valido} onClick={() => onSave(f)} style={{ justifyContent: "center", marginTop: 6 }}>Guardar lote</Btn>
      </div>
    </Modal>
  );
}

/* ---------------- PRODUCTOS ---------------- */
function Productos({ data, costeo, guardarProducto, eliminarProducto }) {
  const [modal, setModal] = useState(null);
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Btn onClick={() => setModal({})}><Plus size={15} /> Nuevo producto</Btn>
      </div>
      {data.productos.length === 0 ? (
        <EmptyState icon={Package} title="Sin productos" desc="Un producto es lo que vendes. Se arma con insumos directos y/o recetas base." action={<Btn onClick={() => setModal({})}>Crear producto</Btn>} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.productos.map((p) => {
            const { costo, incompleto } = costeo.costoProducto(p);
            const margen = (Number(p.precioVenta) || 0) - costo;
            return (
              <Card key={p.id} style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.nombre}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>Precio: {clp(p.precioVenta)}</div>
                    <div style={{ fontSize: 12, color: incompleto ? C.caramelDark : C.inkSoft }}>Costo: {incompleto ? "incompleto (falta lote de receta base)" : clp(costo)}</div>
                    {!incompleto && <div style={{ fontSize: 12, color: margen >= 0 ? C.sage : C.brick, fontWeight: 600 }}>Margen: {clp(margen)}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, height: "fit-content" }}>
                    <button onClick={() => setModal(p)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}><Pencil size={16} /></button>
                    <button onClick={() => eliminarProducto(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={16} /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {modal && <ProductoModal producto={modal} data={data} onClose={() => setModal(null)} onSave={async (p) => { await guardarProducto(p); setModal(null); }} />}
    </div>
  );
}
function ProductoModal({ producto, data, onClose, onSave }) {
  const [f, setF] = useState({ nombre: "", precioVenta: "", componentes: [], ...producto });
  const opciones = [
    ...data.ingredientes.map((i) => ({ tipo: "ingrediente", refId: i.id, nombre: i.nombre, unidad: i.unidad })),
    ...data.recetasBase.map((r) => ({ tipo: "receta_base", refId: r.id, nombre: `${r.nombre} (receta base)`, unidad: r.unidadRendimiento })),
  ];
  const addComp = () => { if (opciones.length === 0) return; const o = opciones[0]; setF({ ...f, componentes: [...f.componentes, { tipo: o.tipo, refId: o.refId, cantidad: "", unidad: o.unidad }] }); };
  const setComp = (idx, patch) => { const arr = [...f.componentes]; arr[idx] = { ...arr[idx], ...patch }; setF({ ...f, componentes: arr }); };
  const delComp = (idx) => setF({ ...f, componentes: f.componentes.filter((_, i) => i !== idx) });
  const valido = f.nombre.trim() && Number(f.precioVenta) >= 0 && f.componentes.every((c) => c.refId && Number(c.cantidad) > 0);

  return (
    <Modal title={producto.id ? "Editar producto" : "Nuevo producto"} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Nombre" hint="Ej: Vaso de manjar 200 g"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus /></Field>
        <Field label="Precio de venta"><Input type="number" min="0" value={f.precioVenta} onChange={(e) => setF({ ...f, precioVenta: e.target.value })} /></Field>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Composición (para costear)</div>
        {opciones.length === 0 && <div style={{ fontSize: 12, color: C.inkSoft }}>Crea insumos o recetas base primero.</div>}
        {f.componentes.map((c, idx) => {
          const opt = opciones.find((o) => o.refId === c.refId && o.tipo === c.tipo);
          const familiaUnidad = opt ? FAMILIA[opt.unidad] : null;
          const unidadesPosibles = familiaUnidad ? UNIDADES.filter((u) => FAMILIA[u] === familiaUnidad) : UNIDADES;
          return (
            <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Select value={`${c.tipo}:${c.refId}`} onChange={(e) => { const [tipo, refId] = e.target.value.split(":"); const o = opciones.find((x) => x.tipo === tipo && x.refId === refId); setComp(idx, { tipo, refId, unidad: o?.unidad }); }} style={{ flex: 2 }}>
                {opciones.map((o) => <option key={`${o.tipo}:${o.refId}`} value={`${o.tipo}:${o.refId}`}>{o.nombre}</option>)}
              </Select>
              <Input type="number" min="0" placeholder="Cant." value={c.cantidad} onChange={(e) => setComp(idx, { cantidad: e.target.value })} style={{ flex: 1, width: 0 }} />
              <Select value={c.unidad} onChange={(e) => setComp(idx, { unidad: e.target.value })} style={{ flex: 1 }}>{unidadesPosibles.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
              <button onClick={() => delComp(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={16} /></button>
            </div>
          );
        })}
        {opciones.length > 0 && <Btn variant="ghost" onClick={addComp}><Plus size={14} /> Agregar componente</Btn>}
        <Btn disabled={!valido} onClick={() => onSave(f)} style={{ justifyContent: "center", marginTop: 8 }}>Guardar producto</Btn>
      </div>
    </Modal>
  );
}

/* ---------------- VENTAS ---------------- */
function Ventas({ data, guardarVenta, eliminarVenta }) {
  const [modal, setModal] = useState(null);
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Btn onClick={() => setModal({})} disabled={data.productos.length === 0}><Plus size={15} /> Nueva venta</Btn>
      </div>
      {data.productos.length === 0 && <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>Crea al menos un producto antes de registrar ventas.</div>}
      {data.ventas.length === 0 ? (
        <EmptyState icon={Receipt} title="Sin ventas registradas" desc="Cada venta descuenta del margen los costos calculados desde tus recetas." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.ventas.map((v) => {
            const cliente = data.clientes.find((c) => c.id === v.clienteId);
            return (
              <Card key={v.id} style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{v.fecha} {cliente && <span style={{ fontWeight: 400, color: C.inkSoft }}>· {cliente.nombre}</span>}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>{v.items.map((it) => { const p = data.productos.find((pp) => pp.id === it.productoId); return `${it.cantidad}× ${p ? p.nombre : "?"}`; }).join(", ")}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{clp(v.total)}</div>
                    <button onClick={() => eliminarVenta(v.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {modal && <VentaModal data={data} onClose={() => setModal(null)} onSave={async (v) => { await guardarVenta(v); setModal(null); }} />}
    </div>
  );
}
function VentaModal({ data, onClose, onSave }) {
  const [f, setF] = useState({ fecha: hoy(), clienteId: "", items: [{ productoId: data.productos[0]?.id || "", cantidad: 1, precioUnitario: data.productos[0]?.precioVenta || 0 }] });
  const setItem = (idx, patch) => { const arr = [...f.items]; arr[idx] = { ...arr[idx], ...patch }; setF({ ...f, items: arr }); };
  const addItem = () => setF({ ...f, items: [...f.items, { productoId: data.productos[0]?.id || "", cantidad: 1, precioUnitario: data.productos[0]?.precioVenta || 0 }] });
  const delItem = (idx) => setF({ ...f, items: f.items.filter((_, i) => i !== idx) });
  const total = f.items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0), 0);
  const valido = f.items.every((it) => it.productoId && Number(it.cantidad) > 0);

  return (
    <Modal title="Nueva venta" onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Fecha"><Input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
          <Field label="Cliente (opcional)">
            <Select value={f.clienteId} onChange={(e) => setF({ ...f, clienteId: e.target.value })}>
              <option value="">—</option>
              {data.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </Field>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Productos vendidos</div>
        {f.items.map((it, idx) => (
          <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Select value={it.productoId} onChange={(e) => { const p = data.productos.find((pp) => pp.id === e.target.value); setItem(idx, { productoId: e.target.value, precioUnitario: p?.precioVenta || 0 }); }} style={{ flex: 2 }}>
              {data.productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Select>
            <Input type="number" min="1" value={it.cantidad} onChange={(e) => setItem(idx, { cantidad: e.target.value })} style={{ width: 55 }} />
            <Input type="number" min="0" value={it.precioUnitario} onChange={(e) => setItem(idx, { precioUnitario: e.target.value })} style={{ width: 80 }} />
            <button onClick={() => delItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={16} /></button>
          </div>
        ))}
        <Btn variant="ghost" onClick={addItem}><Plus size={14} /> Agregar producto</Btn>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: 15, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}><span>Total</span><span>{clp(total)}</span></div>
        <Btn disabled={!valido} onClick={() => onSave(f)} style={{ justifyContent: "center", marginTop: 4 }}>Guardar venta</Btn>
      </div>
    </Modal>
  );
}
