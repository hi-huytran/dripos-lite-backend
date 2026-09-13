CREATE TABLE products (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  sold_out        BOOLEAN NOT NULL DEFAULT false,
  category        TEXT NOT NULL,
  price_cents     INTEGER NOT NULL,
  description     TEXT
);

CREATE TABLE modifier_groups (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  required        BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE modifier_options (
  id                  TEXT PRIMARY KEY,
  modifier_group_id   TEXT NOT NULL REFERENCES modifier_groups(id),
  name                TEXT NOT NULL,
  price_delta_cents   INTEGER NOT NULL
);

CREATE TABLE product_modifier_groups (
  product_id          TEXT NOT NULL REFERENCES products(id),
  modifier_group_id   TEXT NOT NULL REFERENCES modifier_groups(id),
  PRIMARY KEY (product_id, modifier_group_id)
);

CREATE TABLE tickets (
  id               SERIAL PRIMARY KEY,
  status           TEXT NOT NULL DEFAULT 'paid',
  subtotal_cents   INTEGER NOT NULL,
  tax_cents        INTEGER NOT NULL,
  total_cents      INTEGER NOT NULL,
  tendered_cents   INTEGER NOT NULL,
  change_cents     INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_items (
  id                  SERIAL PRIMARY KEY,
  ticket_id           INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  product_id          TEXT NOT NULL REFERENCES products(id),
  product_name        TEXT NOT NULL,
  unit_price_cents    INTEGER NOT NULL,
  quantity            INTEGER NOT NULL,
  line_total_cents    INTEGER NOT NULL
);

CREATE TABLE ticket_item_modifiers (
  id                     SERIAL PRIMARY KEY,
  ticket_item_id         INTEGER NOT NULL REFERENCES ticket_items(id) ON DELETE CASCADE,
  modifier_option_id     TEXT NOT NULL REFERENCES modifier_options(id),
  option_name            TEXT NOT NULL,
  price_delta_cents      INTEGER NOT NULL
);
