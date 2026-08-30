/* Universal Store — Merchant admin (admin.html).
   Login is the Store ID. Every section is gated by the store's access_level. */
(function () {
  const { $, $$, el, money, dateFmt, dateTimeFmt, store, theme, toast, modal, confirmDialog,
          debounce, fileToDataURL, copy, skeletons, empty, sortable } = UI;

  const NAV = [
    { id: "dashboard", label: "Dashboard", ico: "📊" },
    { id: "orders", label: "Orders", ico: "🧾" },
    { id: "catalog", label: "Catalog", ico: "📦" },
    { id: "payments", label: "Payments", ico: "💳" },
    { id: "fulfillment", label: "Fulfillment", ico: "🚚" },
    { id: "settings", label: "Store", ico: "⚙️" },
    { id: "subscription", label: "Plan", ico: "🎟️" }
  ];
  const ALLOWED = {
    INITIAL_SETUP: ["wizard"],
    SUBSCRIPTION_ONLY: ["subscription"],
    FULL_ADMIN: NAV.map(n => n.id),
    ORDERS_AND_SUBSCRIPTION: ["dashboard", "orders", "subscription"],
    BLOCKED: []
  };
  const S = { store: null, settings: null, section: "dashboard", data: {} };

  /* ================= Auth ================= */
  async function boot() {
    theme.init();
    const saved = store.get("storeId");
    if (saved) {
      api.storeId = saved;
      try { const r = await api.storeLogin(saved); return onLogin(r); }
      catch { store.del("storeId"); }
    }
    renderLogin();
  }

  function renderLogin() {
    $("#shell").classList.add("hide");
    const host = $("#auth");
    host.classList.remove("hide");
    const input = el("input", { class: "input", placeholder: "STR-XXXX-XXXX-XXXX", autocomplete: "off",
      style: "text-transform:uppercase;letter-spacing:.06em;font-weight:600" });
    const btn = el("button", { class: "btn primary block lg" }, "Open my store");
    const go = async () => {
      const id = input.value.trim().toUpperCase();
      if (!id) return toast("Enter your Store ID.");
      btn.disabled = true; btn.textContent = "Checking\u2026";
      try {
        api.storeId = id;
        const r = await api.storeLogin(id);
        store.set("storeId", id);
        onLogin(r);
      } catch (e) { toast(e.message, "err"); btn.disabled = false; btn.textContent = "Open my store"; }
    };
    btn.onclick = go;
    input.addEventListener("keydown", e => e.key === "Enter" && go());

    host.replaceChildren(el("div", { class: "wrap", style: "min-height:100dvh;display:grid;place-items:center;padding-block:32px" },
      el("div", { style: "width:min(440px,100%)" },
        el("div", { class: "center mb" },
          el("div", { class: "brandmark", style: "justify-content:center" },
            el("div", { class: "logo" }, "US"), el("span", {}, "Universal Store")),
          el("p", { class: "muted small mt" }, "Merchant sign-in")),
        el("div", { class: "card" },
          el("div", { class: "field" },
            el("label", {}, "Store ID"), input,
            el("div", { class: "hint" }, "Your Store ID is your key \u2014 keep it private. It's different from your public shop link.")),
          btn,
          el("div", { class: "divider" }),
          el("div", { class: "center small muted" }, "Don't have a store yet?"),
          el("button", { class: "btn ghost block mt", onclick: renderSignup }, "Create a store")),
        el("p", { class: "center xs muted mt" }, "Lost your Store ID? Contact the platform owner to have it re-issued."))));
  }

  async function renderSignup() {
    const F = { business_name: "", owner_name: "", owner_email: "", plan_id: "", reference: "", receipt_file_id: "" };
    let plans = [], mpm = [];
    try { [plans, mpm] = await Promise.all([api.listPlans(), api.listMasterPaymentMethods()]); }
    catch (e) { return toast(e.message, "err"); }

    const planBox = el("div", { class: "col" });
    const payBox = el("div", { class: "col" });
    const paint = () => {
      planBox.replaceChildren(...plans.map(p => el("button", {
        class: "list-item", type: "button",
        style: F.plan_id === p.plan_id ? "border-color:var(--brand);background:var(--brand-050)" : "",
        onclick: () => { F.plan_id = p.plan_id; paint(); }
      },
        el("div", { class: "grow" }, el("div", { class: "bold" }, p.name),
          el("div", { class: "xs muted" }, p.blurb || `${p.duration_days} days`)),
        el("div", { class: "bold" }, money(p.price)))));
      payBox.replaceChildren(...mpm.map(p => el("div", { class: "card flat" },
        el("div", { class: "row between" }, el("strong", {}, p.name),
          p.account_number ? el("button", { class: "btn link xs", onclick: () => copy(p.account_number) }, "Copy") : null),
        el("div", { class: "small muted" }, [p.account_name, p.account_number].filter(Boolean).join(" \u00b7 ")),
        p.qr_file_id ? el("img", { src: p.qr_file_id, alt: "QR code", style: "width:130px;border-radius:12px;margin-top:8px" }) : null)));
    };
    paint();

    const preview = el("div", { class: "uploader" }, "Tap to upload your payment receipt");
    const file = el("input", { type: "file", accept: "image/*", class: "sr", onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      try { F.receipt_file_id = await fileToDataURL(f, 1400); preview.replaceChildren(el("img", { src: F.receipt_file_id, alt: "" })); }
      catch (err) { toast(err.message, "err"); } } });
    preview.onclick = () => file.click();

    const field = (label, key, type = "text") => el("div", { class: "field" },
      el("label", {}, label), el("input", { class: "input", type, oninput: e => F[key] = e.target.value }));

    const submit = el("button", { class: "btn primary block lg" }, "Submit for verification");
    submit.onclick = async () => {
      if (!F.business_name.trim()) return toast("Enter your business name.");
      if (!F.owner_name.trim()) return toast("Enter your name.");
      if (!/^\S+@\S+\.\S+$/.test(F.owner_email)) return toast("Enter a valid email address.");
      if (!F.plan_id) return toast("Choose a subscription plan.");
      if (!F.receipt_file_id) return toast("Upload your payment receipt.");
      submit.disabled = true; submit.textContent = "Submitting\u2026";
      try {
        const r = await api.storeSignup(F);
        modal({
          title: "Store created",
          body: el("div", { class: "col" },
            el("p", {}, "Your store is now waiting for the platform owner to verify your payment. You'll get full access once it's approved."),
            el("div", { class: "card flat", style: "background:var(--brand-050);border-color:var(--brand)" },
              el("div", { class: "xs muted" }, "YOUR STORE ID \u2014 SAVE THIS"),
              el("div", { style: "font-size:1.15rem;font-weight:750;letter-spacing:.05em;word-break:break-all" }, r.store.store_id)),
            el("p", { class: "xs muted" }, "This is your only way in. Keep it private \u2014 anyone with it can manage your store.")),
          footer: [el("button", { class: "btn ghost", onclick: () => copy(r.store.store_id) }, "Copy ID"),
                   el("button", { class: "btn primary", onclick: () => { store.set("storeId", r.store.store_id); location.reload(); } }, "Continue")]
        });
      } catch (e) { toast(e.message, "err"); submit.disabled = false; submit.textContent = "Submit for verification"; }
    };

    $("#auth").replaceChildren(el("div", { class: "wrap", style: "padding-block:28px;max-width:680px" },
      el("div", { class: "page-h" }, el("div", {}, el("h1", {}, "Create your store"),
        el("div", { class: "sub" }, "Takes about two minutes.")),
        el("button", { class: "btn ghost sm", onclick: renderLogin }, "Back to sign-in")),
      el("div", { class: "card" },
        el("h3", { class: "mb" }, "1. Your details"),
        field("Business name", "business_name"), field("Your name", "owner_name"), field("Email", "owner_email", "email")),
      el("div", { class: "card mt" }, el("h3", { class: "mb" }, "2. Choose a plan"), planBox),
      el("div", { class: "card mt" }, el("h3", { class: "mb" }, "3. Pay & upload proof"),
        el("p", { class: "small muted mb" }, "Send payment to any of these, then upload your receipt."),
        payBox,
        el("div", { class: "field mt" }, el("label", {}, "Reference number"),
          el("input", { class: "input", oninput: e => F.reference = e.target.value })),
        el("div", { class: "field" }, el("label", {}, "Receipt"), preview, file)),
      el("div", { class: "mt" }, submit)));
  }

  function onLogin(r) {
    S.store = r.store; S.settings = r.settings;
    $("#auth").classList.add("hide");
    $("#shell").classList.remove("hide");
    theme.accent(S.settings?.accent_color);
    $("#storeNameTop").textContent = S.store.business_name;
    const allowed = ALLOWED[S.store.access_level] || [];
    S.section = allowed.includes("wizard") ? "wizard" : (allowed[0] || "blocked");
    renderNav(allowed);
    renderSection();
  }

  function logout() { store.del("storeId"); api.storeId = null; location.reload(); }

  /* ================= Nav ================= */
  function renderNav(allowed) {
    const side = $("#sidebar"), tabs = $("#tabbar");
    if (allowed.includes("wizard") || !allowed.length) { side.replaceChildren(); tabs.replaceChildren(); return; }
    side.replaceChildren(
      el("div", { class: "brandmark", style: "padding:6px 12px 16px" },
        el("div", { class: "logo" }, (S.store.business_name || "S").slice(0, 2).toUpperCase()),
        el("span", { class: "truncate" }, S.store.business_name)),
      ...NAV.filter(n => allowed.includes(n.id)).map(n => el("button", {
        class: "nav-item", "aria-current": S.section === n.id ? "page" : null,
        onclick: () => go(n.id)
      }, el("span", { class: "ico" }, n.ico), n.label)),
      el("div", { style: "margin-top:auto" }),
      el("button", { class: "nav-item", onclick: () => theme.toggle() }, el("span", { class: "ico", "data-theme-toggle": "" }, "🌙"), "Theme"),
      el("button", { class: "nav-item", onclick: logout }, el("span", { class: "ico" }, "↩︎"), "Sign out"));
    const mobile = NAV.filter(n => allowed.includes(n.id)).slice(0, 5);
    tabs.replaceChildren(...mobile.map(n => el("button", {
      "aria-current": S.section === n.id ? "page" : null, onclick: () => go(n.id)
    }, el("span", { class: "ico" }, n.ico), n.label)));
    theme.init();
  }

  function go(id) {
    S.section = id;
    renderNav(ALLOWED[S.store.access_level] || []);
    renderSection();
    $("#main").scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function header(title, sub, actions) {
    return el("div", { class: "page-h" },
      el("div", {}, el("h1", {}, title), sub ? el("div", { class: "sub" }, sub) : null),
      actions ? el("div", { class: "btn-group" }, ...actions) : null);
  }
  const loading = () => el("div", { class: "col" }, ...skeletons(3, "skel line"), el("div", { class: "skel card mt" }));

  async function renderSection() {
    const m = $("#main");
    m.replaceChildren(loading());
    const map = { wizard: viewWizard, dashboard: viewDashboard, orders: viewOrders, catalog: viewCatalog,
                  payments: viewPayments, fulfillment: viewFulfillment, settings: viewSettings,
                  subscription: viewSubscription, blocked: viewBlocked };
    try { await (map[S.section] || viewBlocked)(m); }
    catch (e) { m.replaceChildren(header("Something went wrong"), el("div", { class: "card" }, empty("⚠️", "Couldn't load this page", e.message))); }
  }

  function viewBlocked(m) {
    m.replaceChildren(header("Store suspended"),
      el("div", { class: "locked" }, el("div", { class: "ico" }, "🔒"),
        el("h3", {}, "Access is locked"),
        el("p", { class: "small mt" }, "This store has been suspended by the platform owner. Please get in touch with them to restore access."),
        el("button", { class: "btn ghost mt", onclick: logout }, "Sign out")));
  }

  /* ================= Dashboard ================= */
  async function viewDashboard(m) {
    const d = await api.storeDashboard();
    S.data.dash = d;
    const expiring = d.days_left != null && d.days_left <= 7;
    const stat = (k, v, sub) => el("div", { class: "stat" }, el("div", { class: "k" }, k), el("div", { class: "v" }, v), sub ? el("div", { class: "d" }, sub) : null);
    m.replaceChildren(
      header("Dashboard", `Welcome back \u2014 ${S.store.business_name}`, [
        el("button", { class: "btn ghost sm", onclick: () => copy(shopLink()) }, "Copy shop link")]),
      S.store.access_level === "ORDERS_AND_SUBSCRIPTION" ? el("div", { class: "card mb", style: "border-color:var(--warn);background:var(--warn-bg)" },
        el("strong", {}, "Your subscription has expired."),
        el("p", { class: "small" }, "Your storefront is hidden and your catalog is locked. You can still manage existing orders. Renew to go live again."),
        el("button", { class: "btn primary sm mt", onclick: () => go("subscription") }, "Renew now")) : null,
      expiring && S.store.status === "ACTIVE" ? el("div", { class: "card mb", style: "border-color:var(--warn);background:var(--warn-bg)" },
        el("strong", {}, `Your plan renews in ${d.days_left} day${d.days_left === 1 ? "" : "s"}.`),
        el("button", { class: "btn ghost sm mt", onclick: () => go("subscription") }, "View plan")) : null,
      el("div", { class: "stats" },
        stat("Orders today", d.orders_today, d.unseen ? `${d.unseen} unseen` : ""),
        stat("Pending", d.pending, "awaiting action"),
        stat("Products", d.products, ""),
        stat("Revenue today", money(d.revenue_today), "")),
      el("div", { class: "stats mt" },
        stat("This month", money(d.revenue_month)),
        stat("All time", money(d.revenue_all)),
        stat("Status", S.store.status.replace(/_/g, " ")),
        stat("Days left", d.days_left ?? "\u2014")),
      el("div", { class: "card mt-lg" },
        el("div", { class: "card-h" }, el("h3", {}, "Recent orders"),
          el("button", { class: "btn ghost sm", onclick: () => go("orders") }, "View all")),
        d.recent.length ? el("div", { class: "list" }, ...d.recent.map(orderRow)) : empty("🧾", "No orders yet", "Share your shop link to get your first one.")));
  }

  const shopLink = () => `${location.origin}${location.pathname.replace(/admin\.html$/, "index.html")}?store=${S.store.public_store_id}`;

  const STATUS_TONE = { PENDING: "warn", UNPAID: "warn", PAID: "info", COMPLETED: "ok", CANCELLED: "danger" };
  function orderRow(o) {
    return el("button", { class: "list-item" + (o.seen ? "" : " unseen"), onclick: () => openOrder(o) },
      el("div", { class: "grow" },
        el("div", { class: "row between" }, el("strong", {}, o.order_number), el("span", { class: "badge " + (STATUS_TONE[o.status] || "") }, o.status)),
        el("div", { class: "small muted truncate" }, `${o.customer_name} \u00b7 ${o.fulfillment_type} \u00b7 ${dateTimeFmt(o.created_at)}`)),
      el("div", { class: "bold" }, money(o.total)));
  }

  /* ================= Orders ================= */
  async function viewOrders(m) {
    let status = "", q = "";
    const list = el("div", { class: "list" });
    const load = async () => {
      list.replaceChildren(...skeletons(4, "skel line"));
      const r = await api.storeOrders({ status, q });
      S.data.orders = r.items;
      list.replaceChildren(...(r.items.length ? r.items.map(orderRow)
        : [empty("🧾", "No orders here", "Try a different filter.")]));
    };
    const chips = el("div", { class: "chips" },
      ...["", "PENDING", "UNPAID", "PAID", "COMPLETED", "CANCELLED"].map(s => el("button", {
        class: "chip" + (s === status ? " on" : ""),
        onclick: e => { status = s; $$(".chip", chips).forEach(c => c.classList.remove("on")); e.currentTarget.classList.add("on"); load(); }
      }, s || "All")));
    m.replaceChildren(
      header("Orders", "Tap an order to view details or change its status", [
        el("button", { class: "btn ghost sm", onclick: exportCsv }, "Export CSV")]),
      el("div", { class: "searchbar mb" }, el("span", { class: "ico" }, "🔍"),
        el("input", { class: "input", placeholder: "Search order no., name or mobile\u2026",
          oninput: debounce(e => { q = e.target.value.trim(); load(); }, 300) })),
      chips, list);
    load();
  }

  function exportCsv() {
    const rows = S.data.orders || [];
    if (!rows.length) return toast("Nothing to export.");
    const head = ["Order", "Date", "Customer", "Mobile", "Fulfillment", "Payment", "Status", "Subtotal", "Fee", "Total", "Items"];
    const csv = [head, ...rows.map(o => [o.order_number, new Date(o.created_at).toISOString(), o.customer_name, o.mobile,
      o.fulfillment_type, o.payment_method, o.status, o.subtotal, o.delivery_fee, o.total,
      o.items.map(i => `${i.qty}x ${i.name}${i.variant ? " (" + i.variant + ")" : ""}`).join("; ")])]
      .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = el("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `orders-${Date.now()}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
    toast("CSV downloaded", "ok");
  }

  function openOrder(o) {
    if (!o.seen) api.storeUpdateOrder({ order_id: o.order_id, seen: 1 }).catch(() => {});
    const line = (k, v) => v ? el("div", { class: "t-row" }, el("span", { class: "muted" }, k), el("span", { class: "bold" }, v)) : null;
    const statusSel = el("select", { class: "select" },
      ...["PENDING", "UNPAID", "PAID", "COMPLETED", "CANCELLED"].map(s => el("option", { value: s, selected: o.status === s }, s)));
    const save = el("button", { class: "btn primary" }, "Save status");
    const m = modal({
      title: "Order " + o.order_number, wide: true,
      body: el("div", { class: "col" },
        el("div", { class: "row between" },
          el("span", { class: "badge " + (STATUS_TONE[o.status] || "") }, o.status),
          el("span", { class: "small muted" }, dateTimeFmt(o.created_at))),
        el("div", { class: "card flat" },
          ...o.items.map(i => el("div", { class: "t-row" },
            el("span", {}, `${i.qty} \u00d7 ${i.name}${i.variant ? " (" + i.variant + ")" : ""}`), el("span", {}, money(i.price * i.qty)))),
          el("div", { class: "totals" },
            line("Subtotal", money(o.subtotal)), line("Delivery fee", money(o.delivery_fee)),
            el("div", { class: "t-row grand" }, el("span", {}, "Total"), el("span", {}, money(o.total))))),
        el("div", { class: "card flat" },
          line("Customer", o.customer_name), line("Mobile", o.mobile),
          line("Fulfillment", o.fulfillment_type), line("Address", o.address),
          line("Meet-up", o.meetup_location), line("Preferred date", o.preferred_date ? dateFmt(o.preferred_date) : ""),
          line("Payment", o.payment_method), line("Notes", o.notes)),
        o.proof_file_id ? el("div", { class: "card flat" }, el("div", { class: "bold small mb" }, "Proof of payment"),
          el("img", { src: o.proof_file_id, alt: "Receipt", style: "border-radius:12px" })) : null,
        el("div", { class: "field mt" }, el("label", {}, "Order status"), statusSel)),
      footer: [el("button", { class: "btn ghost", onclick: () => copy(`${o.order_number} \u2014 ${o.customer_name} \u2014 ${money(o.total)}`) }, "Copy summary"), save]
    });
    save.onclick = async () => {
      save.disabled = true;
      try { await api.storeUpdateOrder({ order_id: o.order_id, status: statusSel.value }); toast("Order updated", "ok"); m.close(); renderSection(); }
      catch (e) { toast(e.message, "err"); save.disabled = false; }
    };
  }

  /* ================= Catalog ================= */
  async function viewCatalog(m) {
    const storeData = await api.getStore(S.store.public_store_id).catch(() => null);
    const categories = storeData?.categories || [];
    const prods = (await api.listProducts({ public_store_id: S.store.public_store_id, limit: 500 })).items;

    const list = el("div", { class: "list" });
    const paintProducts = () => {
      list.replaceChildren(...(prods.length ? prods.map(p => el("div", {
        class: "list-item", draggable: "true", dataset: { sortId: p.product_id }
      },
        el("span", { class: "drag-handle" }, "⠿"),
        el("img", { class: "thumb", src: p.images?.[0] || "", alt: "" }),
        el("div", { class: "grow" }, el("div", { class: "bold truncate" }, p.name),
          el("div", { class: "xs muted" }, money(p.price), " \u00b7 ", p.stock > 0 ? p.stock + " in stock" : "Sold out",
            p.variant_groups?.length ? " \u00b7 " + p.variant_groups.length + " variant group(s)" : "")),
        el("button", { class: "btn ghost sm", onclick: () => editProduct(p) }, "Edit")))
        : [empty("📦", "No products yet", "Add your first product to open for business.")]));
      sortable(list, ids => api.storeReorderProducts(ids).then(() => toast("Order saved", "ok")).catch(e => toast(e.message, "err")));
    };
    paintProducts();

    const catList = el("div", { class: "list" },
      ...categories.map(c => el("div", { class: "list-item" },
        el("div", { class: "grow" }, el("strong", {}, c.name), c.is_system ? el("span", { class: "badge mt" }, "system") : null),
        c.is_system ? null : el("div", { class: "btn-group" },
          el("button", { class: "btn ghost sm", onclick: () => editCategory(c) }, "Rename"),
          el("button", { class: "btn ghost sm", onclick: async () => {
            if (!await confirmDialog({ title: "Delete category?", message: `Products in "${c.name}" will move to Uncategorized.`, confirmText: "Delete", danger: true })) return;
            await api.storeDeleteCategory(c.category_id); toast("Category deleted", "ok"); renderSection();
          } }, "Delete")))));

    m.replaceChildren(
      header("Catalog", `${prods.length} product(s), ${categories.length} categor(ies)`, [
        el("button", { class: "btn ghost sm", onclick: () => editCategory(null) }, "New category"),
        el("button", { class: "btn primary sm", onclick: () => editProduct(null) }, "New product")]),
      el("div", { class: "card" }, el("div", { class: "card-h" }, el("h3", {}, "Products"),
        el("span", { class: "xs muted" }, "Drag to reorder")), list),
      el("div", { class: "card mt" }, el("div", { class: "card-h" }, el("h3", {}, "Categories")), catList));

    function editCategory(c) {
      const input = el("input", { class: "input", value: c?.name || "" });
      const save = el("button", { class: "btn primary" }, "Save");
      const mm = modal({ title: c ? "Rename category" : "New category",
        body: el("div", { class: "field" }, el("label", {}, "Name"), input), footer: save });
      save.onclick = async () => {
        save.disabled = true;
        try { await api.storeSaveCategory({ category: { category_id: c?.category_id, name: input.value.trim() } });
          toast("Saved", "ok"); mm.close(); renderSection(); }
        catch (e) { toast(e.message, "err"); save.disabled = false; }
      };
    }

    function editProduct(p) {
      const F = { product_id: p?.product_id, name: p?.name || "", price: p?.price ?? "", stock: p?.stock ?? 0,
        category_id: p?.category_id || categories[0]?.category_id, description: p?.description || "",
        images: [...(p?.images || [])], variant_groups: JSON.parse(JSON.stringify(p?.variant_groups || [])) };

      const imgRow = el("div", { class: "row", style: "gap:10px" });
      const paintImgs = () => {
        imgRow.replaceChildren(...[0, 1].map(i => {
          const box = el("div", { class: "uploader", style: "flex:1;padding:10px" },
            F.images[i] ? el("img", { src: F.images[i], alt: "" }) : el("span", { class: "small" }, `Image ${i + 1}`));
          const inp = el("input", { type: "file", accept: "image/*", class: "sr", onchange: async e => {
            const f = e.target.files[0]; if (!f) return;
            try { F.images[i] = await fileToDataURL(f, 1200); paintImgs(); } catch (err) { toast(err.message, "err"); } } });
          box.onclick = () => inp.click();
          return el("div", { style: "flex:1" }, box, inp);
        }));
      };
      paintImgs();

      const vBox = el("div", { class: "col" });
      const paintVariants = () => {
        vBox.replaceChildren(...F.variant_groups.map((g, gi) => el("div", { class: "card flat" },
          el("div", { class: "row between mb" },
            el("input", { class: "input", value: g.name, placeholder: "Group name (e.g. Size)", oninput: e => g.name = e.target.value }),
            el("button", { class: "btn ghost sm", onclick: () => { F.variant_groups.splice(gi, 1); paintVariants(); } }, "Remove")),
          ...g.options.map((o, oi) => el("div", { class: "row", style: "gap:8px;margin-bottom:6px" },
            el("input", { class: "input", value: o, placeholder: "Option", oninput: e => g.options[oi] = e.target.value }),
            el("input", { class: "input", type: "number", style: "max-width:120px", value: g.price_delta?.[oi] ?? 0,
              placeholder: "+price", oninput: e => { g.price_delta = g.price_delta || []; g.price_delta[oi] = Number(e.target.value) || 0; } }),
            el("button", { class: "btn ghost sm", onclick: () => { g.options.splice(oi, 1); g.price_delta?.splice(oi, 1); paintVariants(); } }, "✕"))),
          el("button", { class: "btn ghost sm", onclick: () => { g.options.push(""); (g.price_delta = g.price_delta || []).push(0); paintVariants(); } }, "Add option"))),
          el("button", { class: "btn ghost sm", onclick: () => { F.variant_groups.push({ name: "", options: [""], price_delta: [0] }); paintVariants(); } }, "Add variant group"));
      };
      paintVariants();

      const save = el("button", { class: "btn primary" }, "Save product");
      const mm = modal({
        title: p ? "Edit product" : "New product", wide: true,
        body: el("div", {},
          el("div", { class: "field" }, el("label", {}, "Photos"), imgRow),
          el("div", { class: "field" }, el("label", {}, "Name"), el("input", { class: "input", value: F.name, oninput: e => F.name = e.target.value })),
          el("div", { class: "grid-2" },
            el("div", { class: "field" }, el("label", {}, "Price"), el("input", { class: "input", type: "number", step: "0.01", value: F.price, oninput: e => F.price = e.target.value })),
            el("div", { class: "field" }, el("label", {}, "Stock"), el("input", { class: "input", type: "number", value: F.stock, oninput: e => F.stock = e.target.value }))),
          el("div", { class: "field" }, el("label", {}, "Category"),
            el("select", { class: "select", onchange: e => F.category_id = e.target.value },
              ...categories.map(c => el("option", { value: c.category_id, selected: F.category_id === c.category_id }, c.name)))),
          el("div", { class: "field" }, el("label", {}, "Description"),
            el("textarea", { class: "textarea", oninput: e => F.description = e.target.value }, F.description)),
          el("div", { class: "field" }, el("label", {}, "Variants"), el("div", { class: "hint mb" }, "Optional. Customers must pick one option per group before adding to cart."), vBox)),
        footer: [p ? el("button", { class: "btn danger", onclick: async () => {
          if (!await confirmDialog({ title: "Delete product?", message: `"${p.name}" will be removed from your storefront.`, confirmText: "Delete", danger: true })) return;
          await api.storeDeleteProduct(p.product_id); mm.close(); toast("Product deleted", "ok"); renderSection();
        } }, "Delete") : null, save].filter(Boolean)
      });
      save.onclick = async () => {
        save.disabled = true;
        try {
          F.variant_groups = F.variant_groups.filter(g => g.name.trim() && g.options.filter(Boolean).length);
          await api.storeSaveProduct({ product: F });
          toast("Product saved", "ok"); mm.close(); renderSection();
        } catch (e) { toast(e.message, "err"); save.disabled = false; }
      };
    }
  }

  /* ================= Payments ================= */
  async function viewPayments(m) {
    const sd = await api.getStore(S.store.public_store_id).catch(() => ({ payment_methods: [] }));
    const methods = sd.payment_methods || [];
    m.replaceChildren(
      header("Payment methods", "How customers pay you", [
        el("button", { class: "btn primary sm", onclick: () => editMethod(null) }, "Add method")]),
      el("div", { class: "list" }, ...(methods.length ? methods.map(p => el("div", { class: "list-item" },
        p.qr_file_id ? el("img", { class: "thumb", src: p.qr_file_id, alt: "" }) : el("div", { class: "thumb", style: "display:grid;place-items:center" }, "💳"),
        el("div", { class: "grow" }, el("div", { class: "bold" }, p.name),
          el("div", { class: "xs muted" }, [p.account_name, p.account_number].filter(Boolean).join(" \u00b7 ") || "No account details"),
          el("div", { class: "xs muted" }, (p.valid_for || []).join(", ") || "all fulfillment types",
            p.requires_proof ? " \u00b7 proof required" : "")),
        el("button", { class: "btn ghost sm", onclick: () => editMethod(p) }, "Edit")))
        : [empty("💳", "No payment methods yet", "Add at least one so customers can check out.")])));

    function editMethod(p) {
      const F = { method_id: p?.method_id, name: p?.name || "", account_name: p?.account_name || "",
        account_number: p?.account_number || "", qr_file_id: p?.qr_file_id || "",
        requires_proof: p?.requires_proof ? 1 : 0, valid_for: [...(p?.valid_for || ["delivery", "pickup", "meetup"])] };
      const qrBox = el("div", { class: "uploader" }, F.qr_file_id ? el("img", { src: F.qr_file_id, alt: "" }) : "Upload QR code (optional)");
      const qrInput = el("input", { type: "file", accept: "image/*", class: "sr", onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        try { F.qr_file_id = await fileToDataURL(f, 900); qrBox.replaceChildren(el("img", { src: F.qr_file_id, alt: "" })); }
        catch (err) { toast(err.message, "err"); } } });
      qrBox.onclick = () => qrInput.click();
      const save = el("button", { class: "btn primary" }, "Save");
      const mm = modal({
        title: p ? "Edit payment method" : "New payment method",
        body: el("div", {},
          el("div", { class: "field" }, el("label", {}, "Name"), el("input", { class: "input", value: F.name, placeholder: "GCash, Bank transfer, Cash\u2026", oninput: e => F.name = e.target.value })),
          el("div", { class: "grid-2" },
            el("div", { class: "field" }, el("label", {}, "Account name"), el("input", { class: "input", value: F.account_name, oninput: e => F.account_name = e.target.value })),
            el("div", { class: "field" }, el("label", {}, "Account number"), el("input", { class: "input", value: F.account_number, oninput: e => F.account_number = e.target.value }))),
          el("div", { class: "field" }, el("label", {}, "QR code"), qrBox, qrInput),
          el("div", { class: "field" }, el("label", {}, "Valid for"),
            el("div", { class: "chips" }, ...["delivery", "pickup", "meetup"].map(t => el("button", {
              class: "chip" + (F.valid_for.includes(t) ? " on" : ""), type: "button",
              onclick: e => { F.valid_for.includes(t) ? F.valid_for.splice(F.valid_for.indexOf(t), 1) : F.valid_for.push(t); e.currentTarget.classList.toggle("on"); }
            }, t)))),
          el("label", { class: "switch" }, el("input", { type: "checkbox", checked: !!F.requires_proof, onchange: e => F.requires_proof = e.target.checked ? 1 : 0 }),
            el("span", { class: "track" }), el("span", {}, "Require proof of payment at checkout"))),
        footer: [p ? el("button", { class: "btn danger", onclick: async () => {
          if (!await confirmDialog({ title: "Delete payment method?", message: `"${p.name}" will no longer be offered at checkout.`, confirmText: "Delete", danger: true })) return;
          await api.storeDeletePaymentMethod(p.method_id); mm.close(); toast("Deleted", "ok"); renderSection();
        } }, "Delete") : null, save].filter(Boolean)
      });
      save.onclick = async () => {
        save.disabled = true;
        try { await api.storeSavePaymentMethod({ method: F }); toast("Saved", "ok"); mm.close(); renderSection(); }
        catch (e) { toast(e.message, "err"); save.disabled = false; }
      };
    }
  }

  /* ================= Fulfillment ================= */
  async function viewFulfillment(m) {
    const sd = await api.getStore(S.store.public_store_id).catch(() => ({ fulfillment: [], scheduling: {} }));
    const byType = t => sd.fulfillment.find(f => f.type === t) || { type: t, enabled: 0, fee_mode: "fixed", fee: 0, address: "", instructions: "", locations: [] };
    const D = { delivery: { ...byType("delivery") }, pickup: { ...byType("pickup") }, meetup: { ...byType("meetup"), locations: [...(byType("meetup").locations || [])] } };
    const SCH = { ...(sd.scheduling || { enabled: 0, prep_days: 0, max_advance_days: 14, blocked_weekdays: [] }) };

    const toggle = (obj, label) => el("label", { class: "switch" },
      el("input", { type: "checkbox", checked: !!obj.enabled, onchange: e => { obj.enabled = e.target.checked ? 1 : 0; } }),
      el("span", { class: "track" }), el("span", { class: "bold" }, label));

    const locBox = el("div", { class: "col" });
    const paintLocs = () => locBox.replaceChildren(
      ...D.meetup.locations.map((l, i) => el("div", { class: "row", style: "gap:8px" },
        el("input", { class: "input", value: l, oninput: e => D.meetup.locations[i] = e.target.value }),
        el("button", { class: "btn ghost sm", onclick: () => { D.meetup.locations.splice(i, 1); paintLocs(); } }, "✕"))),
      el("button", { class: "btn ghost sm", onclick: () => { D.meetup.locations.push(""); paintLocs(); } }, "Add location"));
    paintLocs();

    const save = el("button", { class: "btn primary" }, "Save fulfillment");
    save.onclick = async () => {
      save.disabled = true;
      try {
        D.meetup.locations = D.meetup.locations.filter(Boolean);
        await api.storeSaveFulfillment({ rows: [D.delivery, D.pickup, D.meetup], scheduling: SCH });
        toast("Fulfillment saved", "ok"); save.disabled = false;
      } catch (e) { toast(e.message, "err"); save.disabled = false; }
    };

    m.replaceChildren(
      header("Fulfillment", "How customers receive their orders", [save]),
      el("div", { class: "card" }, toggle(D.delivery, "Delivery"),
        el("div", { class: "field mt" }, el("label", {}, "Fee"),
          el("select", { class: "select", onchange: e => D.delivery.fee_mode = e.target.value },
            el("option", { value: "fixed", selected: D.delivery.fee_mode === "fixed" }, "Fixed fee"),
            el("option", { value: "manual", selected: D.delivery.fee_mode === "manual" }, "I'll confirm the fee after the order"))),
        el("div", { class: "field" }, el("label", {}, "Fixed fee amount"),
          el("input", { class: "input", type: "number", value: D.delivery.fee, oninput: e => D.delivery.fee = Number(e.target.value) || 0 })),
        el("div", { class: "field" }, el("label", {}, "Notes shown at checkout"),
          el("textarea", { class: "textarea", oninput: e => D.delivery.instructions = e.target.value }, D.delivery.instructions))),
      el("div", { class: "card mt" }, toggle(D.pickup, "Pickup"),
        el("div", { class: "field mt" }, el("label", {}, "Pickup address"),
          el("textarea", { class: "textarea", oninput: e => D.pickup.address = e.target.value }, D.pickup.address)),
        el("div", { class: "field" }, el("label", {}, "Instructions"),
          el("textarea", { class: "textarea", oninput: e => D.pickup.instructions = e.target.value }, D.pickup.instructions))),
      el("div", { class: "card mt" }, toggle(D.meetup, "Meet-up"),
        el("div", { class: "field mt" }, el("label", {}, "Locations"), locBox)),
      el("div", { class: "card mt" }, toggle(SCH, "Let customers choose a preferred date"),
        el("div", { class: "grid-2 mt" },
          el("div", { class: "field" }, el("label", {}, "Preparation days"),
            el("input", { class: "input", type: "number", value: SCH.prep_days, oninput: e => SCH.prep_days = Number(e.target.value) || 0 })),
          el("div", { class: "field" }, el("label", {}, "Max days in advance"),
            el("input", { class: "input", type: "number", value: SCH.max_advance_days, oninput: e => SCH.max_advance_days = Number(e.target.value) || 0 })))),
      el("div", { class: "mt-lg" }, save));
  }

  /* ================= Store settings ================= */
  async function viewSettings(m) {
    const sd = await api.getStore(S.store.public_store_id).catch(() => null);
    const F = { business_name: S.store.business_name, logo_file_id: S.settings?.logo_file_id || "",
      accent_color: S.settings?.accent_color || "#173d24", announcement: S.settings?.announcement || "",
      tagline: S.settings?.tagline || "", contact: JSON.parse(JSON.stringify(S.settings?.contact || [])) };

    const logoBox = el("div", { class: "uploader" }, F.logo_file_id ? el("img", { src: F.logo_file_id, alt: "" }) : "Upload your logo");
    const logoInput = el("input", { type: "file", accept: "image/*", class: "sr", onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      try { F.logo_file_id = await fileToDataURL(f, 600); logoBox.replaceChildren(el("img", { src: F.logo_file_id, alt: "" })); }
      catch (err) { toast(err.message, "err"); } } });
    logoBox.onclick = () => logoInput.click();

    const contactBox = el("div", { class: "col" });
    const paintContacts = () => contactBox.replaceChildren(
      ...F.contact.map((c, i) => el("div", { class: "row", style: "gap:8px;flex-wrap:wrap" },
        el("select", { class: "select", style: "max-width:150px", onchange: e => c.type = e.target.value },
          ...["mobile", "email", "facebook", "instagram", "viber", "website"].map(t => el("option", { value: t, selected: c.type === t }, t))),
        el("input", { class: "input", style: "flex:1;min-width:160px", value: c.value, oninput: e => c.value = e.target.value }),
        el("label", { class: "switch" }, el("input", { type: "checkbox", checked: !!c.visible, onchange: e => c.visible = e.target.checked ? 1 : 0 }),
          el("span", { class: "track" }), el("span", { class: "xs" }, "Show")),
        el("button", { class: "btn ghost sm", onclick: () => { F.contact.splice(i, 1); paintContacts(); } }, "✕"))),
      el("button", { class: "btn ghost sm", onclick: () => { F.contact.push({ type: "mobile", value: "", visible: 1 }); paintContacts(); } }, "Add contact"));
    paintContacts();

    const save = el("button", { class: "btn primary" }, "Save settings");
    save.onclick = async () => {
      save.disabled = true;
      try {
        await api.storeSaveSettings({ business_name: F.business_name, settings: {
          logo_file_id: F.logo_file_id, accent_color: F.accent_color, announcement: F.announcement,
          tagline: F.tagline, contact: F.contact.filter(c => c.value.trim()) } });
        S.store.business_name = F.business_name;
        Object.assign(S.settings, F);
        theme.accent(F.accent_color);
        $("#storeNameTop").textContent = F.business_name;
        toast("Settings saved", "ok");
      } catch (e) { toast(e.message, "err"); }
      finally { save.disabled = false; }
    };

    m.replaceChildren(
      header("Store settings", "Branding, contact details and your shop link", [save]),
      el("div", { class: "card" },
        el("div", { class: "field" }, el("label", {}, "Business name"),
          el("input", { class: "input", value: F.business_name, oninput: e => F.business_name = e.target.value })),
        el("div", { class: "field" }, el("label", {}, "Tagline"),
          el("input", { class: "input", value: F.tagline, oninput: e => F.tagline = e.target.value })),
        el("div", { class: "field" }, el("label", {}, "Logo"), logoBox, logoInput),
        el("div", { class: "field" }, el("label", {}, "Accent color"),
          el("input", { class: "input", type: "color", style: "max-width:110px;padding:6px", value: F.accent_color,
            oninput: e => { F.accent_color = e.target.value; theme.accent(e.target.value); } })),
        el("div", { class: "field" }, el("label", {}, "Announcement banner"),
          el("textarea", { class: "textarea", oninput: e => F.announcement = e.target.value }, F.announcement),
          el("div", { class: "hint" }, "Leave blank to hide it."))),
      el("div", { class: "card mt" }, el("div", { class: "card-h" }, el("h3", {}, "Contact & socials")), contactBox),
      el("div", { class: "card mt" }, el("div", { class: "card-h" }, el("h3", {}, "Your shop link")),
        el("div", { class: "card flat", style: "word-break:break-all" }, shopLink()),
        el("div", { class: "btn-group mt" },
          el("button", { class: "btn ghost sm", onclick: () => copy(shopLink()) }, "Copy link"),
          el("a", { class: "btn ghost sm", href: shopLink(), target: "_blank", rel: "noopener" }, "Open storefront")),
        el("div", { class: "divider" }),
        el("div", { class: "xs muted" }, "Admin Store ID (private)"),
        el("div", { class: "row between" }, el("code", {}, S.store.store_id),
          el("button", { class: "btn link sm", onclick: () => copy(S.store.store_id) }, "Copy"))),
      el("div", { class: "mt-lg" }, save));
  }

  /* ================= Subscription ================= */
  async function viewSubscription(m) {
    const d = await api.storeSubscription();
    const pending = d.history.find(h => h.status === "PENDING");
    const rejected = d.history.find(h => h.status === "REJECTED");
    let planId = d.plan?.plan_id || d.plans[0]?.plan_id, receipt = "", reference = "";

    const planBox = el("div", { class: "col" });
    const paint = () => planBox.replaceChildren(...d.plans.map(p => el("button", {
      class: "list-item", type: "button", style: planId === p.plan_id ? "border-color:var(--brand);background:var(--brand-050)" : "",
      onclick: () => { planId = p.plan_id; paint(); } },
      el("div", { class: "grow" }, el("div", { class: "bold" }, p.name), el("div", { class: "xs muted" }, p.blurb || `${p.duration_days} days`)),
      el("div", { class: "bold" }, money(p.price)))));
    paint();

    const rBox = el("div", { class: "uploader" }, "Upload your payment receipt");
    const rInput = el("input", { type: "file", accept: "image/*", class: "sr", onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      try { receipt = await fileToDataURL(f, 1400); rBox.replaceChildren(el("img", { src: receipt, alt: "" })); }
      catch (err) { toast(err.message, "err"); } } });
    rBox.onclick = () => rInput.click();

    const submit = el("button", { class: "btn primary block" }, "Submit payment for review");
    submit.onclick = async () => {
      if (!planId) return toast("Choose a plan.");
      if (!receipt) return toast("Upload your receipt.");
      submit.disabled = true;
      try { await api.storeSubmitPayment({ plan_id: planId, receipt_file_id: receipt, reference,
              kind: S.store.status === "PENDING_VERIFICATION" ? "SIGNUP" : "RENEWAL" });
        toast("Submitted \u2014 you'll be notified once it's reviewed.", "ok"); renderSection(); }
      catch (e) { toast(e.message, "err"); submit.disabled = false; }
    };

    const tone = d.days_left == null ? "" : d.days_left < 0 ? "danger" : d.days_left <= 7 ? "warn" : "ok";
    m.replaceChildren(
      header("Subscription", "Your plan and payment history"),
      el("div", { class: "stats mb" },
        el("div", { class: "stat" }, el("div", { class: "k" }, "Plan"), el("div", { class: "v", style: "font-size:1.3rem" }, d.plan?.name || "\u2014")),
        el("div", { class: "stat" }, el("div", { class: "k" }, "Status"), el("div", { class: "v", style: "font-size:1.3rem" }, S.store.status.replace(/_/g, " "))),
        el("div", { class: "stat" }, el("div", { class: "k" }, "Days left"), el("div", { class: "v" }, d.days_left ?? "\u2014")),
        el("div", { class: "stat" }, el("div", { class: "k" }, "Expires"), el("div", { class: "v", style: "font-size:1.1rem" }, dateFmt(S.store.subscription_expiry)))),
      pending ? el("div", { class: "card mb", style: "border-color:var(--info);background:var(--info-bg)" },
        el("strong", {}, "Payment under review"),
        el("p", { class: "small" }, `We received your ${pending.plan_name} payment on ${dateFmt(pending.created_at)}. The platform owner will verify it shortly.`)) : null,
      rejected && !pending ? el("div", { class: "card mb", style: "border-color:var(--danger);background:var(--danger-bg)" },
        el("strong", {}, "Your last payment was rejected"),
        el("p", { class: "small" }, rejected.reject_reason || "No reason was given. Please submit a new payment.")) : null,
      pending ? null : el("div", { class: "card" },
        el("div", { class: "card-h" }, el("h3", {}, S.store.status === "PENDING_VERIFICATION" ? "Activate your store" : "Renew or change plan")),
        planBox,
        el("div", { class: "divider" }),
        el("h4", { class: "mb" }, "Pay to"),
        ...d.master_payment_methods.map(p => el("div", { class: "card flat mb" },
          el("div", { class: "row between" }, el("strong", {}, p.name),
            p.account_number ? el("button", { class: "btn link xs", onclick: () => copy(p.account_number) }, "Copy") : null),
          el("div", { class: "small muted" }, [p.account_name, p.account_number].filter(Boolean).join(" \u00b7 ")),
          p.qr_file_id ? el("img", { src: p.qr_file_id, alt: "", style: "width:130px;border-radius:12px;margin-top:8px" }) : null)),
        el("div", { class: "field" }, el("label", {}, "Reference number"),
          el("input", { class: "input", oninput: e => reference = e.target.value })),
        el("div", { class: "field" }, el("label", {}, "Receipt"), rBox, rInput),
        submit),
      el("div", { class: "card mt" }, el("div", { class: "card-h" }, el("h3", {}, "Payment history")),
        d.history.length ? el("div", { class: "table-wrap" },
          el("table", {}, el("thead", {}, el("tr", {}, ...["Date", "Plan", "Type", "Amount", "Status"].map(h => el("th", {}, h)))),
            el("tbody", {}, ...d.history.map(h => el("tr", {},
              el("td", {}, dateFmt(h.created_at)), el("td", {}, h.plan_name), el("td", {}, h.kind),
              el("td", {}, money(h.amount)),
              el("td", {}, el("span", { class: "badge " + ({ APPROVED: "ok", PENDING: "warn", REJECTED: "danger" }[h.status] || "") }, h.status)))))))
          : empty("🎟️", "No payments yet", "")));
  }

  /* ================= Guided setup wizard ================= */
  async function viewWizard(m) {
    const STEPS = [
      { key: "business",    label: "Business",      skippable: false },
      { key: "logo",        label: "Logo",          skippable: true  },
      { key: "theme",       label: "Theme",         skippable: true  },
      { key: "contact",     label: "Contact",       skippable: true  },
      { key: "payment",     label: "Payment",       skippable: false },
      { key: "fulfillment", label: "Fulfillment",   skippable: false },
      { key: "product",     label: "First product", skippable: true  },
      { key: "review",      label: "Review",        skippable: false }
    ];
    let i = 0;
    const skipped = new Set();

    const F = {
      business_name: S.store.business_name, tagline: "", logo: "", accent: "#173d24",
      contact: [{ type: "mobile", value: "", visible: 1 }],
      method: { name: "", account_name: "", account_number: "", requires_proof: 1, valid_for: ["delivery", "pickup", "meetup"] },
      ff: { delivery: { type: "delivery", enabled: 1, fee_mode: "fixed", fee: 0, address: "", instructions: "", locations: [] },
            pickup:   { type: "pickup",   enabled: 0, fee_mode: "fixed", fee: 0, address: "", instructions: "", locations: [] },
            meetup:   { type: "meetup",   enabled: 0, fee_mode: "fixed", fee: 0, address: "", instructions: "", locations: [] } },
      product: { name: "", price: "", stock: 1, description: "", images: [] }
    };

    const nav = el("div", { class: "wizard-nav" });
    const body = el("div", { class: "card mt" });
    const back = el("button", { class: "btn ghost" }, "\u2190 Back");
    const skip = el("button", { class: "btn ghost" }, "Skip for now");
    const next = el("button", { class: "btn primary" }, "Continue");

    /* Clicking a step chip jumps back to it — only to steps already visited. */
    const paintNav = () => nav.replaceChildren(...STEPS.map((s, n) => {
      const cls = n === i ? " on" : (n < i ? " done" : "");
      const chip = el("div", {
        class: "wizard-step" + cls,
        style: n < i ? "cursor:pointer" : "",
        title: n < i ? "Go back to this step" : ""
      }, `${n + 1}. ${s.label}${skipped.has(s.key) ? " \u00b7 skipped" : ""}`);
      if (n < i) chip.onclick = () => { i = n; paint(); };
      return chip;
    }));

    const f = (label, node, hint) => el("div", { class: "field" },
      el("label", {}, label), node, hint ? el("div", { class: "hint" }, hint) : null);

    const uploader = (getter, setter, text) => {
      const box = el("div", { class: "uploader" }, getter() ? el("img", { src: getter(), alt: "" }) : text);
      const inp = el("input", { type: "file", accept: "image/*", class: "sr", onchange: async e => {
        const file = e.target.files[0]; if (!file) return;
        try { const d = await fileToDataURL(file, 1000); setter(d); box.replaceChildren(el("img", { src: d, alt: "" })); }
        catch (err) { toast(err.message, "err"); } } });
      box.onclick = () => inp.click();
      return el("div", {}, box, inp);
    };

    const optionalNote = t => el("p", { class: "hint mt" }, t);

    const steps = {
      business: () => el("div", {}, el("h3", { class: "mb" }, "Tell us about your business"),
        f("Business name", el("input", { class: "input", value: F.business_name, oninput: e => F.business_name = e.target.value })),
        f("Tagline", el("input", { class: "input", value: F.tagline, oninput: e => F.tagline = e.target.value }),
          "One short line customers see under your name. Optional.")),

      logo: () => el("div", {}, el("h3", { class: "mb" }, "Add your logo"),
        uploader(() => F.logo, v => F.logo = v, "Tap to upload a square logo"),
        optionalNote("Optional \u2014 you can add or change this later in Store settings.")),

      theme: () => el("div", {}, el("h3", { class: "mb" }, "Pick your accent color"),
        f("Accent", el("input", { class: "input", type: "color", style: "max-width:110px;padding:6px", value: F.accent,
          oninput: e => { F.accent = e.target.value; theme.accent(e.target.value); } })),
        el("div", { class: "card flat mt" }, el("div", { class: "bold mb" }, "Preview"),
          el("button", { class: "btn primary" }, "Add to cart")),
        optionalNote("Optional \u2014 skipping keeps the default deep green.")),

      contact: () => el("div", {}, el("h3", { class: "mb" }, "How can customers reach you?"),
        f("Mobile number", el("input", { class: "input", type: "tel", value: F.contact[0].value,
          oninput: e => F.contact[0].value = e.target.value })),
        optionalNote("Optional \u2014 you can add email and socials later.")),

      payment: () => el("div", {}, el("h3", { class: "mb" }, "How will customers pay you?"),
        f("Method name", el("input", { class: "input", value: F.method.name, placeholder: "GCash, Bank transfer, Cash\u2026",
          oninput: e => F.method.name = e.target.value })),
        f("Account name", el("input", { class: "input", value: F.method.account_name, oninput: e => F.method.account_name = e.target.value })),
        f("Account number", el("input", { class: "input", value: F.method.account_number, oninput: e => F.method.account_number = e.target.value })),
        el("label", { class: "switch" },
          el("input", { type: "checkbox", checked: !!F.method.requires_proof, onchange: e => F.method.requires_proof = e.target.checked ? 1 : 0 }),
          el("span", { class: "track" }), el("span", {}, "Require proof of payment")),
        el("p", { class: "hint mt" }, "Required \u2014 customers can't check out without at least one payment method.")),

      fulfillment: () => el("div", {}, el("h3", { class: "mb" }, "How do customers get their orders?"),
        el("label", { class: "switch" },
          el("input", { type: "checkbox", checked: !!F.ff.delivery.enabled, onchange: e => F.ff.delivery.enabled = e.target.checked ? 1 : 0 }),
          el("span", { class: "track" }), el("span", { class: "bold" }, "Delivery")),
        f("Delivery fee", el("input", { class: "input", type: "number", value: F.ff.delivery.fee,
          oninput: e => F.ff.delivery.fee = Number(e.target.value) || 0 })),
        el("div", { class: "divider" }),
        el("label", { class: "switch" },
          el("input", { type: "checkbox", checked: !!F.ff.pickup.enabled, onchange: e => F.ff.pickup.enabled = e.target.checked ? 1 : 0 }),
          el("span", { class: "track" }), el("span", { class: "bold" }, "Pickup")),
        f("Pickup address", el("textarea", { class: "textarea", oninput: e => F.ff.pickup.address = e.target.value }, F.ff.pickup.address)),
        el("p", { class: "hint mt" }, "Required \u2014 turn on at least one.")),

      product: () => el("div", {}, el("h3", { class: "mb" }, "Add your first product"),
        uploader(() => F.product.images[0], v => F.product.images[0] = v, "Tap to upload a product photo"),
        f("Name", el("input", { class: "input", value: F.product.name, oninput: e => F.product.name = e.target.value })),
        el("div", { class: "grid-2" },
          f("Price", el("input", { class: "input", type: "number", step: "0.01", value: F.product.price,
            oninput: e => F.product.price = e.target.value })),
          f("Stock", el("input", { class: "input", type: "number", value: F.product.stock,
            oninput: e => F.product.stock = e.target.value }))),
        f("Description", el("textarea", { class: "textarea", oninput: e => F.product.description = e.target.value }, F.product.description)),
        optionalNote("Optional \u2014 skip this and add products from the Catalog once you're open.")),

      review: () => {
        const row = (k, v, warn) => el("div", { class: "t-row" },
          el("span", { class: "muted" }, k),
          el("span", { class: "bold", style: warn ? "color:var(--warn)" : "" }, v));
        const ffOn = [F.ff.delivery.enabled && "Delivery", F.ff.pickup.enabled && "Pickup"].filter(Boolean).join(", ");
        return el("div", {}, el("h3", { class: "mb" }, "Ready to open"),
          el("div", { class: "card flat" },
            row("Business", F.business_name),
            row("Logo", F.logo ? "Added" : "Skipped", !F.logo),
            row("Theme", skipped.has("theme") ? "Default" : F.accent),
            row("Contact", F.contact[0].value || "Skipped", !F.contact[0].value),
            row("Payment", F.method.name || "\u2014"),
            row("Fulfillment", ffOn || "\u2014"),
            row("First product", F.product.name || "Skipped", !F.product.name)),
          skipped.size ? el("div", { class: "card mt", style: "border-color:var(--info);background:var(--info-bg)" },
            el("strong", {}, "You skipped a few things"),
            el("p", { class: "small mt" }, "That's fine \u2014 nothing here is permanent. You can fill any of it in later from Store settings and Catalog."),
            el("button", { class: "btn ghost sm mt", onclick: () => { i = 0; paint(); } }, "Go back and review")) : null,
          el("p", { class: "muted small mt" }, "When you finish, your storefront goes live and your shop link starts working."));
      }
    };

    /* Only blocks steps that genuinely can't be empty. */
    const validate = () => {
      const key = STEPS[i].key;
      if (key === "business" && !F.business_name.trim()) return "Enter your business name.";
      if (key === "payment" && !F.method.name.trim()) return "Add at least one payment method so customers can check out.";
      if (key === "fulfillment" && !F.ff.delivery.enabled && !F.ff.pickup.enabled)
        return "Turn on at least one way for customers to receive their order.";
      if (key === "product" && (F.product.name.trim() || F.product.price !== "")) {
        if (!F.product.name.trim()) return "Give this product a name, or skip this step.";
        if (F.product.price === "" || Number(F.product.price) < 0) return "Enter a valid price, or skip this step.";
      }
      return null;
    };

    const paint = () => {
      paintNav();
      body.replaceChildren(steps[STEPS[i].key]());
      back.classList.toggle("hide", i === 0);
      skip.classList.toggle("hide", !STEPS[i].skippable);
      next.textContent = i === STEPS.length - 1 ? "Finish & open my store" : "Continue";
      next.disabled = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    back.onclick = () => { if (i > 0) { i--; paint(); } };

    skip.onclick = () => {
      const key = STEPS[i].key;
      skipped.add(key);
      /* Clear whatever was half-entered so nothing partial gets saved. */
      if (key === "logo") F.logo = "";
      if (key === "theme") { F.accent = "#173d24"; theme.accent("#173d24"); }
      if (key === "contact") F.contact[0].value = "";
      if (key === "product") F.product = { name: "", price: "", stock: 1, description: "", images: [] };
      i++; paint();
      toast(`Skipped \u2014 you can set this up later.`);
    };

    next.onclick = async () => {
      const err = validate();
      if (err) return toast(err, "err");
      skipped.delete(STEPS[i].key);
      if (i < STEPS.length - 1) { i++; return paint(); }

      next.disabled = true; back.disabled = true;
      next.textContent = "Setting up\u2026";
      try {
        await api.storeSaveSettings({
          business_name: F.business_name,
          settings: {
            logo_file_id: F.logo, accent_color: F.accent, tagline: F.tagline, announcement: "",
            contact: F.contact.filter(c => c.value && c.value.trim())
          }
        });
        await api.storeSavePaymentMethod({ method: F.method });
        await api.storeSaveFulfillment({ rows: [F.ff.delivery, F.ff.pickup, F.ff.meetup] });

        /* Only save a product if one was actually entered. */
        if (F.product.name.trim() && F.product.price !== "") {
          await api.storeSaveProduct({
            product: {
              name: F.product.name.trim(),
              price: Number(F.product.price),
              stock: Number(F.product.stock) || 0,
              description: F.product.description || "",
              images: F.product.images.filter(Boolean),
              variant_groups: []
            }
          });
        }

        const r = await api.storeCompleteSetup();
        S.store = r.store;
        toast("Your store is live \u{1F389}", "ok");
        onLogin({ store: S.store, settings: S.settings });
      } catch (e) {
        toast(e.message || "Setup couldn't be saved. Please try again.", "err", 6000);
        next.disabled = false; back.disabled = false;
        next.textContent = "Finish & open my store";
      }
    };

    m.replaceChildren(
      header("Set up your store", "A few quick steps and you're open for business. Optional steps can be skipped."),
      nav, body,
      el("div", { class: "btn-group mt-lg" }, back, skip, next));
    paint();
  }

  boot();
})();
