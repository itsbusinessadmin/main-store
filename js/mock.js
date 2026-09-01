/* Universal Store — in-browser mock backend (DEMO_MODE only).
   Mirrors the Worker's action names, state machine and validation rules so the
   frontend can be built and demoed with zero infrastructure. Data lives in
   localStorage under us:demo-db. */
(function (w) {
  const KEY = "us:demo-db";
  const rid = p => p + "-" + Array.from({ length: 3 }, () =>
    Math.random().toString(36).slice(2, 6).toUpperCase()).join("-");
  const now = () => new Date().toISOString();
  const addDays = (iso, d) => new Date(new Date(iso).getTime() + d * 86400000).toISOString();

  const IMG = (a, b) => `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/></svg>`)}`;

  function seed() {
    const created = now();
    const store = {
      store_id: "STR-DEMO-2K4X-9QW1",
      public_store_id: "SHOP-DEMO-7H3M-2P8L",
      business_name: "Verde & Co.",
      owner_name: "Jordan S.",
      owner_email: "owner@verde.example",
      status: "ACTIVE",
      access_level: "FULL_ADMIN",
      customer_store_enabled: 1,
      plan_id: "PLAN-STARTER",
      subscription_start: created,
      subscription_expiry: addDays(created, 27),
      created_at: created
    };
    const settings = {
      store_id: store.store_id, logo_file_id: IMG("#173d24", "#caa66b"),
      accent_color: "#173d24", announcement: "Free delivery on orders over \u20b11,500 \u2014 this week only.",
      tagline: "Small-batch home & wellness goods",
      contact: [
        { type: "mobile", value: "+63 917 000 0000", visible: 1 },
        { type: "facebook", value: "facebook.com/verde.co", visible: 1 },
        { type: "email", value: "hello@verde.example", visible: 0 }
      ]
    };
    const cats = [
      { category_id: "CAT-UNCAT", store_id: store.store_id, name: "Uncategorized", is_system: 1, sort: 99 },
      { category_id: "CAT-1", store_id: store.store_id, name: "Wellness", is_system: 0, sort: 0 },
      { category_id: "CAT-2", store_id: store.store_id, name: "Home", is_system: 0, sort: 1 },
      { category_id: "CAT-3", store_id: store.store_id, name: "Gifting", is_system: 0, sort: 2 }
    ];
    const P = (id, name, price, cat, stock, a, b, desc, variants) => ({
      product_id: id, store_id: store.store_id, name, price, category_id: cat, stock,
      images: [IMG(a, b), IMG(b, a)], description: desc, is_active: 1, sort: 0,
      variant_groups: variants || []
    });
    const products = [
      P("PRD-1", "Calm Balm \u2014 Lavender", 480, "CAT-1", 24, "#2f5d43", "#a8c3a0",
        "A slow-melting balm of shea, beeswax and true lavender. Warm a little between your palms before bed.",
        [{ name: "Size", options: ["15g", "30g"], price_delta: [0, 220] }]),
      P("PRD-2", "Linen Table Runner", 1290, "CAT-2", 8, "#8a7b5e", "#e6dcc6",
        "Stonewashed European linen, hand-hemmed. Softens beautifully with every wash.",
        [{ name: "Color", options: ["Oat", "Sage", "Clay"], price_delta: [0, 0, 60] }]),
      P("PRD-3", "Ceramic Pour-Over", 1850, "CAT-2", 5, "#3b4a52", "#c9d6db", "Unglazed exterior, glazed interior. Fits standard #2 filters."),
      P("PRD-4", "Beeswax Taper Set", 640, "CAT-2", 0, "#c39a3f", "#f3e2b6", "Six hand-dipped tapers. Roughly 7 hours of burn time each."),
      P("PRD-5", "Gift Box \u2014 The Quiet Evening", 2400, "CAT-3", 12, "#5b3f5e", "#d9c3dd", "Calm Balm, two tapers and a linen napkin, boxed and ribboned."),
      P("PRD-6", "Magnesium Soak", 720, "CAT-1", 31, "#2d5b63", "#b5dbdf", "Epsom, magnesium chloride and a whisper of eucalyptus."),
      P("PRD-7", "Cedar Room Mist", 890, "CAT-1", 17, "#4a5a35", "#cfdcb4", "Cedarwood, vetiver and bergamot in a fine alcohol-free mist."),
      P("PRD-8", "Stoneware Mug", 760, "CAT-2", 22, "#6b4b3a", "#e0cbb8", "Speckled clay, 300ml, dishwasher-safe.")
    ];
    const payMethods = [
      { method_id: "PM-1", store_id: store.store_id, name: "GCash", account_name: "Verde & Co.", account_number: "0917 000 0000", qr_file_id: IMG("#173d24", "#5fbf85"), requires_proof: 1, valid_for: ["delivery", "pickup", "meetup"], is_active: 1 },
      { method_id: "PM-2", store_id: store.store_id, name: "Bank Transfer (BPI)", account_name: "Verde Trading", account_number: "1234-5678-90", qr_file_id: "", requires_proof: 1, valid_for: ["delivery"], is_active: 1 },
      { method_id: "PM-3", store_id: store.store_id, name: "Cash on Pickup", account_name: "", account_number: "", qr_file_id: "", requires_proof: 0, valid_for: ["pickup", "meetup"], is_active: 1 }
    ];
    const fulfillment = [
      { store_id: store.store_id, type: "delivery", enabled: 1, fee_mode: "fixed", fee: 120, address: "", instructions: "Metro Manila only. Same-day cut-off 2:00 PM.", locations: [] },
      { store_id: store.store_id, type: "pickup", enabled: 1, fee_mode: "fixed", fee: 0, address: "24 Malumanay St., Quezon City", instructions: "Ring the bell at the green gate.", locations: [] },
      { store_id: store.store_id, type: "meetup", enabled: 1, fee_mode: "fixed", fee: 0, address: "", instructions: "", locations: ["Trinoma \u2014 Level 1", "SM North EDSA \u2014 Annex", "Katipunan Station"] }
    ];
    const scheduling = { store_id: store.store_id, enabled: 1, prep_days: 1, max_advance_days: 21, blocked_weekdays: [0], blocked_dates: [] };
    const orders = [
      { order_id: "O1", order_number: "VC-100238", store_id: store.store_id, customer_name: "Maria Reyes", mobile: "+63 918 111 2233", fulfillment_type: "delivery", address: "12 Sampaguita St., Marikina", meetup_location: "", preferred_date: addDays(now(), 2), payment_method: "GCash", proof_file_id: IMG("#444", "#999"), status: "PAID", seen: 0, delivery_fee: 120, subtotal: 1770, total: 1890, created_at: addDays(now(), -0.2), items: [{ name: "Calm Balm \u2014 Lavender", variant: "30g", qty: 1, price: 700 }, { name: "Magnesium Soak", variant: "", qty: 1, price: 720 }, { name: "Cedar Room Mist", variant: "", qty: 0.5, price: 350 }] },
      { order_id: "O2", order_number: "VC-100237", store_id: store.store_id, customer_name: "Paolo Cruz", mobile: "+63 917 555 8899", fulfillment_type: "pickup", address: "", meetup_location: "", preferred_date: addDays(now(), 1), payment_method: "Cash on Pickup", proof_file_id: "", status: "PENDING", seen: 0, delivery_fee: 0, subtotal: 1850, total: 1850, created_at: addDays(now(), -0.9), items: [{ name: "Ceramic Pour-Over", variant: "", qty: 1, price: 1850 }] },
      { order_id: "O3", order_number: "VC-100236", store_id: store.store_id, customer_name: "Ana Lim", mobile: "+63 920 444 1010", fulfillment_type: "meetup", address: "", meetup_location: "Trinoma \u2014 Level 1", preferred_date: addDays(now(), -1), payment_method: "GCash", proof_file_id: "", status: "COMPLETED", seen: 1, delivery_fee: 0, subtotal: 2400, total: 2400, created_at: addDays(now(), -3), items: [{ name: "Gift Box \u2014 The Quiet Evening", variant: "", qty: 1, price: 2400 }] },
      { order_id: "O4", order_number: "VC-100235", store_id: store.store_id, customer_name: "Rico Tan", mobile: "+63 915 222 3344", fulfillment_type: "delivery", address: "9 Katipunan Ave., QC", meetup_location: "", preferred_date: null, payment_method: "Bank Transfer (BPI)", proof_file_id: "", status: "CANCELLED", seen: 1, delivery_fee: 120, subtotal: 760, total: 880, created_at: addDays(now(), -6), items: [{ name: "Stoneware Mug", variant: "", qty: 1, price: 760 }] }
    ];
    const plans = [
      { plan_id: "PLAN-STARTER", name: "Starter", price: 299, duration_days: 30, is_active: 1, blurb: "1 store, unlimited products" },
      { plan_id: "PLAN-GROWTH", name: "Growth", price: 799, duration_days: 90, is_active: 1, blurb: "Everything in Starter, 3 months" },
      { plan_id: "PLAN-YEAR", name: "Annual", price: 2790, duration_days: 365, is_active: 1, blurb: "Best value \u2014 2 months free" }
    ];
    const masterPay = [
      { method_id: "MPM-1", name: "GCash", account_name: "Universal Store PH", account_number: "0999 123 4567", qr_file_id: IMG("#173d24", "#caa66b"), is_active: 1 },
      { method_id: "MPM-2", name: "BDO Transfer", account_name: "Universal Store PH", account_number: "0012-3456-7890", qr_file_id: "", is_active: 1 }
    ];
    const otherStores = [
      { store_id: "STR-PEND-1A2B-3C4D", public_store_id: "SHOP-PEND-9Z8Y-7X6W", business_name: "Bloom Flower Bar", owner_name: "Kaye D.", owner_email: "kaye@bloom.example", status: "PENDING_VERIFICATION", access_level: "SUBSCRIPTION_ONLY", customer_store_enabled: 0, plan_id: "PLAN-STARTER", subscription_start: null, subscription_expiry: null, created_at: addDays(now(), -1) },
      { store_id: "STR-EXPR-5E6F-7G8H", public_store_id: "SHOP-EXPR-4Q3R-2S1T", business_name: "Nook Coffee Supply", owner_name: "Migs A.", owner_email: "migs@nook.example", status: "EXPIRED", access_level: "ORDERS_AND_SUBSCRIPTION", customer_store_enabled: 0, plan_id: "PLAN-STARTER", subscription_start: addDays(now(), -60), subscription_expiry: addDays(now(), -4), created_at: addDays(now(), -62) },
      { store_id: "STR-SUSP-9I0J-1K2L", public_store_id: "SHOP-SUSP-8M7N-6O5P", business_name: "Loud Tees MNL", owner_name: "Bea R.", owner_email: "bea@loud.example", status: "SUSPENDED", access_level: "BLOCKED", customer_store_enabled: 0, plan_id: "PLAN-GROWTH", subscription_start: addDays(now(), -20), subscription_expiry: addDays(now(), 70), created_at: addDays(now(), -21) }
    ];
    const payments = [
      { payment_id: "SP-1", store_id: "STR-PEND-1A2B-3C4D", store_name: "Bloom Flower Bar", plan_id: "PLAN-STARTER", plan_name: "Starter", amount: 299, kind: "SIGNUP", status: "PENDING", receipt_file_id: IMG("#555", "#bbb"), reference: "GC-88213", created_at: addDays(now(), -1), reject_reason: "" },
      { payment_id: "SP-2", store_id: "STR-EXPR-5E6F-7G8H", store_name: "Nook Coffee Supply", plan_id: "PLAN-GROWTH", plan_name: "Growth", amount: 799, kind: "RENEWAL", status: "PENDING", receipt_file_id: "", reference: "BDO-41120", created_at: addDays(now(), -0.4), reject_reason: "" },
      { payment_id: "SP-0", store_id: "STR-DEMO-2K4X-9QW1", store_name: "Verde & Co.", plan_id: "PLAN-STARTER", plan_name: "Starter", amount: 299, kind: "SIGNUP", status: "APPROVED", receipt_file_id: "", reference: "GC-77120", created_at: addDays(now(), -3), reject_reason: "" }
    ];
    return { stores: [store, ...otherStores], settings: [settings], categories: cats, products,
             payMethods, fulfillment, scheduling: [scheduling], orders, plans, masterPay, payments, seq: 100239 };
  }

  let db = null;
  function load() { try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; } if (!db) reset(); return db; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} }
  function reset() { db = seed(); save(); return db; }

  const findStore = id => db.stores.find(s => s.store_id === id);
  const findPublic = pid => db.stores.find(s => s.public_store_id === pid);
  const err = (msg, code = "ERROR") => { const e = new Error(msg); e.code = code; throw e; };

  /* Lifecycle: recompute status/access from the subscription clock (BRAIN.md §5). */
  function refreshLifecycle(s) {
    if (!s || s.status === "SUSPENDED" || s.status === "ARCHIVED" || s.status === "PENDING_VERIFICATION") return s;
    if (s.status === "ACTIVE" && s.subscription_expiry && new Date(s.subscription_expiry) < new Date()) {
      s.status = "EXPIRED"; s.access_level = "ORDERS_AND_SUBSCRIPTION"; s.customer_store_enabled = 0;
    }
    return s;
  }

  function requireStore(api) {
    const s = findStore(api.storeId);
    if (!s) err("That Store ID wasn't recognised.", "AUTH");
    refreshLifecycle(s);
    if (s.access_level === "BLOCKED") err("This store has been suspended by the platform owner.", "BLOCKED");
    return s;
  }
  function requireFullAdmin(api) {
    const s = requireStore(api);
    if (s.access_level !== "FULL_ADMIN" && s.access_level !== "INITIAL_SETUP")
      err("Your subscription needs to be active to change this.", "LOCKED");
    return s;
  }
  function requireMaster(api) { if (!api.masterToken) err("Please sign in as the platform owner.", "AUTH"); }

  const storeSettings = id => db.settings.find(x => x.store_id === id) ||
    (db.settings.push({ store_id: id, logo_file_id: "", accent_color: "#173d24", announcement: "", tagline: "", contact: [] }), db.settings.at(-1));

  function publicStorePayload(s) {
    const st = storeSettings(s.store_id);
    return {
      public_store_id: s.public_store_id, business_name: s.business_name, status: s.status,
      customer_store_enabled: !!s.customer_store_enabled, logo: st.logo_file_id,
      accent_color: st.accent_color, announcement: st.announcement, tagline: st.tagline,
      contact: (st.contact || []).filter(c => c.visible),
      categories: db.categories.filter(c => c.store_id === s.store_id).sort((a, b) => a.sort - b.sort),
      payment_methods: db.payMethods.filter(p => p.store_id === s.store_id && p.is_active),
      fulfillment: db.fulfillment.filter(f => f.store_id === s.store_id && f.enabled),
      scheduling: db.scheduling.find(x => x.store_id === s.store_id) || { enabled: 0 }
    };
  }

  const priceFor = (p, variant) => {
    if (!variant || !p.variant_groups?.length) return p.price;
    let price = p.price;
    p.variant_groups.forEach(g => {
      const chosen = variant[g.name]; const i = g.options.indexOf(chosen);
      if (i > -1) price += (g.price_delta?.[i] || 0);
    });
    return price;
  };

  const handlers = {
    /* ---------- Public storefront ---------- */
    public_get_store: ({ public_store_id }) => {
      const s = findPublic(public_store_id) || err("We couldn't find that store.", "NOT_FOUND");
      refreshLifecycle(s);
      if (!s.customer_store_enabled) err("This store isn't open right now.", "STORE_CLOSED");
      return publicStorePayload(s);
    },
    public_list_products: ({ public_store_id, q = "", category_id = "", offset = 0, limit = 20 }) => {
      const s = findPublic(public_store_id) || err("Store not found.", "NOT_FOUND");
      let rows = db.products.filter(p => p.store_id === s.store_id && p.is_active);
      if (category_id) rows = rows.filter(p => p.category_id === category_id);
      if (q) { const t = q.toLowerCase(); rows = rows.filter(p => (p.name + " " + p.description).toLowerCase().includes(t)); }
      return { items: rows.slice(offset, offset + limit), total: rows.length, has_more: offset + limit < rows.length };
    },
    public_get_product: ({ product_id }) => db.products.find(p => p.product_id === product_id) || err("Product not found.", "NOT_FOUND"),
    public_validate_cart: ({ public_store_id, items = [] }) => {
      const s = findPublic(public_store_id) || err("Store not found.", "NOT_FOUND");
      const issues = [], priced = [];
      items.forEach(it => {
        const p = db.products.find(x => x.product_id === it.product_id && x.store_id === s.store_id);
        if (!p || !p.is_active) return issues.push({ product_id: it.product_id, type: "REMOVED", message: `"${it.name}" is no longer available and was removed.` });
        if (p.stock <= 0) return issues.push({ product_id: it.product_id, type: "SOLD_OUT", message: `"${p.name}" just sold out.` });
        let qty = it.qty;
        if (p.stock < qty) { qty = p.stock; issues.push({ product_id: it.product_id, type: "STOCK", message: `Only ${p.stock} left of "${p.name}" \u2014 quantity adjusted.` }); }
        const live = priceFor(p, it.variant);
        if (live !== it.price) issues.push({ product_id: it.product_id, type: "PRICE", message: `The price of "${p.name}" changed.` });
        priced.push({ ...it, qty, price: live });
      });
      return { items: priced, issues, ok: issues.length === 0 };
    },
    public_place_order: (p) => {
      const s = findPublic(p.public_store_id) || err("Store not found.", "NOT_FOUND");
      const dupe = db.orders.find(o => o.client_request_id && o.client_request_id === p.client_request_id);
      if (dupe) return { order_number: dupe.order_number, order_id: dupe.order_id, duplicate: true };
      /* Atomic-ish stock check then decrement. */
      p.items.forEach(it => {
        const prod = db.products.find(x => x.product_id === it.product_id);
        if (!prod || prod.stock < it.qty) err(`Sorry \u2014 "${it.name}" just went out of stock. Please review your cart.`, "OUT_OF_STOCK");
      });
      p.items.forEach(it => { db.products.find(x => x.product_id === it.product_id).stock -= it.qty; });
      const order = {
        order_id: "O" + db.seq, order_number: "VC-" + db.seq++, store_id: s.store_id,
        customer_name: p.customer_name, mobile: p.mobile, fulfillment_type: p.fulfillment_type,
        address: p.address || "", meetup_location: p.meetup_location || "", preferred_date: p.preferred_date || null,
        payment_method: p.payment_method, proof_file_id: p.proof_file_id || "", status: "PENDING", seen: 0,
        delivery_fee: p.delivery_fee || 0, subtotal: p.subtotal, total: p.total, notes: p.notes || "",
        created_at: now(), client_request_id: p.client_request_id,
        items: p.items.map(i => ({ name: i.name, variant: i.variantLabel || "", qty: i.qty, price: i.price }))
      };
      db.orders.unshift(order); save();
      return { order_number: order.order_number, order_id: order.order_id };
    },
    public_track_order: ({ public_store_id, order_number }) => {
      const s = findPublic(public_store_id) || err("Store not found.", "NOT_FOUND");
      const o = db.orders.find(x => x.store_id === s.store_id && x.order_number.toLowerCase() === String(order_number).toLowerCase().trim());
      if (!o) err("We couldn't find an order with that number.", "NOT_FOUND");
      return { order_number: o.order_number, status: o.status, total: o.total, created_at: o.created_at, items: o.items, fulfillment_type: o.fulfillment_type };
    },
    public_list_plans: () => db.plans.filter(p => p.is_active),
    public_list_master_payment_methods: () => db.masterPay.filter(p => p.is_active),

    /* ---------- Merchant ---------- */
    store_login: ({ store_id }) => {
      const s = db.stores.find(x => x.store_id === String(store_id).trim().toUpperCase());
      if (!s) err("That Store ID wasn't recognised. Check for typos and try again.", "AUTH");
      refreshLifecycle(s); save();
      return { store: s, settings: storeSettings(s.store_id) };
    },
    store_signup: (p) => {
      const s = {
        store_id: rid("STR"), public_store_id: rid("SHOP"), business_name: p.business_name,
        owner_name: p.owner_name, owner_email: p.owner_email, status: "PENDING_VERIFICATION",
        access_level: "SUBSCRIPTION_ONLY", customer_store_enabled: 0, plan_id: p.plan_id,
        subscription_start: null, subscription_expiry: null, created_at: now()
      };
      db.stores.push(s);
      db.settings.push({ store_id: s.store_id, logo_file_id: "", accent_color: "#173d24", announcement: "", tagline: "", contact: [] });
      db.categories.push({ category_id: "CAT-UNCAT-" + s.store_id, store_id: s.store_id, name: "Uncategorized", is_system: 1, sort: 99 });
      ["delivery", "pickup", "meetup"].forEach(t => db.fulfillment.push({ store_id: s.store_id, type: t, enabled: 0, fee_mode: "fixed", fee: 0, address: "", instructions: "", locations: [] }));
      db.scheduling.push({ store_id: s.store_id, enabled: 0, prep_days: 0, max_advance_days: 14, blocked_weekdays: [], blocked_dates: [] });
      const plan = db.plans.find(x => x.plan_id === p.plan_id);
      db.payments.unshift({ payment_id: "SP-" + Date.now(), store_id: s.store_id, store_name: s.business_name, plan_id: p.plan_id, plan_name: plan?.name || "", amount: plan?.price || 0, kind: "SIGNUP", status: "PENDING", receipt_file_id: p.receipt_file_id || "", reference: p.reference || "", created_at: now(), reject_reason: "" });
      save();
      return { store: s };
    },
    store_dashboard: (_, api) => {
      const s = requireStore(api);
      const os = db.orders.filter(o => o.store_id === s.store_id);
      const today = new Date().toDateString();
      const paid = o => ["PAID", "COMPLETED"].includes(o.status);
      const sum = arr => arr.reduce((t, o) => t + o.total, 0);
      const thisMonth = o => new Date(o.created_at).getMonth() === new Date().getMonth();
      return {
        store: s, settings: storeSettings(s.store_id),
        orders_today: os.filter(o => new Date(o.created_at).toDateString() === today).length,
        pending: os.filter(o => o.status === "PENDING").length,
        unseen: os.filter(o => !o.seen).length,
        products: db.products.filter(p => p.store_id === s.store_id).length,
        revenue_today: sum(os.filter(o => paid(o) && new Date(o.created_at).toDateString() === today)),
        revenue_month: sum(os.filter(o => paid(o) && thisMonth(o))),
        revenue_all: sum(os.filter(paid)),
        recent: os.slice(0, 5),
        days_left: s.subscription_expiry ? Math.ceil((new Date(s.subscription_expiry) - Date.now()) / 86400000) : null
      };
    },
    store_list_orders: ({ status = "", q = "" } = {}, api) => {
      const s = requireStore(api);
      let rows = db.orders.filter(o => o.store_id === s.store_id);
      if (status) rows = rows.filter(o => o.status === status);
      if (q) { const t = q.toLowerCase(); rows = rows.filter(o => (o.order_number + o.customer_name + o.mobile).toLowerCase().includes(t)); }
      return { items: rows };
    },
    store_update_order: ({ order_id, status, seen }, api) => {
      const s = requireStore(api);
      const o = db.orders.find(x => x.order_id === order_id && x.store_id === s.store_id) || err("Order not found.", "NOT_FOUND");
      if (status) o.status = status;
      if (seen != null) o.seen = seen ? 1 : 0;
      save(); return o;
    },
    store_save_product: ({ product }, api) => {
      const s = requireFullAdmin(api);
      if (!product.name?.trim()) err("A product needs a name.", "VALIDATION");
      if (product.price == null || Number(product.price) < 0) err("Enter a valid price.", "VALIDATION");
      if (product.product_id) {
        const i = db.products.findIndex(p => p.product_id === product.product_id && p.store_id === s.store_id);
        if (i < 0) err("Product not found.", "NOT_FOUND");
        db.products[i] = { ...db.products[i], ...product, price: Number(product.price), stock: Number(product.stock) || 0 };
      } else {
        db.products.push({ ...product, product_id: "PRD-" + Date.now(), store_id: s.store_id,
          price: Number(product.price), stock: Number(product.stock) || 0, is_active: 1, sort: db.products.length });
      }
      save(); return { ok: true };
    },
    store_delete_product: ({ product_id }, api) => {
      const s = requireFullAdmin(api);
      db.products = db.products.filter(p => !(p.product_id === product_id && p.store_id === s.store_id));
      save(); return { ok: true };
    },
    store_reorder_products: ({ ids }, api) => {
      requireFullAdmin(api);
      ids.forEach((id, i) => { const p = db.products.find(x => x.product_id === id); if (p) p.sort = i; });
      db.products.sort((a, b) => a.sort - b.sort); save(); return { ok: true };
    },
    store_save_category: ({ category }, api) => {
      const s = requireFullAdmin(api);
      if (!category.name?.trim()) err("A category needs a name.", "VALIDATION");
      if (category.category_id) {
        const c = db.categories.find(x => x.category_id === category.category_id) || err("Category not found.", "NOT_FOUND");
        if (c.is_system) err("The Uncategorized category can't be renamed.", "PROTECTED");
        c.name = category.name;
      } else {
        db.categories.push({ category_id: "CAT-" + Date.now(), store_id: s.store_id, name: category.name, is_system: 0, sort: db.categories.length });
      }
      save(); return { ok: true };
    },
    store_delete_category: ({ category_id }, api) => {
      const s = requireFullAdmin(api);
      const c = db.categories.find(x => x.category_id === category_id) || err("Category not found.", "NOT_FOUND");
      if (c.is_system) err("The Uncategorized category can't be deleted.", "PROTECTED");
      const fallback = db.categories.find(x => x.store_id === s.store_id && x.is_system);
      db.products.forEach(p => { if (p.category_id === category_id) p.category_id = fallback.category_id; });
      db.categories = db.categories.filter(x => x.category_id !== category_id);
      save(); return { ok: true };
    },
    store_save_payment_method: ({ method }, api) => {
      const s = requireFullAdmin(api);
      if (!method.name?.trim()) err("Give this payment method a name.", "VALIDATION");
      if (method.method_id) {
        const i = db.payMethods.findIndex(m => m.method_id === method.method_id);
        db.payMethods[i] = { ...db.payMethods[i], ...method };
      } else db.payMethods.push({ ...method, method_id: "PM-" + Date.now(), store_id: s.store_id, is_active: 1 });
      save(); return { ok: true };
    },
    store_delete_payment_method: ({ method_id }, api) => {
      requireFullAdmin(api);
      db.payMethods = db.payMethods.filter(m => m.method_id !== method_id); save(); return { ok: true };
    },
    store_save_fulfillment: ({ rows, scheduling }, api) => {
      const s = requireFullAdmin(api);
      rows.forEach(r => {
        const i = db.fulfillment.findIndex(f => f.store_id === s.store_id && f.type === r.type);
        if (i > -1) db.fulfillment[i] = { ...db.fulfillment[i], ...r }; else db.fulfillment.push({ ...r, store_id: s.store_id });
      });
      if (scheduling) {
        const i = db.scheduling.findIndex(x => x.store_id === s.store_id);
        if (i > -1) db.scheduling[i] = { ...db.scheduling[i], ...scheduling }; else db.scheduling.push({ ...scheduling, store_id: s.store_id });
      }
      save(); return { ok: true };
    },
    store_save_settings: ({ settings, business_name }, api) => {
      const s = requireFullAdmin(api);
      if (business_name?.trim()) s.business_name = business_name.trim();
      const i = db.settings.findIndex(x => x.store_id === s.store_id);
      db.settings[i] = { ...db.settings[i], ...settings };
      save(); return { ok: true };
    },
    store_complete_setup: (_, api) => {
      const s = requireStore(api);
      if (s.access_level === "INITIAL_SETUP") { s.access_level = "FULL_ADMIN"; s.customer_store_enabled = 1; }
      save(); return { store: s };
    },
    store_get_subscription: (_, api) => {
      const s = requireStore(api);
      return {
        store: s, plan: db.plans.find(p => p.plan_id === s.plan_id) || null, plans: db.plans.filter(p => p.is_active),
        master_payment_methods: db.masterPay.filter(p => p.is_active),
        history: db.payments.filter(p => p.store_id === s.store_id),
        days_left: s.subscription_expiry ? Math.ceil((new Date(s.subscription_expiry) - Date.now()) / 86400000) : null
      };
    },
    store_submit_payment: ({ plan_id, receipt_file_id, reference, kind = "RENEWAL" }, api) => {
      const s = requireStore(api);
      const plan = db.plans.find(p => p.plan_id === plan_id) || err("Choose a plan.", "VALIDATION");
      db.payments.unshift({ payment_id: "SP-" + Date.now(), store_id: s.store_id, store_name: s.business_name,
        plan_id, plan_name: plan.name, amount: plan.price, kind, status: "PENDING",
        receipt_file_id: receipt_file_id || "", reference: reference || "", created_at: now(), reject_reason: "" });
      save(); return { ok: true };
    },

    /* ---------- Master admin ---------- */
    master_sign_in: ({ id_token }, api) => { api.masterToken = id_token || "demo"; return { email: "owner@universalstore.app", ok: true }; },
    master_dashboard: (_, api) => {
      requireMaster(api); db.stores.forEach(refreshLifecycle); save();
      return {
        total: db.stores.length,
        active: db.stores.filter(s => s.status === "ACTIVE").length,
        expired: db.stores.filter(s => s.status === "EXPIRED").length,
        pending_payments: db.payments.filter(p => p.status === "PENDING").length,
        revenue: db.payments.filter(p => p.status === "APPROVED").reduce((t, p) => t + p.amount, 0),
        recent_stores: db.stores.slice(-5).reverse()
      };
    },
    master_list_stores: ({ q = "", status = "" } = {}, api) => {
      requireMaster(api); db.stores.forEach(refreshLifecycle);
      let rows = [...db.stores];
      if (status) rows = rows.filter(s => s.status === status);
      if (q) { const t = q.toLowerCase(); rows = rows.filter(s => (s.business_name + s.store_id + s.public_store_id + s.owner_email).toLowerCase().includes(t)); }
      return { items: rows };
    },
    master_get_store: ({ store_id }, api) => {
      requireMaster(api);
      const s = findStore(store_id) || err("Store not found.", "NOT_FOUND");
      return { store: s, settings: storeSettings(store_id),
        products: db.products.filter(p => p.store_id === store_id).length,
        orders: db.orders.filter(o => o.store_id === store_id).length,
        payments: db.payments.filter(p => p.store_id === store_id) };
    },
    master_set_store_status: ({ store_id, status }, api) => {
      requireMaster(api);
      const s = findStore(store_id) || err("Store not found.", "NOT_FOUND");
      s.status = status;
      s.access_level = status === "SUSPENDED" || status === "ARCHIVED" ? "BLOCKED"
        : status === "ACTIVE" ? "FULL_ADMIN"
        : status === "EXPIRED" ? "ORDERS_AND_SUBSCRIPTION"
        : status === "PENDING_VERIFICATION" ? "SUBSCRIPTION_ONLY" : s.access_level;
      s.customer_store_enabled = status === "ACTIVE" ? 1 : 0;
      save(); return s;
    },
    master_regenerate_store_id: ({ store_id }, api) => {
      requireMaster(api);
      const s = findStore(store_id) || err("Store not found.", "NOT_FOUND");
      const old = s.store_id, next = rid("STR");
      s.store_id = next;
      [db.settings, db.categories, db.products, db.payMethods, db.fulfillment, db.scheduling, db.orders, db.payments]
        .forEach(t => t.forEach(r => { if (r.store_id === old) r.store_id = next; }));
      save(); return { store_id: next };
    },
    master_extend_subscription: ({ store_id, days }, api) => {
      requireMaster(api);
      const s = findStore(store_id) || err("Store not found.", "NOT_FOUND");
      const base = s.subscription_expiry && new Date(s.subscription_expiry) > new Date() ? s.subscription_expiry : now();
      s.subscription_expiry = addDays(base, Number(days) || 0);
      s.subscription_start = s.subscription_start || now();
      if (s.status === "EXPIRED" || s.status === "PENDING_VERIFICATION") { s.status = "ACTIVE"; s.access_level = "FULL_ADMIN"; s.customer_store_enabled = 1; }
      save(); return s;
    },
    master_delete_store: ({ store_id }, api) => {
      requireMaster(api);
      db.stores = db.stores.filter(s => s.store_id !== store_id);
      [["settings"], ["categories"], ["products"], ["payMethods"], ["fulfillment"], ["scheduling"], ["orders"], ["payments"]]
        .forEach(([k]) => { db[k] = db[k].filter(r => r.store_id !== store_id); });
      save(); return { ok: true };
    },
    master_list_pending_payments: (_, api) => { requireMaster(api); return { items: db.payments.filter(p => p.status === "PENDING") }; },
    master_review_payment: ({ payment_id, approve, reason = "" }, api) => {
      requireMaster(api);
      const p = db.payments.find(x => x.payment_id === payment_id) || err("Payment not found.", "NOT_FOUND");
      const s = findStore(p.store_id);
      if (approve) {
        p.status = "APPROVED";
        const plan = db.plans.find(x => x.plan_id === p.plan_id);
        const base = s.subscription_expiry && new Date(s.subscription_expiry) > new Date() ? s.subscription_expiry : now();
        s.plan_id = p.plan_id;
        s.subscription_start = s.subscription_start || now();
        s.subscription_expiry = addDays(base, plan?.duration_days || 30);
        s.status = "ACTIVE";
        s.access_level = p.kind === "SIGNUP" ? "INITIAL_SETUP" : "FULL_ADMIN";
        s.customer_store_enabled = p.kind === "SIGNUP" ? 0 : 1;
      } else { p.status = "REJECTED"; p.reject_reason = reason; }
      save(); return { ok: true };
    },
    master_save_plan: ({ plan }, api) => {
      requireMaster(api);
      if (plan.plan_id) { const i = db.plans.findIndex(x => x.plan_id === plan.plan_id); db.plans[i] = { ...db.plans[i], ...plan }; }
      else db.plans.push({ ...plan, plan_id: "PLAN-" + Date.now(), is_active: 1 });
      save(); return { ok: true };
    },
    master_save_master_payment_method: ({ method }, api) => {
      requireMaster(api);
      if (method.method_id) { const i = db.masterPay.findIndex(x => x.method_id === method.method_id); db.masterPay[i] = { ...db.masterPay[i], ...method }; }
      else db.masterPay.push({ ...method, method_id: "MPM-" + Date.now(), is_active: 1 });
      save(); return { ok: true };
    },

    /* ---------- Files ---------- */
    file_upload: ({ data }) => ({ file_id: data })   // demo: data URL is the id
  };

  w.MockBackend = {
    reset, get db() { return db; },
    async handle(action, payload, api) {
      if (!db) load();
      await new Promise(r => setTimeout(r, 140 + Math.random() * 220)); // simulate latency
      const fn = handlers[action];
      if (!fn) throw Object.assign(new Error(`Unknown action: ${action}`), { code: "UNKNOWN_ACTION" });
      const out = fn(payload, api);
      save();
      return out;
    }
  };
  /* Only seed/parse the demo DB when the app is actually in demo mode. Loading
     this script is harmless when DEMO_MODE is off (api.js never calls into it),
     but the old unconditional load() at import time still parsed/seeded a full
     localStorage database on every real page load for no reason. */
  if (w.US_CONFIG?.DEMO_MODE) load();
})(window);
