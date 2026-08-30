-- Universal Store — D1 schema
-- Every tenant-owned table is keyed by store_id with ON DELETE CASCADE / ON UPDATE CASCADE.
-- CASCADE on update is what makes "regenerate Admin Store ID" a single-statement operation.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stores (
  store_id                TEXT PRIMARY KEY,              -- STR-XXXX-XXXX-XXXX (private, acts as the merchant key)
  public_store_id         TEXT UNIQUE NOT NULL,          -- SHOP-XXXX-XXXX-XXXX (safe to share)
  business_name           TEXT NOT NULL,
  owner_name              TEXT,
  owner_email             TEXT,
  status                  TEXT NOT NULL DEFAULT 'NOT_ACTIVATED',
      -- NOT_ACTIVATED | PENDING_VERIFICATION | ACTIVE | EXPIRED | SUSPENDED | ARCHIVED
  access_level            TEXT NOT NULL DEFAULT 'SUBSCRIPTION_ONLY',
      -- INITIAL_SETUP | SUBSCRIPTION_ONLY | FULL_ADMIN | ORDERS_AND_SUBSCRIPTION | BLOCKED
  customer_store_enabled  INTEGER NOT NULL DEFAULT 0,
  plan_id                 TEXT,
  subscription_start      TEXT,
  subscription_expiry     TEXT,
  order_seq               INTEGER NOT NULL DEFAULT 1000,
  created_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
CREATE INDEX IF NOT EXISTS idx_stores_public ON stores(public_store_id);

CREATE TABLE IF NOT EXISTS store_settings (
  store_id      TEXT PRIMARY KEY REFERENCES stores(store_id) ON DELETE CASCADE ON UPDATE CASCADE,
  logo_file_id  TEXT DEFAULT '',
  accent_color  TEXT DEFAULT '#173d24',
  announcement  TEXT DEFAULT '',
  tagline       TEXT DEFAULT '',
  contact       TEXT DEFAULT '[]'    -- JSON: [{type, value, visible}]
);

CREATE TABLE IF NOT EXISTS categories (
  category_id  TEXT PRIMARY KEY,
  store_id     TEXT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE ON UPDATE CASCADE,
  name         TEXT NOT NULL,
  is_system    INTEGER NOT NULL DEFAULT 0,   -- 1 = protected "Uncategorized"
  sort         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_categories_store ON categories(store_id, sort);

CREATE TABLE IF NOT EXISTS products (
  product_id      TEXT PRIMARY KEY,
  store_id        TEXT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE ON UPDATE CASCADE,
  name            TEXT NOT NULL,
  price           REAL NOT NULL DEFAULT 0,
  stock           INTEGER NOT NULL DEFAULT 0,
  category_id     TEXT,
  description     TEXT DEFAULT '',
  images          TEXT DEFAULT '[]',   -- JSON array of FILE- ids
  variant_groups  TEXT DEFAULT '[]',   -- JSON: [{name, options[], price_delta[]}]
  is_active       INTEGER NOT NULL DEFAULT 1,
  sort            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id, is_active, sort);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id);

CREATE TABLE IF NOT EXISTS store_payment_methods (
  method_id       TEXT PRIMARY KEY,
  store_id        TEXT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE ON UPDATE CASCADE,
  name            TEXT NOT NULL,
  account_name    TEXT DEFAULT '',
  account_number  TEXT DEFAULT '',
  qr_file_id      TEXT DEFAULT '',
  requires_proof  INTEGER NOT NULL DEFAULT 0,
  valid_for       TEXT DEFAULT '[]',   -- JSON: ["delivery","pickup","meetup"]
  is_active       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_pm_store ON store_payment_methods(store_id, is_active);

CREATE TABLE IF NOT EXISTS fulfillment_settings (
  store_id      TEXT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE ON UPDATE CASCADE,
  type          TEXT NOT NULL,          -- delivery | pickup | meetup
  enabled       INTEGER NOT NULL DEFAULT 0,
  fee_mode      TEXT DEFAULT 'fixed',   -- fixed | manual (merchant confirms after order)
  fee           REAL DEFAULT 0,
  address       TEXT DEFAULT '',
  instructions  TEXT DEFAULT '',
  locations     TEXT DEFAULT '[]',      -- JSON array, meet-up only
  PRIMARY KEY (store_id, type)
);

CREATE TABLE IF NOT EXISTS scheduling_settings (
  store_id          TEXT PRIMARY KEY REFERENCES stores(store_id) ON DELETE CASCADE ON UPDATE CASCADE,
  enabled           INTEGER NOT NULL DEFAULT 0,
  prep_days         INTEGER NOT NULL DEFAULT 0,
  max_advance_days  INTEGER NOT NULL DEFAULT 14,
  blocked_weekdays  TEXT DEFAULT '[]',
  blocked_dates     TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS orders (
  order_id           TEXT PRIMARY KEY,
  order_number       TEXT NOT NULL,
  store_id           TEXT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE ON UPDATE CASCADE,
  customer_name      TEXT NOT NULL,
  mobile             TEXT NOT NULL,
  fulfillment_type   TEXT NOT NULL,
  address            TEXT DEFAULT '',
  meetup_location    TEXT DEFAULT '',
  preferred_date     TEXT,
  payment_method     TEXT DEFAULT '',
  proof_file_id      TEXT DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING|UNPAID|PAID|COMPLETED|CANCELLED
  seen               INTEGER NOT NULL DEFAULT 0,
  subtotal           REAL NOT NULL DEFAULT 0,
  delivery_fee       REAL NOT NULL DEFAULT 0,
  total              REAL NOT NULL DEFAULT 0,
  notes              TEXT DEFAULT '',
  client_request_id  TEXT UNIQUE,        -- idempotency key: blocks duplicate submits
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(store_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_number ON orders(store_id, order_number);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id  TEXT PRIMARY KEY,
  order_id       TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id     TEXT,
  name           TEXT NOT NULL,
  variant        TEXT DEFAULT '',
  qty            REAL NOT NULL,
  price          REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items ON order_items(order_id);

-- Platform-wide (not tenant-scoped)
CREATE TABLE IF NOT EXISTS subscription_plans (
  plan_id        TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  price          REAL NOT NULL DEFAULT 0,
  duration_days  INTEGER NOT NULL DEFAULT 30,
  blurb          TEXT DEFAULT '',
  is_active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  payment_id      TEXT PRIMARY KEY,
  store_id        TEXT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE ON UPDATE CASCADE,
  plan_id         TEXT,
  amount          REAL NOT NULL DEFAULT 0,
  kind            TEXT NOT NULL DEFAULT 'RENEWAL',  -- SIGNUP | RENEWAL | PLAN_CHANGE
  status          TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
  receipt_file_id TEXT DEFAULT '',
  reference       TEXT DEFAULT '',
  reject_reason   TEXT DEFAULT '',
  created_at      TEXT NOT NULL,
  reviewed_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_sp_status ON subscription_payments(status, created_at);
CREATE INDEX IF NOT EXISTS idx_sp_store ON subscription_payments(store_id);

CREATE TABLE IF NOT EXISTS master_payment_methods (
  method_id       TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  account_name    TEXT DEFAULT '',
  account_number  TEXT DEFAULT '',
  qr_file_id      TEXT DEFAULT '',
  is_active       INTEGER NOT NULL DEFAULT 1
);

-- Starter data
INSERT OR IGNORE INTO subscription_plans (plan_id, name, price, duration_days, blurb, is_active) VALUES
  ('PLAN-STARTER','Starter', 299, 30,  '1 store, unlimited products', 1),
  ('PLAN-GROWTH', 'Growth',  799, 90,  'Everything in Starter, 3 months', 1),
  ('PLAN-YEAR',   'Annual', 2790, 365, 'Best value — 2 months free', 1);
