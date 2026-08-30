/**
 * Universal Store — Cloudflare Worker API
 * One endpoint, many actions (RPC). D1 for data, KV for files.
 *
 * Bindings (wrangler.toml):
 *   DB     -> D1 database
 *   FILES  -> KV namespace
 * Vars/secrets:
 *   MASTER_ADMIN_EMAIL  -> the single email allowed into master.html
 *   ALLOWED_ORIGINS     -> comma-separated list, or "*" while developing
 */

const json = (data, status = 200, origin = "*") =>
  new Response(JSON.stringify({ ok: status < 400, data }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Cache-Control": "no-store"
    }
  });

const fail = (message, code = "ERROR", status = 400, origin = "*") =>
  new Response(JSON.stringify({ ok: false, error: message, code }), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": origin }
  });

class AppError extends Error {
  constructor(message, code = "ERROR", status = 400) { super(message); this.code = code; this.status = status; }
}
const bad = (m, c, s) => { throw new AppError(m, c, s); };

/* ---------- helpers ---------- */
const block = () => Array.from(crypto.getRandomValues(new Uint8Array(3)))
  .map(b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("") +
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[crypto.getRandomValues(new Uint8Array(1))[0] % 32];
const newId = prefix => `${prefix}-${block()}-${block()}-${block()}`;
const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const addDays = (iso, d) => new Date(new Date(iso).getTime() + d * 86400000).toISOString();
const j = v => (v == null ? null : JSON.stringify(v));
const p = (v, fb) => { try { return v ? JSON.parse(v) : fb; } catch { return fb; } };

/* ---------- auth ---------- */
async function currentStore(env, req, body) {
  const id = (req.headers.get("X-Store-Id") || body.store_id || "").trim().toUpperCase();
  if (!id) bad("Please sign in with your Store ID.", "AUTH", 401);
  const s = await env.DB.prepare("SELECT * FROM stores WHERE store_id = ?").bind(id).first();
  if (!s) bad("That Store ID wasn't recognised.", "AUTH", 401);
  return refreshLifecycle(env, s);
}

/* Subscription clock -> status/access transitions (BRAIN.md §5). */
async function refreshLifecycle(env, s) {
  if (["SUSPENDED", "ARCHIVED", "PENDING_VERIFICATION"].includes(s.status)) return s;
  if (s.status === "ACTIVE" && s.subscription_expiry && new Date(s.subscription_expiry) < new Date()) {
    await env.DB.prepare(
      "UPDATE stores SET status='EXPIRED', access_level='ORDERS_AND_SUBSCRIPTION', customer_store_enabled=0 WHERE store_id=?"
    ).bind(s.store_id).run();
    Object.assign(s, { status: "EXPIRED", access_level: "ORDERS_AND_SUBSCRIPTION", customer_store_enabled: 0 });
  }
  return s;
}

function requireAccess(s, levels) {
  if (s.access_level === "BLOCKED") bad("This store has been suspended by the platform owner.", "BLOCKED", 403);
  if (!levels.includes(s.access_level)) bad("Your subscription needs to be active to do that.", "LOCKED", 403);
  return s;
}

/* Google ID token -> email. Verified against Google's tokeninfo endpoint. */
async function masterEmail(env, req, body) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "") || body.id_token;
  if (!token) bad("Please sign in as the platform owner.", "AUTH", 401);
  const res = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token));
  if (!res.ok) bad("Your sign-in has expired. Please sign in again.", "AUTH", 401);
  const info = await res.json();
  if (info.aud !== env.GOOGLE_CLIENT_ID) bad("This sign-in isn't valid for this app.", "AUTH", 401);
  if (info.email_verified !== "true" && info.email_verified !== true) bad("Your Google email isn't verified.", "AUTH", 401);
  if ((info.email || "").toLowerCase() !== (env.MASTER_ADMIN_EMAIL || "").toLowerCase())
    bad("This account isn't the platform owner.", "FORBIDDEN", 403);
  return info.email;
}

/* ---------- files (KV) ---------- */
async function putFile(env, dataUrl, kind = "misc") {
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(dataUrl || "")) bad("Only PNG, JPEG or WebP images can be uploaded.", "VALIDATION");
  const b64 = dataUrl.split(",")[1];
  if (b64.length * 0.75 > 3_000_000) bad("That image is too large. Please use one under 3 MB.", "VALIDATION");
  const id = `FILE-${uuid()}`;
  await env.FILES.put(id, dataUrl, { metadata: { kind, created_at: nowIso() } });
  return id;
}

/* ---------- shaping ---------- */
const shapeProduct = r => ({
  product_id: r.product_id, name: r.name, price: r.price, stock: r.stock,
  category_id: r.category_id, description: r.description || "",
  images: p(r.images, []), variant_groups: p(r.variant_groups, []),
  is_active: r.is_active, sort: r.sort
});

function priceFor(prod, variant) {
  const groups = prod.variant_groups || [];
  if (!variant || !groups.length) return prod.price;
  return groups.reduce((price, g) => {
    const i = (g.options || []).indexOf(variant[g.name]);
    return price + (i > -1 ? (g.price_delta?.[i] || 0) : 0);
  }, prod.price);
}

/* ========================= ACTIONS ========================= */
const A = {};

