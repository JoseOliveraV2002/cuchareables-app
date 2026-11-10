"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { X } from "lucide-react";
import permisosCfg from "../lib/permisos";
import validaciones from "../lib/validaciones";

export const { SECCIONES } = permisosCfg;
export const IDS_NAV = [...SECCIONES.map((x) => x.id), "caja", "usuarios", "auditoria"];
export const VAL = validaciones;


/* ---------------- paleta / helpers ---------------- */
export const C = {
  bg: "#FBF7F1", surface: "#FFFFFF", line: "#E7DCC9", ink: "#3A2A1E", inkSoft: "#7A6A57",
  caramel: "#A15C2B", caramelDark: "#7E4620", sage: "#5F7355", sageBg: "#EEF2E9",
  brick: "#A23E3E", brickBg: "#F7EAEA", chip: "#F3EADA",
};
export const UNIDADES = ["g", "kg", "ml", "l", "m", "cm", "unidad"];
export const FAMILIA = { g: "peso", kg: "peso", ml: "volumen", l: "volumen", m: "longitud", cm: "longitud", unidad: "conteo" };
export const A_BASE = { g: 1, kg: 1000, ml: 1, l: 1000, m: 100, cm: 1, unidad: 1 };
export const BASE_DE = { peso: "g", volumen: "ml", longitud: "cm", conteo: "unidad" };
export const TIPOS_DOC = ["Boleta", "Factura", "Guía de despacho", "Otro"];
// Costo por unidad: muestra más decimales cuando es menor a 1 sol (S/ 0.0047 en vez de S/ 0.00).
export const clpU = (n) => { const x = isFinite(n) ? n : 0; const a = Math.abs(x); return x.toLocaleString("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2, maximumFractionDigits: a >= 1 ? 2 : a >= 0.01 ? 4 : 6 }); };
export const clp = (n) => (isFinite(n) ? n : 0).toLocaleString("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 });
// Convierte lo escrito a número. Un solo punto o coma es decimal: "0.956" -> 0.956 · "1,5" -> 1.5 · "16352" -> 16352
export const parseNum = (v) => {
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
export const fmtNum = (n, d = 4) => (isFinite(n) ? n : 0).toLocaleString("es-PE", { maximumFractionDigits: d });
export const toBase = (cantidad, unidad) => (Number(cantidad) || 0) * (A_BASE[unidad] || 1);
export const baseUnidadDe = (unidad) => BASE_DE[FAMILIA[unidad]] || unidad;
export const aFecha = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const hoy = () => aFecha(new Date());
export const deFecha = (f) => { const [y, m, d] = f.split("-").map(Number); return new Date(y, m - 1, d); };
export const sumarDias = (f, n) => { const d = deFecha(f); d.setDate(d.getDate() + n); return aFecha(d); };
export const DATA_VACIA = { clientes: [], ingredientes: [], compras: [], recetasBase: [], producciones: [], productos: [], ventas: [], ajustesInventario: [], pedidos: [], gastos: [], articulos: [], cierres: [], cajaConfig: [], ajustesCaja: [] };

export function useFonts() {
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
export function useCosteo(data) {
  const costoBaseIngrediente = useMemo(() => {
    const map = {};
    // Una sola pasada para agrupar las compras por insumo (antes se recorría toda la lista por cada insumo).
    const porInsumo = new Map();
    data.compras.forEach((c) => { const g = porInsumo.get(c.ingredienteId); if (g) g.push(c); else porInsumo.set(c.ingredienteId, [c]); });
    data.ingredientes.forEach((ing) => {
      const compras = porInsumo.get(ing.id) || [];
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
    const lotesPorReceta = new Map();
    data.producciones.forEach((p) => { const g = lotesPorReceta.get(p.recetaBaseId); if (g) g.push(p); else lotesPorReceta.set(p.recetaBaseId, [p]); });
    data.recetasBase.forEach((rb) => {
      const lotes = lotesPorReceta.get(rb.id) || [];
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
export function useStock(data) {
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
export function Shell({ children }) {
  return <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: C.ink }}>{children}</div>;
}
export function Card({ children, style, ...rest }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, ...style }} {...rest}>{children}</div>;
}
export function Btn({ children, variant = "primary", onClick, type = "button", style, disabled }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: disabled ? "default" : "pointer", border: "1px solid transparent", opacity: disabled ? 0.5 : 1 };
  const variants = {
    primary: { background: C.caramel, color: "#fff" },
    ghost: { background: "transparent", color: C.ink, border: `1px solid ${C.line}` },
    danger: { background: C.brickBg, color: C.brick },
  };
  return <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}
export const inputStyle = { border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", color: C.ink, background: "#FFFDFA", outline: "none" };
export const estiloInvalido = { borderColor: C.brick, background: "#FFF6F5", boxShadow: `0 0 0 2px ${C.brickBg}` };
export function Input({ invalid, style, ...props }) { return <input {...props} aria-invalid={invalid || undefined} style={{ ...inputStyle, minWidth: 0, ...(invalid ? estiloInvalido : {}), ...(style || {}) }} />; }
// Campo numérico: solo admite dígitos, punto y coma.
export function NumInput({ invalid, style, onChange, ...props }) {
  const alCambiar = (e) => {
    const limpio = e.target.value.replace(/[^0-9.,]/g, "");
    if (limpio !== e.target.value) e.target.value = limpio;
    if (onChange) onChange(e);
  };
  return <input type="text" inputMode="decimal" {...props} onChange={alCambiar} aria-invalid={invalid || undefined} style={{ ...inputStyle, ...(invalid ? estiloInvalido : {}), ...(style || {}) }} />;
}
export function Select({ invalid, style, ...props }) { return <select {...props} aria-invalid={invalid || undefined} style={{ ...inputStyle, minWidth: 0, maxWidth: "100%", ...(invalid ? estiloInvalido : {}), ...(style || {}) }} />; }
export const estiloMensaje = { color: C.brick, fontSize: 12, fontWeight: 600 };
// Mensaje de error de un campo (para los que no van dentro de un <Field>).
export function Err({ v, campo }) {
  const m = v.msg(campo);
  return m ? <span role="alert" style={estiloMensaje}>{m}</span> : null;
}
// Primer mensaje de error entre varios campos de una misma fila.
export function ErrFila({ v, campos }) {
  const m = campos.map((c) => v.msg(c)).find(Boolean);
  return m ? <span role="alert" style={estiloMensaje}>{m}</span> : null;
}
export function Field({ label, children, v, campo, error }) {
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
export function useValidacion(errores) {
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
export function ErrorForm({ v }) {
  return v.general ? <div role="alert" style={{ background: C.brickBg, color: C.brick, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{v.general}</div> : null;
}
export function Modal({ title, onClose, children, wide }) {
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
export function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: C.inkSoft }}>
      <Icon size={28} style={{ marginBottom: 10, color: C.caramel }} />
      <div style={{ fontWeight: 600, color: C.ink, marginBottom: 4 }}>{title}</div>
      {desc && <div style={{ fontSize: 13, marginBottom: 16 }}>{desc}</div>}
      {action}
    </div>
  );
}
export function Th({ children, right }) { return <th style={{ textAlign: right ? "right" : "left", padding: "8px 10px", fontSize: 12, color: C.inkSoft, fontWeight: 600, borderBottom: `1px solid ${C.line}` }}>{children}</th>; }
export function Td({ children, right, style }) { return <td style={{ textAlign: right ? "right" : "left", padding: "9px 10px", fontSize: 13.5, borderBottom: `1px solid ${C.line}`, ...style }}>{children}</td>; }

/* ---------------- CONFIRMACIÓN (ventana modal propia) ---------------- */
export let abrirConfirmacion = null;
// Reemplaza a window.confirm: devuelve una promesa con true (aceptó) o false (canceló).
export const confirmar = (mensaje, { titulo = "Confirmar", boton = "Eliminar", peligro = true } = {}) =>
  new Promise((resolver) => {
    if (!abrirConfirmacion) { resolver(false); return; }
    abrirConfirmacion({ mensaje, titulo, boton, peligro, resolver });
  });
export function ConfirmHost() {
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

/* ---------------- esqueletos de carga ---------------- */
export function Esqueleto({ filas = 3, alto = 64 }) {
  return (
    <div className="esq-lista" role="status" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => <div key={i} className="esq" style={{ height: alto }} />)}
    </div>
  );
}
export function EsqueletoApp() {
  return (
    <div role="status" aria-label="Cargando">
      <div className="app-top"><div className="app-top-inner"><div className="app-brand">Gestión de cucharables</div></div></div>
      <div className="app-main">
        <div className="esq-fila">{[0, 1, 2].map((i) => <div key={i} className="esq" style={{ height: 66 }} />)}</div>
        <Esqueleto filas={4} alto={72} />
      </div>
    </div>
  );
}

/* ---------------- rendimiento: paginación y debounce ---------------- */
export const TAM_PAGINA = 40;
// Muestra la lista por tandas; al cambiar `reinicio` (filtros) vuelve a la primera tanda.
export function usePaginado(lista, reinicio) {
  const [n, setN] = useState(TAM_PAGINA);
  useEffect(() => { setN(TAM_PAGINA); }, [reinicio]);
  return { visibles: lista.length > n ? lista.slice(0, n) : lista, hay: lista.length > n, resto: lista.length - n, mas: () => setN((x) => x + TAM_PAGINA) };
}
export function MostrarMas({ p }) {
  if (!p.hay) return null;
  return (
    <button type="button" onClick={p.mas} style={{ alignSelf: "center", background: "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.caramelDark, cursor: "pointer" }}>
      Mostrar más ({p.resto} restantes)
    </button>
  );
}
// Devuelve el valor con retraso: la lista se filtra al dejar de escribir, no en cada tecla.
export function useDebounced(valor, ms = 250) {
  const [v, setV] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return v;
}
