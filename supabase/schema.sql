-- Esquema para "Gestión de cucharables"
-- Ejecutar completo en Supabase: Dashboard > SQL Editor > New query > pegar y "Run"

create extension if not exists "pgcrypto";

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  email text,
  direccion text,
  notas text,
  created_at timestamptz not null default now()
);

create table ingredientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  unidad text not null check (unidad in ('g','kg','ml','l','unidad')),
  created_at timestamptz not null default now()
);

create table compras (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tipo_documento text not null,
  numero text,
  ingrediente_id uuid not null references ingredientes(id) on delete restrict,
  cantidad numeric not null check (cantidad > 0),
  unidad text not null,
  costo_total numeric not null check (costo_total >= 0),
  created_at timestamptz not null default now()
);

create table recetas_base (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  unidad_rendimiento text not null,
  created_at timestamptz not null default now()
);

create table receta_base_ingredientes (
  id uuid primary key default gen_random_uuid(),
  receta_base_id uuid not null references recetas_base(id) on delete cascade,
  ingrediente_id uuid not null references ingredientes(id) on delete restrict,
  cantidad numeric not null check (cantidad > 0),
  unidad text not null
);

create table producciones (
  id uuid primary key default gen_random_uuid(),
  receta_base_id uuid not null references recetas_base(id) on delete cascade,
  fecha date not null,
  rendimiento_real numeric not null check (rendimiento_real > 0),
  unidad_rendimiento text not null,
  notas text,
  created_at timestamptz not null default now()
);

create table produccion_ingredientes (
  id uuid primary key default gen_random_uuid(),
  produccion_id uuid not null references producciones(id) on delete cascade,
  ingrediente_id uuid not null references ingredientes(id) on delete restrict,
  cantidad numeric not null default 0,
  unidad text not null
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio_venta numeric not null default 0,
  created_at timestamptz not null default now()
);

create table producto_componentes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  tipo text not null check (tipo in ('ingrediente','receta_base')),
  ref_id uuid not null,
  cantidad numeric not null check (cantidad > 0),
  unidad text not null
);

create table ventas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  cliente_id uuid references clientes(id) on delete set null,
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

create table venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete restrict,
  cantidad numeric not null check (cantidad > 0),
  precio_unitario numeric not null default 0
);

-- Row Level Security: solo usuarios autenticados (tú y Andrea) pueden leer y escribir.
-- No hay más lógica de roles porque solo ustedes dos tendrán cuenta en Supabase Auth.
alter table clientes enable row level security;
alter table ingredientes enable row level security;
alter table compras enable row level security;
alter table recetas_base enable row level security;
alter table receta_base_ingredientes enable row level security;
alter table producciones enable row level security;
alter table produccion_ingredientes enable row level security;
alter table productos enable row level security;
alter table producto_componentes enable row level security;
alter table ventas enable row level security;
alter table venta_items enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'clientes','ingredientes','compras','recetas_base','receta_base_ingredientes',
      'producciones','produccion_ingredientes','productos','producto_componentes',
      'ventas','venta_items'
    ])
  loop
    execute format(
      'create policy "usuarios autenticados acceso total" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');',
      t
    );
  end loop;
end $$;
