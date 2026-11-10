"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Pencil, ChevronRight, ChevronLeft, Loader2, KeyRound, Unlock, ShieldCheck, Copy, RefreshCw, History } from "lucide-react";
import { fetchUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario, fetchAuditoria } from "../lib/data";
import { Btn, C, Card, EmptyState, Err, ErrorForm, Field, Input, Modal, SECCIONES, Select, VAL, confirmar, estiloMensaje, useValidacion } from "./comun";

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

export function Usuarios({ session }) {
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

export function Auditoria() {
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