/* ---- Public storefront ---- */
A.public_get_store = async (env, body) => {
  const s = await env.DB.prepare("SELECT * FROM stores WHERE public_store_id = ?")
    .bind(String(body.public_store_id || "").toUpperCase()).first();
  if (!s) bad("We couldn't find that store.", "NOT_FOUND", 404);
  await refreshLifecycle(env, s);
  if (!s.customer_store_enabled) bad("This store isn't open right now.", "STORE_CLOSED", 403);

  const [set, cats, pms, ff, sch] = await Promise.all([
    env.DB.prepare("SELECT * FROM store_settings WHERE store_id=?").bind(s.store_id).first(),
    env.DB.prepare("SELECT * FROM categories WHERE store_id=? ORDER BY sort").bind(s.store_id).all(),
    env.DB.prepare("SELECT * FROM store_payment_methods WHERE store_id=? AND is_active=1").bind(s.store_id).all(),
    env.DB.prepare("SELECT * FROM fulfillment_settings WHERE store_id=? AND enabled=1").bind(s.store_id).all(),
    env.DB.prepare("SELECT * FROM scheduling_settings WHERE store_id=?").bind(s.store_id).first()
  ]);

  return {
    public_store_id: s.public_store_id, business_name: s.business_name, status: s.status,
    customer_store_enabled: !!s.customer_store_enabled,
    logo: set?.logo_file_id || "", accent_color: set?.accent_color || "#173d24",
    announcement: set?.announcement || "", tagline: set?.tagline || "",
    contact: p(set?.contact, []).filter(c => c.visible),
    categories: cats.results,
    payment_methods: pms.results.map(m => ({ ...m, valid_for: p(m.valid_for, []) })),
    fulfillment: ff.results.map(f => ({ ...f, locations: p(f.locations, []) })),
    scheduling: sch ? { ...sch, blocked_weekdays: p(sch.blocked_weekdays, []), blocked_dates: p(sch.blocked_dates, []) } : { enabled: 0 }
  };
};

