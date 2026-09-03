# Gestión de cucharables

App real (Next.js) con base de datos Postgres y login reales, usando **Supabase** (base de datos + autenticación) y **Vercel** (hosting + dominio).

No necesitas saber programar para desplegarla, solo seguir estos pasos en orden.

---

## 1. Crear el proyecto en Supabase (base de datos)

1. Ve a https://supabase.com → crea una cuenta gratis → **New project**.
2. Elige un nombre (ej. `cucharables`) y una contraseña de base de datos (guárdala, no la necesitarás seguido).
3. Espera a que el proyecto termine de crearse (1-2 min).
4. En el menú izquierdo ve a **SQL Editor → New query**.
5. Abre el archivo `supabase/schema.sql` de esta carpeta, copia **todo** su contenido, pégalo ahí y dale **Run**. Esto crea todas las tablas y la seguridad de acceso.
6. Ve a **Project Settings → API**. Copia dos valores, los vas a necesitar en el paso 3:
   - `Project URL`
   - `anon public` key

## 2. Crear las 2 cuentas (tú y Andrea)

1. En Supabase, ve a **Authentication → Users → Add user**.
2. Crea un usuario con tu correo y una contraseña.
3. Repite para Andrea, con su correo y su contraseña.
4. Estas son las únicas 2 cuentas que van a poder entrar — no hay registro público.

## 3. Subir el código a GitHub

1. Crea una cuenta en https://github.com si no tienes.
2. Crea un repositorio nuevo (puede ser privado), ej. `cucharables-app`.
3. Sube esta carpeta completa a ese repositorio (puedes arrastrar los archivos desde la web de GitHub, o usar `git` si sabes usarlo).

## 4. Desplegar en Vercel

1. Ve a https://vercel.com → crea una cuenta con tu GitHub.
2. **Add New → Project** → elige el repositorio que acabas de subir.
3. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = el `Project URL` que copiaste en el paso 1.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = el `anon public key` que copiaste en el paso 1.
4. Dale **Deploy**. En un par de minutos te da un enlace tipo `cucharables-app.vercel.app` — esa ya es tu web real, funcionando.

## 5. Conectar tu propio dominio (opcional)

Si compran un dominio (ej. en NIC Chile o GoDaddy):
1. En Vercel, entra al proyecto → **Settings → Domains** → agrega tu dominio.
2. Vercel te muestra qué registro DNS agregar en el sitio donde compraste el dominio.
3. En 24 horas como máximo el dominio queda apuntando a la app.

---

## Uso diario (para desarrollo local, opcional)

Si más adelante quieren pedirle cambios a Claude Code y probarlos en su computador antes de subirlos:

```bash
npm install
cp .env.local.example .env.local   # y completa las 2 variables ahí
npm run dev
```

Abre http://localhost:3000

## Cómo está organizada la base de datos

- `clientes`
- `ingredientes` (materias primas)
- `compras` (fecha, tipo de documento, número, cantidad, costo total)
- `recetas_base` + `receta_base_ingredientes` (ej. Manjar)
- `producciones` + `produccion_ingredientes` (cada lote real que preparan, con su rendimiento real)
- `productos` + `producto_componentes` (los cucharables que venden, armados con insumos y/o recetas base)
- `ventas` + `venta_items`

Todo el costeo (costo promedio por insumo, costo por gramo de cada receta base, costo y margen por producto) se calcula en la app a partir de estos datos — no hay números escritos a mano en ningún lado.

## Seguridad

Solo las 2 cuentas que crees en Supabase Authentication pueden entrar y ver/editar datos (reforzado a nivel de base de datos con Row Level Security, no solo en la pantalla de login). Si más adelante agregan más usuarios, se crean del mismo modo en el paso 2.
