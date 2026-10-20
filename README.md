# Gestión de cucharables — modo 100% local

Esta versión corre completamente en tu computadora: base de datos real (SQLite, un archivo `data.sqlite` en la carpeta del proyecto) y login real (contraseñas encriptadas con bcrypt, sesiones con cookies). No depende de internet ni de ningún servicio externo.

**Importante:** este modo es para desarrollar y probar. Un archivo SQLite vive solo en tu disco — cuando llegue el momento de publicar la app en internet para que Andrea la use desde su teléfono, vamos a cambiar la base de datos a algo alojado en la nube (ej. Supabase, que ya dejamos preparado antes). El código de la interfaz no cambia, solo la capa de datos (`lib/db.js` y las rutas en `app/api/`).

## 1. Instalar dependencias

```bash
npm install
```

## 2. Crear tus 2 usuarios (tú y Andrea)

```bash
npm run seed -- "tu-correo@ejemplo.com" "tu-contraseña" "Tu nombre"
npm run seed -- "andrea-correo@ejemplo.com" "su-contraseña" "Andrea"
```

Esto crea el archivo `data.sqlite` la primera vez que lo corres, con las tablas ya listas. Puedes volver a correr el mismo comando con el mismo correo para cambiar una contraseña.

## 3. Correr la app

```bash
npm run dev
```

Abre **http://localhost:3000**, entra con el correo y contraseña que creaste, y prueba todo: clientes, insumos, compras, recetas base, lotes de producción, productos y ventas.

## 4. Si quieres empezar de cero

Borra el archivo `data.sqlite` (o muévelo a otro lado) y vuelve a correr `npm run seed` para las 2 cuentas. Se crea todo de nuevo, vacío.

---

## Cómo está organizado el código

- `lib/db.js` — toda la base de datos: esquema (se crea solo la primera vez) y funciones para leer/guardar cada tabla.
- `app/api/*/route.js` — una ruta por sección (clientes, compras, recetas-base, producciones, productos, pedidos, ventas) más `app/api/auth/*` para login/logout/sesión. Todas exigen sesión válida excepto login.
- `lib/data.js` — funciones que la interfaz llama (`saveCliente`, `deleteVenta`, etc.), que a su vez llaman a esas rutas.
- `app/page.js` — toda la interfaz: pantalla de login, panel, y los módulos de clientes/compras/recetas/productos/pedidos/ventas. El cálculo de costos (promedio de compras, costo por gramo de cada receta base según su rendimiento real, margen por producto) vive aquí y no depende de si los datos vienen de SQLite o de otra base más adelante.

## Cuando llegue el momento de desplegar

Ese día:
1. Creamos un proyecto en una base de datos en la nube (Supabase u otra).
2. Reemplazamos `lib/db.js` por una versión que hable con esa base en vez de con el archivo local (la forma de las funciones — `saveCliente`, `fetchAllData`, etc. — se mantiene igual, así que el resto del código casi no cambia).
3. Subimos el proyecto a un hosting (Vercel, Netlify, etc.) y configuramos ahí las variables de conexión.

Avísame cuando quieras dar ese paso y lo armamos.


---

## Usuarios, permisos y contraseñas

- **Usuarios:** los administradores ven la sección *Usuarios*. Ahí crean cuentas (correo + contraseña provisional), eligen qué secciones ve cada persona, las editan cuando quieran, restablecen contraseñas, desbloquean cuentas o las desactivan. Los cambios rigen al instante.
- **Reglas de contraseña:** mínimo 8 caracteres, al menos una mayúscula y un número (también al usar `npm run seed`).
- **Auditoría:** los administradores ven la sección *Auditoría*: quién creó, editó o eliminó cada registro (con lo que había antes y lo que quedó, p. ej. los datos de un lote eliminado), más ingresos, cierres, bloqueos y cambios de contraseña. Se registra en el servidor (tabla `auditoria` de `data.sqlite`), no se puede alterar desde la web. Las contraseñas nunca se guardan en el registro.
- **Validaciones:** todos los formularios marcan en rojo los campos con error; el servidor aplica las mismas reglas (`lib/validaciones.js`).
- **Contraseña provisional:** quien entra con una contraseña provisional debe elegir una propia antes de usar la app.
- **Cuentas del seed:** las que se crean con `npm run seed` son administradoras.
- **Bloqueo por intentos:** 3 contraseñas incorrectas cierran el acceso (un *cierre*). Si hay 3 cierres seguidos, la cuenta queda bloqueada 2 horas. Un administrador puede desbloquearla antes.
- **Recuperar contraseña:** en el inicio de sesión, “¿Olvidaste tu contraseña?” genera un código de 6 dígitos (vence en 15 minutos).
  - Con correo configurado, el código llega por email.
  - Sin correo configurado, el código aparece en *Usuarios* para que un administrador se lo entregue a la persona (y se imprime en la terminal del servidor).
- **Configurar el envío de correos (opcional):** crea el archivo `.env.local` en la carpeta del proyecto:

```
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_USER=usuario
SMTP_PASS=contraseña
SMTP_FROM="Venu <correo@tu-dominio.com>"
```