A.public_list_products = async (env, body) => {
  const s = await env.DB.prepare("SELECT store_id FROM stores WHERE public_store_id=? AND customer_store_enabled=1")
    .bind(String(body.public_store_id || "").toUpperCase()).first();
  if (!s) bad("Store not found.", "NOT_FOUND", 404);
  const limit = Math.min(Number(body.limit) || 20, 60);
  const offset = Math.max(Number(body.offset) || 0, 0);
  const where = ["store_id = ?", "is_active = 1"], args = [s.store_id];
  if (body.category_id) { where.push("category_id = ?"); args.push(body.category_id); }
  if (body.q) { where.push("(name LIKE ? OR description LIKE ?)"); args.push(`%${body.q}%`, `%${body.q}%`); }
  const w = where.join(" AND ");
  const [rows, count] = await Promise.all([
    env.DB.prepare(`SELECT * FROM products WHERE ${w} ORDER BY sort, rowid LIMIT ? OFFSET ?`).bind(...args, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM products WHERE ${w}`).bind(...args).first()
  ]);
  return { items: rows.results.map(shapeProduct), total: count.n, has_more: offset + rows.results.length < count.n };
};

A.public_get_product = async (env, body) => {
  const r = await env.DB.prepare("SELECT * FROM products WHERE product_id=? AND is_active=1").bind(body.product_id).first();
  if (!r) bad("Product not found.", "NOT_FOUND", 404);
  return shapeProduct(r);
};

A.public_validate_cart = async (env, body) => {
  const s = await env.DB.prepare("SELECT store_id FROM stores WHERE public_store_id=?")
    .bind(String(body.public_store_id || "").toUpperCase()).first();
  if (!s) bad("Store not found.", "NOT_FOUND", 404);
  const issues = [], items = [];
  for (const it of body.items || []) {
    const row = await env.DB.prepare("SELECT * FROM products WHERE product_id=? AND store_id=?")
      .bind(it.product_id, s.store_id).first();
    if (!row || !row.is_active) { issues.push({ product_id: it.product_id, type: "REMOVED", message: `"${it.name}" is no longer available and was removed.` }); continue; }
    const prod = shapeProduct(row);
    if (prod.stock <= 0) { issues.push({ product_id: it.product_id, type: "SOLD_OUT", message: `"${prod.name}" just sold out.` }); continue; }
    let qty = it.qty;
    if (prod.stock < qty) { qty = prod.stock; issues.push({ product_id: it.product_id, type: "STOCK", message: `Only ${prod.stock} left of "${prod.name}" — quantity adjusted.` }); }
    const live = priceFor(prod, it.variant);
    if (live !== it.price) issues.push({ product_id: it.product_id, type: "PRICE", message: `The price of "${prod.name}" changed.` });
    items.push({ ...it, qty, price: live });
  }
  return { items, issues, ok: issues.length === 0 };
};

A.public_place_order = async (env, body) => {
  const s = await env.DB.prepare("SELECT * FROM stores WHERE public_store_id=? AND customer_store_enabled=1")
    .bind(String(body.public_store_id || "").toUpperCase()).first();
  if (!s) bad("This store isn't accepting orders right now.", "STORE_CLOSED", 403);
  if (!body.customer_name?.trim() || !body.mobile?.trim()) bad("Your name and mobile number are required.", "VALIDATION");
  if (!body.items?.length) bad("Your cart is empty.", "VALIDATION");

  /* Idempotency: the same client_request_id always returns the same order. */
  if (body.client_request_id) {
    const dupe = await env.DB.prepare("SELECT order_id, order_number FROM orders WHERE client_request_id=?")
      .bind(body.client_request_id).first();
    if (dupe) return { ...dupe, duplicate: true };
  }

  let proof = body.proof_file_id || "";
  if (proof.startsWith("data:")) proof = await putFile(env, proof, "receipt");

  const orderId = uuid();
  const seqRow = await env.DB.prepare("SELECT order_seq FROM stores WHERE store_id=?").bind(s.store_id).first();
  const seq = (seqRow?.order_seq || 1000) + 1;
  const orderNumber = `${(s.business_name || "OR").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "OR"}-${seq}`;

  /* Conditional decrements: `AND stock >= ?` makes overselling impossible even
     under concurrency. If any decrement affects 0 rows, the batch is rejected. */
  const statements = [
    env.DB.prepare("UPDATE stores SET order_seq=? WHERE store_id=?").bind(seq, s.store_id),
    env.DB.prepare(`INSERT INTO orders
      (order_id, order_number, store_id, customer_name, mobile, fulfillment_type, address, meetup_location,
       preferred_date, payment_method, proof_file_id, status, seen, subtotal, delivery_fee, total, notes,
       client_request_id, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'PENDING',0,?,?,?,?,?,?)`)
      .bind(orderId, orderNumber, s.store_id, body.customer_name.trim(), body.mobile.trim(), body.fulfillment_type,
        body.address || "", body.meetup_location || "", body.preferred_date || null, body.payment_method || "",
        proof, body.subtotal, body.delivery_fee || 0, body.total, body.notes || "",
        body.client_request_id || uuid(), nowIso())
  ];
  for (const it of body.items) {
    statements.push(env.DB.prepare("UPDATE products SET stock = stock - ? WHERE product_id = ? AND store_id = ? AND stock >= ?")
      .bind(it.qty, it.product_id, s.store_id, it.qty));
    statements.push(env.DB.prepare(`INSERT INTO order_items (order_item_id, order_id, product_id, name, variant, qty, price)
      VALUES (?,?,?,?,?,?,?)`).bind(uuid(), orderId, it.product_id, it.name, it.variantLabel || "", it.qty, it.price));
  }

  const results = await env.DB.batch(statements);
  const stockWrites = results.filter((_, i) => i >= 2 && (i - 2) % 2 === 0);
  if (stockWrites.some(r => (r.meta?.changes ?? 0) === 0)) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM order_items WHERE order_id=?").bind(orderId),
      env.DB.prepare("DELETE FROM orders WHERE order_id=?").bind(orderId)
    ]);
    bad("Sorry — one of your items just went out of stock. Please review your cart.", "OUT_OF_STOCK", 409);
  }
  return { order_id: orderId, order_number: orderNumber };
};

A.public_track_order = async (env, body) => {
  const s = await env.DB.prepare("SELECT store_id FROM stores WHERE public_store_id=?")
    .bind(String(body.public_store_id || "").toUpperCase()).first();
  if (!s) bad("Store not found.", "NOT_FOUND", 404);
  const o = await env.DB.prepare("SELECT * FROM orders WHERE store_id=? AND UPPER(order_number)=UPPER(?)")
    .bind(s.store_id, String(body.order_number || "").trim()).first();
  if (!o) bad("We couldn't find an order with that number.", "NOT_FOUND", 404);
  const items = await env.DB.prepare("SELECT name, variant, qty, price FROM order_items WHERE order_id=?").bind(o.order_id).all();
  return { order_number: o.order_number, status: o.status, total: o.total, created_at: o.created_at,
           fulfillment_type: o.fulfillment_type, items: items.results };
};

A.public_list_plans = async env =>
  (await env.DB.prepare("SELECT * FROM subscription_plans WHERE is_active=1 ORDER BY price").all()).results;

A.public_list_master_payment_methods = async env =>
  (await env.DB.prepare("SELECT * FROM master_payment_methods WHERE is_active=1").all()).results;

/* ---- Merchant ---- */
A.store_login = async (env, body, ctx) => {
  const s = await currentStore(env, ctx.req, body);
  const set = await env.DB.prepare("SELECT * FROM store_settings WHERE store_id=?").bind(s.store_id).first();
  return { store: s, settings: set ? { ...set, contact: p(set.contact, []) } : null };
};

A.store_signup = async (env, body) => {
  for (const f of ["business_name", "owner_name", "owner_email", "plan_id"])
    if (!String(body[f] || "").trim()) bad("Please complete every field before submitting.", "VALIDATION");
  const plan = await env.DB.prepare("SELECT * FROM subscription_plans WHERE plan_id=? AND is_active=1").bind(body.plan_id).first();
  if (!plan) bad("Please choose a valid plan.", "VALIDATION");

  const storeId = newId("STR"), publicId = newId("SHOP"), created = nowIso();
  let receipt = body.receipt_file_id || "";
  if (receipt.startsWith("data:")) receipt = await putFile(env, receipt, "receipt");

  const stmts = [
    env.DB.prepare(`INSERT INTO stores (store_id, public_store_id, business_name, owner_name, owner_email,
      status, access_level, customer_store_enabled, plan_id, created_at, order_seq)
      VALUES (?,?,?,?,?, 'PENDING_VERIFICATION','SUBSCRIPTION_ONLY',0, ?, ?, 1000)`)
      .bind(storeId, publicId, body.business_name.trim(), body.owner_name.trim(), body.owner_email.trim().toLowerCase(), body.plan_id, created),
    env.DB.prepare(`INSERT INTO store_settings (store_id, logo_file_id, accent_color, announcement, tagline, contact)
      VALUES (?,'','#173d24','','','[]')`).bind(storeId),
    env.DB.prepare(`INSERT INTO categories (category_id, store_id, name, is_system, sort) VALUES (?,?, 'Uncategorized',1,99)`)
      .bind(uuid(), storeId),
    env.DB.prepare(`INSERT INTO scheduling_settings (store_id, enabled, prep_days, max_advance_days, blocked_weekdays, blocked_dates)
      VALUES (?,0,0,14,'[]','[]')`).bind(storeId),
    env.DB.prepare(`INSERT INTO subscription_payments (payment_id, store_id, plan_id, amount, kind, status, receipt_file_id, reference, created_at)
      VALUES (?,?,?,?, 'SIGNUP','PENDING',?,?,?)`)
      .bind(uuid(), storeId, body.plan_id, plan.price, receipt, body.reference || "", created)
  ];
  for (const t of ["delivery", "pickup", "meetup"])
    stmts.push(env.DB.prepare(`INSERT INTO fulfillment_settings (store_id, type, enabled, fee_mode, fee, address, instructions, locations)
      VALUES (?,?,0,'fixed',0,'','','[]')`).bind(storeId, t));
  await env.DB.batch(stmts);

  const store = await env.DB.prepare("SELECT * FROM stores WHERE store_id=?").bind(storeId).first();
  return { store };
};

A.store_dashboard = async (env, body, ctx) => {
  const s = requireAccess(await currentStore(env, ctx.req, body), ["FULL_ADMIN", "ORDERS_AND_SUBSCRIPTION", "INITIAL_SETUP", "SUBSCRIPTION_ONLY"]);
  const today = nowIso().slice(0, 10), month = nowIso().slice(0, 7);
  const q = (sql, ...a) => env.DB.prepare(sql).bind(s.store_id, ...a).first();
  const [ordersToday, pending, unseen, products, revToday, revMonth, revAll, recent] = await Promise.all([
    q("SELECT COUNT(*) n FROM orders WHERE store_id=? AND substr(created_at,1,10)=?", today),
    q("SELECT COUNT(*) n FROM orders WHERE store_id=? AND status='PENDING'"),
    q("SELECT COUNT(*) n FROM orders WHERE store_id=? AND seen=0"),
    q("SELECT COUNT(*) n FROM products WHERE store_id=?"),
    q("SELECT COALESCE(SUM(total),0) n FROM orders WHERE store_id=? AND status IN ('PAID','COMPLETED') AND substr(created_at,1,10)=?", today),
    q("SELECT COALESCE(SUM(total),0) n FROM orders WHERE store_id=? AND status IN ('PAID','COMPLETED') AND substr(created_at,1,7)=?", month),
    q("SELECT COALESCE(SUM(total),0) n FROM orders WHERE store_id=? AND status IN ('PAID','COMPLETED')"),
    env.DB.prepare("SELECT * FROM orders WHERE store_id=? ORDER BY created_at DESC LIMIT 5").bind(s.store_id).all()
  ]);
  return {
    store: s, orders_today: ordersToday.n, pending: pending.n, unseen: unseen.n, products: products.n,
    revenue_today: revToday.n, revenue_month: revMonth.n, revenue_all: revAll.n, recent: recent.results,
    days_left: s.subscription_expiry ? Math.ceil((new Date(s.subscription_expiry) - Date.now()) / 86400000) : null
  };
};

A.store_list_orders = async (env, body, ctx) => {
  const s = requireAccess(await currentStore(env, ctx.req, body), ["FULL_ADMIN", "ORDERS_AND_SUBSCRIPTION"]);
  const where = ["store_id = ?"], args = [s.store_id];
  if (body.status) { where.push("status = ?"); args.push(body.status); }
  if (body.q) { where.push("(order_number LIKE ? OR customer_name LIKE ? OR mobile LIKE ?)"); args.push(`%${body.q}%`, `%${body.q}%`, `%${body.q}%`); }
  const rows = await env.DB.prepare(`SELECT * FROM orders WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 300`).bind(...args).all();
  const ids = rows.results.map(o => o.order_id);
  let itemsByOrder = {};
  if (ids.length) {
    const items = await env.DB.prepare(
      `SELECT * FROM order_items WHERE order_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
    itemsByOrder = items.results.reduce((m, i) => ((m[i.order_id] ||= []).push(i), m), {});
  }
  return { items: rows.results.map(o => ({ ...o, items: itemsByOrder[o.order_id] || [] })) };
};

A.store_update_order = async (env, body, ctx) => {
  const s = requireAccess(await currentStore(env, ctx.req, body), ["FULL_ADMIN", "ORDERS_AND_SUBSCRIPTION"]);
  const VALID = ["PENDING", "UNPAID", "PAID", "COMPLETED", "CANCELLED"];
  if (body.status && !VALID.includes(body.status)) bad("That isn't a valid order status.", "VALIDATION");
  const sets = [], args = [];
  if (body.status) { sets.push("status = ?"); args.push(body.status); }
  if (body.seen != null) { sets.push("seen = ?"); args.push(body.seen ? 1 : 0); }
  if (!sets.length) bad("Nothing to update.", "VALIDATION");
  const r = await env.DB.prepare(`UPDATE orders SET ${sets.join(", ")} WHERE order_id=? AND store_id=?`)
    .bind(...args, body.order_id, s.store_id).run();
  if (!r.meta.changes) bad("Order not found.", "NOT_FOUND", 404);
  return { ok: true };
};

A.store_save_product = async (env, body, ctx) => {
  const s = requireAccess(await currentStore(env, ctx.req, body), ["FULL_ADMIN", "INITIAL_SETUP"]);
  const pr = body.product || {};
  if (!String(pr.name || "").trim()) bad("A product needs a name.", "VALIDATION");
  if (pr.price == null || Number(pr.price) < 0) bad("Enter a valid price.", "VALIDATION");

  /* The setup wizard doesn't ask for a category, and D1 rejects undefined
     binds. Fall back to the store's protected "Uncategorized" row. */
  if (!pr.category_id) {
    const fallback = await env.DB.prepare(
      "SELECT category_id FROM categories WHERE store_id=? AND is_system=1"
    ).bind(s.store_id).first();
    pr.category_id = fallback?.category_id ?? null;
  }

  const images = [];
  for (const img of pr.images || []) images.push(img?.startsWith("data:") ? await putFile(env, img, "product") : img);

  if (pr.product_id) {
    const r = await env.DB.prepare(`UPDATE products SET name=?, price=?, stock=?, category_id=?, description=?,
      images=?, variant_groups=?, is_active=? WHERE product_id=? AND store_id=?`)
      .bind(pr.name.trim(), Number(pr.price), Number(pr.stock) || 0, pr.category_id, pr.description || "",
        j(images), j(pr.variant_groups || []), pr.is_active ? 1 : 1, pr.product_id, s.store_id).run();
    if (!r.meta.changes) bad("Product not found.", "NOT_FOUND", 404);
    return { product_id: pr.product_id };
  }
  const id = uuid();
  const next = await env.DB.prepare("SELECT COALESCE(MAX(sort),-1)+1 AS n FROM products WHERE store_id=?").bind(s.store_id).first();
  await env.DB.prepare(`INSERT INTO products (product_id, store_id, name, price, stock, category_id, description,
    images, variant_groups, is_active, sort) VALUES (?,?,?,?,?,?,?,?,?,1,?)`)
    .bind(id, s.store_id, pr.name.trim(), Number(pr.price), Number(pr.stock) || 0, pr.category_id, pr.description || "",
      j(images), j(pr.variant_groups || []), next.n).run();
  return { product_id: id };
};

A.store_delete_product = async (env, body, ctx) => {
  const s = requireAccess(await currentStore(env, ctx.req, body), ["FULL_ADMIN"]);
  await env.DB.prepare("DELETE FROM products WHERE product_id=? AND store_id=?").bind(body.product_id, s.store_id).run();
  return { ok: true };
};

A.store_reorder_products = async (env, body, ctx) => {
  const s = requireAccess(await currentStore(env, ctx.req, body), ["FULL_ADMIN"]);
  await env.DB.batch((body.ids || []).map((id, i) =>
    env.DB.prepare("UPDATE products SET sort=? WHERE product_id=? AND store_id=?").bind(i, id, s.store_id)));
  return { ok: true };
};

A.store_save_category = async (env, body, ctx) => {
  const s = requireAccess(await currentStore(env, ctx.req, body), ["FULL_ADMIN", "INITIAL_SETUP"]);
  const c = body.category || {};
  if (!String(c.name || "").trim()) bad("A category needs a name.", "VALIDATION");
  if (c.category_id) {
    const row = await env.DB.prepare("SELECT * FROM categories WHERE category_id=? AND store_id=?").bind(c.category_id, s.store_id).first();
    if (!row) bad("Category not found.", "NOT_FOUND", 404);
    if (row.is_system) bad("The Uncategorized category can't be renamed.", "PROTECTED", 403);
    await env.DB.prepare("UPDATE categories SET name=? WHERE category_id=?").bind(c.name.trim(), c.category_id).run();
    return { category_id: c.category_id };
  }
  const id = uuid();
  const next = await env.DB.prepare("SELECT COALESCE(MAX(sort),-1)+1 AS n FROM categories WHERE store_id=? AND is_system=0").bind(s.store_id).first();
  await env.DB.prepare("INSERT INTO categories (category_id, store_id, name, is_system, sort) VALUES (?,?,?,0,?)")
    .bind(id, s.store_id, c.name.trim(), next.n).run();
  return { category_id: id };
};

A.store_delete_category = async (env, body, ctx) => {
  const s = requireAccess(await currentStore(env, ctx.req, body), ["FULL_ADMIN"]);
  const row = await env.DB.prepare("SELECT * FROM categories WHERE category_id=? AND store_id=?").bind(body.category_id, s.store_id).first();
  if (!row) bad("Category not found.", "NOT_FOUND", 404);
  if (row.is_system) bad("The Uncategorized category can't be deleted.", "PROTECTED", 403);
  const fallback = await env.DB.prepare("SELECT category_id FROM categories WHERE store_id=? AND is_system=1").bind(s.store_id).first();
  await env.DB.batch([
    env.DB.prepare("UPDATE products SET category_id=? WHERE category_id=? AND store_id=?").bind(fallback.category_id, body.category_id, s.store_id),
    env.DB.prepare("DELETE FROM categories WHERE category_id=?").bind(body.category_id)
  ]);
  return { ok: true };
};

A.store_save_payment_method = async (env, body, ctx) => {
  const s = requireAccess(await currentStore(env, ctx.req, body), ["FULL_ADMIN", "INITIAL_SETUP"]);
  const m = body.method || {};
  if (!String(m.name || "").trim()) bad("Give this payment method a name.", "VALIDATION");
  let qr = m.qr_file_id || "";
  if (qr.startsWith("data:")) qr = await putFile(env, qr, "qr");
  if (m.method_id) {
    await env.DB.prepare(`UPDATE store_payment_methods SET name=?, account_name=?, account_number=?, qr_file_id=?,
      requires_proof=?, valid_for=?, is_active=? WHERE method_id=? AND store_id=?`)
      .bind(m.name.trim(), m.account_name || "", m.account_number || "", qr, m.requires_proof ? 1 : 0,
        j(m.valid_for || []), m.is_active == null ? 1 : (m.is_active ? 1 : 0), m.method_id, s.store_id).run();
    return { method_id: m.method_id };
  }
  const id = uuid();
  await env.DB.prepare(`INSERT INTO store_payment_methods (method_id, store_id, name, account_name, account_number,
    qr_file_id, requires_proof, valid_for, is_active) VALUES (?,?,?,?,?,?,?,?,1)`)
    .bind(id, s.store_id, m.name.trim(), m.account_name || "", m.account_number || "", qr, m.requires_proof ? 1 : 0, j(m.valid_for || [])).run();
  return { method_id: id };
};

A.store_delete_payment_method = async (env, body, ctx) => {
  const s = requireAccess(await currentStore(env, ctx.req, body), ["FULL_ADMIN"]);
  await env.DB.prepare("DELETE FROM store_payment_methods WHERE method_id=? AND store_id=?").bind(body.method_id, s.store_id).run();
  return { ok: true };
};

A.store_save_fulfillment = async (env, body, ctx) => {
  const s = requireAccess(await currentStore(env, ctx.req, body), ["FULL_ADMIN", "INITIAL_SETUP"]);
  const stmts = (body.rows || []).map(r => env.DB.prepare(
    `INSERT INTO fulfillment_settings (store_id, type, enabled, fee_mode, fee, address, instructions, locations)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(store_id, type) DO UPDATE SET enabled=excluded.enabled, fee_mode=excluded.fee_mode,
       fee=excluded.fee, address=excluded.address, instructions=excluded.instructions, locations=excluded.locations`)
    .bind(s.store_id, r.type, r.enabled ? 1 : 0, r.fee_mode || "fixed", Number(r.fee) || 0,
      r.address || "", r.instructions || "", j(r.locations || [])));
  if (body.scheduling) {
    const sc = body.scheduling;
    stmts.push(env.DB.prepare(
      `INSERT INTO scheduling_settings (store_id, enabled, prep_days, max_advance_days, blocked_weekdays, blocked_dates)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(store_id) DO UPDATE SET enabled=excluded.enabled, prep_days=excluded.prep_days,
         max_advance_days=excluded.max_advance_days, blocked_weekdays=excluded.blocked_weekdays, blocked_dates=excluded.blocked_dates`)
      .bind(s.store_id, sc.enabled ? 1 : 0, Number(sc.prep_days) || 0, Number(sc.max_advance_days) || 14,
        j(sc.blocked_weekdays || []), j(sc.blocked_dates || [])));
  }
  await env.DB.batch(stmts);
  return { ok: true };
};

A.store_save_settings = async (env, body, ctx) => {
  const s = requireAccess(await currentStore(env, ctx.req, body), ["FULL_ADMIN", "INITIAL_SETUP"]);
  const st = body.settings || {};
  let logo = st.logo_file_id || "";
  if (logo.startsWith("data:")) logo = await putFile(env, logo, "logo");
  const stmts = [env.DB.prepare(`UPDATE store_settings SET logo_file_id=?, accent_color=?, announcement=?, tagline=?, contact=?
    WHERE store_id=?`).bind(logo, st.accent_color || "#173d24", st.announcement || "", st.tagline || "", j(st.contact || []), s.store_id)];
  if (String(body.business_name || "").trim())
    stmts.push(env.DB.prepare("UPDATE stores SET business_name=? WHERE store_id=?").bind(body.business_name.trim(), s.store_id));
  await env.DB.batch(stmts);
  return { ok: true };
};

A.store_complete_setup = async (env, body, ctx) => {
  const s = await currentStore(env, ctx.req, body);
  if (s.access_level !== "INITIAL_SETUP") bad("Setup has already been completed.", "VALIDATION");
  await env.DB.prepare("UPDATE stores SET access_level='FULL_ADMIN', customer_store_enabled=1 WHERE store_id=?").bind(s.store_id).run();
  const store = await env.DB.prepare("SELECT * FROM stores WHERE store_id=?").bind(s.store_id).first();
  return { store };
};

A.store_get_subscription = async (env, body, ctx) => {
  const s = await currentStore(env, ctx.req, body);
  const [plan, plans, mpm, history] = await Promise.all([
    s.plan_id ? env.DB.prepare("SELECT * FROM subscription_plans WHERE plan_id=?").bind(s.plan_id).first() : null,
    env.DB.prepare("SELECT * FROM subscription_plans WHERE is_active=1 ORDER BY price").all(),
    env.DB.prepare("SELECT * FROM master_payment_methods WHERE is_active=1").all(),
    env.DB.prepare(`SELECT sp.*, pl.name AS plan_name FROM subscription_payments sp
      LEFT JOIN subscription_plans pl ON pl.plan_id = sp.plan_id
      WHERE sp.store_id=? ORDER BY sp.created_at DESC`).bind(s.store_id).all()
  ]);
  return { store: s, plan, plans: plans.results, master_payment_methods: mpm.results, history: history.results,
           days_left: s.subscription_expiry ? Math.ceil((new Date(s.subscription_expiry) - Date.now()) / 86400000) : null };
};

A.store_submit_payment = async (env, body, ctx) => {
  const s = await currentStore(env, ctx.req, body);
  const plan = await env.DB.prepare("SELECT * FROM subscription_plans WHERE plan_id=? AND is_active=1").bind(body.plan_id).first();
  if (!plan) bad("Please choose a valid plan.", "VALIDATION");
  const open = await env.DB.prepare("SELECT payment_id FROM subscription_payments WHERE store_id=? AND status='PENDING'").bind(s.store_id).first();
  if (open) bad("You already have a payment waiting for review.", "DUPLICATE", 409);
  let receipt = body.receipt_file_id || "";
  if (receipt.startsWith("data:")) receipt = await putFile(env, receipt, "receipt");
  await env.DB.prepare(`INSERT INTO subscription_payments (payment_id, store_id, plan_id, amount, kind, status,
    receipt_file_id, reference, created_at) VALUES (?,?,?,?,?, 'PENDING',?,?,?)`)
    .bind(uuid(), s.store_id, body.plan_id, plan.price, body.kind === "SIGNUP" ? "SIGNUP" : "RENEWAL",
      receipt, body.reference || "", nowIso()).run();
  return { ok: true };
};

/* ---- Master admin ---- */
A.master_sign_in = async (env, body, ctx) => ({ email: await masterEmail(env, ctx.req, body), ok: true });

A.master_dashboard = async (env, body, ctx) => {
  await masterEmail(env, ctx.req, body);
  const one = sql => env.DB.prepare(sql).first();
  const [total, active, expired, pendingPay, revenue, recent] = await Promise.all([
    one("SELECT COUNT(*) n FROM stores"),
    one("SELECT COUNT(*) n FROM stores WHERE status='ACTIVE'"),
    one("SELECT COUNT(*) n FROM stores WHERE status='EXPIRED'"),
    one("SELECT COUNT(*) n FROM subscription_payments WHERE status='PENDING'"),
    one("SELECT COALESCE(SUM(amount),0) n FROM subscription_payments WHERE status='APPROVED'"),
    env.DB.prepare("SELECT * FROM stores ORDER BY created_at DESC LIMIT 5").all()
  ]);
  return { total: total.n, active: active.n, expired: expired.n, pending_payments: pendingPay.n,
           revenue: revenue.n, recent_stores: recent.results };
};

A.master_list_stores = async (env, body, ctx) => {
  await masterEmail(env, ctx.req, body);
  const where = ["1=1"], args = [];
  if (body.status) { where.push("status=?"); args.push(body.status); }
  if (body.q) { where.push("(business_name LIKE ? OR store_id LIKE ? OR public_store_id LIKE ? OR owner_email LIKE ?)");
    args.push(...Array(4).fill(`%${body.q}%`)); }
  const rows = await env.DB.prepare(`SELECT * FROM stores WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 300`).bind(...args).all();
  return { items: rows.results };
};

A.master_get_store = async (env, body, ctx) => {
  await masterEmail(env, ctx.req, body);
  const store = await env.DB.prepare("SELECT * FROM stores WHERE store_id=?").bind(body.store_id).first();
  if (!store) bad("Store not found.", "NOT_FOUND", 404);
  const [settings, products, orders, payments] = await Promise.all([
    env.DB.prepare("SELECT * FROM store_settings WHERE store_id=?").bind(body.store_id).first(),
    env.DB.prepare("SELECT COUNT(*) n FROM products WHERE store_id=?").bind(body.store_id).first(),
    env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE store_id=?").bind(body.store_id).first(),
    env.DB.prepare(`SELECT sp.*, pl.name AS plan_name FROM subscription_payments sp
      LEFT JOIN subscription_plans pl ON pl.plan_id=sp.plan_id WHERE sp.store_id=? ORDER BY sp.created_at DESC`).bind(body.store_id).all()
  ]);
  return { store, settings, products: products.n, orders: orders.n, payments: payments.results };
};

A.master_set_store_status = async (env, body, ctx) => {
  await masterEmail(env, ctx.req, body);
  const MAP = {
    ACTIVE: ["FULL_ADMIN", 1], EXPIRED: ["ORDERS_AND_SUBSCRIPTION", 0],
    SUSPENDED: ["BLOCKED", 0], ARCHIVED: ["BLOCKED", 0], PENDING_VERIFICATION: ["SUBSCRIPTION_ONLY", 0]
  };
  const m = MAP[body.status];
  if (!m) bad("That isn't a valid store status.", "VALIDATION");
  const r = await env.DB.prepare("UPDATE stores SET status=?, access_level=?, customer_store_enabled=? WHERE store_id=?")
    .bind(body.status, m[0], m[1], body.store_id).run();
  if (!r.meta.changes) bad("Store not found.", "NOT_FOUND", 404);
  return { ok: true };
};

A.master_regenerate_store_id = async (env, body, ctx) => {
  await masterEmail(env, ctx.req, body);
  const next = newId("STR");
  /* store_id is the FK across every child table; ON UPDATE CASCADE handles the rest. */
  const r = await env.DB.prepare("UPDATE stores SET store_id=? WHERE store_id=?").bind(next, body.store_id).run();
  if (!r.meta.changes) bad("Store not found.", "NOT_FOUND", 404);
  return { store_id: next };
};

A.master_extend_subscription = async (env, body, ctx) => {
  await masterEmail(env, ctx.req, body);
  const s = await env.DB.prepare("SELECT * FROM stores WHERE store_id=?").bind(body.store_id).first();
  if (!s) bad("Store not found.", "NOT_FOUND", 404);
  const base = s.subscription_expiry && new Date(s.subscription_expiry) > new Date() ? s.subscription_expiry : nowIso();
  await env.DB.prepare(`UPDATE stores SET subscription_expiry=?, subscription_start=COALESCE(subscription_start,?),
    status='ACTIVE', access_level='FULL_ADMIN', customer_store_enabled=1 WHERE store_id=?`)
    .bind(addDays(base, Number(body.days) || 0), nowIso(), body.store_id).run();
  return { ok: true };
};

A.master_delete_store = async (env, body, ctx) => {
  await masterEmail(env, ctx.req, body);
  await env.DB.prepare("DELETE FROM stores WHERE store_id=?").bind(body.store_id).run(); // cascades
  return { ok: true };
};

A.master_list_pending_payments = async (env, body, ctx) => {
  await masterEmail(env, ctx.req, body);
  const rows = await env.DB.prepare(`SELECT sp.*, st.business_name AS store_name, pl.name AS plan_name
    FROM subscription_payments sp
    JOIN stores st ON st.store_id = sp.store_id
    LEFT JOIN subscription_plans pl ON pl.plan_id = sp.plan_id
    WHERE sp.status='PENDING' ORDER BY sp.created_at ASC`).all();
  return { items: rows.results };
};

A.master_review_payment = async (env, body, ctx) => {
  await masterEmail(env, ctx.req, body);
  const pay = await env.DB.prepare("SELECT * FROM subscription_payments WHERE payment_id=?").bind(body.payment_id).first();
  if (!pay) bad("Payment not found.", "NOT_FOUND", 404);
  if (pay.status !== "PENDING") bad("This payment has already been reviewed.", "VALIDATION");

  if (!body.approve) {
    if (!String(body.reason || "").trim()) bad("Please give the merchant a reason.", "VALIDATION");
    await env.DB.prepare("UPDATE subscription_payments SET status='REJECTED', reject_reason=?, reviewed_at=? WHERE payment_id=?")
      .bind(body.reason.trim(), nowIso(), body.payment_id).run();
    return { ok: true };
  }
  const [store, plan] = await Promise.all([
    env.DB.prepare("SELECT * FROM stores WHERE store_id=?").bind(pay.store_id).first(),
    env.DB.prepare("SELECT * FROM subscription_plans WHERE plan_id=?").bind(pay.plan_id).first()
  ]);
  const base = store.subscription_expiry && new Date(store.subscription_expiry) > new Date() ? store.subscription_expiry : nowIso();
  const signup = pay.kind === "SIGNUP";
  await env.DB.batch([
    env.DB.prepare("UPDATE subscription_payments SET status='APPROVED', reviewed_at=? WHERE payment_id=?").bind(nowIso(), body.payment_id),
    env.DB.prepare(`UPDATE stores SET plan_id=?, subscription_start=COALESCE(subscription_start,?), subscription_expiry=?,
      status='ACTIVE', access_level=?, customer_store_enabled=? WHERE store_id=?`)
      .bind(pay.plan_id, nowIso(), addDays(base, plan?.duration_days || 30),
        signup ? "INITIAL_SETUP" : "FULL_ADMIN", signup ? 0 : 1, pay.store_id)
  ]);
  return { ok: true };
};

A.master_save_plan = async (env, body, ctx) => {
  await masterEmail(env, ctx.req, body);
  const pl = body.plan || {};
  if (!String(pl.name || "").trim()) bad("Give the plan a name.", "VALIDATION");
  if (pl.plan_id) {
    await env.DB.prepare("UPDATE subscription_plans SET name=?, price=?, duration_days=?, blurb=?, is_active=? WHERE plan_id=?")
      .bind(pl.name.trim(), Number(pl.price) || 0, Number(pl.duration_days) || 30, pl.blurb || "", pl.is_active ? 1 : 0, pl.plan_id).run();
    return { plan_id: pl.plan_id };
  }
  const id = uuid();
  await env.DB.prepare("INSERT INTO subscription_plans (plan_id, name, price, duration_days, blurb, is_active) VALUES (?,?,?,?,?,1)")
    .bind(id, pl.name.trim(), Number(pl.price) || 0, Number(pl.duration_days) || 30, pl.blurb || "").run();
  return { plan_id: id };
};

A.master_save_master_payment_method = async (env, body, ctx) => {
  await masterEmail(env, ctx.req, body);
  const m = body.method || {};
  if (!String(m.name || "").trim()) bad("Give the method a name.", "VALIDATION");
  let qr = m.qr_file_id || "";
  if (qr.startsWith("data:")) qr = await putFile(env, qr, "qr");
  if (m.method_id) {
    await env.DB.prepare(`UPDATE master_payment_methods SET name=?, account_name=?, account_number=?, qr_file_id=?, is_active=?
      WHERE method_id=?`).bind(m.name.trim(), m.account_name || "", m.account_number || "", qr, m.is_active ? 1 : 0, m.method_id).run();
    return { method_id: m.method_id };
  }
  const id = uuid();
  await env.DB.prepare(`INSERT INTO master_payment_methods (method_id, name, account_name, account_number, qr_file_id, is_active)
    VALUES (?,?,?,?,?,1)`).bind(id, m.name.trim(), m.account_name || "", m.account_number || "", qr).run();
  return { method_id: id };
};

/* ---- Files ---- */
A.file_upload = async (env, body) => ({ file_id: await putFile(env, body.data, body.kind) });

/* ========================= Router ========================= */
const PUBLIC_ACTIONS = new Set(Object.keys(A).filter(k => k.startsWith("public_")));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const allowed = (env.ALLOWED_ORIGINS || "*").split(",").map(s => s.trim());
    const reqOrigin = req.headers.get("Origin") || "";
    const origin = allowed.includes("*") ? "*" : (allowed.includes(reqOrigin) ? reqOrigin : allowed[0] || "");

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Store-Id",
        "Access-Control-Max-Age": "86400"
      } });
    }

    /* Serve KV files directly (long-cached, immutable). */
    if (url.searchParams.get("action") === "file_get") {
      const id = url.searchParams.get("id");
      const data = id ? await env.FILES.get(id) : null;
      if (!data) return fail("File not found.", "NOT_FOUND", 404, origin);
      const [meta, b64] = data.split(",");
      const type = (meta.match(/data:(.*?);/) || [, "image/jpeg"])[1];
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      return new Response(bytes, { headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": origin
      } });
    }

    try {
      let body = {};
      if (req.method === "POST") {
        body = await req.json().catch(() => bad("Your request couldn't be read.", "BAD_JSON"));
      } else if (req.method === "GET") {
        body = Object.fromEntries(url.searchParams.entries());
      } else {
        return fail("Method not allowed.", "METHOD", 405, origin);
      }

      const action = body.action;
      if (!action || !A[action]) return fail("Unknown action.", "UNKNOWN_ACTION", 404, origin);
      if (req.method === "GET" && !PUBLIC_ACTIONS.has(action))
        return fail("This action must be sent as a POST request.", "METHOD", 405, origin);

      const data = await A[action](env, body, { req, url });
      return json(data, 200, origin);
    } catch (e) {
      if (e instanceof AppError) return fail(e.message, e.code, e.status, origin);
      console.error("Unhandled:", e?.stack || e);
      return fail("Something went wrong on our end. Please try again.", "INTERNAL", 500, origin);
    }
  }
};
