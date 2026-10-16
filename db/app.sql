CREATE TABLE IF NOT EXISTS carts (
  session text PRIMARY KEY,
  owner text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  cart text NOT NULL REFERENCES carts(session) ON DELETE CASCADE,
  product_id integer NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  PRIMARY KEY (cart, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id bigserial PRIMARY KEY,
  token text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  channel text NOT NULL,
  status text NOT NULL,
  payment text NOT NULL,
  customer text,
  delivery text NOT NULL,
  customer_profile jsonb,
  address text,
  lines jsonb NOT NULL,
  subtotal_cents bigint NOT NULL,
  shipping_cents bigint NOT NULL,
  total_cents bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS encargos (
  id text PRIMARY KEY,
  kind text NOT NULL,
  product text NOT NULL,
  universe text,
  quantity integer NOT NULL DEFAULT 1,
  product_type text,
  set_name text,
  condition text,
  budget_cents integer,
  price_cents integer,
  url text,
  notes text,
  customer text,
  email text,
  phone text,
  customer_profile jsonb,
  photos jsonb,
  status text NOT NULL DEFAULT 'Pendiente',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE encargos ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE encargos ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE encargos ADD COLUMN IF NOT EXISTS set_name text;
ALTER TABLE encargos ADD COLUMN IF NOT EXISTS condition_col text;

CREATE TABLE IF NOT EXISTS users (
  username text PRIMARY KEY,
  password_hash text NOT NULL,
  display_name text,
  contact_email text,
  contact_phone text,
  address text,
  avatar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  username text NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  product_id integer NOT NULL,
  PRIMARY KEY (username, product_id)
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS session text;