- **Qué datos recibe cada usuario:** el servidor solo envía los datos que necesitan las secciones activadas. Algunas secciones comparten datos: por ejemplo, Stock y Recetas base incluyen el historial de ventas porque el stock de cada lote depende de ellas.

- **Planificar producción:** eliges recetas base y cuántas veces las harás; calcula insumos necesarios, lo que falta según el stock y el costo con el precio de la última compra de cada insumo. Se activa por usuario en Usuarios.

- **Filtros y marca:** en Compras se registra la marca (opcional) de cada insumo y se filtra por cuenta de pago y fechas. En Ventas se filtra por cliente, cuenta, estado de pago y fechas. El Panel muestra el mes que elijas.
- **Compras por documento:** las compras se agrupan en un bloque por documento (boleta o factura); al abrirlo se ven sus ítems y se puede "Editar documento" (cambiar datos, corregir o quitar ítems y agregar los que faltaron). Los números se leen con punto o coma como decimal ("0.956" = 0,956).
- **Artículos (ej. tapers):** en los gastos operativos, la categoría "Artículos y equipo" pide nombre, marca, cantidad y costo; calcula el precio por unidad y crea el artículo en Stock > Artículos, con historial de precios (último, más barato, promedio) y ajustes por rotura o pérdida. Cada documento de gastos exige foto (se puede tomar con la cámara del celular).
- **Gastos operativos (OpEx):** en Compras hay dos pestañas: "Insumos de producción" y "Gastos operativos" (mano de obra puntual, servicios, honorarios, transporte...). Los gastos no crean insumos ni tocan stock o costos de recetas, pero restan en la utilidad y en la caja.
- **Caja mensual con arrastre:** el Panel muestra, para el mes elegido, saldo inicial (el final del mes anterior), cobros, pagos y saldo final. Cuenta solo la cuenta de la empresa, según la fecha de cobro (ventas) y de pago (compras y gastos); lo pagado con dinero personal de un socio sale de la caja cuando se marca como reembolsado. Un "Saldo de apertura" opcional fija con cuánto dinero arrancas.
- **Fecha del documento vs. fecha de pago:** las compras y gastos tienen "Fecha de pago (si es distinta)"; las ventas, "Fecha en que se cobró". Los resultados usan la fecha del documento y la caja usa la de pago/cobro; las operaciones que cruzan de mes se listan aparte.
- **Conciliación:** cada mes se puede guardar el saldo real del banco y el sistema muestra si cuadra o la diferencia.
- **Pareto 80/20:** gráfico y lista de los insumos que concentran el 80% del gasto (por mes o todo el historial).
- **Histórico que no cambia:** cada venta guarda el precio de venta y el costo de producción de cada producto al momento de venderlo; cambiar precios, recetas o el precio de los insumos no modifica las ventas pasadas ni su margen.
- **Foto de boleta o factura:** al registrar una compra (o después, con "Adjuntar foto") se guarda la imagen del documento; se ve, cambia o quita desde cada compra. Se reduce en el navegador y se guarda en la base de datos (Turso), solo visible con sesión y permiso de Compras.

- **Carga rápida:** al crear insumos, clientes o compras, el botón **Guardar y agregar otro** deja el formulario limpio para el siguiente (la unidad y la fecha se conservan). **Guardar y cerrar** funciona como antes.

- **Editar insumos:** el lápiz junto a cada insumo (en Compras) permite cambiar nombre y unidad. Unidades: g, kg, ml, l, m, cm y unidad. Si el insumo ya tiene compras, recetas, productos o ventas, la unidad solo puede cambiar dentro de su familia (g↔kg, ml↔l, m↔cm).

## Seguridad

- Consultas SQL siempre parametrizadas; el navegador nunca accede a la base (solo el servidor tiene el token de Turso).
- Contraseñas con bcrypt, bloqueo por intentos fallidos y límite de peticiones por IP en ingreso y recuperación.
- Sesión que se cierra tras 3 horas sin actividad (vence en el servidor), cookie HttpOnly/SameSite/Secure.
- Cabeceras HTTP de seguridad y `no-store` en la API.
- Guarda `TURSO_AUTH_TOKEN` solo en Vercel, repositorio privado y verificación en dos pasos en GitHub, Vercel y Turso.

## Despliegue (Vercel + Turso)

La base de datos es SQLite alojada en **Turso** (gratis), así que la app corre en Vercel o Netlify sin disco propio.

1. Crea una cuenta en turso.tech e instala su CLI. Luego:
   `turso db create venu` · `turso db show venu --url` · `turso db tokens create venu`
2. Sube el proyecto a GitHub (sin `node_modules` ni `data.sqlite`).
3. En vercel.com: *Add New → Project*, elige el repositorio y, en *Environment Variables*, agrega `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` (y opcionalmente las `SMTP_*`). Despliega.
4. Crea tu usuario administrador desde tu computador (las tablas se crean solas):
   `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/seed.js "correo" "Contraseña1" "Nombre"`
5. Copias de seguridad: desde Turso (`turso db shell venu .dump`).

Sin esas variables, la app usa el archivo local `data.sqlite` (desarrollo). El `Dockerfile` sigue disponible como alternativa con disco propio.
