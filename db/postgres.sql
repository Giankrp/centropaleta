CREATE TABLE IF NOT EXISTS inventory_records (
  key text PRIMARY KEY,
  kind text NOT NULL,
  payload text NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_revision (
  id integer PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0,
  mutation text NOT NULL DEFAULT '',
  next_id integer NOT NULL DEFAULT 1
);
