"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Users, ShoppingCart, FlaskConical, Package, Receipt, LayoutDashboard,
  Plus, Trash2, Pencil, X, ChevronRight, ChevronLeft, AlertTriangle, TrendingUp, Loader2, Search, LogOut, Layers, CalendarDays, Check, Menu, ArrowDown, ArrowUp, Mail, Lock, Eye, EyeOff, UserCog, KeyRound, Unlock, ShieldCheck, Ban, Copy, RefreshCw, Hash, History, Calculator,
} from "lucide-react";
import {
  fetchAll, saveCliente, deleteCliente, saveIngrediente, deleteIngrediente, saveCompra, deleteCompra, marcarReembolso, actualizarDocumento, saveGasto, deleteGasto, marcarReembolsoGasto, guardarCierre, borrarCierre, guardarApertura, borrarApertura, subirFoto, asignarFoto, comprimirImagen,
  saveRecetaBase, deleteRecetaBase, saveProduccion, deleteProduccion,
  saveProducto, deleteProducto, saveVenta, deleteVenta, actualizarCuentaVenta, saveAjuste, deleteAjuste,
  savePedido, deletePedido, cambiarPagoPedido,
  fetchUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario, fetchAuditoria,
} from "../lib/data";
import permisosCfg from "../lib/permisos";
import validaciones from "../lib/validaciones";
const { SECCIONES } = permisosCfg;
const IDS_NAV = [...SECCIONES.map((x) => x.id), "usuarios", "auditoria"];
const VAL = validaciones;

