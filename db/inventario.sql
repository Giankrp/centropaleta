create table if not exists productos (
  id integer primary key,
  name text not null,
  description text not null default '',
  category text not null,
  type text not null,
  set_name text not null default '',
  code text not null unique,
  price_cents integer not null,
  stock integer not null default 0,
  min_stock integer not null default 3,
  target_stock integer not null default 10,
  condition text not null default '',
  badge text,
  art text not null default '📦',
  barcodes text[] not null default '{}',
  image_url text,
  offer_active boolean not null default false,
  offer_percent integer,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists photos (
  id serial primary key,
  product_id integer not null unique references productos(id) on delete cascade,
  mime text not null default 'image/jpeg',
  data text not null,
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id bigserial primary key,
  code text not null unique,
  token text not null unique,
  channel text not null,
  payment text not null,
  customer_id text,
  customer_profile jsonb,
  delivery text,
  subtotal_cents integer not null,
  shipping_cents integer not null,
  total_cents integer not null,
  received_cents integer,
  change_cents integer,
  created_at timestamptz not null default now()
);

create table if not exists sales_lines (
  id bigserial primary key,
  sale_id integer not null references sales(id) on delete cascade,
  product_id integer references productos(id) on delete set null,
  product_name text not null,
  qty integer not null,
  unit_cents integer not null
);

create table if not exists moves (
  id bigserial primary key,
  kind text not null,
  product_name text not null,
  qty integer not null,
  product_id integer,
  token text,
  created_at timestamptz not null default now()
);

create table if not exists inventory_meta (
  id integer primary key,
  next_product_id integer not null default 1
);

create table if not exists mutation_results (
  id text primary key,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  username text primary key,
  password_hash text not null,
  display_name text,
  contact_email text,
  contact_phone text,
  address text,
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists carts (
  session text primary key,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cart_items (
  cart text not null references carts(session) on delete cascade,
  product_id integer not null,
  qty integer not null check (qty > 0),
  primary key (cart, product_id)
);

create table if not exists favorites (
  username text not null references users(username) on delete cascade,
  product_id integer not null,
  primary key (username, product_id)
);

create table if not exists orders (
  id bigserial primary key,
  token text not null unique,
  code text not null unique,
  channel text not null,
  status text not null,
  payment text not null,
  customer text,
  session text,
  delivery text not null,
  address text,
  lines jsonb not null,
  subtotal_cents bigint not null,
  shipping_cents bigint not null,
  total_cents bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists encargos (
  id text primary key,
  kind text not null,
  product text not null,
  universe text,
  quantity integer not null default 1,
  product_type text,
  set_name text,
  condition text,
  budget_cents integer,
  price_cents integer,
  url text,
  notes text,
  customer text null,
  email text,
  phone text,
  customer_profile jsonb,
  photos jsonb,
  status text not null default 'Pendiente',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table productos add column if not exists barcodes text[] not null default '{}';
alter table encargos add column if not exists email text;
alter table encargos add column if not exists phone text;
alter table orders add column if not exists session text;
