"use client";
import { useState, useEffect, useCallback } from "react";
import { Mail, Lock, Eye, EyeOff, KeyRound, Ban, Hash } from "lucide-react";
import MainApp from "./Principal";
import { ConfirmHost, EsqueletoApp, Shell, VAL, useFonts, useValidacion } from "./comun";
function LoginLayout({ children }) {
  return (
    <Shell>
      <div className="login">
        <aside className="login-brand">
          <div className="login-orb login-orb-a" />
          <div className="login-orb login-orb-b" />
          <picture><source srcSet="/logo-venu.webp" type="image/webp" /><img className="login-logo" src="/logo-venu.png" alt="Venu" width={168} height={168} fetchPriority="high" decoding="async" /></picture>
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
    return <Shell><EsqueletoApp /></Shell>;
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