/* ---------------- paleta / helpers ---------------- */
const C = {
  bg: "#FBF7F1", surface: "#FFFFFF", line: "#E7DCC9", ink: "#3A2A1E", inkSoft: "#7A6A57",
  caramel: "#A15C2B", caramelDark: "#7E4620", sage: "#5F7355", sageBg: "#EEF2E9",
  brick: "#A23E3E", brickBg: "#F7EAEA", chip: "#F3EADA",
};
const UNIDADES = ["g", "kg", "ml", "l", "m", "cm", "unidad"];
const FAMILIA = { g: "peso", kg: "peso", ml: "volumen", l: "volumen", m: "longitud", cm: "longitud", unidad: "conteo" };
const A_BASE = { g: 1, kg: 1000, ml: 1, l: 1000, m: 100, cm: 1, unidad: 1 };
const BASE_DE = { peso: "g", volumen: "ml", longitud: "cm", conteo: "unidad" };
const TIPOS_DOC = ["Boleta", "Factura", "Guía de despacho", "Otro"];
// Costo por unidad: muestra más decimales cuando es menor a 1 sol (S/ 0.0047 en vez de S/ 0.00).
const clpU = (n) => { const x = isFinite(n) ? n : 0; const a = Math.abs(x); return x.toLocaleString("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2, maximumFractionDigits: a >= 1 ? 2 : a >= 0.01 ? 4 : 6 }); };
const clp = (n) => (isFinite(n) ? n : 0).toLocaleString("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 });
// Convierte lo escrito a número. Un solo punto o coma es decimal: "0.956" -> 0.956 · "1,5" -> 1.5 · "16352" -> 16352
const parseNum = (v) => {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  let s = String(v).trim();
  if (s.includes(",") && s.includes(".")) {
    // el último separador es el decimal (1,234.5 -> 1234.5 · 1.234,5 -> 1234.5)
    const dec = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
    s = s.slice(0, dec).replace(/[.,]/g, "") + "." + s.slice(dec + 1);
  } else if ((s.match(/,/g) || []).length > 1) {
    s = s.replace(/,/g, ""); // 1,234,567
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, ""); // 1.234.567
  } else {
    s = s.replace(",", "."); // un solo separador = decimal ("0.956" y "0,956" valen 0.956)
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const fmtNum = (n, d = 4) => (isFinite(n) ? n : 0).toLocaleString("es-PE", { maximumFractionDigits: d });
const toBase = (cantidad, unidad) => (Number(cantidad) || 0) * (A_BASE[unidad] || 1);
const baseUnidadDe = (unidad) => BASE_DE[FAMILIA[unidad]] || unidad;
const aFecha = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoy = () => aFecha(new Date());
const deFecha = (f) => { const [y, m, d] = f.split("-").map(Number); return new Date(y, m - 1, d); };
const sumarDias = (f, n) => { const d = deFecha(f); d.setDate(d.getDate() + n); return aFecha(d); };
const DATA_VACIA = { clientes: [], ingredientes: [], compras: [], recetasBase: [], producciones: [], productos: [], ventas: [], ajustesInventario: [], pedidos: [], gastos: [], cierres: [], cajaConfig: [] };

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
    (prod) =>
      prod.costoTotalLote != null
        ? prod.costoTotalLote
        : (prod.ingredientesUsados || []).reduce((s, i) => s + costoIngredienteEnCantidad(i.ingredienteId, i.cantidad, i.unidad), 0),
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

/* ---------------- stock (materia prima y producto procesado) ---------------- */
function useStock(data) {
  // Todos los consumos de todas las ventas, en una sola lista.
  const consumos = useMemo(
    () => data.ventas.flatMap((v) => v.items.flatMap((it) => (it.consumos || []).map((c) => ({ ...c, ventaId: v.id, ventaFecha: v.fecha })))),
    [data.ventas]
  );

  const stockIngrediente = useCallback(
    (ingredienteId) => {
      const compradoBase = data.compras.filter((c) => c.ingredienteId === ingredienteId).reduce((s, c) => s + toBase(c.cantidad, c.unidad), 0);
      const usadoProduccionBase = data.producciones.reduce(
        (s, p) => s + (p.ingredientesUsados || []).filter((i) => i.ingredienteId === ingredienteId).reduce((s2, i) => s2 + toBase(i.cantidad, i.unidad), 0),
        0
      );
      const usadoVentaBase = consumos.filter((c) => c.tipo === "ingrediente" && c.refId === ingredienteId).reduce((s, c) => s + toBase(c.cantidad, c.unidad), 0);
      const ajustesBase = data.ajustesInventario.filter((a) => a.tipo === "ingrediente" && a.refId === ingredienteId).reduce((s, a) => s + toBase(a.cantidad, a.unidad), 0);
      return compradoBase - usadoProduccionBase - usadoVentaBase + ajustesBase;
    },
    [data.compras, data.producciones, data.ajustesInventario, consumos]
  );

  const stockLote = useCallback(
    (produccion) => {
      const rendimientoBase = toBase(produccion.rendimientoReal, produccion.unidadRendimiento);
      const usadoVentaBase = consumos.filter((c) => c.tipo === "receta_base" && c.refId === produccion.id).reduce((s, c) => s + toBase(c.cantidad, c.unidad), 0);
      const ajustesBase = data.ajustesInventario.filter((a) => a.tipo === "lote" && a.refId === produccion.id).reduce((s, a) => s + toBase(a.cantidad, a.unidad), 0);
      return rendimientoBase - usadoVentaBase + ajustesBase;
    },
    [data.ajustesInventario, consumos]
  );

  const stockRecetaBase = useCallback(
    (recetaBaseId) => data.producciones.filter((p) => p.recetaBaseId === recetaBaseId).reduce((s, p) => s + stockLote(p), 0),
    [data.producciones, stockLote]
  );

  // Consumos con faltante (no alcanzó ningún lote) — señal de que hay que hacer un ajuste.
  const faltantes = useMemo(() => consumos.filter((c) => c.tipo === "receta_base" && c.refId == null), [consumos]);

  return { stockIngrediente, stockLote, stockRecetaBase, consumos, faltantes };
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
const inputStyle = { border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", color: C.ink, background: "#FFFDFA", outline: "none" };
const estiloInvalido = { borderColor: C.brick, background: "#FFF6F5", boxShadow: `0 0 0 2px ${C.brickBg}` };
function Input({ invalid, style, ...props }) { return <input {...props} aria-invalid={invalid || undefined} style={{ ...inputStyle, minWidth: 0, ...(invalid ? estiloInvalido : {}), ...(style || {}) }} />; }
// Campo numérico: solo admite dígitos, punto y coma.
function NumInput({ invalid, style, onChange, ...props }) {
  const alCambiar = (e) => {
    const limpio = e.target.value.replace(/[^0-9.,]/g, "");
    if (limpio !== e.target.value) e.target.value = limpio;
    if (onChange) onChange(e);
  };
  return <input type="text" inputMode="decimal" {...props} onChange={alCambiar} aria-invalid={invalid || undefined} style={{ ...inputStyle, ...(invalid ? estiloInvalido : {}), ...(style || {}) }} />;
}
function Select({ invalid, style, ...props }) { return <select {...props} aria-invalid={invalid || undefined} style={{ ...inputStyle, minWidth: 0, maxWidth: "100%", ...(invalid ? estiloInvalido : {}), ...(style || {}) }} />; }
const estiloMensaje = { color: C.brick, fontSize: 12, fontWeight: 600 };
// Mensaje de error de un campo (para los que no van dentro de un <Field>).
function Err({ v, campo }) {
  const m = v.msg(campo);
  return m ? <span role="alert" style={estiloMensaje}>{m}</span> : null;
}
// Primer mensaje de error entre varios campos de una misma fila.
function ErrFila({ v, campos }) {
  const m = campos.map((c) => v.msg(c)).find(Boolean);
  return m ? <span role="alert" style={estiloMensaje}>{m}</span> : null;
}
function Field({ label, children, v, campo, error }) {
  const msg = error !== undefined ? error : v && campo ? v.msg(campo) : null;
  const hijo = msg && React.isValidElement(children) ? React.cloneElement(children, { invalid: true }) : children;
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, minWidth: 0 }} onBlur={v && campo ? () => v.tocar(campo) : undefined}>
      <span style={{ color: C.inkSoft, fontWeight: 600 }}>{label}</span>
      {hijo}
      {msg && <span role="alert" style={estiloMensaje}>{msg}</span>}
    </label>
  );
}
// Validación de formularios: los errores se muestran al salir de un campo o al intentar guardar.
// `errores` es el mapa { campo: mensaje } que calcula el formulario con las reglas compartidas.
function useValidacion(errores) {
  const [intento, setIntento] = useState(false);
  const [tocados, setTocados] = useState({});
  const [servidor, setServidor] = useState({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const msg = (campo) => ((intento || tocados[campo]) ? errores[campo] : null) || servidor[campo] || null;
  const tocar = (campo) => {
    setTocados((t) => (t[campo] ? t : { ...t, [campo]: true }));
    setServidor((s) => { if (!s[campo]) return s; const n = { ...s }; delete n[campo]; return n; });
  };
  const p = (campo) => ({ invalid: !!msg(campo), onBlur: () => tocar(campo) });
  const hayErrores = Object.keys(errores).length > 0;
  const enviar = async (fn) => {
    setIntento(true);
    setServidor({});
    setErrorGeneral("");
    if (hayErrores) {
      setTimeout(() => { const el = document.querySelector('[aria-invalid="true"]'); if (el) { el.scrollIntoView({ block: "center" }); el.focus(); } }, 0);
      return false;
    }
    setEnviando(true);
    try {
      await fn();
      return true;
    } catch (e) {
      setServidor(e.errores || {});
      setErrorGeneral(e.message || "No se pudo guardar.");
      return false;
    } finally {
      setEnviando(false);
    }
  };
  const general = errorGeneral || (intento && hayErrores ? "Revisa los campos marcados en rojo." : "");
  const reiniciar = () => { setIntento(false); setTocados({}); setServidor({}); setErrorGeneral(""); };
  return { msg, tocar, p, enviar, enviando, general, hayErrores, reiniciar, fallar: (m) => setErrorGeneral(m) };
}
function ErrorForm({ v }) {
  return v.general ? <div role="alert" style={{ background: C.brickBg, color: C.brick, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{v.general}</div> : null;
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(58,42,30,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, width: "100%", maxWidth: wide ? 640 : 460, borderRadius: "16px 16px 0 0", padding: 20, maxHeight: "88vh", overflowY: "auto", overflowX: "hidden", boxSizing: "border-box", boxShadow: "0 -8px 30px rgba(0,0,0,0.15)" }}>
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
      {desc && <div style={{ fontSize: 13, marginBottom: 16 }}>{desc}</div>}
      {action}
    </div>
  );
}
function Th({ children, right }) { return <th style={{ textAlign: right ? "right" : "left", padding: "8px 10px", fontSize: 12, color: C.inkSoft, fontWeight: 600, borderBottom: `1px solid ${C.line}` }}>{children}</th>; }
function Td({ children, right, style }) { return <td style={{ textAlign: right ? "right" : "left", padding: "9px 10px", fontSize: 13.5, borderBottom: `1px solid ${C.line}`, ...style }}>{children}</td>; }

/* ---------------- CONFIRMACIÓN (ventana modal propia) ---------------- */
let abrirConfirmacion = null;
// Reemplaza a window.confirm: devuelve una promesa con true (aceptó) o false (canceló).
const confirmar = (mensaje, { titulo = "Confirmar", boton = "Eliminar", peligro = true } = {}) =>
  new Promise((resolver) => {
    if (!abrirConfirmacion) { resolver(false); return; }
    abrirConfirmacion({ mensaje, titulo, boton, peligro, resolver });
  });
function ConfirmHost() {
  const [pedido, setPedido] = useState(null);
  const refCancelar = useRef(null);
  useEffect(() => {
    abrirConfirmacion = (p) => setPedido(p);
    return () => { abrirConfirmacion = null; };
  }, []);
  const cerrar = (valor) => { if (pedido) pedido.resolver(valor); setPedido(null); };
  useEffect(() => {
    if (!pedido) return;
    refCancelar.current?.focus();
    const alTeclear = (e) => { if (e.key === "Escape") cerrar(false); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [pedido]);
  if (!pedido) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(58,42,30,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }} onClick={() => cerrar(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-titulo" aria-describedby="confirm-msg" onClick={(e) => e.stopPropagation()} style={{ background: C.surface, width: "100%", maxWidth: 400, borderRadius: 14, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
        <h3 id="confirm-titulo" style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>{pedido.titulo}</h3>
        <p id="confirm-msg" style={{ margin: "0 0 18px", fontSize: 14, color: C.inkSoft, lineHeight: 1.45 }}>{pedido.mensaje}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button ref={refCancelar} type="button" onClick={() => cerrar(false)} style={{ padding: "9px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.line}`, background: "transparent", color: C.ink }}>Cancelar</button>
          <button type="button" onClick={() => cerrar(true)} style={{ padding: "9px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", border: "1px solid transparent", background: pedido.peligro ? C.brick : C.caramel, color: "#fff" }}>{pedido.boton}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- LOGIN ---------------- */
function LoginLayout({ children }) {
  return (
    <Shell>
      <div className="login">
        <aside className="login-brand">
          <div className="login-orb login-orb-a" />
          <div className="login-orb login-orb-b" />
          <img className="login-logo" src="/logo-venu.png" alt="Venu" width={168} height={168} />
          <div className="login-name">Gestión de cucharables</div>
        </aside>
        <main className="login-panel">{children}</main>
      </div>
    </Shell>
  );
}
function LoginCampo({ label, icono: Icono, type = "text", value, onChange, autoFocus, autoComplete, inputMode, maxLength, v, campo }) {
  const [ver, setVer] = useState(false);
  const esClave = type === "password";
  const msg = v && campo ? v.msg(campo) : null;
  return (
    <label className={`login-field${msg ? " invalid" : ""}`} onBlur={v && campo ? () => v.tocar(campo) : undefined}>
      {label}
      <span className="login-control">
        <Icono size={17} className="login-lead" />
        <input type={esClave && ver ? "text" : type} value={value} onChange={onChange} autoFocus={autoFocus} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} aria-invalid={msg ? true : undefined} />
        {esClave && (
          <button type="button" className="login-eye" aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setVer(!ver)}>
            {ver ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </span>
      {msg && <span className="login-msg" role="alert">{msg}</span>}
    </label>
  );
}
// Lista en vivo de requisitos de la contraseña nueva.
function ReglasClave({ valor, rojo }) {
  return (
    <ul className="login-reglas" aria-label="Requisitos de la contraseña">
      {VAL.reglasClave(valor).map((r) => (
        <li key={r.id} className={r.ok ? "ok" : rojo ? "mal" : ""}>{r.ok ? "✓" : "•"} {r.texto}</li>
      ))}
    </ul>
  );
}
const fmtRestante = (ms) => {
  const min = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
};
async function postJson(url, datos) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

function LoginScreen({ onLoggedIn }) {
  const [modo, setModo] = useState("login"); // login | cierre | bloqueado | recuperar | codigo
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [aviso, setAviso] = useState("");
  const [cierres, setCierres] = useState(1);
  const [bloqueoHasta, setBloqueoHasta] = useState(0);
  const [porCorreo, setPorCorreo] = useState(false);
  const [ahora, setAhora] = useState(Date.now());

  const errores = {};
  if (modo === "login" || modo === "recuperar" || modo === "codigo") { const m = VAL.validarEmail(email); if (m) errores.email = m; }
  if (modo === "login" && !password) errores.password = "La contraseña es obligatoria.";
  if (modo === "codigo") {
    if (codigo.length !== 6) errores.codigo = "El código tiene 6 dígitos.";
    const m = VAL.validarClave(nueva, "La contraseña nueva"); if (m) errores.nueva = m;
    if (nueva !== repetir) errores.repetir = repetir ? "Las contraseñas no coinciden." : "Repite la contraseña.";
  }
  const v = useValidacion(errores);
  const loading = v.enviando;

  useEffect(() => {
    if (modo !== "bloqueado") return;
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 15000);
    return () => clearInterval(t);
  }, [modo]);
  useEffect(() => {
    if (modo === "bloqueado" && bloqueoHasta && ahora >= bloqueoHasta) { setModo("login"); v.reiniciar(); }
  }, [ahora, modo, bloqueoHasta]);

  const ir = (m) => { setModo(m); v.reiniciar(); setAviso(""); };
  // Ejecuta la llamada y, si falla la conexión, lo muestra como error del formulario.
  const llamar = (fn) => v.enviar(async () => {
    try { await fn(); } catch (e) { if (e.errores || e.message) throw e; throw new Error("No se pudo conectar con el servidor."); }
  });
  const falla = (body, defecto) => { const err = new Error(body.error || defecto); err.errores = body.errores; return err; };

  const entrar = (e) => {
    e.preventDefault();
    setAviso("");
    return llamar(async () => {
      const { res, body } = await postJson("/api/auth/login", { email, password });
      if (res.ok) onLoggedIn(body.user);
      else if (res.status === 429) { setBloqueoHasta(body.bloqueadoHasta); setPassword(""); setModo("bloqueado"); v.reiniciar(); }
      else if (body.cierre) { setCierres(body.cierres); setPassword(""); setModo("cierre"); v.reiniciar(); }
      else throw falla(body, "No se pudo iniciar sesión.");
    });
  };
  const pedirCodigo = (e) => {
    e.preventDefault();
    return llamar(async () => {
      const { res, body } = await postJson("/api/auth/recuperar", { email });
      if (!res.ok) throw falla(body, "No se pudo pedir el código.");
      setPorCorreo(!!body.porCorreo);
      setModo("codigo");
      v.reiniciar();
    });
  };
  const restablecer = (e) => {
    e.preventDefault();
    return llamar(async () => {
      const { res, body } = await postJson("/api/auth/restablecer", { email, codigo, password: nueva });
      if (!res.ok) throw falla(body, "No se pudo restablecer la contraseña.");
      setCodigo(""); setNueva(""); setRepetir(""); setPassword("");
      setModo("login");
      v.reiniciar();
      setAviso("Contraseña actualizada. Ya puedes entrar con la nueva.");
    });
  };

  const volver = <button type="button" className="login-link" onClick={() => ir("login")}>Volver a iniciar sesión</button>;
  const errorForm = v.general ? <div className="login-error" role="alert">{v.general}</div> : null;

  if (modo === "cierre") {
    return (
      <LoginLayout>
        <div className="login-form">
          <div className="login-state"><Ban size={26} /></div>
          <h1 className="login-title">Acceso cerrado</h1>
          <p className="login-text">Escribiste mal la contraseña 3 veces. Es el cierre {cierres} de 3: si se cierra 3 veces seguidas, tendrás que esperar 2 horas para volver a intentarlo.</p>
          <button type="button" className="login-btn" onClick={() => ir("login")}>Volver a intentar</button>
          <button type="button" className="login-link" onClick={() => ir("recuperar")}>Recuperar mi contraseña</button>
        </div>
      </LoginLayout>
    );
  }
  if (modo === "bloqueado") {
    return (
      <LoginLayout>
        <div className="login-form">
          <div className="login-state"><Lock size={26} /></div>
          <h1 className="login-title">Acceso bloqueado</h1>
          <p className="login-text">Hubo 3 cierres de acceso seguidos. Podrás volver a intentarlo en <b>{fmtRestante(bloqueoHasta - ahora)}</b>.</p>
          <button type="button" className="login-btn" onClick={() => ir("recuperar")}>Recuperar mi contraseña</button>
        </div>
      </LoginLayout>
    );
  }
  if (modo === "recuperar") {
    return (
      <LoginLayout>
        <form className="login-form" onSubmit={pedirCodigo} noValidate>
          <h1 className="login-title">Recuperar contraseña</h1>
          <LoginCampo label="Correo" icono={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="username" v={v} campo="email" />
          {errorForm}
          <button type="submit" className="login-btn" disabled={loading}>{loading ? "Enviando…" : "Pedir código"}</button>
          {volver}
        </form>
      </LoginLayout>
    );
  }
  if (modo === "codigo") {
    return (
      <LoginLayout>
        <form className="login-form" onSubmit={restablecer} noValidate>
          <h1 className="login-title">Crea tu contraseña nueva</h1>
          <p className="login-text">{porCorreo ? "Escribe el código que te enviamos. Vence en 15 minutos." : "Escribe tu código de recuperación. Vence en 15 minutos."}</p>
          <LoginCampo label="Código de 6 dígitos" icono={Hash} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={6} autoFocus autoComplete="one-time-code" v={v} campo="codigo" />
          <LoginCampo label="Contraseña nueva" icono={Lock} type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" v={v} campo="nueva" />
          <ReglasClave valor={nueva} rojo={!!v.msg("nueva")} />
          <LoginCampo label="Repite la contraseña" icono={Lock} type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" v={v} campo="repetir" />
          {errorForm}
          <button type="submit" className="login-btn" disabled={loading}>{loading ? "Guardando…" : "Guardar contraseña"}</button>
          {volver}
        </form>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout>
      <form className="login-form" onSubmit={entrar} noValidate>
        <h1 className="login-title">Inicia sesión</h1>
        {aviso && <div className="login-ok" role="status">{aviso}</div>}
        <LoginCampo label="Correo" icono={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="username" v={v} campo="email" />
        <LoginCampo label="Contraseña" icono={Lock} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" v={v} campo="password" />
        {errorForm}
        <button type="submit" className="login-btn" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
        <button type="button" className="login-link" onClick={() => ir("recuperar")}>¿Olvidaste tu contraseña?</button>
      </form>
    </LoginLayout>
  );
}

// Primera vez con una contraseña provisional: hay que elegir una propia antes de entrar.
function CambiarClaveScreen({ session, onDone, onLogout }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const errores = {};
  if (!actual) errores.actual = "Escribe la contraseña provisional.";
  const mc = VAL.validarClave(nueva, "La contraseña nueva"); if (mc) errores.nueva = mc;
  if (!mc && nueva === actual) errores.nueva = "La contraseña nueva debe ser distinta de la provisional.";
  if (nueva !== repetir) errores.repetir = repetir ? "Las contraseñas no coinciden." : "Repite la contraseña.";
  const v = useValidacion(errores);

  const guardar = (e) => {
    e.preventDefault();
    return v.enviar(async () => {
      const { res, body } = await postJson("/api/auth/cambiar-clave", { actual, nueva });
      if (!res.ok) { const err = new Error(body.error || "No se pudo cambiar la contraseña."); err.errores = body.errores; throw err; }
      onDone();
    });
  };
  const salir = async () => { await fetch("/api/auth/logout", { method: "POST" }); onLogout(); };

  return (
    <LoginLayout>
      <form className="login-form" onSubmit={guardar} noValidate>
        <h1 className="login-title">Elige tu contraseña</h1>
        <p className="login-text">Hola{session.nombre ? `, ${session.nombre}` : ""}. Entraste con una contraseña provisional: crea una propia para continuar.</p>
        <LoginCampo label="Contraseña provisional" icono={KeyRound} type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoFocus autoComplete="current-password" v={v} campo="actual" />
        <LoginCampo label="Contraseña nueva" icono={Lock} type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" v={v} campo="nueva" />
        <ReglasClave valor={nueva} rojo={!!v.msg("nueva")} />
        <LoginCampo label="Repite la contraseña" icono={Lock} type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" v={v} campo="repetir" />
        {v.general && <div className="login-error" role="alert">{v.general}</div>}
        <button type="submit" className="login-btn" disabled={v.enviando}>{v.enviando ? "Guardando…" : "Guardar y entrar"}</button>
        <button type="button" className="login-link" onClick={salir}>Salir</button>
      </form>
    </LoginLayout>
  );
}

/* ---------------- APP RAÍZ ---------------- */
export default function Page() {
  useFonts();
  const [session, setSession] = useState(undefined);

  const checkSession = useCallback(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((body) => setSession(body.user || null))
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Al volver a la ventana se revisa la sesión: si el administrador cambió permisos o desactivó la cuenta, se nota enseguida.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState !== "hidden") checkSession(); };
    window.addEventListener("focus", alVolver);
    document.addEventListener("visibilitychange", alVolver);
    return () => { window.removeEventListener("focus", alVolver); document.removeEventListener("visibilitychange", alVolver); };
  }, [checkSession]);

  if (session === undefined) {
    return <Shell><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", gap: 8, color: C.inkSoft }}><Loader2 size={18} /> Cargando…</div></Shell>;
  }
  return (
    <>
      {!session ? <LoginScreen onLoggedIn={setSession} />
        : session.mustChange ? <CambiarClaveScreen session={session} onDone={checkSession} onLogout={() => setSession(null)} />
        : <MainApp session={session} onLogout={() => setSession(null)} />}
      <ConfirmHost />
    </>
  );
}

function MainApp({ session, onLogout }) {
  const [data, setData] = useState(DATA_VACIA);
  const [loaded, setLoaded] = useState(false);
  const esAdmin = session.rol === "admin";
  const idsPermitidos = IDS_NAV.filter((id) => (id === "usuarios" || id === "auditoria" ? esAdmin : esAdmin || (session.permisos || []).includes(id)));
  const clavePermisos = `${session.rol}:${(session.permisos || []).join(",")}`;
  const [tab, setTabState] = useState(() => idsPermitidos[0] || "dashboard");
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

  // La sección activa vive en la URL (#ventas, #stock…): recargar la página la respeta.
  const setTab = (id) => {
    setTabState(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
      window.scrollTo({ top: 0 });
    }
  };
  useEffect(() => {
    const leer = () => { const h = window.location.hash.slice(1); if (idsPermitidos.includes(h)) setTabState(h); };
    leer();
    window.addEventListener("hashchange", leer);
    return () => window.removeEventListener("hashchange", leer);
  }, [clavePermisos]);
  // Si le quitan la sección en la que está, pasa a la primera que sí tiene.
  useEffect(() => {
    if (idsPermitidos.length > 0 && !idsPermitidos.includes(tab)) setTabState(idsPermitidos[0]);
  }, [tab, clavePermisos]);
  // Menú lateral (escritorio): el ícono lo abre y lo deja fijo; acercar el mouse lo abre y se cierra al alejarlo.
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [menuFijo, setMenuFijo] = useState(false);
  const timerMenu = useRef(null);
  const refMenu = useRef(null);
  const refBotonMenu = useRef(null);
  const cancelarCierre = () => { clearTimeout(timerMenu.current); timerMenu.current = null; };
  const cerrarMenu = () => { cancelarCierre(); setMenuAbierto(false); setMenuFijo(false); };
  const abrirPorMouse = () => { cancelarCierre(); if (!menuAbierto) { setMenuFijo(false); setMenuAbierto(true); } };
  const alternarMenu = () => { if (menuAbierto && menuFijo) cerrarMenu(); else { cancelarCierre(); setMenuFijo(true); setMenuAbierto(true); } };
  useEffect(() => {
    if (!menuAbierto) return;
    const alTeclear = (e) => { if (e.key === "Escape") cerrarMenu(); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [menuAbierto]);
  // Abierto con el mouse: se cierra cuando el cursor se aleja del menú y del ícono (se mide la posición real del cursor).
  useEffect(() => {
    if (!menuAbierto || menuFijo) return;
    const alMover = (e) => {
      const dentro = [refMenu.current, refBotonMenu.current].some((el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return e.clientX >= r.left - 8 && e.clientX <= r.right + 8 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8;
      });
      if (dentro) cancelarCierre();
      else if (!timerMenu.current) timerMenu.current = setTimeout(cerrarMenu, 250);
    };
    window.addEventListener("mousemove", alMover);
    return () => window.removeEventListener("mousemove", alMover);
  }, [menuAbierto, menuFijo]);
  useEffect(() => () => clearTimeout(timerMenu.current), []);

  // En el celular la barra inferior se desplaza: mantiene a la vista la sección activa.
  useEffect(() => {
    document.querySelector('.nav-tab[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [tab, loaded]);

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

  // Para los formularios: el error se devuelve al formulario (que marca los campos) en vez de cerrarse.
  const wrapForm = (fn) => async (...args) => {
    setBusy(true);
    setError("");
    try {
      await fn(...args);
    } finally {
      setBusy(false);
    }
    await reload();
  };

  const conf = (mensaje, fn) => async (...args) => { if (await confirmar(mensaje)) return fn(...args); };

  const actions = {
    guardarCliente: wrapForm(saveCliente),
    eliminarCliente: conf("¿Eliminar este cliente?", wrap(deleteCliente)),
    guardarIngrediente: wrapForm(saveIngrediente),
    eliminarIngrediente: conf("¿Eliminar este insumo?", wrap(deleteIngrediente)),
    guardarCompra: wrapForm(saveCompra),
    eliminarCompra: conf("¿Eliminar esta compra?", wrap(deleteCompra)),
    marcarReembolso: wrap((id, r) => marcarReembolso(id, r, hoy())),
    guardarGasto: wrapForm(saveGasto),
    eliminarGasto: conf("¿Eliminar este gasto?", wrap(deleteGasto)),
    marcarReembolsoGasto: wrap((id, r) => marcarReembolsoGasto(id, r, hoy())),
    guardarCierre: wrapForm(guardarCierre),
    borrarCierre: conf("¿Quitar la conciliación de este mes?", wrap(borrarCierre)),
    guardarApertura: wrapForm(guardarApertura),
    borrarApertura: conf("¿Quitar el saldo de apertura?", wrap(borrarApertura)),
    asignarFoto: wrapForm(asignarFoto),
    guardarDocumento: wrapForm(actualizarDocumento),
    eliminarDocumento: conf("¿Eliminar todas las compras de este documento?", wrap(async (ids) => { for (const id of ids) await deleteCompra(id); })),
    guardarRecetaBase: wrapForm(saveRecetaBase),
    eliminarRecetaBase: conf("¿Eliminar esta receta base? También se eliminarán todos sus lotes.", wrap(deleteRecetaBase)),
    guardarProduccion: wrapForm(saveProduccion),
    eliminarProduccion: conf("¿Eliminar este lote?", wrap(deleteProduccion)),
    guardarProducto: wrapForm(saveProducto),
    eliminarProducto: conf("¿Eliminar este producto?", wrap(deleteProducto)),
    guardarVenta: wrapForm(saveVenta),
    eliminarVenta: conf("¿Eliminar esta venta?", wrap(deleteVenta)),
    cambiarCuentaVenta: wrapForm(actualizarCuentaVenta),
    guardarPedido: wrapForm(savePedido),
    eliminarPedido: wrap(deletePedido),
    cambiarPagoPedido: wrap(cambiarPagoPedido),
    guardarAjuste: wrapForm(saveAjuste),
    eliminarAjuste: conf("¿Eliminar este ajuste?", wrap(deleteAjuste)),
  };

  const costeo = useCosteo(data);
  const stock = useStock(data);

  if (!loaded) {
    return <Shell><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", gap: 8, color: C.inkSoft }}><Loader2 size={18} /> Cargando datos…</div></Shell>;
  }

  const NAV = [
    { id: "dashboard", label: "Panel", icon: LayoutDashboard },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "compras", label: "Compras", icon: ShoppingCart },
    { id: "stock", label: "Stock", icon: Layers },
    { id: "recetas", label: "Recetas base", short: "Recetas", icon: FlaskConical },
    { id: "planificador", label: "Planificar producción", short: "Planificar", icon: Calculator },
    { id: "productos", label: "Productos", icon: Package },
    { id: "pedidos", label: "Pedidos", icon: CalendarDays },
    { id: "ventas", label: "Ventas", icon: Receipt },
    { id: "usuarios", label: "Usuarios", icon: UserCog },
    { id: "auditoria", label: "Auditoría", icon: History },
  ].filter((n) => idsPermitidos.includes(n.id));
  const salir = async () => { await fetch("/api/auth/logout", { method: "POST" }); onLogout(); };

  return (
    <Shell>
      <header className="app-top">
        <div className="app-top-inner">
          <button className="menu-btn" aria-label="Menú de secciones" aria-expanded={menuAbierto} aria-controls="menu-lateral" ref={refBotonMenu} onClick={alternarMenu} onMouseEnter={abrirPorMouse}>
            <Menu size={20} />
          </button>
          <div className="app-brand">Gestión de cucharables</div>
          <div className="app-section">{NAV.find((n) => n.id === tab)?.label || ""}</div>
          <div style={{ flex: 1 }} />
          {busy && <span className="app-busy">Guardando…</span>}
          <button className="nav-link solo-movil" onClick={salir}><LogOut size={15} /> Salir</button>
        </div>
      </header>

      {menuAbierto && menuFijo && <div className="scrim" onClick={cerrarMenu} />}
      {!menuAbierto && <div className="nav-hotspot" onMouseEnter={abrirPorMouse} />}
      <aside id="menu-lateral" ref={refMenu} className={`sidebar${menuAbierto ? " open" : ""}`}>
        <nav className="side-nav" aria-label="Secciones">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <button key={n.id} className="nav-link" aria-current={tab === n.id ? "page" : undefined} onClick={() => { setTab(n.id); cerrarMenu(); }}>
                <Icon size={18} />{n.label}
              </button>
            );
          })}
        </nav>
        <div className="side-user">
          <span className="app-user-mail">{session.email}</span>
          <button className="nav-link" onClick={salir}><LogOut size={16} /> Salir</button>
        </div>
      </aside>

      <div className="app-main">
        {error && <div style={{ margin: "0 0 10px", background: C.brickBg, color: C.brick, padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>{error}</div>}

        <main>
          {tab === "dashboard" && <Dashboard data={data} costeo={costeo} {...actions} />}
          {tab === "clientes" && <Clientes data={data} {...actions} />}
          {tab === "compras" && <Compras data={data} costeo={costeo} session={session} {...actions} />}
          {tab === "stock" && <Stock data={data} costeo={costeo} stock={stock} {...actions} />}
          {tab === "recetas" && <RecetasBase data={data} costeo={costeo} stock={stock} {...actions} />}
          {tab === "planificador" && <Planificador data={data} stock={stock} />}
          {tab === "productos" && <Productos data={data} costeo={costeo} {...actions} />}
          {tab === "pedidos" && <Pedidos data={data} session={session} stock={stock} {...actions} />}
          {idsPermitidos.length === 0 && <EmptyState icon={Lock} title="Sin secciones activas" />}
          {tab === "usuarios" && esAdmin && <Usuarios session={session} />}
          {tab === "auditoria" && esAdmin && <Auditoria />}
          {tab === "ventas" && <Ventas data={data} costeo={costeo} stock={stock} session={session} {...actions} />}
        </main>
      </div>

      <nav className="nav-bottom" aria-label="Secciones">
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <button key={n.id} className="nav-tab" aria-current={tab === n.id ? "page" : undefined} onClick={() => setTab(n.id)}>
              <Icon size={20} />{n.short || n.label}
            </button>
          );
        })}
      </nav>
    </Shell>
  );
}

/* ---------------- PLANIFICAR PRODUCCIÓN ---------------- */
function Planificador({ data, stock }) {
  const [filas, setFilas] = useState([{ recetaId: "", veces: "1" }]);
  const [copiado, setCopiado] = useState(false);

  // Precio más reciente de cada insumo (por unidad base), según la última compra registrada.
  const precioActual = useMemo(() => {
    const ultima = {};
    data.compras.forEach((c) => {
      const base = toBase(c.cantidad, c.unidad);
      if (base <= 0) return;
      const previa = ultima[c.ingredienteId];
      if (!previa || c.fecha > previa.fecha) ultima[c.ingredienteId] = { fecha: c.fecha, precio: (Number(c.costoTotal) || 0) / base };
    });
    return ultima;
  }, [data.compras]);

  const calculo = useMemo(() => {
    const necesario = {};
    const porReceta = [];
    filas.forEach((f) => {
      const r = data.recetasBase.find((x) => x.id === f.recetaId);
      const veces = parseNum(f.veces);
      if (!r || veces <= 0) return;
      let costo = 0, sinPrecio = false;
      r.ingredientes.forEach((i) => {
        const base = toBase(i.cantidad, i.unidad) * veces;
        necesario[i.ingredienteId] = (necesario[i.ingredienteId] || 0) + base;
        const p = precioActual[i.ingredienteId];
        if (p) costo += p.precio * base; else sinPrecio = true;
      });
      const lotes = data.producciones.filter((p) => p.recetaBaseId === r.id);
      const promedioBase = lotes.length ? lotes.reduce((s, p) => s + toBase(p.rendimientoReal, p.unidadRendimiento), 0) / lotes.length : null;
      porReceta.push({ receta: r, veces, costo, sinPrecio, rendimientoBase: promedioBase != null ? promedioBase * veces : null });
    });
    const lineas = Object.keys(necesario).map((id) => {
      const ing = data.ingredientes.find((x) => x.id === id);
      const stockBase = Math.max(0, stock.stockIngrediente(id));
      const faltaBase = Math.max(0, necesario[id] - stockBase);
      const p = precioActual[id];
      return {
        id, ing, necesarioBase: necesario[id], stockBase, faltaBase,
        precio: p ? p.precio : null,
        costoNecesario: p ? p.precio * necesario[id] : null,
        costoFalta: p ? p.precio * faltaBase : null,
      };
    }).filter((l) => l.ing).sort((a, b) => a.ing.nombre.localeCompare(b.ing.nombre));
    return {
      porReceta, lineas,
      costoTotal: lineas.reduce((s, l) => s + (l.costoNecesario || 0), 0),
      costoComprar: lineas.reduce((s, l) => s + (l.costoFalta || 0), 0),
      sinPrecio: lineas.filter((l) => l.precio == null),
    };
  }, [filas, data, precioActual, stock]);

  const enUnidad = (base, ing) => `${fmtNum(base / (A_BASE[ing.unidad] || 1), 3)} ${ing.unidad}`;
  const cambiar = (i, k, val) => setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [k]: val } : f)));
  const faltantes = calculo.lineas.filter((l) => l.faltaBase > 0.0001);

  const copiarLista = async () => {
    const txt = ["Lista de compras:", ...faltantes.map((l) => `- ${l.ing.nombre}: ${enUnidad(l.faltaBase, l.ing)}${l.costoFalta != null ? ` (aprox. ${clp(l.costoFalta)})` : ""}`), `Total aprox.: ${clp(calculo.costoComprar)}`].join("\n");
    try { await navigator.clipboard.writeText(txt); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch (e) { /* sin portapapeles */ }
  };

  if (data.recetasBase.length === 0) return <EmptyState icon={Calculator} title="Primero crea una receta base" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
      <Card style={{ padding: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>¿Qué vas a producir?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filas.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Select value={f.recetaId} onChange={(e) => cambiar(i, "recetaId", e.target.value)} style={{ flex: 1, minWidth: 0 }} aria-label="Receta">
                <option value="">Elige una receta</option>
                {data.recetasBase.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </Select>
              <span style={{ fontSize: 13, color: C.inkSoft }}>×</span>
              <NumInput value={f.veces} onChange={(e) => cambiar(i, "veces", e.target.value)} style={{ width: 70 }} aria-label="Veces" />
              <button type="button" aria-label="Quitar" onClick={() => setFilas((fs) => (fs.length > 1 ? fs.filter((_, j) => j !== i) : [{ recetaId: "", veces: "1" }]))} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}><Btn variant="ghost" onClick={() => setFilas([...filas, { recetaId: "", veces: "1" }])}><Plus size={15} /> Agregar receta</Btn></div>
      </Card>

      {calculo.lineas.length === 0 ? (
        <EmptyState icon={Calculator} title="Elige una receta y cuántas veces la harás" />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
            <Card style={{ padding: "12px 10px" }}>
              <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 4 }}>Costo de la producción</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600 }}>{clp(calculo.costoTotal)}</div>
            </Card>
            <Card style={{ padding: "12px 10px", borderColor: faltantes.length ? "#E8CFAE" : C.line, background: faltantes.length ? "#FFF8EC" : C.surface }}>
              <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 4 }}>Dinero para comprar lo que falta</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, color: faltantes.length ? C.caramelDark : C.sage }}>{clp(calculo.costoComprar)}</div>
            </Card>
          </div>

          {calculo.sinPrecio.length > 0 && (
            <Card style={{ padding: 12, borderColor: "#E8CFAE", background: "#FFF8EC", fontSize: 13 }}>
              <AlertTriangle size={14} color={C.caramel} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              Sin precio registrado (no se suman al costo): {calculo.sinPrecio.map((l) => l.ing.nombre).join(", ")}.
            </Card>
          )}

          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px 6px", fontWeight: 600, fontSize: 14 }}>Insumos</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead><tr><Th>Insumo</Th><Th right>Necesito</Th><Th right>En stock</Th><Th right>Falta</Th><Th right>Precio actual</Th><Th right>Costo de lo que falta</Th></tr></thead>
                <tbody>
                  {calculo.lineas.map((l) => (
                    <tr key={l.id}>
                      <Td>{l.ing.nombre}</Td>
                      <Td right>{enUnidad(l.necesarioBase, l.ing)}</Td>
                      <Td right>{enUnidad(l.stockBase, l.ing)}</Td>
                      <Td right style={{ fontWeight: 600, color: l.faltaBase > 0.0001 ? C.brick : C.sage }}>{l.faltaBase > 0.0001 ? enUnidad(l.faltaBase, l.ing) : "Alcanza"}</Td>
                      <Td right>{l.precio != null ? `S/ ${fmtNum(l.precio * (A_BASE[l.ing.unidad] || 1), 4)} / ${l.ing.unidad}` : "—"}</Td>
                      <Td right>{l.costoFalta != null ? clp(l.costoFalta) : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card style={{ padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Por receta</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {calculo.porReceta.map((p, i) => {
                const u = baseUnidadDe(p.receta.unidadRendimiento);
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, flexWrap: "wrap" }}>
                    <span>{p.receta.nombre} × {fmtNum(p.veces)}</span>
                    <span style={{ color: C.inkSoft }}>
                      {clp(p.costo)}{p.rendimientoBase != null ? ` · rinde aprox. ${fmtNum(p.rendimientoBase, 0)} ${u} (${clpU(p.costo / p.rendimientoBase)}/${u})` : " · sin lotes para estimar el rendimiento"}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {faltantes.length > 0 && <div><Btn variant="ghost" onClick={copiarLista}><Copy size={15} /> {copiado ? "Copiado" : "Copiar lista de compras"}</Btn></div>}
        </>
      )}
    </div>
  );
}

/* ---------------- DASHBOARD ---------------- */
/* ---------------- CAJA (criterio de caja) ---------------- */
const mesDe = (f) => String(f || "").slice(0, 7);
const finDeMes = (mes) => { const [y, m] = mes.split("-").map(Number); return aFecha(new Date(y, m, 0)); };
const fmtMes = (mes) => { const [y, m] = mes.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" }); };

// Movimientos reales de la cuenta de la empresa, con la fecha en que el dinero entró o salió.
// - Ventas cobradas en la cuenta de la empresa: entran en su fecha de cobro.
// - Compras y gastos pagados con la cuenta de la empresa: salen en su fecha de pago.
// - Lo pagado con dinero personal de un socio: sale de la empresa cuando se le reembolsa.
function movimientosCaja(data) {
  const out = [];
  const nombreIng = (id) => data.ingredientes.find((i) => i.id === id)?.nombre || "insumo";
  data.ventas.forEach((v) => {
    if (v.cuenta !== "empresa") return;
    const cli = data.clientes.find((c) => c.id === v.clienteId);
    out.push({ fecha: v.fechaCobro || v.fecha, doc: v.fecha, tipo: "ingreso", concepto: `Venta${cli ? ` · ${cli.nombre}` : ""}`, monto: Number(v.total) || 0 });
  });
  data.compras.forEach((c) => {
    const monto = Number(c.costoTotal) || 0, pago = c.fechaPago || c.fecha;
    if (c.cuenta !== "personal") out.push({ fecha: pago, doc: c.fecha, tipo: "egreso", concepto: `Compra · ${nombreIng(c.ingredienteId)}`, monto });
    else if (c.reembolsado) out.push({ fecha: c.fechaReembolso || pago, doc: c.fecha, tipo: "egreso", concepto: `Reembolso compra · ${nombreIng(c.ingredienteId)}`, monto });
  });
  (data.gastos || []).forEach((g) => {
    const monto = Number(g.monto) || 0, pago = g.fechaPago || g.fecha;
    if (g.cuenta !== "personal") out.push({ fecha: pago, doc: g.fecha, tipo: "egreso", concepto: `Gasto · ${g.descripcion}`, monto });
    else if (g.reembolsado) out.push({ fecha: g.fechaReembolso || pago, doc: g.fecha, tipo: "egreso", concepto: `Reembolso gasto · ${g.descripcion}`, monto });
  });
  return out;
}
// Caja de un mes: saldo inicial (arrastrado del mes anterior), entradas, salidas y saldo final.
function calcularCaja(data, mes) {
  const ap = (data.cajaConfig || [])[0] || null;
  const movs = movimientosCaja(data).filter((m) => !ap || m.fecha >= ap.fecha);
  const ini = `${mes}-01`, fin = finDeMes(mes);
  let saldoInicial = ap && ap.fecha <= fin ? Number(ap.monto) || 0 : 0;
  movs.filter((m) => m.fecha < ini).forEach((m) => { saldoInicial += m.tipo === "ingreso" ? m.monto : -m.monto; });
  const delMes = movs.filter((m) => m.fecha >= ini && m.fecha <= fin).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ingresos = delMes.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
  const egresos = delMes.filter((m) => m.tipo === "egreso").reduce((s, m) => s + m.monto, 0);
  return { ap, saldoInicial, ingresos, egresos, saldoFinal: saldoInicial + ingresos - egresos, delMes };
}

function CajaMes({ data, mes, guardarCierre, borrarCierre, guardarApertura, borrarApertura }) {
  const caja = useMemo(() => calcularCaja(data, mes), [data, mes]);
  const cierre = (data.cierres || []).find((c) => c.mes === mes);
  const [saldoBanco, setSaldoBanco] = useState("");
  const [nota, setNota] = useState("");
  const [verMov, setVerMov] = useState(false);
  const [cfg, setCfg] = useState(false);
  const [apMonto, setApMonto] = useState("");
  const [apFecha, setApFecha] = useState(hoy());
  useEffect(() => { setSaldoBanco(cierre ? String(cierre.saldoBanco) : ""); setNota(cierre?.nota || ""); }, [mes, cierre?.saldoBanco, cierre?.nota]);
  useEffect(() => { if (caja.ap) { setApMonto(String(caja.ap.monto)); setApFecha(caja.ap.fecha); } }, [caja.ap?.monto, caja.ap?.fecha]);

  const valCierre = useValidacion(VAL.validarCierre({ mes, saldoBanco: parseNum(saldoBanco), nota }));
  const valAp = useValidacion(VAL.validarApertura({ fecha: apFecha, monto: parseNum(apMonto) }));
  const dif = cierre ? Number(cierre.saldoBanco) - caja.saldoFinal : null;

  // Compras o gastos que cruzan de mes: la fecha del documento y la del pago caen en meses distintos.
  const cruzan = useMemo(() => {
    const todos = [];
    const nombreIng = (id) => data.ingredientes.find((i) => i.id === id)?.nombre || "insumo";
    data.compras.forEach((c) => { if (c.cuenta !== "personal" && c.fechaPago) todos.push({ doc: c.fecha, pago: c.fechaPago, concepto: `Compra · ${nombreIng(c.ingredienteId)}`, monto: Number(c.costoTotal) || 0 }); });
    (data.gastos || []).forEach((g) => { if (g.cuenta !== "personal" && g.fechaPago) todos.push({ doc: g.fecha, pago: g.fechaPago, concepto: `Gasto · ${g.descripcion}`, monto: Number(g.monto) || 0 }); });
    data.ventas.forEach((v) => { if (v.cuenta === "empresa" && v.fechaCobro) todos.push({ doc: v.fecha, pago: v.fechaCobro, concepto: "Venta (cobro)", monto: Number(v.total) || 0 }); });
    return todos.filter((t) => mesDe(t.doc) !== mesDe(t.pago) && (mesDe(t.doc) === mes || mesDe(t.pago) === mes));
  }, [data, mes]);

  const porCobrar = data.ventas.filter((v) => v.cuenta === "pendiente").reduce((s, v) => s + (Number(v.total) || 0), 0);
  const enSocios = data.ventas.filter((v) => v.cuenta === "personal").reduce((s, v) => s + (Number(v.total) || 0), 0);
  const porReembolsar = data.compras.filter((c) => c.cuenta === "personal" && !c.reembolsado).reduce((s, c) => s + (Number(c.costoTotal) || 0), 0)
    + (data.gastos || []).filter((g) => g.cuenta === "personal" && !g.reembolsado).reduce((s, g) => s + (Number(g.monto) || 0), 0);

  const fila = (label, valor, color, fuerte) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: fuerte ? 700 : 400, padding: "3px 0", borderTop: fuerte ? `1px solid ${C.line}` : "none", marginTop: fuerte ? 4 : 0 }}>
      <span style={{ color: fuerte ? C.ink : C.inkSoft }}>{label}</span><span style={{ color: color || C.ink }}>{valor}</span>
    </div>
  );

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Caja de {fmtMes(mes)}</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8 }}>Dinero real de la cuenta de la empresa, según la fecha en que se cobró o se pagó.</div>
      {fila("Saldo inicial (arrastrado del mes anterior)", clp(caja.saldoInicial))}
      {fila("+ Cobros del mes", clp(caja.ingresos), C.sage)}
      {fila("− Pagos del mes (insumos, gastos y reembolsos)", clp(caja.egresos), C.brick)}
      {fila("Saldo final (pasa como inicial al mes siguiente)", clp(caja.saldoFinal), caja.saldoFinal >= 0 ? C.ink : C.brick, true)}

      <button onClick={() => setVerMov((x) => !x)} style={{ background: "none", border: "none", cursor: "pointer", color: C.caramel, fontWeight: 600, fontSize: 12, padding: 0, marginTop: 8 }}>
        {verMov ? "Ocultar movimientos" : `Ver los ${caja.delMes.length} movimiento(s) del mes`}
      </button>
      {verMov && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          {caja.delMes.length === 0 && <div style={{ fontSize: 12, color: C.inkSoft }}>Sin movimientos de caja este mes.</div>}
          {caja.delMes.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5 }}>
              <span>{m.fecha} · {m.concepto}{m.doc !== m.fecha ? <span style={{ color: C.inkSoft }}> (documento del {m.doc})</span> : null}</span>
              <span style={{ color: m.tipo === "ingreso" ? C.sage : C.brick, whiteSpace: "nowrap" }}>{m.tipo === "ingreso" ? "+" : "−"}{clp(m.monto)}</span>
            </div>
          ))}
        </div>
      )}

      {cruzan.length > 0 && (
        <div style={{ marginTop: 10, background: "#FFF8EC", border: "1px solid #E8CFAE", borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Operaciones que cruzan de mes</div>
          {cruzan.map((t, i) => (
            <div key={i} style={{ fontSize: 12, color: C.inkSoft }}>{t.concepto} · {clp(t.monto)}: documento del {t.doc}, {mesDe(t.pago) === mes ? "pagado" : "se paga"} el {t.pago}</div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Conciliar con el banco</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 150 }}><Field label={`Saldo real al cierre de ${fmtMes(mes)}`} v={valCierre} campo="saldoBanco"><NumInput value={saldoBanco} onChange={(e) => setSaldoBanco(e.target.value)} placeholder="0.00" /></Field></div>
          <div style={{ flex: 1, minWidth: 150 }}><Field label="Nota (opcional)" v={valCierre} campo="nota"><Input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} /></Field></div>
        </div>
        <ErrorForm v={valCierre} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Btn disabled={valCierre.enviando || saldoBanco === ""} onClick={() => valCierre.enviar(() => guardarCierre({ mes, saldoBanco: parseNum(saldoBanco), nota }))}>Guardar conciliación</Btn>
          {cierre && <Btn variant="ghost" onClick={() => borrarCierre(mes)}>Quitar</Btn>}
        </div>
        {cierre && (
          <div role="status" style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: Math.abs(dif) < 0.005 ? C.sage : C.brick }}>
            {Math.abs(dif) < 0.005 ? "Cuadra con el banco." : `Diferencia: ${dif > 0 ? "el banco tiene" : "el sistema tiene"} ${clp(Math.abs(dif))} más. Revisa si falta registrar un cobro o un pago, o si alguno tiene la fecha equivocada.`}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.inkSoft, display: "flex", flexDirection: "column", gap: 2 }}>
        <div>Por cobrar (ventas pendientes, hoy): <b style={{ color: C.ink }}>{clp(porCobrar)}</b></div>
        <div>Cobrado en cuentas personales de socios: <b style={{ color: C.ink }}>{clp(enSocios)}</b></div>
        <div>Por reembolsar a socios (hoy): <b style={{ color: C.ink }}>{clp(porReembolsar)}</b></div>
      </div>

      <button onClick={() => setCfg((x) => !x)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, fontSize: 12, padding: 0, marginTop: 10 }}>
        {cfg ? "Ocultar saldo de apertura" : caja.ap ? `Saldo de apertura: ${clp(caja.ap.monto)} desde el ${caja.ap.fecha} (cambiar)` : "Configurar saldo de apertura (dinero que ya había en la cuenta)"}
      </button>
      {cfg && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>Es el dinero que tenía la cuenta de la empresa el primer día que usas el sistema. Los movimientos anteriores a esa fecha no se cuentan.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}><Field label="Saldo" v={valAp} campo="monto"><NumInput value={apMonto} onChange={(e) => setApMonto(e.target.value)} placeholder="0.00" /></Field></div>
            <div style={{ flex: 1, minWidth: 140 }}><Field label="Desde el día" v={valAp} campo="fecha"><Input type="date" value={apFecha} onChange={(e) => setApFecha(e.target.value)} /></Field></div>
          </div>
          <ErrorForm v={valAp} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Btn disabled={valAp.enviando || apMonto === ""} onClick={() => valAp.enviar(() => guardarApertura({ monto: parseNum(apMonto), fecha: apFecha }))}>Guardar apertura</Btn>
            {caja.ap && <Btn variant="ghost" onClick={() => borrarApertura()}>Quitar</Btn>}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------------- PARETO DE INSUMOS ---------------- */
function ParetoInsumos({ data, mes }) {
  const [alcance, setAlcance] = useState("mes");
  const filas = useMemo(() => {
    const por = {};
    data.compras.forEach((c) => {
      if (alcance === "mes" && mesDe(c.fecha) !== mes) return;
      por[c.ingredienteId] = (por[c.ingredienteId] || 0) + (Number(c.costoTotal) || 0);
    });
    const lista = Object.entries(por).map(([id, total]) => ({ id, nombre: data.ingredientes.find((i) => i.id === id)?.nombre || "Insumo eliminado", total })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
    const suma = lista.reduce((s, x) => s + x.total, 0);
    let acum = 0;
    return { suma, lista: lista.map((x) => { const antes = acum; acum += x.total; return { ...x, pct: suma ? (x.total / suma) * 100 : 0, acum: suma ? (acum / suma) * 100 : 0, claseA: suma ? (antes / suma) * 100 < 80 : false }; }) };
  }, [data.compras, data.ingredientes, alcance, mes]);

  const { lista, suma } = filas;
  const nA = lista.filter((x) => x.claseA).length;
  const MAX = 12;
  const barras = lista.length > MAX ? [...lista.slice(0, MAX - 1), (() => { const resto = lista.slice(MAX - 1); const total = resto.reduce((s, x) => s + x.total, 0); return { id: "resto", nombre: `Otros ${resto.length} insumos`, total, acum: 100, claseA: false }; })()] : lista;
  const W = 620, H = 230, L = 46, R = 40, T = 14, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const max = Math.max(...barras.map((b) => b.total), 1);
  const bw = pw / Math.max(barras.length, 1);
  const x = (i) => L + bw * i + bw / 2;
  const yv = (v) => T + ph - (v / max) * ph;
  const yp = (p) => T + ph - (p / 100) * ph;
  const pts = barras.map((b, i) => `${x(i)},${yp(b.acum)}`).join(" ");

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Pareto 80/20 de insumos</div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["mes", fmtMes(mes)], ["todo", "Todo el historial"]].map(([v, t]) => (
            <button key={v} aria-pressed={alcance === v} onClick={() => setAlcance(v)} style={{ padding: "4px 10px", borderRadius: 14, fontSize: 12, cursor: "pointer", border: `1px solid ${alcance === v ? C.caramel : C.line}`, background: alcance === v ? C.chip : "#FFFDFA", color: alcance === v ? C.caramelDark : C.inkSoft, fontWeight: 600 }}>{t}</button>
          ))}
        </div>
      </div>
      {lista.length === 0 ? (
        <div style={{ fontSize: 13, color: C.inkSoft }}>No hay compras de insumos {alcance === "mes" ? "en este mes" : "registradas"}.</div>
      ) : (
        <>
          <div style={{ fontSize: 13, margin: "6px 0 8px" }}>
            <b>{nA} de {lista.length}</b> insumo(s) ({Math.round((nA / lista.length) * 100)}%) concentran el <b>{Math.round(lista.filter((x) => x.claseA).slice(-1)[0].acum)}%</b> del gasto de {clp(suma)}. Son los que más conviene negociar, comparar marcas o controlar.
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gráfico de Pareto: ${nA} de ${lista.length} insumos concentran el 80% del gasto`} style={{ width: "100%", height: "auto" }}>
            {[0, 25, 50, 75, 100].map((p) => (
              <g key={p}>
                <line x1={L} x2={W - R} y1={yp(p)} y2={yp(p)} stroke={C.line} strokeWidth="1" />
                <text x={W - R + 4} y={yp(p) + 4} fontSize="10" fill={C.inkSoft}>{p}%</text>
              </g>
            ))}
            <text x={L - 6} y={T + 4} fontSize="10" fill={C.inkSoft} textAnchor="end">{clp(max)}</text>
            <text x={L - 6} y={T + ph + 4} fontSize="10" fill={C.inkSoft} textAnchor="end">0</text>
            <line x1={L} x2={W - R} y1={yp(80)} y2={yp(80)} stroke={C.brick} strokeWidth="1.2" strokeDasharray="5 4" />
            {barras.map((b, i) => (
              <g key={b.id}>
                <rect x={x(i) - bw * 0.34} y={yv(b.total)} width={bw * 0.68} height={Math.max(ph - (yv(b.total) - T), 0)} rx="3" fill={b.claseA ? C.caramel : "#D9C8AB"}><title>{`${b.nombre}: ${clp(b.total)}`}</title></rect>
                <text x={x(i)} y={H - 9} fontSize="10.5" fill={C.inkSoft} textAnchor="middle">{i + 1}</text>
              </g>
            ))}
            <polyline points={pts} fill="none" stroke={C.sage} strokeWidth="2" />
            {barras.map((b, i) => <circle key={b.id} cx={x(i)} cy={yp(b.acum)} r="3.2" fill={C.sage}><title>{`Acumulado hasta ${b.nombre}: ${Math.round(b.acum)}%`}</title></circle>)}
          </svg>
          <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: C.inkSoft, flexWrap: "wrap", margin: "2px 0 8px" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: C.caramel, borderRadius: 2, marginRight: 4 }} />Insumos que suman el 80%</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#D9C8AB", borderRadius: 2, marginRight: 4 }} />Resto</span>
            <span><span style={{ display: "inline-block", width: 14, height: 2, background: C.sage, marginRight: 4, verticalAlign: "middle" }} />% acumulado</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {lista.map((r, i) => (
              <div key={r.id} style={{ display: "flex", gap: 8, fontSize: 12.5, alignItems: "baseline", fontWeight: r.claseA ? 600 : 400, color: r.claseA ? C.ink : C.inkSoft }}>
                <span style={{ width: 20, color: C.inkSoft }}>{i + 1}.</span>
                <span style={{ flex: 1 }}>{r.nombre}</span>
                <span>{clp(r.total)}</span>
                <span style={{ width: 46, textAlign: "right" }}>{r.pct.toFixed(1)}%</span>
                <span style={{ width: 70, textAlign: "right", color: C.sage, whiteSpace: "nowrap" }}>{r.acum.toFixed(0)}% acum.</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------------- PANEL ---------------- */
function Dashboard({ data, costeo, guardarCierre, borrarCierre, guardarApertura, borrarApertura }) {
  const [mes, setMes] = useState(() => hoy().slice(0, 7));
  const ventasMes = data.ventas.filter((v) => String(v.fecha).startsWith(mes));
  const totalVentasMes = ventasMes.reduce((s, v) => s + (Number(v.total) || 0), 0);
  const gastosMes = (data.gastos || []).filter((g) => String(g.fecha).startsWith(mes));
  const totalGastosMes = gastosMes.reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const gastosPorCategoria = {};
  gastosMes.forEach((g) => { gastosPorCategoria[g.categoria] = (gastosPorCategoria[g.categoria] || 0) + (Number(g.monto) || 0); });

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
  const utilidadMes = margenMes - totalGastosMes;
  const ranking = Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
  const maxCant = ranking[0]?.cantidad || 1;
  const productosSinCosto = data.productos.filter((p) => costeo.costoProducto(p).incompleto);

  const stats = [
    { label: "Ventas del mes", value: clp(totalVentasMes) },
    { label: "Costo estimado de lo vendido", value: clp(costoMes) },
    { label: "Margen del mes", value: clp(margenMes), color: margenMes >= 0 ? C.sage : C.brick },
    { label: "Gastos operativos", value: clp(totalGastosMes) },
    { label: "Utilidad neta del mes", value: clp(utilidadMes), color: utilidadMes >= 0 ? C.sage : C.brick },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: C.inkSoft }}>Mes a revisar</span>
        <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} style={{ width: 170 }} />
      </div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: -6 }}>Resultados del mes (por fecha de venta y de gasto)</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        {stats.map((s) => (
          <Card key={s.label} style={{ padding: "12px 10px" }}>
            <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, color: s.color || C.ink }}>{s.value}</div>
          </Card>
        ))}
      </div>
      {Object.keys(gastosPorCategoria).length > 0 && (
        <div style={{ fontSize: 12.5, color: C.inkSoft }}>Gastos operativos: {Object.entries(gastosPorCategoria).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${clp(v)}`).join(" · ")}</div>
      )}

      <CajaMes data={data} mes={mes} guardarCierre={guardarCierre} borrarCierre={borrarCierre} guardarApertura={guardarApertura} borrarApertura={borrarApertura} />

      <ParetoInsumos data={data} mes={mes} />

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <TrendingUp size={16} color={C.caramel} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Productos más vendidos del mes</div>
        </div>
        {ranking.length === 0 ? (
          <div style={{ fontSize: 13, color: C.inkSoft }}>No hay ventas registradas en este mes.</div>
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
        <EmptyState icon={Users} title="Sin clientes aún" action={<Btn onClick={() => setModal({})}>Agregar cliente</Btn>} />
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
      {modal && <ClienteModal cliente={modal} onClose={() => setModal(null)} onSave={async (c, opts) => { await guardarCliente(c); if (!opts?.seguir) setModal(null); }} />}
    </div>
  );
}
function ClienteModal({ cliente, onClose, onSave }) {
  const vacio = { nombre: "", telefono: "", email: "", direccion: "", notas: "" };
  const [f, setF] = useState({ ...vacio, ...cliente });
  const [ultimo, setUltimo] = useState("");
  const v = useValidacion(VAL.validarCliente(f));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = (seguir) => v.enviar(async () => {
    await onSave(f, { seguir });
    if (seguir) {
      setUltimo(f.nombre.trim());
      setF({ ...vacio });
      v.reiniciar();
      setTimeout(() => document.getElementById("nuevo-cliente-nombre")?.focus(), 0);
    }
  });
  return (
    <Modal title={cliente.id ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ultimo && <div role="status" style={{ fontSize: 13, color: C.sage, fontWeight: 600 }}><Check size={14} style={{ verticalAlign: "-2px" }} /> Guardado: {ultimo}. Agrega otro cuando quieras.</div>}
        <Field label="Nombre" v={v} campo="nombre"><Input id="nuevo-cliente-nombre" value={f.nombre} onChange={set("nombre")} autoFocus maxLength={100} /></Field>
        <Field label="Teléfono (opcional)" v={v} campo="telefono"><Input value={f.telefono || ""} onChange={set("telefono")} inputMode="tel" maxLength={25} /></Field>
        <Field label="Email (opcional)" v={v} campo="email"><Input type="email" value={f.email || ""} onChange={set("email")} maxLength={120} /></Field>
        <Field label="Dirección (opcional)" v={v} campo="direccion"><Input value={f.direccion || ""} onChange={set("direccion")} maxLength={200} /></Field>
        <Field label="Notas (opcional)" v={v} campo="notas"><Input value={f.notas || ""} onChange={set("notas")} maxLength={500} /></Field>
        <ErrorForm v={v} />
        {cliente.id ? (
          <Btn disabled={v.enviando} onClick={() => guardar(false)} style={{ justifyContent: "center", marginTop: 6 }}>Guardar cliente</Btn>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <Btn variant="ghost" disabled={v.enviando} onClick={() => guardar(true)} style={{ flex: 1, justifyContent: "center" }}>Guardar y agregar otro</Btn>
            <Btn disabled={v.enviando} onClick={() => guardar(false)} style={{ flex: 1, justifyContent: "center" }}>Guardar y cerrar</Btn>
          </div>
        )}
      </div>
    </Modal>
  );
}
/* ---------------- COMPRAS: insumos y gastos operativos ---------------- */
function Compras(props) {
  const [vista, setVista] = useState("insumos");
  const pest = (id, texto) => (
    <button aria-pressed={vista === id} onClick={() => setVista(id)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${vista === id ? C.caramel : C.line}`, background: vista === id ? C.chip : "#FFFDFA", color: vista === id ? C.caramelDark : C.inkSoft }}>{texto}</button>
  );
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>{pest("insumos", "Insumos de producción")}{pest("gastos", "Gastos operativos")}</div>
      {vista === "insumos" ? <ComprasInsumos {...props} /> : <Gastos {...props} />}
    </div>
  );
}

function Gastos({ data, session, guardarGasto, eliminarGasto, marcarReembolsoGasto }) {
  const [modal, setModal] = useState(null);
  const [fCat, setFCat] = useState("todas");
  const [fCuenta, setFCuenta] = useState("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const lista = (data.gastos || []).filter((g) => (fCat === "todas" || g.categoria === fCat) && (fCuenta === "todas" || g.cuenta === fCuenta) && (!desde || g.fecha >= desde) && (!hasta || g.fecha <= hasta));
  const total = lista.reduce((s, g) => s + (Number(g.monto) || 0), 0);
  return (
    <div style={{ paddingTop: 12 }}>
      <Card style={{ padding: 12, marginBottom: 12, background: "#FFF8EC", borderColor: "#E8CFAE" }}>
        <div style={{ fontSize: 12.5 }}>Aquí van los pagos que <b>no son insumos</b>: mano de obra puntual, servicios, honorarios, transporte, etc. No crean insumos, no tocan el stock ni los costos de las recetas, pero sí restan en la utilidad y en la caja.</div>
      </Card>
      <Btn onClick={() => setModal({})} style={{ width: "100%", justifyContent: "center", marginBottom: 12 }}><Plus size={15} /> Registrar gasto operativo</Btn>

      <Card style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 130 }}><Field label="Categoría"><Select value={fCat} onChange={(e) => setFCat(e.target.value)}><option value="todas">Todas</option>{VAL.CATEGORIAS_GASTO.map((c) => <option key={c}>{c}</option>)}</Select></Field></div>
          <div style={{ flex: 1, minWidth: 130 }}><Field label="Pagado con"><Select value={fCuenta} onChange={(e) => setFCuenta(e.target.value)}><option value="todas">Todas</option><option value="empresa">Cuenta de la empresa</option><option value="personal">Cuenta personal</option></Select></Field></div>
          <div style={{ flex: 1, minWidth: 130 }}><Field label="Desde"><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Field></div>
          <div style={{ flex: 1, minWidth: 130 }}><Field label="Hasta"><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Field></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 13 }}><span style={{ color: C.inkSoft }}>{lista.length} gasto(s)</span><span style={{ fontWeight: 600 }}>Total: {clp(total)}</span></div>
      </Card>

      {(data.gastos || []).length === 0 ? (
        <EmptyState icon={Receipt} title="Sin gastos operativos registrados" />
      ) : lista.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24, color: C.inkSoft, fontSize: 13 }}>Ningún gasto coincide con los filtros.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.map((g) => (
            <Card key={g.id} style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{g.descripcion}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft }}>{g.categoria} · {g.fecha}{g.fechaPago && g.fechaPago !== g.fecha ? ` · pagado el ${g.fechaPago}` : ""}</div>
                  {g.cuenta === "personal" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: g.reembolsado ? C.sage : C.brick }}>Pagado por {g.registradoPor} — {g.reembolsado ? `reembolsado${g.fechaReembolso ? ` el ${g.fechaReembolso}` : ""}` : "pendiente de reembolso"}</span>
                      <button onClick={() => marcarReembolsoGasto(g.id, g.reembolsado ? 0 : 1)} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 6, padding: "2px 7px", fontSize: 11, cursor: "pointer", color: C.inkSoft }}>{g.reembolsado ? "marcar pendiente" : "marcar reembolsado"}</button>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{clp(g.monto)}</div>
                  <button aria-label={`Editar ${g.descripcion}`} onClick={() => setModal(g)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, marginTop: 2 }}><Pencil size={14} /></button>
                  <button aria-label={`Eliminar ${g.descripcion}`} onClick={() => eliminarGasto(g.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick, marginTop: 2 }}><Trash2 size={14} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {modal && <GastoModal gasto={modal} session={session} onClose={() => setModal(null)} onSave={async (g, opts) => { await guardarGasto(g); if (!opts?.seguir) setModal(null); }} />}
    </div>
  );
}

function GastoModal({ gasto, session, onClose, onSave }) {
  const nombreUsuario = session?.nombre || session?.email || "";
  const vacio = { fecha: hoy(), fechaPago: "", categoria: "Mano de obra", descripcion: "", monto: "", cuenta: "empresa" };
  const [f, setF] = useState(gasto.id ? { ...vacio, ...gasto, fechaPago: gasto.fechaPago || "", monto: String(gasto.monto) } : vacio);
  const [ultimo, setUltimo] = useState("");
  const payload = {
    id: gasto.id, fecha: f.fecha, fechaPago: f.fechaPago || null, categoria: f.categoria, descripcion: f.descripcion, monto: parseNum(f.monto), cuenta: f.cuenta,
    registradoPor: f.cuenta === "personal" ? (gasto.id && gasto.registradoPor) || nombreUsuario : null,
  };
  const v = useValidacion(VAL.validarGasto(payload));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = (seguir) => v.enviar(async () => {
    await onSave(payload, { seguir });
    if (seguir) { setUltimo(f.descripcion.trim()); setF({ ...vacio, fecha: f.fecha, categoria: f.categoria, cuenta: f.cuenta }); v.reiniciar(); }
  });
  return (
    <Modal title={gasto.id ? "Editar gasto operativo" : "Registrar gasto operativo"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ultimo && <div role="status" style={{ fontSize: 13, color: C.sage, fontWeight: 600 }}><Check size={14} style={{ verticalAlign: "-2px" }} /> Guardado: {ultimo}.</div>}
        <Field label="Categoría" v={v} campo="categoria"><Select value={f.categoria} onChange={set("categoria")}>{VAL.CATEGORIAS_GASTO.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Descripción (ej. ayuda en el armado de pedidos)" v={v} campo="descripcion"><Input value={f.descripcion} onChange={set("descripcion")} maxLength={120} autoFocus /></Field>
        <Field label="Monto pagado" v={v} campo="monto"><NumInput value={f.monto} onChange={set("monto")} placeholder="0.00" /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Fecha del gasto" v={v} campo="fecha"><Input type="date" value={f.fecha} onChange={set("fecha")} /></Field>
          <Field label="Fecha de pago (si es distinta)" v={v} campo="fechaPago"><Input type="date" value={f.fechaPago} onChange={set("fechaPago")} /></Field>
        </div>
        <Field label="¿Con qué dinero se pagó?" v={v} campo="cuenta">
          <Select value={f.cuenta} onChange={set("cuenta")}>
            <option value="empresa">Cuenta de la empresa</option>
            <option value="personal">Cuenta personal (a reembolsar)</option>
          </Select>
        </Field>
        <ErrorForm v={v} />
        {gasto.id ? (
          <Btn disabled={v.enviando} onClick={() => guardar(false)} style={{ justifyContent: "center", marginTop: 6 }}>Guardar cambios</Btn>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <Btn variant="ghost" disabled={v.enviando} onClick={() => guardar(true)} style={{ flex: 1, justifyContent: "center" }}>Guardar y agregar otro</Btn>
            <Btn disabled={v.enviando} onClick={() => guardar(false)} style={{ flex: 1, justifyContent: "center" }}>Guardar y cerrar</Btn>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- COMPRAS ---------------- */
function ComprasInsumos({ data, costeo, session, guardarCompra, eliminarCompra, guardarIngrediente, eliminarIngrediente, marcarReembolso, asignarFoto, guardarDocumento, eliminarDocumento }) {
  const [modal, setModal] = useState(null);
  const [editDoc, setEditDoc] = useState(null);
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [docModal, setDocModal] = useState(null);
  const [modalIng, setModalIng] = useState(null);
  const [fCuenta, setFCuenta] = useState("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const ordenadas = data.compras.filter((c) => (fCuenta === "todas" || c.cuenta === fCuenta) && (!desde || c.fecha >= desde) && (!hasta || c.fecha <= hasta));
  // Las compras con el mismo documento (fecha + tipo + número) se agrupan en un bloque.
  const grupos = [];
  const porClave = new Map();
  for (const c of ordenadas) {
    const key = c.numero ? `${c.fecha}|${c.tipoDocumento}|${c.numero}` : c.id;
    if (!porClave.has(key)) { const g = { key, compras: [] }; porClave.set(key, g); grupos.push(g); }
    porClave.get(key).compras.push(c);
  }
  const totalFiltrado = ordenadas.reduce((s, c) => s + (Number(c.costoTotal) || 0), 0);

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

      <Card style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 130 }}><Field label="Pagado con"><Select value={fCuenta} onChange={(e) => setFCuenta(e.target.value)}><option value="todas">Todas</option><option value="empresa">Cuenta de la empresa</option><option value="personal">Cuenta personal</option></Select></Field></div>
          <div style={{ flex: 1, minWidth: 130 }}><Field label="Desde"><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Field></div>
          <div style={{ flex: 1, minWidth: 130 }}><Field label="Hasta"><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Field></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 13 }}><span style={{ color: C.inkSoft }}>{grupos.length} documento(s) · {ordenadas.length} ítem(s)</span><span style={{ fontWeight: 600 }}>Total: {clp(totalFiltrado)}</span></div>
      </Card>

      {data.compras.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="Sin compras registradas" />
      ) : ordenadas.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24, color: C.inkSoft, fontSize: 13 }}>Ninguna compra coincide con los filtros.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {grupos.map((g) => {
            const abierto = abiertos.has(g.key);
            const primera = g.compras[0];
            const total = g.compras.reduce((t, c) => t + (Number(c.costoTotal) || 0), 0);
            const conFoto = g.compras.some((c) => c.fotoId);
            const personal = primera.cuenta === "personal";
            const pendientes = g.compras.filter((c) => personal && !c.reembolsado).length;
            return (
              <Card key={g.key} style={{ padding: 0, overflow: "hidden" }}>
                <button
                  onClick={() => setAbiertos((p) => { const n = new Set(p); n.has(g.key) ? n.delete(g.key) : n.add(g.key); return n; })}
                  aria-expanded={abierto}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, textAlign: "left", font: "inherit", color: "inherit" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <ChevronRight size={16} style={{ transform: abierto ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{primera.tipoDocumento}{primera.numero ? ` #${primera.numero}` : " (sin número)"}</div>
                      <div style={{ fontSize: 12, color: C.inkSoft }}>{primera.fecha}{primera.fechaPago && primera.fechaPago !== primera.fecha ? ` (pagado el ${primera.fechaPago})` : ""} · {g.compras.length} {g.compras.length === 1 ? "ítem" : "ítems"}{personal ? ` · pagado por ${primera.registradoPor || "cuenta personal"}` : ""}</div>
                      {personal && <div style={{ fontSize: 11.5, fontWeight: 600, color: pendientes ? C.brick : C.sage }}>{pendientes ? `${pendientes} pendiente(s) de reembolso` : "ya reembolsado"}</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" }}>{clp(total)}</div>
                </button>
                {abierto && (
                  <div style={{ borderTop: `1px solid ${C.line}`, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    {g.compras.map((c) => {
                      const ing = data.ingredientes.find((i) => i.id === c.ingredienteId);
                      const cu = Number(c.cantidad) > 0 ? Number(c.costoTotal) / Number(c.cantidad) : 0;
                      return (
                        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{ing ? ing.nombre : "—"}{c.marca && <span style={{ fontWeight: 400, color: C.inkSoft }}> · {c.marca}</span>}</div>
                            <div style={{ fontSize: 12, color: C.inkSoft }}>{fmtNum(c.cantidad, 4)} {c.unidad} · {clpU(cu)}/{c.unidad}</div>
                            {c.cuenta === "personal" && (
                              <button
                                onClick={() => marcarReembolso(c.id, c.reembolsado ? 0 : 1)}
                                style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 6, padding: "2px 7px", fontSize: 11, cursor: "pointer", color: c.reembolsado ? C.sage : C.brick, marginTop: 3 }}
                              >
                                {c.reembolsado ? "reembolsado · marcar pendiente" : "pendiente · marcar reembolsado"}
                              </button>
                            )}
                          </div>
                          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{clp(c.costoTotal)}</div>
                            <button aria-label="Eliminar compra" onClick={() => eliminarCompra(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick, marginTop: 2 }}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                      <Btn variant="ghost" onClick={() => setEditDoc(g.compras)}><Pencil size={13} /> Editar documento</Btn>
                      <Btn variant="ghost" onClick={() => setDocModal(primera.id)} style={{ color: conFoto ? C.sage : undefined }}>{conFoto ? "Ver documento" : "Adjuntar foto"}</Btn>
                      <Btn variant="ghost" onClick={() => eliminarDocumento(g.compras.map((c) => c.id))} style={{ color: C.brick }}><Trash2 size={13} /> Eliminar todo</Btn>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {data.ingredientes.length > 0 && (
        <Card style={{ padding: 14, marginTop: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Costo promedio actual por insumo</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.ingredientes.map((ing) => (
              <div key={ing.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <span>{ing.nombre} <span style={{ color: C.inkSoft }}>· {ing.unidad}</span></span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.inkSoft }}>{costeo.costoBaseIngrediente[ing.id] ? `${clpU(costeo.costoBaseIngrediente[ing.id])} / ${baseUnidadDe(ing.unidad)}` : "sin compras aún"}</span>
                  <button aria-label={`Editar ${ing.nombre}`} onClick={() => setModalIng(ing)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}><Pencil size={13} /></button>
                  <button aria-label={`Eliminar ${ing.nombre}`} onClick={() => eliminarIngrediente(ing.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {docModal && <DocumentoModal compra={data.compras.find((c) => c.id === docModal)} compras={data.compras} onClose={() => setDocModal(null)} onSave={asignarFoto} />}
      {editDoc && <CompraModal data={data} session={session} doc={editDoc} onClose={() => setEditDoc(null)} onSave={async (c) => { await guardarDocumento(c); setEditDoc(null); setAbiertos((p) => new Set(p)); }} onNuevoIngrediente={() => setModalIng({})} />}
      {modal && <CompraModal data={data} session={session} onClose={() => setModal(null)} onSave={async (c, opts) => { await guardarCompra(c); if (!opts?.seguir) setModal(null); }} onNuevoIngrediente={() => setModalIng({})} />}
      {modalIng && <IngredienteModal insumo={modalIng} data={data} onClose={() => setModalIng(null)} onSave={async (i, opts) => { await guardarIngrediente(i); if (!opts?.seguir) setModalIng(null); }} />}
    </div>
  );
}
function IngredienteModal({ insumo, data, onClose, onSave }) {
  const editando = !!(insumo && insumo.id);
  const [f, setF] = useState(editando ? { id: insumo.id, nombre: insumo.nombre, unidad: insumo.unidad } : { nombre: "", unidad: "g" });
  const [ultimo, setUltimo] = useState("");
  // Si el insumo ya se usa, la unidad solo puede cambiar dentro de su familia (g<->kg, ml<->l, m<->cm).
  const enUso = editando && !!data && (
    data.compras.some((c) => c.ingredienteId === insumo.id) ||
    data.recetasBase.some((r) => r.ingredientes.some((x) => x.ingredienteId === insumo.id)) ||
    data.producciones.some((p) => (p.ingredientesUsados || []).some((x) => x.ingredienteId === insumo.id)) ||
    data.productos.some((p) => (p.componentes || []).some((c) => c.tipo === "ingrediente" && c.refId === insumo.id))
  );
  const unidadesOpcion = enUso ? UNIDADES.filter((u) => FAMILIA[u] === FAMILIA[insumo.unidad]) : UNIDADES;
  const v = useValidacion(VAL.validarIngrediente(f));
  const guardar = (seguir) => v.enviar(async () => {
    await onSave(f, { seguir });
    if (seguir) {
      setUltimo(f.nombre.trim());
      setF({ nombre: "", unidad: f.unidad }); // la unidad se conserva para el siguiente
      v.reiniciar();
      setTimeout(() => document.getElementById("nuevo-insumo-nombre")?.focus(), 0);
    }
  });
  return (
    <Modal title={editando ? "Editar insumo" : "Nuevo insumo"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ultimo && <div role="status" style={{ fontSize: 13, color: C.sage, fontWeight: 600 }}><Check size={14} style={{ verticalAlign: "-2px" }} /> Guardado: {ultimo}. Agrega otro cuando quieras.</div>}
        <Field label="Nombre" v={v} campo="nombre"><Input id="nuevo-insumo-nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus maxLength={80} /></Field>
        <Field label="Unidad en que lo compras/usas" v={v} campo="unidad">
          <Select value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })}>{unidadesOpcion.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
        </Field>
        <ErrorForm v={v} />
        {editando ? (
          <Btn disabled={v.enviando} onClick={() => guardar(false)} style={{ justifyContent: "center", marginTop: 6 }}>Guardar cambios</Btn>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <Btn variant="ghost" disabled={v.enviando} onClick={() => guardar(true)} style={{ flex: 1, justifyContent: "center" }}>Guardar y agregar otro</Btn>
            <Btn disabled={v.enviando} onClick={() => guardar(false)} style={{ flex: 1, justifyContent: "center" }}>Guardar y cerrar</Btn>
          </div>
        )}
      </div>
    </Modal>
  );
}
function CompraModal({ data, session, doc, onClose, onSave, onNuevoIngrediente }) {
  const editando = !!doc;
  const primerIng = data.ingredientes[0];
  const itemVacio = (ing) => ({ ingredienteId: ing?.id || "", marca: "", cantidad: "", unidad: ing?.unidad || "g", costoTotal: "", porUnidades: false, unidades: "", contenidoPorUnidad: "" });
  const [f, setF] = useState(editando ? {
    fecha: doc[0].fecha, fechaPago: doc[0].fechaPago || "", tipoDocumento: doc[0].tipoDocumento, numero: doc[0].numero || "", cuenta: doc[0].cuenta || "empresa",
    items: doc.map((c) => ({ id: c.id, ingredienteId: c.ingredienteId, marca: c.marca || "", cantidad: String(c.cantidad), unidad: c.unidad, costoTotal: String(c.costoTotal), porUnidades: false, unidades: "", contenidoPorUnidad: "" })),
  } : {
    fecha: hoy(), fechaPago: "", tipoDocumento: "Boleta", numero: "", cuenta: "empresa",
    items: primerIng ? [itemVacio(primerIng)] : [],
  });
  const nombreUsuario = session?.nombre || session?.email || "";
  const [foto, setFoto] = useState(null); // data URL ya reducida
  const [errFoto, setErrFoto] = useState("");
  const elegirFoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErrFoto("");
    try { setFoto(await comprimirImagen(file)); } catch (er) { setErrFoto(er.message); }
  };
  // Sube la foto (si hay) y devuelve los datos de la compra con su id.
  const conFoto = async () => ({ ...payload, fotoId: foto ? await subirFoto(foto) : null });

  const addItem = () => { if (!primerIng) return; setF({ ...f, items: [...f.items, itemVacio(primerIng)] }); };
  const setItem = (idx, patch) => { const arr = [...f.items]; arr[idx] = { ...arr[idx], ...patch }; setF({ ...f, items: arr }); };
  const delItem = (idx) => setF({ ...f, items: f.items.filter((_, i) => i !== idx) });

  // Cantidad final de cada ítem: directa, o calculada (unidades × contenido por unidad).
  const cantidadFinal = (it) => (it.porUnidades ? parseNum(it.unidades) * parseNum(it.contenidoPorUnidad) : parseNum(it.cantidad));

  const payload = {
    fecha: f.fecha, fechaPago: f.fechaPago || null, tipoDocumento: f.tipoDocumento, numero: f.numero,
    cuenta: f.cuenta, registradoPor: f.cuenta === "personal" ? (editando && doc[0].registradoPor) || nombreUsuario : null,
    ...(editando ? { ids: doc.map((c) => c.id) } : {}),
    items: f.items.map((it) => ({ id: it.id, ingredienteId: it.ingredienteId, marca: it.marca || null, unidad: it.unidad, cantidad: cantidadFinal(it), costoTotal: parseNum(it.costoTotal) })),
  };
  const v = useValidacion(VAL.validarCompra(payload));

  return (
    <Modal title={editando ? `Editar documento · ${doc[0].tipoDocumento}${doc[0].numero ? ` #${doc[0].numero}` : ""}` : "Registrar compra"} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Fecha" v={v} campo="fecha"><Input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
          <Field label="Tipo de documento" v={v} campo="tipoDocumento"><Select value={f.tipoDocumento} onChange={(e) => setF({ ...f, tipoDocumento: e.target.value })}>{TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        </div>
        <Field label="Fecha de pago (solo si pagaste otro día)" v={v} campo="fechaPago"><Input type="date" value={f.fechaPago || ""} onChange={(e) => setF({ ...f, fechaPago: e.target.value })} /></Field>
        <Field label="N° de documento (opcional)" v={v} campo="numero"><Input value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} maxLength={40} /></Field>
        <Field label="¿Con qué dinero se pagó?" v={v} campo="cuenta">
          <Select value={f.cuenta} onChange={(e) => setF({ ...f, cuenta: e.target.value })}>
            <option value="empresa">Cuenta de la empresa</option>
            <option value="personal">Cuenta personal (a reembolsar)</option>
          </Select>
        </Field>

        {!editando && <Field label="Foto de la boleta o factura (opcional)">
          {foto ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <img src={foto} alt="Vista previa del documento" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} />
              <Btn variant="ghost" onClick={() => setFoto(null)}>Quitar foto</Btn>
            </div>
          ) : (
            <input type="file" accept="image/*" onChange={elegirFoto} aria-label="Foto de la boleta o factura" style={{ fontSize: 13 }} />
          )}
          {errFoto && <div style={{ color: C.brick, fontSize: 12, marginTop: 4 }}>{errFoto}</div>}
        </Field>}

        {data.ingredientes.length === 0 ? (
          <div style={{ fontSize: 13, color: C.inkSoft }}>No tienes insumos creados. <button onClick={onNuevoIngrediente} style={{ color: C.caramel, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Crea uno primero</button>.</div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Insumos comprados en este documento</div>
            <Err v={v} campo="items" />
            {f.items.map((it, idx) => {
              const ing = data.ingredientes.find((i) => i.id === it.ingredienteId);
              const unidadesPosibles = ing ? UNIDADES.filter((u) => FAMILIA[u] === FAMILIA[ing.unidad]) : UNIDADES;
              const kCant = `items.${idx}.cantidad`;
              const kCosto = `items.${idx}.costoTotal`;
              return (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, border: `1px solid ${C.line}`, borderRadius: 8 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <Field label="Insumo" v={v} campo={`items.${idx}.ingredienteId`}>
                        <Select value={it.ingredienteId} onChange={(e) => { const ni = data.ingredientes.find((i) => i.id === e.target.value); setItem(idx, { ingredienteId: e.target.value, unidad: ni?.unidad }); }}>
                          {data.ingredientes.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                        </Select>
                      </Field>
                    </div>
                    {f.items.length > 1 && <button aria-label="Quitar insumo" onClick={() => delItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick, paddingBottom: 8 }}><Trash2 size={16} /></button>}
                  </div>
                  <Field label="Marca (opcional)" v={v} campo={`items.${idx}.marca`}><Input value={it.marca || ""} onChange={(e) => setItem(idx, { marca: e.target.value })} maxLength={60} placeholder="" /></Field>

                  <button
                    onClick={() => setItem(idx, { porUnidades: !it.porUnidades })}
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.caramel, fontSize: 12, fontWeight: 600, textAlign: "left", padding: 0 }}
                  >
                    {it.porUnidades ? "← ingresar la cantidad total directamente" : "calcular cantidad a partir de N° de unidades →"}
                  </button>

                  {it.porUnidades ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 6, alignItems: "start" }}>
                      <div style={{ minWidth: 0 }}><Field label="N° de unidades" v={v} campo={kCant}><NumInput value={it.unidades} onChange={(e) => setItem(idx, { unidades: e.target.value })} /></Field></div>
                      <span style={{ color: C.inkSoft, fontSize: 13, paddingTop: 28 }}>×</span>
                      <div style={{ minWidth: 0 }}><Field label="Contenido de cada una"><NumInput value={it.contenidoPorUnidad} onChange={(e) => setItem(idx, { contenidoPorUnidad: e.target.value })} {...v.p(kCant)} /></Field></div>
                      <div style={{ gridColumn: "1 / -1", minWidth: 0 }}><Field label="Unidad del contenido" v={v} campo={`items.${idx}.unidad`}><Select value={it.unidad} onChange={(e) => setItem(idx, { unidad: e.target.value })}>{unidadesPosibles.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field></div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}><Field label="Cantidad total" v={v} campo={kCant}><NumInput value={it.cantidad} onChange={(e) => setItem(idx, { cantidad: e.target.value })} /></Field></div>
                      <div style={{ flex: 1, minWidth: 0 }}><Field label="Unidad" v={v} campo={`items.${idx}.unidad`}><Select value={it.unidad} onChange={(e) => setItem(idx, { unidad: e.target.value })}>{unidadesPosibles.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field></div>
                    </div>
                  )}

                  {it.porUnidades && cantidadFinal(it) > 0 && <div style={{ fontSize: 12, color: C.inkSoft }}>= {fmtNum(cantidadFinal(it), 4)} {it.unidad} en total</div>}

                  <Field label="Costo total pagado por este insumo" v={v} campo={kCosto}><NumInput value={it.costoTotal} onChange={(e) => setItem(idx, { costoTotal: e.target.value })} /></Field>
                  {cantidadFinal(it) > 0 && parseNum(it.costoTotal) > 0 && <div style={{ fontSize: 12, color: C.inkSoft }}>Costo unitario: {clpU(parseNum(it.costoTotal) / cantidadFinal(it))} / {it.unidad}</div>}
                </div>
              );
            })}
            <Btn variant="ghost" onClick={addItem}><Plus size={14} /> Agregar otro insumo a este documento</Btn>
          </>
        )}

        <ErrorForm v={v} />
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {editando ? <Btn disabled={v.enviando} onClick={() => v.enviar(() => onSave(payload))} style={{ flex: 1, justifyContent: "center" }}>Guardar cambios</Btn> : <>
          <Btn variant="ghost" disabled={v.enviando} onClick={() => v.enviar(async () => {
            await onSave(await conFoto(), { seguir: true });
            // Conserva fecha, tipo de documento y cuenta; limpia documento, foto e insumos para la siguiente compra.
            setF({ ...f, numero: "", items: primerIng ? [itemVacio(primerIng)] : [] });
            setFoto(null);
            v.reiniciar();
          })} style={{ flex: 1, justifyContent: "center" }}>Guardar y agregar otra</Btn>
          <Btn disabled={v.enviando} onClick={() => v.enviar(async () => onSave(await conFoto()))} style={{ flex: 1, justifyContent: "center" }}>Guardar compra</Btn></>}
        </div>
      </div>
    </Modal>
  );
}
/* Ver, cambiar o quitar la foto de la boleta o factura de una compra. */
function DocumentoModal({ compra, compras, onClose, onSave }) {
  const [nueva, setNueva] = useState(null);
  const [aplicar, setAplicar] = useState(true);
  const [err, setErr] = useState("");
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(false);
  if (!compra) return null;
  const hermanas = compra.numero ? compras.filter((x) => x.id !== compra.id && x.fecha === compra.fecha && x.tipoDocumento === compra.tipoDocumento && x.numero === compra.numero).length : 0;
  const elegir = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    try { setNueva(await comprimirImagen(file)); } catch (er) { setErr(er.message); }
  };
  const guardar = async (fotoId) => {
    setCargando(true); setErr("");
    try { await onSave(compra.id, fotoId, aplicar && hermanas > 0); onClose(); } catch (er) { setErr(er.message); } finally { setCargando(false); }
  };
  const subirYGuardar = async () => {
    setCargando(true); setErr("");
    try { const id = await subirFoto(nueva); await onSave(compra.id, id, aplicar && hermanas > 0); onClose(); } catch (er) { setErr(er.message); } finally { setCargando(false); }
  };
  return (
    <Modal title={`Documento · ${compra.tipoDocumento}${compra.numero ? ` #${compra.numero}` : ""}`} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {compra.fotoId && !nueva && (
          fallo ? <div style={{ fontSize: 13, color: C.brick }}>No se pudo cargar la foto.</div> : (
            <a href={`/api/fotos?id=${encodeURIComponent(compra.fotoId)}`} target="_blank" rel="noreferrer">
              <img src={`/api/fotos?id=${encodeURIComponent(compra.fotoId)}`} alt="Boleta o factura" onError={() => setFallo(true)} style={{ width: "100%", maxHeight: "60vh", objectFit: "contain", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff" }} />
            </a>
          )
        )}
        {nueva && <img src={nueva} alt="Vista previa de la nueva foto" style={{ width: "100%", maxHeight: "60vh", objectFit: "contain", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff" }} />}
        {!compra.fotoId && !nueva && <div style={{ fontSize: 13, color: C.inkSoft }}>Esta compra aún no tiene foto del documento.</div>}
        {!nueva && <input type="file" accept="image/*" onChange={elegir} aria-label="Elegir foto del documento" style={{ fontSize: 13 }} />}
        {hermanas > 0 && (
          <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={aplicar} onChange={(e) => setAplicar(e.target.checked)} />
            Aplicar también a las otras {hermanas} compra(s) de este mismo documento
          </label>
        )}
        {err && <div style={{ color: C.brick, fontSize: 13 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          {nueva && <Btn disabled={cargando} onClick={subirYGuardar} style={{ flex: 1, justifyContent: "center" }}>Guardar foto</Btn>}
          {nueva && <Btn variant="ghost" disabled={cargando} onClick={() => setNueva(null)}>Cancelar</Btn>}
          {compra.fotoId && !nueva && <Btn variant="ghost" disabled={cargando} onClick={() => guardar(null)} style={{ color: C.brick }}>Quitar foto</Btn>}
          {!nueva && <Btn variant="ghost" onClick={onClose} style={{ flex: 1, justifyContent: "center" }}>Cerrar</Btn>}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- AJUSTE DE INVENTARIO ---------------- */
const CATEGORIAS_AJUSTE = ["Merma", "Daño", "Conteo físico", "Otro"];

function AjusteModal({ tipo, refId, nombre, unidadBase, lote, stockActual, onClose, onSave }) {
  const tienePesoEnvase = tipo === "lote" && lote?.pesoEnvase != null;
  const [f, setF] = useState({ fecha: hoy(), categoria: "Conteo físico", signo: "restar", cantidad: "", nota: "", modoEnvase: tienePesoEnvase, pesoTotalPesado: "" });
  const enModoEnvase = f.modoEnvase && tienePesoEnvase;

  const pesoNeto = tienePesoEnvase ? parseNum(f.pesoTotalPesado) - Number(lote.pesoEnvase) : null;
  const diferencia = pesoNeto != null ? pesoNeto - (stockActual || 0) : null;
  const cantidadFinal = enModoEnvase ? diferencia : (f.signo === "restar" ? -1 : 1) * parseNum(f.cantidad);

  const payload = { tipo, refId, fecha: f.fecha, unidad: unidadBase, categoria: f.categoria, nota: f.nota, cantidad: cantidadFinal };
  const errores = VAL.validarAjuste(payload);
  delete errores.cantidad;
  if (enModoEnvase) {
    if (!(parseNum(f.pesoTotalPesado) > 0)) errores.pesoTotalPesado = "Escribe el peso total pesado.";
    else if (pesoNeto <= 0) errores.pesoTotalPesado = "El peso total debe ser mayor que el del envase vacío.";
    else if (Math.abs(diferencia) < 0.0001) errores.pesoTotalPesado = "El peso coincide con el stock del sistema: no hay nada que ajustar.";
  } else if (!(parseNum(f.cantidad) > 0)) errores.cantidad = "La cantidad debe ser mayor que 0.";
  else if (parseNum(f.cantidad) > 1000000000) errores.cantidad = "La cantidad es demasiado grande.";
  const v = useValidacion(errores);

  return (
    <Modal title={`Ajustar stock — ${nombre}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Fecha" v={v} campo="fecha"><Input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
        <Field label="Categoría" v={v} campo="categoria"><Select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>{CATEGORIAS_AJUSTE.map((c) => <option key={c}>{c}</option>)}</Select></Field>

        {tienePesoEnvase && (
          <button onClick={() => setF({ ...f, modoEnvase: !f.modoEnvase })} style={{ background: "none", border: "none", cursor: "pointer", color: C.caramel, fontSize: 12, fontWeight: 600, textAlign: "left", padding: 0 }}>
            {f.modoEnvase ? "← ingresar la cantidad directamente" : "calcular pesando el envase con contenido →"}
          </button>
        )}

        {enModoEnvase ? (
          <>
            <Field label={`Peso total pesado (envase + contenido, en ${unidadBase})`} v={v} campo="pesoTotalPesado"><NumInput value={f.pesoTotalPesado} onChange={(e) => setF({ ...f, pesoTotalPesado: e.target.value })} /></Field>
            <div style={{ fontSize: 12, color: C.inkSoft }}>Peso del envase: {fmtNum(lote.pesoEnvase)} {unidadBase} · Peso neto: {fmtNum(pesoNeto || 0)} {unidadBase}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: diferencia < 0 ? C.brick : C.sage }}>
              {diferencia < 0 ? "Restar" : "Sumar"} {fmtNum(Math.abs(diferencia || 0))} {unidadBase} (sistema decía {fmtNum(stockActual || 0)} {unidadBase})
            </div>
          </>
        ) : (
          <>
            <Field label="¿Qué pasó?">
              <Select value={f.signo} onChange={(e) => setF({ ...f, signo: e.target.value })}>
                <option value="restar">Hay menos de lo que dice el sistema (restar)</option>
                <option value="sumar">Hay más de lo que dice el sistema (sumar)</option>
              </Select>
            </Field>
            <Field label={`Cantidad (${unidadBase})`} v={v} campo="cantidad"><NumInput value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} /></Field>
          </>
        )}

        <Field label="Nota (opcional)" v={v} campo="nota"><Input value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} maxLength={200} /></Field>
        <ErrorForm v={v} />
        <Btn disabled={v.enviando} onClick={() => v.enviar(() => onSave({ ...payload, cantidad: cantidadFinal }))} style={{ justifyContent: "center", marginTop: 6 }}>Guardar ajuste</Btn>
      </div>
    </Modal>
  );
}
/* ---------------- STOCK: existencias y movimientos ---------------- */
// Reconstruye, con los datos ya registrados, cada entrada y salida de un insumo o de un lote.
// Cantidades en unidad base (g, ml, unidad): positivo = entra, negativo = sale.
function construirMovimientos(data, tipo, refId) {
  const movs = [];
  const nombreProducto = (id) => data.productos.find((p) => p.id === id)?.nombre || "producto eliminado";
  const nombreCliente = (id) => data.clientes.find((c) => c.id === id)?.nombre;
  const nombreReceta = (id) => data.recetasBase.find((r) => r.id === id)?.nombre || "receta base";

  const agregarVentas = (tipoConsumo) => {
    data.ventas.forEach((v) => v.items.forEach((it) => (it.consumos || []).filter((c) => c.tipo === tipoConsumo && c.refId === refId).forEach((c) => {
      movs.push({
        id: `v${c.id}`, fecha: v.fecha, rango: 3, clase: "venta",
        titulo: `Venta final: ${fmtNum(it.cantidad)}× ${nombreProducto(it.productoId)}`,
        detalle: nombreCliente(v.clienteId) || "sin cliente", cantidad: -toBase(c.cantidad, c.unidad),
      });
    })));
  };

  if (tipo === "ingrediente") {
    data.compras.filter((c) => c.ingredienteId === refId).forEach((c) => {
      movs.push({
        id: `c${c.id}`, fecha: c.fecha, rango: 0, clase: "compra",
        titulo: `Compra${c.tipoDocumento ? ` · ${c.tipoDocumento}${c.numero ? ` ${c.numero}` : ""}` : ""}`,
        detalle: `${fmtNum(c.cantidad)} ${c.unidad} por ${clp(c.costoTotal)}`, cantidad: toBase(c.cantidad, c.unidad),
      });
    });
    data.producciones.forEach((pr) => (pr.ingredientesUsados || []).filter((i) => i.ingredienteId === refId && Number(i.cantidad) > 0).forEach((i, k) => {
      movs.push({
        id: `u${pr.id}-${k}`, fecha: pr.fecha, rango: 2, clase: "lote",
        titulo: `Se usó en el lote ${pr.codigo || pr.fecha} de ${nombreReceta(pr.recetaBaseId)}`,
        detalle: `rindió ${fmtNum(pr.rendimientoReal)} ${pr.unidadRendimiento}`, cantidad: -toBase(i.cantidad, i.unidad),
      });
    }));
    agregarVentas("ingrediente");
  } else {
    const pr = data.producciones.find((p) => p.id === refId);
    if (pr) {
      movs.push({
        id: `p${pr.id}`, fecha: pr.fecha, rango: 0, clase: "produccion",
        titulo: `Lote ${pr.codigo || pr.fecha} de ${nombreReceta(pr.recetaBaseId)} producido`,
        detalle: `rindió ${fmtNum(pr.rendimientoReal)} ${pr.unidadRendimiento}`, cantidad: toBase(pr.rendimientoReal, pr.unidadRendimiento),
      });
    }
    agregarVentas("receta_base");
  }

  data.ajustesInventario.filter((a) => a.tipo === tipo && a.refId === refId).forEach((a) => {
    movs.push({ id: `a${a.id}`, ajusteId: a.id, fecha: a.fecha, rango: 4, clase: "ajuste", titulo: `Ajuste · ${a.categoria}`, detalle: a.nota || "", cantidad: toBase(a.cantidad, a.unidad) });
  });

  // Mismo día: primero lo que entra, después lo que sale; así el saldo no se ve negativo sin motivo.
  movs.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : x.rango - y.rango));
  let saldo = 0;
  movs.forEach((m) => { saldo += m.cantidad; m.saldo = saldo; });
  return movs;
}
function resumenMovimientos(movs) {
  const r = { entradas: 0, salidas: 0, saldo: 0, destinos: { lote: 0, venta: 0, ajuste: 0 } };
  movs.forEach((m) => {
    if (m.cantidad >= 0) r.entradas += m.cantidad;
    else { r.salidas += -m.cantidad; r.destinos[m.clase] += -m.cantidad; }
  });
  r.saldo = r.entradas - r.salidas;
  return r;
}

const ETIQUETA_MOV = {
  compra: { texto: "Compra", color: C.sage, fondo: C.sageBg },
  produccion: { texto: "Producción", color: C.sage, fondo: C.sageBg },
  lote: { texto: "Lote", color: C.caramelDark, fondo: C.chip },
  venta: { texto: "Venta", color: "#fff", fondo: C.caramel },
  ajuste: { texto: "Ajuste", color: C.inkSoft, fondo: C.chip },
};

function Stock({ data, stock, guardarAjuste, eliminarAjuste }) {
  const [vista, setVista] = useState("insumos");
  const [abierto, setAbierto] = useState(null); // { tipo: "ingrediente" | "lote", id }
  const [modalAjuste, setModalAjuste] = useState(null); // { tipo, item }

  const resumenes = useMemo(() => {
    const r = {};
    data.ingredientes.forEach((i) => { r[`ingrediente:${i.id}`] = resumenMovimientos(construirMovimientos(data, "ingrediente", i.id)); });
    data.producciones.forEach((p) => { r[`lote:${p.id}`] = resumenMovimientos(construirMovimientos(data, "lote", p.id)); });
    return r;
  }, [data]);

  const abrir = (tipo, id) => { setAbierto({ tipo, id }); if (typeof window !== "undefined") window.scrollTo({ top: 0 }); };
  const recetaDe = (lote) => data.recetasBase.find((r) => r.id === lote.recetaBaseId);
  const nombreLote = (lote) => `${recetaDe(lote)?.nombre || "Receta base"} — lote ${lote.codigo || lote.fecha}`;

  const modal = modalAjuste && (modalAjuste.tipo === "ingrediente" ? (
    <AjusteModal
      tipo="ingrediente" refId={modalAjuste.item.id} nombre={modalAjuste.item.nombre} unidadBase={baseUnidadDe(modalAjuste.item.unidad)}
      onClose={() => setModalAjuste(null)} onSave={async (a) => { await guardarAjuste(a); setModalAjuste(null); }}
    />
  ) : (
    <AjusteModal
      tipo="lote" refId={modalAjuste.item.id} nombre={nombreLote(modalAjuste.item)} unidadBase={baseUnidadDe(modalAjuste.item.unidadRendimiento)}
      lote={modalAjuste.item} stockActual={stock.stockLote(modalAjuste.item)}
      onClose={() => setModalAjuste(null)} onSave={async (a) => { await guardarAjuste(a); setModalAjuste(null); }}
    />
  ));

  // Detalle de un insumo o de un lote
  const itemAbierto = abierto && (abierto.tipo === "ingrediente" ? data.ingredientes.find((i) => i.id === abierto.id) : data.producciones.find((p) => p.id === abierto.id));
  if (abierto && itemAbierto) {
    const esInsumo = abierto.tipo === "ingrediente";
    return (
      <>
        <DetalleMovimientos
          data={data} tipo={abierto.tipo} refId={abierto.id}
          titulo={esInsumo ? itemAbierto.nombre : nombreLote(itemAbierto)}
          unidad={baseUnidadDe(esInsumo ? itemAbierto.unidad : itemAbierto.unidadRendimiento)}
          stockActual={esInsumo ? stock.stockIngrediente(itemAbierto.id) : stock.stockLote(itemAbierto)}
          onBack={() => setAbierto(null)} onAjustar={() => setModalAjuste({ tipo: abierto.tipo, item: itemAbierto })} eliminarAjuste={eliminarAjuste}
        />
        {modal}
      </>
    );
  }

  const fila = ({ clave, titulo, sub, tipo, item, unidad, stockActual }) => {
    const r = resumenes[`${tipo}:${item.id}`] || { entradas: 0, salidas: 0 };
    return (
      <Card key={clave} style={{ padding: 0, display: "flex", alignItems: "stretch" }}>
        <button onClick={() => abrir(tipo, item.id)} aria-label={`Ver movimientos de ${titulo}`} style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textAlign: "left", background: "none", border: "none", padding: 12, cursor: "pointer", font: "inherit", color: "inherit" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{titulo}</div>
            {sub && <div style={{ fontSize: 12, color: C.inkSoft }}>{sub}</div>}
            <div style={{ fontSize: 12, color: C.inkSoft }}>Entró {fmtNum(r.entradas)} {unidad} · salió {fmtNum(r.salidas)} {unidad}</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: stockActual < 0 ? C.brick : C.sage, flexShrink: 0 }}>{fmtNum(stockActual)} {unidad}</div>
        </button>
        <button onClick={() => setModalAjuste({ tipo, item })} aria-label={`Ajustar stock de ${titulo}`} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, padding: "0 14px" }}><Pencil size={15} /></button>
      </Card>
    );
  };

  const pestana = (id, texto) => (
    <button type="button" aria-pressed={vista === id} onClick={() => setVista(id)}
      style={{ flex: 1, padding: "8px 10px", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer", border: `1px solid ${vista === id ? C.caramel : C.line}`, background: vista === id ? C.chip : "#FFFDFA", color: vista === id ? C.caramelDark : C.inkSoft }}>
      {texto}
    </button>
  );

  const recetasConLotes = data.recetasBase.filter((r) => data.producciones.some((p) => p.recetaBaseId === r.id));

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{pestana("insumos", "Insumos")}{pestana("lotes", "Lotes")}</div>

      {vista === "insumos" ? (
        data.ingredientes.length === 0 ? (
          <EmptyState icon={Layers} title="Sin insumos aún" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.ingredientes.map((ing) => fila({ clave: ing.id, titulo: ing.nombre, tipo: "ingrediente", item: ing, unidad: baseUnidadDe(ing.unidad), stockActual: stock.stockIngrediente(ing.id) }))}
          </div>
        )
      ) : recetasConLotes.length === 0 ? (
        <EmptyState icon={FlaskConical} title="Sin lotes aún" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {recetasConLotes.map((r) => {
            const u = baseUnidadDe(r.unidadRendimiento);
            const lotes = data.producciones.filter((p) => p.recetaBaseId === r.id).sort((x, y) => (x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : 0));
            return (
              <div key={r.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <span>{r.nombre}</span><span style={{ color: C.inkSoft, fontWeight: 400 }}>en total: {fmtNum(stock.stockRecetaBase(r.id))} {u}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {lotes.map((l) => fila({ clave: l.id, titulo: `Lote ${l.codigo || l.fecha}`, sub: `${l.fecha} · rindió ${fmtNum(l.rendimientoReal)} ${l.unidadRendimiento}`, tipo: "lote", item: l, unidad: baseUnidadDe(l.unidadRendimiento), stockActual: stock.stockLote(l) }))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal}
    </div>
  );
}

function DetalleMovimientos({ data, tipo, refId, titulo, unidad, stockActual, onBack, onAjustar, eliminarAjuste }) {
  const [filtro, setFiltro] = useState("todo");
  const movs = useMemo(() => construirMovimientos(data, tipo, refId), [data, tipo, refId]);
  const r = useMemo(() => resumenMovimientos(movs), [movs]);
  const esInsumo = tipo === "ingrediente";

  const destinos = [
    esInsumo && { id: "lote", texto: "En lotes de producción", valor: r.destinos.lote },
    { id: "venta", texto: esInsumo ? "En ventas finales (uso directo)" : "En ventas finales", valor: r.destinos.venta },
    { id: "ajuste", texto: "En ajustes y mermas", valor: r.destinos.ajuste },
  ].filter((d) => d && d.valor > 0);

  const visibles = movs.filter((m) => (filtro === "entradas" ? m.cantidad >= 0 : filtro === "salidas" ? m.cantidad < 0 : true)).reverse();
  const nEntradas = movs.filter((m) => m.cantidad >= 0).length;
  const nSalidas = movs.length - nEntradas;

  const dato = (texto, valor, color, Icono) => (
    <Card style={{ padding: 10, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: C.inkSoft, display: "flex", alignItems: "center", gap: 3 }}>{Icono && <Icono size={12} />}{texto}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, marginTop: 2 }}>{fmtNum(valor)} <span style={{ fontSize: 12, fontWeight: 600 }}>{unidad}</span></div>
    </Card>
  );
  const chip = (id, texto, n) => (
    <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)}
      style={{ padding: "5px 11px", borderRadius: 14, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${filtro === id ? C.caramel : C.line}`, background: filtro === id ? C.chip : "#FFFDFA", color: filtro === id ? C.caramelDark : C.inkSoft }}>
      {texto} ({n})
    </button>
  );

  return (
    <div style={{ paddingTop: 8 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.inkSoft, fontSize: 13, cursor: "pointer", marginBottom: 10, padding: 0 }}>&larr; Stock</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600 }}>{titulo}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: stockActual < 0 ? C.brick : C.sage }}>Stock actual: {fmtNum(stockActual)} {unidad}</div>
        </div>
        <Btn variant="ghost" onClick={onAjustar} style={{ padding: "7px 12px" }}><Pencil size={14} /> Ajustar</Btn>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {dato("Entradas totales", r.entradas, C.sage, ArrowDown)}
        {dato("Salidas totales", r.salidas, C.caramelDark, ArrowUp)}
        {dato("Saldo", r.saldo, r.saldo < 0 ? C.brick : C.ink)}
      </div>

      <Card style={{ padding: 12, marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>¿A dónde fue?</div>
        {r.salidas <= 0 ? (
          <div style={{ fontSize: 13, color: C.inkSoft }}>Aún no ha salido nada de {esInsumo ? "este insumo" : "este lote"}.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {destinos.map((d) => (
              <div key={d.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                  <span>{d.texto}</span><span style={{ color: C.inkSoft }}>{fmtNum(d.valor)} {unidad} · {fmtNum((d.valor / r.salidas) * 100, 0)}%</span>
                </div>
                <div style={{ background: C.chip, borderRadius: 6, height: 7 }}><div style={{ width: `${(d.valor / r.salidas) * 100}%`, background: C.caramel, height: 7, borderRadius: 6 }} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        {chip("todo", "Todo", movs.length)}{chip("entradas", "Entradas", nEntradas)}{chip("salidas", "Salidas", nSalidas)}
      </div>
      {visibles.length === 0 ? (
        <div style={{ fontSize: 13, color: C.inkSoft, padding: "20px 0", textAlign: "center" }}>Sin movimientos para mostrar.</div>
      ) : (
        <div>
          {visibles.map((m) => {
            const et = ETIQUETA_MOV[m.clase];
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 9, color: et.color, background: et.fondo }}>{et.texto}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{m.titulo}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{m.fecha}{m.detalle ? ` · ${m.detalle}` : ""}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: m.cantidad >= 0 ? C.sage : C.caramelDark }}>{m.cantidad >= 0 ? "+" : "−"}{fmtNum(Math.abs(m.cantidad))} {unidad}</div>
                  <div style={{ fontSize: 11.5, color: m.saldo < 0 ? C.brick : C.inkSoft }}>saldo {fmtNum(m.saldo)} {unidad}</div>
                  {m.ajusteId && eliminarAjuste && (
                    <button aria-label="Eliminar ajuste" onClick={async () => { if (await confirmar("¿Eliminar este ajuste? El stock volverá a como estaba antes de registrarlo.")) eliminarAjuste(m.ajusteId); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick, padding: 0, marginTop: 2 }}><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- RECETAS BASE + PRODUCCIÓN ---------------- */
function RecetasBase({ data, costeo, stock, guardarRecetaBase, eliminarRecetaBase, guardarProduccion, eliminarProduccion, guardarAjuste }) {
  const [modal, setModal] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const recetaActual = detalle ? data.recetasBase.find((r) => r.id === detalle) : null;

  if (recetaActual) {
    return <DetalleRecetaBase receta={recetaActual} data={data} costeo={costeo} stock={stock} guardarRecetaBase={guardarRecetaBase} guardarProduccion={guardarProduccion} eliminarProduccion={eliminarProduccion} guardarAjuste={guardarAjuste} onBack={() => setDetalle(null)} />;
  }

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Btn onClick={() => setModal({})}><Plus size={15} /> Nueva receta base</Btn>
      </div>
      {data.recetasBase.length === 0 ? (
        <EmptyState icon={FlaskConical} title="Sin recetas base" action={<Btn onClick={() => setModal({})}>Crear receta base</Btn>} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.recetasBase.map((r) => {
            const cpu = costeo.costoPorUnidadRecetaBase[r.id];
            const s = stock.stockRecetaBase(r.id);
            return (
              <Card key={r.id} style={{ padding: 12, cursor: "pointer" }} onClick={() => setDetalle(r.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.nombre}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>{r.ingredientes.length} insumo(s) · {data.producciones.filter((p) => p.recetaBaseId === r.id).length} lote(s) · stock {fmtNum(s)} {baseUnidadDe(r.unidadRendimiento)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: cpu != null ? C.sage : C.inkSoft }}>{cpu != null ? `${clpU(cpu)}/${baseUnidadDe(r.unidadRendimiento)}` : "sin lotes aún"}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); eliminarRecetaBase(r.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={15} /></button>
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
  const payload = { ...f, ingredientes: f.ingredientes.map((i) => ({ ...i, cantidad: parseNum(i.cantidad) })) };
  const v = useValidacion(VAL.validarRecetaBase(payload));

  return (
    <Modal title={receta.id ? "Editar receta base" : "Nueva receta base"} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Nombre" v={v} campo="nombre"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus maxLength={80} /></Field>
        <Field label="Unidad en que mides el rendimiento final" v={v} campo="unidadRendimiento">
          <Select value={f.unidadRendimiento} onChange={(e) => setF({ ...f, unidadRendimiento: e.target.value })}>{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
        </Field>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Ingredientes (cantidades de referencia)</div>
        {data.ingredientes.length === 0 && <div style={{ fontSize: 12, color: C.inkSoft }}>Crea insumos primero en la pestaña Compras.</div>}
        {f.ingredientes.length > 0 && (
          <div style={{ display: "flex", gap: 6, fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>
            <span style={{ flex: 2 }}>Insumo</span><span style={{ flex: 1 }}>Cantidad</span><span style={{ flex: 1 }}>Unidad</span><span style={{ width: 22 }} />
          </div>
        )}
        {f.ingredientes.map((it, idx) => {
          const ing = data.ingredientes.find((i) => i.id === it.ingredienteId);
          const unidadesPosibles = ing ? UNIDADES.filter((u) => FAMILIA[u] === FAMILIA[ing.unidad]) : UNIDADES;
          const k = (c) => `ingredientes.${idx}.${c}`;
          return (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Select aria-label="Insumo" value={it.ingredienteId} onChange={(e) => { const ni = data.ingredientes.find((i) => i.id === e.target.value); setIng(idx, { ingredienteId: e.target.value, unidad: ni?.unidad }); }} style={{ flex: 2 }} {...v.p(k("ingredienteId"))}>
                  {data.ingredientes.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                </Select>
                <NumInput aria-label="Cantidad" value={it.cantidad} onChange={(e) => setIng(idx, { cantidad: e.target.value })} style={{ flex: 1, width: 0 }} {...v.p(k("cantidad"))} />
                <Select aria-label="Unidad" value={it.unidad} onChange={(e) => setIng(idx, { unidad: e.target.value })} style={{ flex: 1 }} {...v.p(k("unidad"))}>{unidadesPosibles.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
                <button aria-label="Quitar insumo" onClick={() => delIng(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={16} /></button>
              </div>
              <ErrFila v={v} campos={[k("ingredienteId"), k("cantidad"), k("unidad")]} />
            </div>
          );
        })}
        <Err v={v} campo="ingredientes" />
        {data.ingredientes.length > 0 && <Btn variant="ghost" onClick={addIng}><Plus size={14} /> Agregar insumo</Btn>}
        <ErrorForm v={v} />
        <Btn disabled={v.enviando} onClick={() => v.enviar(() => onSave(payload))} style={{ justifyContent: "center", marginTop: 8 }}>Guardar receta base</Btn>
      </div>
    </Modal>
  );
}
function DetalleRecetaBase({ receta, data, costeo, stock, guardarRecetaBase, guardarProduccion, eliminarProduccion, guardarAjuste, onBack }) {
  const [modalLote, setModalLote] = useState(null);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalAjuste, setModalAjuste] = useState(null);
  const lotes = data.producciones.filter((p) => p.recetaBaseId === receta.id);
  const cpu = costeo.costoPorUnidadRecetaBase[receta.id];
  const stockTotal = stock.stockRecetaBase(receta.id);
  const u = baseUnidadDe(receta.unidadRendimiento);

  return (
    <div style={{ paddingTop: 8 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.inkSoft, fontSize: 13, cursor: "pointer", marginBottom: 10 }}>&larr; Recetas base</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, marginBottom: 4 }}>{receta.nombre}</div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>Costo por {u}: {cpu != null ? clpU(cpu) : "aún sin lotes registrados"}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: stockTotal < 0 ? C.brick : C.sage, marginBottom: 14 }}>Stock total: {fmtNum(stockTotal)} {u}</div>
        </div>
        <button onClick={() => setModalEditar(true)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
          <Pencil size={14} /> editar ingredientes
        </button>
      </div>
      <Btn onClick={() => setModalLote({})} style={{ marginBottom: 14 }}><Plus size={15} /> Registrar producción (lote)</Btn>
      {lotes.length === 0 ? (
        <EmptyState icon={FlaskConical} title="Sin lotes registrados" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lotes.map((l) => {
            const costoLote = costeo.costoLoteProduccion(l);
            const cpuLote = toBase(l.rendimientoReal, l.unidadRendimiento) > 0 ? costoLote / toBase(l.rendimientoReal, l.unidadRendimiento) : 0;
            const stockLote = stock.stockLote(l);
            return (
              <Card key={l.id} style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{l.codigo} <span style={{ fontWeight: 400, color: C.inkSoft }}>· {l.fecha}</span></div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>Rindió {fmtNum(l.rendimientoReal)} {l.unidadRendimiento} · costo lote {clp(costoLote)}</div>
                    <div style={{ fontSize: 12, color: C.sage }}>{clpU(cpuLote)} / {baseUnidadDe(l.unidadRendimiento)}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: stockLote < 0 ? C.brick : C.sage, marginTop: 2 }}>Stock: {fmtNum(stockLote)} {u}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <button onClick={() => eliminarProduccion(l.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={14} /></button>
                    <button onClick={() => setModalAjuste(l)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}><Pencil size={14} /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {modalLote && <LoteModal receta={receta} data={data} onClose={() => setModalLote(null)} onSave={async (l) => { await guardarProduccion({ ...l, recetaBaseId: receta.id }); setModalLote(null); }} />}
      {modalEditar && <RecetaBaseModal receta={receta} data={data} onClose={() => setModalEditar(false)} onSave={async (r) => { await guardarRecetaBase(r); setModalEditar(false); }} />}
      {modalAjuste && (
        <AjusteModal
          tipo="lote" refId={modalAjuste.id} nombre={`${receta.nombre} — lote ${modalAjuste.codigo || modalAjuste.fecha}`} unidadBase={u}
          lote={modalAjuste} stockActual={stock.stockLote(modalAjuste)}
          onClose={() => setModalAjuste(null)}
          onSave={async (a) => { await guardarAjuste(a); setModalAjuste(null); }}
        />
      )}
    </div>
  );
}
function LoteModal({ receta, data, onClose, onSave }) {
  const [f, setF] = useState({ fecha: hoy(), rendimientoReal: "", unidadRendimiento: receta.unidadRendimiento, ingredientesUsados: receta.ingredientes.map((i) => ({ ...i })), notas: "", pesoEnvase: "", codigo: "" });
  const setIng = (idx, patch) => { const arr = [...f.ingredientesUsados]; arr[idx] = { ...arr[idx], ...patch }; setF({ ...f, ingredientesUsados: arr }); };
  const unidadesPosibles = UNIDADES.filter((u) => FAMILIA[u] === FAMILIA[receta.unidadRendimiento]);
  const payload = { ...f, recetaBaseId: receta.id, rendimientoReal: parseNum(f.rendimientoReal), pesoEnvase: f.pesoEnvase === "" ? null : parseNum(f.pesoEnvase), ingredientesUsados: f.ingredientesUsados.map((i) => ({ ...i, cantidad: parseNum(i.cantidad) })) };
  const v = useValidacion(VAL.validarProduccion(payload));

  return (
    <Modal title={`Registrar lote — ${receta.nombre}`} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Fecha" v={v} campo="fecha"><Input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
          <Field label="Código (opcional)" v={v} campo="codigo"><Input value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} maxLength={20} /></Field>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Cantidades realmente usadas</div>
        {f.ingredientesUsados.map((it, idx) => {
          const ing = data.ingredientes.find((i) => i.id === it.ingredienteId);
          const k = `ingredientesUsados.${idx}.cantidad`;
          return (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <span style={{ flex: 2 }}>{ing?.nombre}</span>
                <NumInput aria-label={`Cantidad de ${ing?.nombre}`} value={it.cantidad} onChange={(e) => setIng(idx, { cantidad: e.target.value })} style={{ flex: 1, width: 0 }} {...v.p(k)} />
                <span style={{ width: 40, color: C.inkSoft }}>{it.unidad}</span>
              </div>
              <Err v={v} campo={k} />
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Rendimiento real obtenido" v={v} campo="rendimientoReal"><NumInput value={f.rendimientoReal} onChange={(e) => setF({ ...f, rendimientoReal: e.target.value })} /></Field>
          <Field label="Unidad" v={v} campo="unidadRendimiento"><Select value={f.unidadRendimiento} onChange={(e) => setF({ ...f, unidadRendimiento: e.target.value })}>{unidadesPosibles.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
        </div>
        <Field label="Peso del envase vacío (opcional)" v={v} campo="pesoEnvase">
          <NumInput value={f.pesoEnvase} onChange={(e) => setF({ ...f, pesoEnvase: e.target.value })} />
        </Field>
        <Field label="Notas (opcional)" v={v} campo="notas"><Input value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} maxLength={300} /></Field>
        <ErrorForm v={v} />
        <Btn disabled={v.enviando} onClick={() => v.enviar(() => onSave(payload))} style={{ justifyContent: "center", marginTop: 6 }}>Guardar lote</Btn>
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
        <EmptyState icon={Package} title="Sin productos" action={<Btn onClick={() => setModal({})}>Crear producto</Btn>} />
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
  const payload = { ...f, precioVenta: parseNum(f.precioVenta), componentes: f.componentes.map((c) => ({ ...c, cantidad: parseNum(c.cantidad) })) };
  const v = useValidacion(VAL.validarProducto(payload));

  return (
    <Modal title={producto.id ? "Editar producto" : "Nuevo producto"} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Nombre" v={v} campo="nombre"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus maxLength={100} /></Field>
        <Field label="Precio de venta" v={v} campo="precioVenta"><NumInput value={f.precioVenta} onChange={(e) => setF({ ...f, precioVenta: e.target.value })} /></Field>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Composición (para costear)</div>
        {opciones.length === 0 && <div style={{ fontSize: 12, color: C.inkSoft }}>Crea insumos o recetas base primero.</div>}
        {f.componentes.length > 0 && (
          <div style={{ display: "flex", gap: 6, fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>
            <span style={{ flex: 2 }}>Componente</span><span style={{ flex: 1 }}>Cantidad</span><span style={{ flex: 1 }}>Unidad</span><span style={{ width: 22 }} />
          </div>
        )}
        {f.componentes.map((c, idx) => {
          const opt = opciones.find((o) => o.refId === c.refId && o.tipo === c.tipo);
          const familiaUnidad = opt ? FAMILIA[opt.unidad] : null;
          const unidadesPosibles = familiaUnidad ? UNIDADES.filter((u) => FAMILIA[u] === familiaUnidad) : UNIDADES;
          const k = (x) => `componentes.${idx}.${x}`;
          return (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Select aria-label="Componente" value={`${c.tipo}:${c.refId}`} onChange={(e) => { const [tipo, refId] = e.target.value.split(":"); const o = opciones.find((x) => x.tipo === tipo && x.refId === refId); setComp(idx, { tipo, refId, unidad: o?.unidad }); }} style={{ flex: 2 }} {...v.p(k("refId"))}>
                  {opciones.map((o) => <option key={`${o.tipo}:${o.refId}`} value={`${o.tipo}:${o.refId}`}>{o.nombre}</option>)}
                </Select>
                <NumInput aria-label="Cantidad" value={c.cantidad} onChange={(e) => setComp(idx, { cantidad: e.target.value })} style={{ flex: 1, width: 0 }} {...v.p(k("cantidad"))} />
                <Select aria-label="Unidad" value={c.unidad} onChange={(e) => setComp(idx, { unidad: e.target.value })} style={{ flex: 1 }} {...v.p(k("unidad"))}>{unidadesPosibles.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
                <button aria-label="Quitar componente" onClick={() => delComp(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={16} /></button>
              </div>
              <ErrFila v={v} campos={[k("refId"), k("cantidad"), k("unidad")]} />
            </div>
          );
        })}
        <Err v={v} campo="componentes" />
        {opciones.length > 0 && <Btn variant="ghost" onClick={addComp}><Plus size={14} /> Agregar componente</Btn>}
        <ErrorForm v={v} />
        <Btn disabled={v.enviando} onClick={() => v.enviar(() => onSave(payload))} style={{ justifyContent: "center", marginTop: 8 }}>Guardar producto</Btn>
      </div>
    </Modal>
  );
}
/* ---------------- USUARIOS Y PERMISOS ---------------- */
const generarClave = () => {
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let clave;
  do {
    const bytes = new Uint32Array(10);
    crypto.getRandomValues(bytes);
    clave = Array.from(bytes, (n) => letras[n % letras.length]).join("");
  } while (VAL.validarClave(clave)); // siempre con mayúscula y número
  return clave;
};
const horaCorta = (ms) => new Date(ms).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

function Usuarios({ session }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // { tipo: "crear" } | { tipo: "editar", u } | { tipo: "clave", u }

  const cargar = useCallback(async () => {
    try { setInfo(await fetchUsuarios()); setError(""); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const hacer = async (fn) => {
    setError("");
    try { await fn(); await cargar(); } catch (e) { setError(e.message); }
  };

  if (!info) {
    return <div style={{ padding: "30px 0", display: "flex", gap: 8, alignItems: "center", color: C.inkSoft, justifyContent: "center" }}>{error ? <span style={{ color: C.brick }}>{error}</span> : <><Loader2 size={16} /> Cargando usuarios…</>}</div>;
  }
  const nombreSeccion = (id) => SECCIONES.find((x) => x.id === id)?.label || id;

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div />
        <Btn onClick={() => setModal({ tipo: "crear" })} style={{ flexShrink: 0 }}><Plus size={15} /> Nuevo usuario</Btn>
      </div>
      {error && <div style={{ background: C.brickBg, color: C.brick, padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{error}</div>}

      {info.recuperaciones.length > 0 && (
        <Card style={{ padding: 12, marginBottom: 12, background: "#FFF8EC", borderColor: "#E8CFAE" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><KeyRound size={15} color={C.caramelDark} /> Códigos de recuperación pendientes</div>
          {info.recuperaciones.map((r) => (
            <div key={r.email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderTop: `1px solid ${C.line}` }}>
              <span style={{ fontSize: 13 }}>{r.email} <span style={{ color: C.inkSoft, fontSize: 12 }}>· vence {horaCorta(r.expira)}</span></span>
              <b style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 18, letterSpacing: 2 }}>{r.codigo}</b>
            </div>
          ))}
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {info.usuarios.map((u) => {
          const yo = u.id === session.id || u.email === session.email;
          return (
            <Card key={u.id} style={{ padding: 12, opacity: u.activo ? 1 : 0.65 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {u.nombre || u.email}
                    {yo && <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft }}>(tú)</span>}
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 8px", borderRadius: 9, color: u.rol === "admin" ? "#fff" : C.caramelDark, background: u.rol === "admin" ? C.caramel : C.chip }}>{u.rol === "admin" ? "Administrador" : "Usuario"}</span>
                    {!u.activo && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 8px", borderRadius: 9, color: C.brick, background: C.brickBg }}>Desactivado</span>}
                    {u.bloqueado && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 8px", borderRadius: 9, color: C.brick, background: C.brickBg }}>Bloqueado hasta {horaCorta(u.bloqueadoHasta)}</span>}
                    {u.mustChange && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 8px", borderRadius: 9, color: C.caramelDark, background: "#FFF1D6" }}>Clave provisional</span>}
                  </div>
                  {u.nombre && <div style={{ fontSize: 12, color: C.inkSoft }}>{u.email}</div>}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                    {u.rol === "admin"
                      ? <span style={{ fontSize: 11.5, color: C.sage, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><ShieldCheck size={13} /> Acceso total</span>
                      : u.permisos.map((id) => <span key={id} style={{ fontSize: 11.5, padding: "2px 9px", borderRadius: 10, background: C.sageBg, color: C.sage, fontWeight: 600 }}>{nombreSeccion(id)}</span>)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  {u.bloqueado && <button aria-label={`Desbloquear a ${u.nombre || u.email}`} title="Desbloquear" onClick={() => hacer(() => actualizarUsuario({ id: u.id, accion: "desbloquear" }))} style={{ background: "none", border: "none", cursor: "pointer", color: C.caramel, padding: 6 }}><Unlock size={16} /></button>}
                  <button aria-label={`Restablecer contraseña de ${u.nombre || u.email}`} title="Restablecer contraseña" onClick={() => setModal({ tipo: "clave", u })} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, padding: 6 }}><KeyRound size={16} /></button>
                  <button aria-label={`Editar a ${u.nombre || u.email}`} title="Editar" onClick={() => setModal({ tipo: "editar", u })} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, padding: 6 }}><Pencil size={16} /></button>
                  {!yo && <button aria-label={`Eliminar a ${u.nombre || u.email}`} title="Eliminar" onClick={async () => { if (await confirmar(`¿Eliminar a ${u.nombre || u.email}? Esta acción no se puede deshacer.`)) hacer(() => eliminarUsuario(u.id)); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick, padding: 6 }}><Trash2 size={16} /></button>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {modal && (modal.tipo === "clave"
        ? <ClaveUsuarioModal u={modal.u} onClose={() => setModal(null)} onDone={cargar} />
        : <UsuarioModal usuario={modal.tipo === "editar" ? modal.u : null} esYo={modal.u && (modal.u.id === session.id || modal.u.email === session.email)} onClose={() => setModal(null)} onDone={cargar} />)}
    </div>
  );
}

function CasillaPermiso({ checked, onChange, disabled, children }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: `1px solid ${checked ? C.caramel : C.line}`, borderRadius: 8, background: checked ? C.chip : "#FFFDFA", fontSize: 13.5, fontWeight: 600, color: checked ? C.caramelDark : C.ink, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} style={{ accentColor: C.caramel, width: 16, height: 16 }} />
      {children}
    </label>
  );
}

function CampoClave({ value, onChange, label, v, campo }) {
  const msg = v && campo ? v.msg(campo) : null;
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, minWidth: 0 }} onBlur={v && campo ? () => v.tocar(campo) : undefined}>
      <span style={{ color: C.inkSoft, fontWeight: 600 }}>{label}</span>
      <div style={{ display: "flex", gap: 6 }}>
        <Input value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" invalid={!!msg} style={{ flex: 1, fontFamily: "ui-monospace, Menlo, monospace" }} />
        <Btn variant="ghost" onClick={() => onChange(generarClave())} style={{ padding: "8px 11px" }}><RefreshCw size={14} /> Generar</Btn>
      </div>
      {msg && <span role="alert" style={estiloMensaje}>{msg}</span>}
      <ul className="reglas-inline" aria-label="Requisitos de la contraseña">
        {VAL.reglasClave(value).map((r) => <li key={r.id} className={r.ok ? "ok" : msg ? "mal" : ""}>{r.ok ? "✓" : "•"} {r.texto}</li>)}
      </ul>
    </label>
  );
}
function Credenciales({ email, password, onClose, titulo }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Correo: ${email}\nContraseña provisional: ${password}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch (e) { /* sin portapapeles */ } };
  return (
    <Modal title={titulo} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card style={{ padding: 12, background: C.chip }}>
          <div style={{ fontSize: 12, color: C.inkSoft }}>Correo</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{email}</div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>Contraseña provisional</div>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{password}</div>
        </Card>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={copiar} style={{ flex: 1, justifyContent: "center" }}><Copy size={14} /> {copiado ? "Copiado" : "Copiar datos"}</Btn>
          <Btn onClick={onClose} style={{ flex: 1, justifyContent: "center" }}>Listo</Btn>
        </div>
      </div>
    </Modal>
  );
}

function UsuarioModal({ usuario, esYo, onClose, onDone }) {
  const editando = !!usuario;
  const [f, setF] = useState({
    nombre: usuario?.nombre || "", email: usuario?.email || "", password: editando ? "" : generarClave(),
    admin: usuario ? usuario.rol === "admin" : false, permisos: usuario?.permisos || [], activo: usuario ? usuario.activo : true,
  });
  const [creado, setCreado] = useState(null);

  const alternar = (id) => setF({ ...f, permisos: f.permisos.includes(id) ? f.permisos.filter((x) => x !== id) : [...f.permisos, id] });
  const v = useValidacion(VAL.validarUsuario({ nombre: f.nombre, email: f.email, password: f.password, rol: f.admin ? "admin" : "usuario", permisos: f.permisos }, { creando: !editando }));

  const guardar = () => v.enviar(async () => {
    if (editando) {
      await actualizarUsuario({ id: usuario.id, nombre: f.nombre, rol: f.admin ? "admin" : "usuario", permisos: f.permisos, activo: f.activo });
      await onDone();
      onClose();
    } else {
      await crearUsuario({ nombre: f.nombre, email: f.email.trim(), password: f.password, rol: f.admin ? "admin" : "usuario", permisos: f.permisos });
      await onDone();
      setCreado({ email: f.email.trim().toLowerCase(), password: f.password });
    }
  });

  if (creado) return <Credenciales titulo="Usuario creado" email={creado.email} password={creado.password} onClose={onClose} />;

  return (
    <Modal title={editando ? "Editar usuario" : "Nuevo usuario"} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
          <Field label="Nombre" v={v} campo="nombre"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus={!editando} maxLength={60} /></Field>
          <Field label="Correo" v={v} campo="email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} disabled={editando} autoComplete="off" maxLength={120} /></Field>
        </div>
        {!editando && <CampoClave label="Contraseña provisional" value={f.password} onChange={(x) => setF({ ...f, password: x })} v={v} campo="password" />}

        <CasillaPermiso checked={f.admin} disabled={esYo} onChange={() => setF({ ...f, admin: !f.admin })}>
          <ShieldCheck size={15} /> Administrador
        </CasillaPermiso>

        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Secciones que puede ver</span>
          {!f.admin && (
            <button type="button" onClick={() => setF({ ...f, permisos: f.permisos.length === SECCIONES.length ? [] : SECCIONES.map((x) => x.id) })} style={{ background: "none", border: "none", color: C.caramel, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {f.permisos.length === SECCIONES.length ? "Quitar todas" : "Marcar todas"}
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
          {SECCIONES.map((sec) => (
            <CasillaPermiso key={sec.id} checked={f.admin || f.permisos.includes(sec.id)} disabled={f.admin} onChange={() => alternar(sec.id)}>{sec.label}</CasillaPermiso>
          ))}
        </div>
        <Err v={v} campo="permisos" />

        {editando && !esYo && (
          <CasillaPermiso checked={f.activo} onChange={() => setF({ ...f, activo: !f.activo })}>Cuenta activa</CasillaPermiso>
        )}
        <ErrorForm v={v} />
        <Btn disabled={v.enviando} onClick={guardar} style={{ justifyContent: "center", marginTop: 4 }}>{v.enviando ? "Guardando…" : editando ? "Guardar cambios" : "Crear usuario"}</Btn>
      </div>
    </Modal>
  );
}
function ClaveUsuarioModal({ u, onClose, onDone }) {
  const [password, setPassword] = useState(generarClave());
  const [listo, setListo] = useState(false);
  const errorClave = VAL.validarClave(password, "La contraseña provisional");
  const v = useValidacion(errorClave ? { password: errorClave } : {});

  const guardar = () => v.enviar(async () => { await actualizarUsuario({ id: u.id, accion: "clave", password }); await onDone(); setListo(true); });
  if (listo) return <Credenciales titulo="Contraseña restablecida" email={u.email} password={password} onClose={onClose} />;
  return (
    <Modal title={`Restablecer contraseña — ${u.nombre || u.email}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <CampoClave label="Contraseña provisional nueva" value={password} onChange={setPassword} v={v} campo="password" />
        <ErrorForm v={v} />
        <Btn disabled={v.enviando} onClick={guardar} style={{ justifyContent: "center" }}>{v.enviando ? "Guardando…" : "Restablecer contraseña"}</Btn>
      </div>
    </Modal>
  );
}
/* ---------------- AUDITORÍA ---------------- */
const ACCION_AUD = {
  crear: { texto: "Creó", color: C.sage, fondo: C.sageBg },
  editar: { texto: "Editó", color: C.caramelDark, fondo: C.chip },
  eliminar: { texto: "Eliminó", color: C.brick, fondo: C.brickBg },
  ingreso: { texto: "Ingresó", color: C.inkSoft, fondo: C.chip },
  ingreso_fallido: { texto: "Intento fallido", color: C.brick, fondo: C.brickBg },
  cierre: { texto: "Cierre de acceso", color: C.brick, fondo: C.brickBg },
  bloqueo: { texto: "Bloqueo", color: C.brick, fondo: C.brickBg },
  desbloqueo: { texto: "Desbloqueo", color: C.sage, fondo: C.sageBg },
  clave_cambiada: { texto: "Cambió contraseña", color: C.caramelDark, fondo: C.chip },
  clave_recuperada: { texto: "Recuperó contraseña", color: C.caramelDark, fondo: C.chip },
  clave_restablecida: { texto: "Restableció contraseña", color: C.caramelDark, fondo: C.chip },
  recuperacion_pedida: { texto: "Pidió código", color: C.inkSoft, fondo: C.chip },
};
const ENTIDAD_AUD = { cliente: "Cliente", insumo: "Insumo", compra: "Compra", receta: "Receta base", lote: "Lote", producto: "Producto", venta: "Venta", pedido: "Pedido", ajuste: "Ajuste de stock", gasto: "Gasto operativo", caja: "Caja", usuario: "Usuario", acceso: "Acceso" };
const textoValor = (x) => (x == null || x === "" ? "—" : Array.isArray(x) ? (x.length ? x.join("; ") : "—") : String(x));

function CambiosAuditoria({ item }) {
  const antes = item.antes || {};
  const despues = item.despues || {};
  const base = item.accion === "eliminar" ? antes : item.accion === "crear" ? despues : null;
  const claves = base ? Object.keys(base) : [...new Set([...Object.keys(antes), ...Object.keys(despues)])].filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(despues[k]));
  if (claves.length === 0 && !item.detalle) return null;
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 6 }}>
      {item.detalle && <div style={{ fontSize: 12.5, color: C.inkSoft }}>{item.detalle}</div>}
      {claves.map((k) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 30%) 1fr", gap: 8, fontSize: 12.5 }}>
          <span style={{ color: C.inkSoft, fontWeight: 600 }}>{k}</span>
          {base ? (
            <span style={{ color: item.accion === "eliminar" ? C.brick : C.ink }}>{textoValor(base[k])}</span>
          ) : (
            <span><span style={{ color: C.brick, textDecoration: "line-through" }}>{textoValor(antes[k])}</span> <span style={{ color: C.inkSoft }}>→</span> <span style={{ color: C.sage, fontWeight: 600 }}>{textoValor(despues[k])}</span></span>
          )}
        </div>
      ))}
    </div>
  );
}

function Auditoria() {
  const [filtros, setFiltros] = useState({ desde: "", hasta: "", usuario: "", tipo: "", accion: "", q: "" });
  const [pagina, setPagina] = useState(0);
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [qAplicada, setQAplicada] = useState("");

  useEffect(() => { const t = setTimeout(() => { setQAplicada(filtros.q); setPagina(0); }, 350); return () => clearTimeout(t); }, [filtros.q]);
  const errorRango = filtros.desde && filtros.hasta && filtros.desde > filtros.hasta ? "La fecha “Desde” no puede ser posterior a “Hasta”." : "";

  const cargar = useCallback(async () => {
    if (errorRango) return;
    try {
      const r = await fetchAuditoria({ desde: filtros.desde, hasta: filtros.hasta, usuario: filtros.usuario, entidad: filtros.tipo && filtros.tipo !== "acceso" && filtros.tipo !== "cambios" ? filtros.tipo : "", accion: filtros.tipo === "acceso" || filtros.tipo === "cambios" ? filtros.tipo : filtros.accion, q: qAplicada, pagina });
      setRes(r); setError("");
    } catch (e) { setError(e.message); }
  }, [filtros.desde, filtros.hasta, filtros.usuario, filtros.tipo, filtros.accion, qAplicada, pagina, errorRango]);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiar = (k) => (e) => { setFiltros({ ...filtros, [k]: e.target.value }); setPagina(0); };
  const hayFiltros = Object.values(filtros).some(Boolean);
  const totalPaginas = res ? Math.max(1, Math.ceil(res.total / res.limite)) : 1;
  const cuando = (ts) => new Date(ts).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ paddingTop: 8 }}>
      <Card style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <Field label="Desde" error={errorRango || null}><Input type="date" value={filtros.desde} onChange={cambiar("desde")} /></Field>
          <Field label="Hasta"><Input type="date" value={filtros.hasta} onChange={cambiar("hasta")} /></Field>
          <Field label="Usuario">
            <Select value={filtros.usuario} onChange={cambiar("usuario")}>
              <option value="">Todos</option>
              {(res?.usuarios || []).map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
          <Field label="Sección">
            <Select value={filtros.tipo} onChange={cambiar("tipo")}>
              <option value="">Todo</option>
              <option value="cambios">Solo cambios de datos</option>
              <option value="acceso">Solo accesos</option>
              {Object.entries(ENTIDAD_AUD).filter(([k]) => k !== "acceso").map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Acción">
            <Select value={filtros.accion} onChange={cambiar("accion")} disabled={filtros.tipo === "acceso" || filtros.tipo === "cambios"}>
              <option value="">Todas</option>
              <option value="crear">Creó</option>
              <option value="editar">Editó</option>
              <option value="eliminar">Eliminó</option>
            </Select>
          </Field>
          <Field label="Buscar"><Input value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })} maxLength={80} /></Field>
        </div>
        {hayFiltros && <button onClick={() => { setFiltros({ desde: "", hasta: "", usuario: "", tipo: "", accion: "", q: "" }); setQAplicada(""); setPagina(0); }} style={{ background: "none", border: "none", color: C.caramel, fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 8, padding: 0 }}>Quitar filtros</button>}
      </Card>

      {error && <div role="alert" style={{ background: C.brickBg, color: C.brick, padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {!res ? (
        <div style={{ padding: "30px 0", display: "flex", gap: 8, alignItems: "center", color: C.inkSoft, justifyContent: "center" }}><Loader2 size={16} /> Cargando…</div>
      ) : res.items.length === 0 ? (
        <EmptyState icon={History} title="Sin movimientos" />
      ) : (
        <>
          <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8 }}>{res.total} registro(s)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {res.items.map((it) => {
              const ac = ACCION_AUD[it.accion] || { texto: it.accion, color: C.inkSoft, fondo: C.chip };
              const abiertoAhora = abierto === it.id;
              const tieneDetalle = it.antes || it.despues || it.detalle;
              return (
                <Card key={it.id} style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, cursor: tieneDetalle ? "pointer" : "default" }} onClick={() => tieneDetalle && setAbierto(abiertoAhora ? null : it.id)}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 9, color: ac.color, background: ac.fondo }}>{ac.texto}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{ENTIDAD_AUD[it.entidad] || it.entidad}{it.etiqueta ? `: ${it.etiqueta}` : ""}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>{it.usuarioNombre ? `${it.usuarioNombre} · ` : ""}{it.usuarioEmail || "Sistema"}</div>
                      {it.entidad === "acceso" && it.detalle && <div style={{ fontSize: 12, color: C.inkSoft }}>{it.detalle}</div>}
                    </div>
                    <div style={{ fontSize: 12, color: C.inkSoft, textAlign: "right", flexShrink: 0 }}>{cuando(it.ts)}</div>
                  </div>
                  {abiertoAhora && it.entidad !== "acceso" && <CambiosAuditoria item={it} />}
                </Card>
              );
            })}
          </div>
          {totalPaginas > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
              <Btn variant="ghost" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}><ChevronLeft size={14} /> Anterior</Btn>
              <span style={{ fontSize: 13, color: C.inkSoft }}>Página {pagina + 1} de {totalPaginas}</span>
              <Btn variant="ghost" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Siguiente <ChevronRight size={14} /></Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- PEDIDOS ---------------- */
const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const fechaLarga = (f) => capitalizar(deFecha(f).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" }));
const diaCorto = (f) => deFecha(f).toLocaleDateString("es-PE", { weekday: "short" }).replace(".", "");

function Pedidos({ data, session, stock, guardarPedido, eliminarPedido, cambiarPagoPedido, guardarVenta }) {
  const [fecha, setFecha] = useState(hoy());
  const [modal, setModal] = useState(null);
  const [entregando, setEntregando] = useState(null);

  const nombreProducto = (id) => data.productos.find((p) => p.id === id)?.nombre || "producto eliminado";
  const delDia = data.pedidos.filter((p) => p.fecha === fecha).sort((a, b) => (a.ventaId ? 1 : 0) - (b.ventaId ? 1 : 0));
  const pendientesPorDia = {};
  data.pedidos.forEach((p) => { if (!p.ventaId) pendientesPorDia[p.fecha] = (pendientesPorDia[p.fecha] || 0) + 1; });

  const porPreparar = {};
  delDia.filter((p) => !p.ventaId).forEach((p) => p.items.forEach((it) => { porPreparar[it.productoId] = (porPreparar[it.productoId] || 0) + it.cantidad; }));
  const resumen = Object.entries(porPreparar);

  const totalPedido = (p) => {
    if (p.ventaId) { if (p.ventaTotal != null) return p.ventaTotal; const v = data.ventas.find((x) => x.id === p.ventaId); if (v) return v.total; }
    return p.items.reduce((s, it) => s + it.cantidad * (data.productos.find((x) => x.id === it.productoId)?.precioVenta || 0), 0);
  };
  const esHoy = fecha === hoy();

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <button aria-label="Día anterior" onClick={() => setFecha(sumarDias(fecha, -1))} style={{ ...inputStyle, cursor: "pointer", display: "flex", padding: 8 }}><ChevronLeft size={16} /></button>
        <Input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} aria-label="Fecha de entrega" />
        <button aria-label="Día siguiente" onClick={() => setFecha(sumarDias(fecha, 1))} style={{ ...inputStyle, cursor: "pointer", display: "flex", padding: 8 }}><ChevronRight size={16} /></button>
        {!esHoy && <Btn variant="ghost" onClick={() => setFecha(hoy())} style={{ padding: "7px 12px" }}>Hoy</Btn>}
        <div style={{ flex: 1 }} />
        <Btn onClick={() => setModal({ fecha })} disabled={data.productos.length === 0}><Plus size={15} /> Nuevo pedido</Btn>
      </div>
      {data.productos.length === 0 && <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>Crea al menos un producto antes de agendar pedidos.</div>}

      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {[-3, -2, -1, 0, 1, 2, 3].map((n) => {
          const f = sumarDias(fecha, n);
          const sel = n === 0;
          const c = pendientesPorDia[f] || 0;
          return (
            <button key={f} onClick={() => setFecha(f)} aria-current={sel ? "date" : undefined} aria-label={`${fechaLarga(f)}${c ? `, ${c} por entregar` : ""}`}
              style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 0", borderRadius: 8, cursor: "pointer", border: `1px solid ${sel ? C.caramel : C.line}`, background: sel ? C.caramel : C.surface, color: sel ? "#fff" : C.ink }}>
              <span style={{ fontSize: 11, opacity: 0.85 }}>{diaCorto(f)}</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{deFecha(f).getDate()}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, minWidth: 18, borderRadius: 9, padding: "0 5px", lineHeight: "16px", height: 16, background: c ? (sel ? "#fff" : C.chip) : "transparent", color: c ? (sel ? C.caramelDark : C.caramelDark) : "transparent" }}>{c || "·"}</span>
            </button>
          );
        })}
      </div>

      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{fechaLarga(fecha)}{esHoy && <span style={{ fontFamily: "inherit", fontSize: 12, color: C.inkSoft, fontWeight: 400 }}> · hoy</span>}</div>

      {resumen.length > 0 && (
        <Card style={{ padding: 10, marginBottom: 10, background: C.chip, borderColor: C.line }}>
          <div style={{ fontSize: 12, color: C.caramelDark, fontWeight: 600, marginBottom: 2 }}>Por preparar este día</div>
          <div style={{ fontSize: 13 }}>{resumen.map(([id, cant]) => `${fmtNum(cant, 2)}× ${nombreProducto(id)}`).join(", ")}</div>
        </Card>
      )}

      {delDia.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Sin pedidos para este día" action={data.productos.length > 0 && <Btn onClick={() => setModal({ fecha })}>Nuevo pedido</Btn>} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {delDia.map((p) => {
            const cliente = data.clientes.find((c) => c.id === p.clienteId);
            const entregado = !!p.ventaId;
            return (
              <Card key={p.id} style={{ padding: 12, opacity: entregado ? 0.85 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{cliente ? cliente.nombre : "Sin cliente"}</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>{p.items.map((it) => `${fmtNum(it.cantidad, 2)}× ${nombreProducto(it.productoId)}`).join(", ")}</div>
                    {p.notas && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{p.notas}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{clp(totalPedido(p))}</div>
                    {entregado
                      ? <div style={{ fontSize: 12, color: C.sage, fontWeight: 600, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}><Check size={13} /> Entregado</div>
                      : <button onClick={() => cambiarPagoPedido(p.id, p.pago === "pagado" ? "pendiente" : "pagado")} title={p.pago === "pagado" ? "Marcar como pendiente" : "Marcar como pagado"} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 600, color: p.pago === "pagado" ? C.sage : C.brick }}>{p.pago === "pagado" ? "Pagado" : "Pendiente de pago"}</button>}
                  </div>
                </div>
                {entregado ? (
                  <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}>Registrado en Ventas.</div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                    <Btn onClick={() => setEntregando(p)} style={{ padding: "7px 12px" }}><Check size={15} /> Entregar</Btn>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button aria-label="Editar pedido" onClick={() => setModal(p)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}><Pencil size={16} /></button>
                      <button aria-label="Eliminar pedido" onClick={async () => { if (await confirmar("¿Eliminar este pedido?")) eliminarPedido(p.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {modal && <PedidoModal pedido={modal} data={data} onClose={() => setModal(null)} onSave={async (p) => { await guardarPedido(p); setFecha(p.fecha); setModal(null); }} />}
      {entregando && (
        <VentaModal data={data} session={session} stock={stock} onClose={() => setEntregando(null)}
          inicial={{ fecha: entregando.fecha > hoy() ? hoy() : entregando.fecha, clienteId: entregando.clienteId, cuenta: entregando.pago === "pagado" ? "personal" : "pendiente", pedidoId: entregando.id, items: entregando.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })) }}
          onSave={async (v) => { await guardarVenta(v); setEntregando(null); }} />
      )}
    </div>
  );
}

function PedidoModal({ pedido, data, onClose, onSave }) {
  const [f, setF] = useState({
    fecha: pedido.fecha || hoy(), clienteId: pedido.clienteId || "", pago: pedido.pago || "pendiente", notas: pedido.notas || "",
    items: pedido.items?.length ? pedido.items.map((i) => ({ productoId: i.productoId, cantidad: String(i.cantidad) })) : [{ productoId: data.productos[0]?.id || "", cantidad: "1" }],
  });
  const setItem = (idx, patch) => { const arr = [...f.items]; arr[idx] = { ...arr[idx], ...patch }; setF({ ...f, items: arr }); };
  const delItem = (idx) => setF({ ...f, items: f.items.filter((_, i) => i !== idx) });
  const addItem = () => setF({ ...f, items: [...f.items, { productoId: data.productos[0]?.id || "", cantidad: "1" }] });
  const total = f.items.reduce((s, it) => s + parseNum(it.cantidad) * (data.productos.find((p) => p.id === it.productoId)?.precioVenta || 0), 0);
  const payload = { id: pedido.id, fecha: f.fecha, clienteId: f.clienteId, pago: f.pago, notas: f.notas.trim(), items: f.items.map((it) => ({ productoId: it.productoId, cantidad: parseNum(it.cantidad) })) };
  const v = useValidacion(VAL.validarPedido(payload));
  const opcionPago = (valor, texto) => (
    <button type="button" aria-pressed={f.pago === valor} onClick={() => setF({ ...f, pago: valor })}
      style={{ flex: 1, padding: "8px 10px", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer", border: `1px solid ${f.pago === valor ? (valor === "pagado" ? C.sage : C.brick) : C.line}`, background: f.pago === valor ? (valor === "pagado" ? C.sageBg : C.brickBg) : "#FFFDFA", color: f.pago === valor ? (valor === "pagado" ? C.sage : C.brick) : C.inkSoft }}>
      {texto}
    </button>
  );

  return (
    <Modal title={pedido.id ? "Editar pedido" : "Nuevo pedido"} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Fecha de entrega" v={v} campo="fecha"><Input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
          <Field label="Cliente (opcional)" v={v} campo="clienteId">
            <Select value={f.clienteId} onChange={(e) => setF({ ...f, clienteId: e.target.value })}>
              <option value="">—</option>
              {data.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </Field>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600 }}>Productos</div>
        <div style={{ display: "flex", gap: 6, fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>
          <span style={{ flex: 2 }}>Producto</span><span style={{ width: 64 }}>Cantidad</span>{f.items.length > 1 && <span style={{ width: 22 }} />}
        </div>
        {f.items.map((it, idx) => (
          <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Select aria-label="Producto" value={it.productoId} onChange={(e) => setItem(idx, { productoId: e.target.value })} style={{ flex: 2 }} {...v.p(`items.${idx}.productoId`)}>
                {data.productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>
              <NumInput aria-label="Cantidad" value={it.cantidad} onChange={(e) => setItem(idx, { cantidad: e.target.value })} style={{ width: 64 }} {...v.p(`items.${idx}.cantidad`)} />
              {f.items.length > 1 && <button aria-label="Quitar producto" onClick={() => delItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={16} /></button>}
            </div>
            <ErrFila v={v} campos={[`items.${idx}.productoId`, `items.${idx}.cantidad`]} />
          </div>
        ))}
        <Err v={v} campo="items" />
        <Btn variant="ghost" onClick={addItem}><Plus size={14} /> Agregar producto</Btn>

        <Field label="Estado de pago">
          <div style={{ display: "flex", gap: 6 }}>{opcionPago("pendiente", "Pendiente")}{opcionPago("pagado", "Pagado")}</div>
        </Field>
        <Field label="Notas (opcional)" v={v} campo="notas">
          <Input value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} maxLength={300} />
        </Field>

        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: 15, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}><span>Total estimado</span><span>{clp(total)}</span></div>
        <ErrorForm v={v} />
        <Btn disabled={v.enviando} onClick={() => v.enviar(() => onSave(payload))} style={{ justifyContent: "center" }}>{pedido.id ? "Guardar cambios" : "Agendar pedido"}</Btn>
      </div>
    </Modal>
  );
}
/* ---------------- VENTAS ---------------- */
const ETIQUETA_CUENTA = (v) => {
  if (v.cuenta === "personal") return `Cuenta personal${v.registradoPor ? ` (${v.registradoPor})` : ""}`;
  if (v.cuenta === "empresa") return "Cuenta de la empresa";
  if (v.cuenta === "pendiente") return "Pendiente de pago";
  return null;
};
const COLOR_CUENTA = (v) => (v.cuenta === "pendiente" ? C.brick : v.cuenta ? C.sage : C.inkSoft);

function Ventas({ data, session, stock, guardarVenta, eliminarVenta, cambiarCuentaVenta }) {
  const [modal, setModal] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [fCliente, setFCliente] = useState("todos");
  const [fCuenta, setFCuenta] = useState("todas");
  const [fPago, setFPago] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const ventasFiltradas = data.ventas.filter((v) =>
    (fCliente === "todos" || v.clienteId === fCliente) &&
    (fCuenta === "todas" || v.cuenta === fCuenta) &&
    (fPago === "todos" || (fPago === "pendiente" ? v.cuenta === "pendiente" : v.cuenta !== "pendiente")) &&
    (!desde || v.fecha >= desde) && (!hasta || v.fecha <= hasta)
  );
  const totalFiltrado = ventasFiltradas.reduce((s, v) => s + (Number(v.total) || 0), 0);
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Btn onClick={() => setModal({})} disabled={data.productos.length === 0}><Plus size={15} /> Nueva venta</Btn>
      </div>
      {data.productos.length === 0 && <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>Crea al menos un producto antes de registrar ventas.</div>}
      <Card style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 130 }}><Field label="Cliente"><Select value={fCliente} onChange={(e) => setFCliente(e.target.value)}><option value="todos">Todos</option>{data.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Select></Field></div>
          <div style={{ flex: 1, minWidth: 130 }}><Field label="Cuenta"><Select value={fCuenta} onChange={(e) => setFCuenta(e.target.value)}><option value="todas">Todas</option><option value="empresa">Cuenta de la empresa</option><option value="personal">Cuenta personal</option></Select></Field></div>
          <div style={{ flex: 1, minWidth: 130 }}><Field label="Estado de pago"><Select value={fPago} onChange={(e) => setFPago(e.target.value)}><option value="todos">Todos</option><option value="pagado">Pagado</option><option value="pendiente">Pendiente</option></Select></Field></div>
          <div style={{ flex: 1, minWidth: 130 }}><Field label="Desde"><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Field></div>
          <div style={{ flex: 1, minWidth: 130 }}><Field label="Hasta"><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Field></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 13 }}><span style={{ color: C.inkSoft }}>{ventasFiltradas.length} venta(s)</span><span style={{ fontWeight: 600 }}>Total: {clp(totalFiltrado)}</span></div>
      </Card>
      {data.ventas.length === 0 ? (
        <EmptyState icon={Receipt} title="Sin ventas registradas" />
      ) : ventasFiltradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24, color: C.inkSoft, fontSize: 13 }}>Ninguna venta coincide con los filtros.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ventasFiltradas.map((v) => {
            const cliente = data.clientes.find((c) => c.id === v.clienteId);
            const etiqueta = ETIQUETA_CUENTA(v);
            const tieneFaltante = v.items.some((it) => (it.consumos || []).some((c) => c.tipo === "receta_base" && c.refId == null));
            const abiertaAhora = abierta === v.id;
            return (
              <Card key={v.id} style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setAbierta(abiertaAhora ? null : v.id)}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{v.fecha} {cliente && <span style={{ fontWeight: 400, color: C.inkSoft }}>· {cliente.nombre}</span>}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>{v.items.map((it) => { const p = data.productos.find((pp) => pp.id === it.productoId); return `${it.cantidad}× ${p ? p.nombre : "?"}`; }).join(", ")}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                      {etiqueta && <div style={{ fontSize: 12, color: COLOR_CUENTA(v), fontWeight: 600 }}>{etiqueta}</div>}
                      {tieneFaltante && <div style={{ fontSize: 11, color: C.brick, fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}><AlertTriangle size={12} /> faltó stock</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{clp(v.total)}</div>
                    <button onClick={(e) => { e.stopPropagation(); eliminarVenta(v.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={14} /></button>
                  </div>
                </div>
                {abiertaAhora && <DetalleVenta venta={v} data={data} cambiarCuentaVenta={cambiarCuentaVenta} />}
              </Card>
            );
          })}
        </div>
      )}
      {modal && <VentaModal data={data} session={session} stock={stock} onClose={() => setModal(null)} onSave={async (v) => { await guardarVenta(v); setModal(null); }} />}
    </div>
  );
}

function DetalleVenta({ venta, data, cambiarCuentaVenta }) {
  const [editando, setEditando] = useState(false);
  const [cuenta, setCuenta] = useState(venta.cuenta || "empresa");
  const [registradoPor, setRegistradoPor] = useState(venta.registradoPor || "");
  const [fechaCobro, setFechaCobro] = useState(venta.fechaCobro || hoy());

  const v = useValidacion(VAL.validarCuentaVenta({ cuenta, registradoPor, fechaCobro }));
  const guardarCuenta = () => v.enviar(async () => {
    await cambiarCuentaVenta(venta.id, cuenta, cuenta === "personal" ? registradoPor.trim() : null, cuenta === "pendiente" ? null : fechaCobro);
    setEditando(false);
  });

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: C.chip, borderRadius: 6, padding: 8 }}>
        {!editando ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLOR_CUENTA(venta) }}>{ETIQUETA_CUENTA(venta) || "Sin estado"}{venta.cuenta !== "pendiente" && venta.fechaCobro && venta.fechaCobro !== venta.fecha ? ` · cobrado el ${venta.fechaCobro}` : ""}</span>
            <button onClick={() => setEditando(true)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, fontSize: 11 }}>cambiar</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Select value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
              <option value="personal">Cuenta personal</option>
              <option value="empresa">Cuenta de la empresa</option>
              <option value="pendiente">Pendiente de pago</option>
            </Select>
            {cuenta !== "pendiente" && <Field label="Fecha en que se cobró" v={v} campo="fechaCobro"><Input type="date" value={fechaCobro} onChange={(e) => setFechaCobro(e.target.value)} /></Field>}
            {cuenta === "personal" && <Field label="Nombre de quién tiene el dinero" v={v} campo="registradoPor"><Input value={registradoPor} onChange={(e) => setRegistradoPor(e.target.value)} maxLength={60} /></Field>}
            <ErrorForm v={v} />
            <div style={{ display: "flex", gap: 6 }}>
              <Btn disabled={v.enviando} onClick={guardarCuenta} style={{ flex: 1, justifyContent: "center" }}>Guardar</Btn>
              <Btn variant="ghost" onClick={() => setEditando(false)}>Cancelar</Btn>
            </div>
          </div>
        )}
      </div>
      {venta.items.map((it) => {
        const p = data.productos.find((pp) => pp.id === it.productoId);
        return (
          <div key={it.id}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{it.cantidad}× {p ? p.nombre : "producto eliminado"} <span style={{ color: C.inkSoft, fontWeight: 400 }}>· {clp(it.precioUnitario)} c/u</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 10 }}>
              {(it.consumos || []).length === 0 && <div style={{ fontSize: 11.5, color: C.inkSoft }}>Este producto no tiene componentes de receta configurados.</div>}
              {(it.consumos || []).map((c) => {
                if (c.tipo === "receta_base") {
                  if (c.refId == null) {
                    return (
                      <div key={c.id} style={{ fontSize: 11.5, color: C.brick, display: "flex", alignItems: "center", gap: 4 }}>
                        <AlertTriangle size={11} /> {fmtNum(c.cantidad)} {c.unidad} de {c.recetaBaseNombre || "receta base"} sin lote con stock suficiente
                      </div>
                    );
                  }
                  return (
                    <div key={c.id} style={{ fontSize: 11.5, color: C.inkSoft }}>
                      {fmtNum(c.cantidad)} {c.unidad} de <b style={{ color: C.ink }}>{c.recetaBaseNombre}</b> — lote {c.loteCodigo ? `${c.loteCodigo} · ` : ""}elaborado el {c.loteFecha}
                    </div>
                  );
                }
                return (
                  <div key={c.id} style={{ fontSize: 11.5, color: C.inkSoft }}>
                    {fmtNum(c.cantidad)} {c.unidad} de <b style={{ color: C.ink }}>{c.ingredienteNombre}</b> <span>(insumo directo)</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function VentaModal({ data, session, stock, onClose, onSave, inicial }) {
  // Sugiere (FIFO) de qué lote sale cada componente de receta base de un ítem,
  // pero incluye TODOS los lotes existentes (aunque el sistema los crea en 0)
  // para que se puedan corregir a mano si la realidad no coincide.
  const distribucionSugerida = (productoId, cantidadVendida) => {
    const producto = data.productos.find((p) => p.id === productoId);
    const result = {};
    if (!producto) return result;
    (producto.componentes || []).forEach((comp) => {
      if (comp.tipo !== "receta_base") return;
      const necesarioBase = toBase(parseNum(cantidadVendida) * comp.cantidad, comp.unidad);
      const lotes = [...data.producciones.filter((p) => p.recetaBaseId === comp.refId)].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
      let restante = necesarioBase;
      result[comp.refId] = lotes.map((l) => {
        const disponible = stock.stockLote(l);
        let tomar = 0;
        if (restante > 0 && disponible > 0) { tomar = Math.min(disponible, restante); restante -= tomar; }
        return { produccionId: l.id, fecha: l.fecha, codigo: l.codigo, cantidad: tomar, disponibleSistema: disponible };
      });
    });
    return result;
  };

  const [f, setF] = useState(() => inicial ? {
    fecha: inicial.fecha, clienteId: inicial.clienteId || "", cuenta: inicial.cuenta, pedidoId: inicial.pedidoId,
    items: inicial.items.map((it) => {
      const p = data.productos.find((pp) => pp.id === it.productoId);
      return { productoId: it.productoId, cantidad: it.cantidad, precioUnitario: p?.precioVenta || 0, distribucion: distribucionSugerida(it.productoId, it.cantidad) };
    }),
  } : {
    fecha: hoy(), clienteId: "", cuenta: "personal",
    items: [{ productoId: data.productos[0]?.id || "", cantidad: 1, precioUnitario: data.productos[0]?.precioVenta || 0, distribucion: distribucionSugerida(data.productos[0]?.id, 1) }],
  });
  const setItem = (idx, patch) => { const arr = [...f.items]; arr[idx] = { ...arr[idx], ...patch }; setF({ ...f, items: arr }); };
  const actualizarItem = (idx, patch) => {
    const merged = { ...f.items[idx], ...patch };
    setItem(idx, { ...patch, distribucion: distribucionSugerida(merged.productoId, merged.cantidad) });
  };
  const setDistribLote = (idx, compRefId, loteIdx, cantidad) => {
    const it = f.items[idx];
    const arr = [...(it.distribucion[compRefId] || [])];
    arr[loteIdx] = { ...arr[loteIdx], cantidad: parseNum(cantidad) };
    setItem(idx, { distribucion: { ...it.distribucion, [compRefId]: arr } });
  };
  const addItem = () => {
    const pid = data.productos[0]?.id || "";
    setF({ ...f, items: [...f.items, { productoId: pid, cantidad: 1, precioUnitario: data.productos[0]?.precioVenta || 0, distribucion: distribucionSugerida(pid, 1) }] });
  };
  const delItem = (idx) => setF({ ...f, items: f.items.filter((_, i) => i !== idx) });
  const total = f.items.reduce((s, it) => s + (parseNum(it.cantidad) || 0) * (parseNum(it.precioUnitario) || 0), 0);
  const nombreUsuario = session?.nombre || session?.email || "";
  // Cantidad que necesita un componente de receta base para la cantidad vendida de un ítem.
  const necesarioDe = (it, compRefId) => {
    const prod = data.productos.find((p) => p.id === it.productoId);
    const comp = prod?.componentes.find((c) => c.refId === compRefId);
    return comp ? toBase(parseNum(it.cantidad) * comp.cantidad, comp.unidad) : 0;
  };

  const payload = {
    ...f,
    registradoPor: f.cuenta === "personal" ? nombreUsuario : null,
    items: f.items.map((it) => ({ ...it, cantidad: parseNum(it.cantidad), precioUnitario: parseNum(it.precioUnitario) })),
  };
  const errores = VAL.validarVenta(payload);
  f.items.forEach((it, idx) => {
    Object.entries(it.distribucion || {}).forEach(([compRefId, filas]) => {
      const asignado = filas.reduce((s, x) => s + (parseNum(x.cantidad) || 0), 0);
      if (asignado > necesarioDe(it, compRefId) + 0.01 && !errores[`items.${idx}.distribucion`]) {
        const rb = data.recetasBase.find((r) => r.id === compRefId);
        errores[`items.${idx}.distribucion`] = `Asignaste más ${rb ? `de ${rb.nombre} ` : ""}de lo que necesita la venta.`;
      }
    });
  });
  const v = useValidacion(errores);

  return (
    <Modal title={inicial ? "Entregar pedido" : "Nueva venta"} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Fecha" v={v} campo="fecha"><Input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
          <Field label="Cliente (opcional)" v={v} campo="clienteId">
            <Select value={f.clienteId} onChange={(e) => setF({ ...f, clienteId: e.target.value })}>
              <option value="">—</option>
              {data.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="¿Dónde está el dinero?" v={v} campo="cuenta">
          <Select value={f.cuenta} onChange={(e) => setF({ ...f, cuenta: e.target.value })}>
            <option value="personal">Cuenta personal</option>
            <option value="empresa">Cuenta de la empresa</option>
            <option value="pendiente">Pendiente de pago</option>
          </Select>
        </Field>

        <div style={{ fontSize: 13, fontWeight: 600 }}>Productos vendidos</div>
        <div style={{ display: "flex", gap: 6, fontSize: 11.5, color: C.inkSoft, fontWeight: 600, paddingLeft: 8 }}>
          <span style={{ flex: 2 }}>Producto</span><span style={{ width: 55 }}>Cantidad</span><span style={{ width: 80 }}>Precio c/u</span>{f.items.length > 1 && <span style={{ width: 22 }} />}
        </div>
        <Err v={v} campo="items" />
        {f.items.map((it, idx) => {
          const componentesRB = Object.entries(it.distribucion || {});
          return (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, border: `1px solid ${C.line}`, borderRadius: 8 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Select aria-label="Producto" value={it.productoId} onChange={(e) => { const p = data.productos.find((pp) => pp.id === e.target.value); actualizarItem(idx, { productoId: e.target.value, precioUnitario: p?.precioVenta || 0 }); }} style={{ flex: 2 }} {...v.p(`items.${idx}.productoId`)}>
                  {data.productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </Select>
                <NumInput aria-label="Cantidad" value={it.cantidad} onChange={(e) => actualizarItem(idx, { cantidad: e.target.value })} style={{ width: 55 }} {...v.p(`items.${idx}.cantidad`)} />
                <NumInput aria-label="Precio unitario" value={it.precioUnitario} onChange={(e) => setItem(idx, { precioUnitario: e.target.value })} style={{ width: 80 }} {...v.p(`items.${idx}.precioUnitario`)} />
                {f.items.length > 1 && <button aria-label="Quitar producto" onClick={() => delItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brick }}><Trash2 size={16} /></button>}
              </div>
              <ErrFila v={v} campos={[`items.${idx}.productoId`, `items.${idx}.cantidad`, `items.${idx}.precioUnitario`, `items.${idx}.distribucion`]} />

              {componentesRB.map(([compRefId, filas]) => {
                if (filas.length <= 1) return null; // un solo lote posible: nada que corregir
                const rb = data.recetasBase.find((r) => r.id === compRefId);
                const u = baseUnidadDe(rb?.unidadRendimiento || "g");
                const asignado = filas.reduce((s, x) => s + (parseNum(x.cantidad) || 0), 0);
                const necesario = necesarioDe(it, compRefId);
                return (
                  <div key={compRefId} style={{ background: C.chip, borderRadius: 6, padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: C.caramelDark }}>De qué lote sale el {rb?.nombre} (necesitas {fmtNum(necesario)} {u})</div>
                    {filas.map((fl, li) => (
                      <div key={fl.produccionId} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <span style={{ flex: 1 }}>Lote {fl.codigo ? `${fl.codigo} · ` : ""}{fl.fecha} <span style={{ color: C.inkSoft }}>(sistema: {fmtNum(fl.disponibleSistema)} {u})</span></span>
                        <NumInput aria-label="Cantidad del lote" value={fl.cantidad} onChange={(e) => setDistribLote(idx, compRefId, li, e.target.value)} style={{ width: 70 }} {...v.p(`items.${idx}.distribucion`)} />
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: Math.abs(asignado - necesario) < 0.01 ? C.sage : C.brick, fontWeight: 600 }}>
                      Asignado: {fmtNum(asignado)} {u} {Math.abs(asignado - necesario) >= 0.01 && `(necesitas ${fmtNum(necesario)})`}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        <Btn variant="ghost" onClick={addItem}><Plus size={14} /> Agregar producto</Btn>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: 15, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}><span>Total</span><span>{clp(total)}</span></div>
        <ErrorForm v={v} />
        <Btn disabled={v.enviando} onClick={() => v.enviar(() => onSave(payload))} style={{ justifyContent: "center", marginTop: 4 }}>{inicial ? "Registrar entrega y venta" : "Guardar venta"}</Btn>
      </div>
    </Modal>
  );
}
