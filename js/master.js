/* Universal Store — Master Admin (master.html).
   Google Sign-In gated to a single MASTER_ADMIN_EMAIL, checked server-side. */
(function () {
  const { $, $$, el, money, dateFmt, dateTimeFmt, store, theme, toast, modal, confirmDialog,
          debounce, fileToDataURL, copy, skeletons, empty } = UI;
  const C = window.US_CONFIG;

  const NAV = [
    { id: "dashboard", label: "Dashboard", ico: "📊" },
    { id: "stores", label: "Stores", ico: "🏪" },
    { id: "payments", label: "Approvals", ico: "✅" },
    { id: "plans", label: "Plans", ico: "🎟️" },
    { id: "methods", label: "Payments", ico: "💳" }
  ];
  const S = { section: "dashboard", email: null };

  async function boot() {
    theme.init();
    const t = store.get("masterToken");
    if (t) { api.masterToken = t; try { await api.masterDashboard(); return onIn(store.get("masterEmail")); } catch { store.del("masterToken"); } }
    renderSignIn();
  }

  function renderSignIn() {
    $("#shell").classList.add("hide");
    const host = $("#auth"); host.classList.remove("hide");
    const gBtn = el("div", { id: "gsi" });
    const demoBtn = el("button", { class: "btn primary block lg mt" }, "Sign in (demo owner)");
    demoBtn.onclick = async () => {
      try { const r = await api.masterSignIn("demo-token");
        api.masterToken = "demo-token"; store.set("masterToken", "demo-token"); store.set("masterEmail", r.email); onIn(r.email); }
      catch (e) { toast(e.message, "err"); }
    };
    host.replaceChildren(el("div", { class: "wrap", style: "min-height:100dvh;display:grid;place-items:center" },
      el("div", { style: "width:min(420px,100%)" },
        el("div", { class: "center mb" },
          el("div", { class: "brandmark", style: "justify-content:center" }, el("div", { class: "logo" }, "US"), el("span", {}, "Master Admin")),
          el("p", { class: "muted small mt" }, "Platform owner access only")),
        el("div", { class: "card" },
          gBtn,
          C.DEMO_MODE ? demoBtn : null,
          el("p", { class: "xs muted mt" }, C.DEMO_MODE
            ? "Demo mode is on — sign-in is simulated locally."
            : "Only the configured owner email can sign in. Everyone else is rejected by the server.")))));

    if (!C.DEMO_MODE && window.google?.accounts?.id) {
      google.accounts.id.initialize({
        client_id: C.GOOGLE_CLIENT_ID,
        callback: async res => {
          try { const r = await api.masterSignIn(res.credential);
            api.masterToken = res.credential; store.set("masterToken", res.credential); store.set("masterEmail", r.email); onIn(r.email); }
          catch (e) { toast(e.message, "err"); }
        }
      });
      google.accounts.id.renderButton(gBtn, { theme: "outline", size: "large", width: 340 });
    }
  }

  function onIn(email) {
    S.email = email;
    $("#auth").classList.add("hide");
    $("#shell").classList.remove("hide");
    $("#ownerEmail").textContent = email || "owner";
    renderNav(); renderSection();
  }
  function signOut() { store.del("masterToken"); store.del("masterEmail"); api.masterToken = null; location.reload(); }

  function renderNav() {
    $("#sidebar").replaceChildren(
      el("div", { class: "brandmark", style: "padding:6px 12px 16px" }, el("div", { class: "logo" }, "US"), el("span", {}, "Master Admin")),
      ...NAV.map(n => el("button", { class: "nav-item", "aria-current": S.section === n.id ? "page" : null, onclick: () => go(n.id) },
        el("span", { class: "ico" }, n.ico), n.label)),
      el("div", { style: "margin-top:auto" }),
      el("button", { class: "nav-item", onclick: () => theme.toggle() }, el("span", { class: "ico", "data-theme-toggle": "" }, "🌙"), "Theme"),
      el("button", { class: "nav-item", onclick: signOut }, el("span", { class: "ico" }, "↩︎"), "Sign out"));
    $("#tabbar").replaceChildren(...NAV.map(n => el("button", {
      "aria-current": S.section === n.id ? "page" : null, onclick: () => go(n.id)
    }, el("span", { class: "ico" }, n.ico), n.label)));
    theme.init();
  }
  function go(id) { S.section = id; renderNav(); renderSection(); window.scrollTo({ top: 0, behavior: "smooth" }); }

  const header = (t, s, a) => el("div", { class: "page-h" },
    el("div", {}, el("h1", {}, t), s ? el("div", { class: "sub" }, s) : null),
    a ? el("div", { class: "btn-group" }, ...a) : null);

  const STATUS_TONE = { ACTIVE: "ok", PENDING_VERIFICATION: "warn", EXPIRED: "danger", SUSPENDED: "danger", ARCHIVED: "" };

  async function renderSection() {
    const m = $("#main");
    m.replaceChildren(el("div", { class: "col" }, ...skeletons(3, "skel line"), el("div", { class: "skel card mt" })));
    const map = { dashboard: viewDashboard, stores: viewStores, payments: viewPayments, plans: viewPlans, methods: viewMethods };
    try { await map[S.section](m); }
    catch (e) { m.replaceChildren(header("Something went wrong"), el("div", { class: "card" }, empty("⚠️", "Couldn't load this page", e.message))); }
  }

  /* ---------- Dashboard ---------- */
  async function viewDashboard(m) {
    const d = await api.masterDashboard();
    const stat = (k, v, sub) => el("div", { class: "stat" }, el("div", { class: "k" }, k), el("div", { class: "v" }, v), sub ? el("div", { class: "d" }, sub) : null);
    m.replaceChildren(
      header("Platform overview", `Signed in as ${S.email}`),
      d.pending_payments ? el("div", { class: "card mb", style: "border-color:var(--warn);background:var(--warn-bg)" },
        el("strong", {}, `${d.pending_payments} payment${d.pending_payments === 1 ? "" : "s"} waiting for review`),
        el("button", { class: "btn primary sm mt", onclick: () => go("payments") }, "Review now")) : null,
      el("div", { class: "stats" },
        stat("Stores", d.total), stat("Active", d.active), stat("Expired", d.expired), stat("Revenue", money(d.revenue))),
      el("div", { class: "card mt-lg" }, el("div", { class: "card-h" }, el("h3", {}, "Newest stores"),
        el("button", { class: "btn ghost sm", onclick: () => go("stores") }, "All stores")),
        el("div", { class: "list" }, ...d.recent_stores.map(storeRow))));
  }

  function storeRow(s) {
    return el("button", { class: "list-item", onclick: () => openStore(s.store_id) },
      el("div", { class: "grow" },
        el("div", { class: "row between" }, el("strong", { class: "truncate" }, s.business_name),
          el("span", { class: "badge " + (STATUS_TONE[s.status] || "") }, s.status.replace(/_/g, " "))),
        el("div", { class: "xs muted truncate" }, `${s.owner_email} \u00b7 created ${dateFmt(s.created_at)}`)));
  }

  /* ---------- Stores ---------- */
  async function viewStores(m) {
    let q = "", status = "";
    const list = el("div", { class: "list" });
    const load = async () => {
      list.replaceChildren(...skeletons(4, "skel line"));
      const r = await api.masterStores({ q, status });
      list.replaceChildren(...(r.items.length ? r.items.map(storeRow) : [empty("🏪", "No stores match", "Try a different filter.")]));
    };
    const chips = el("div", { class: "chips" },
      ...["", "ACTIVE", "PENDING_VERIFICATION", "EXPIRED", "SUSPENDED", "ARCHIVED"].map(s => el("button", {
        class: "chip" + (s === status ? " on" : ""),
        onclick: e => { status = s; $$(".chip", chips).forEach(c => c.classList.remove("on")); e.currentTarget.classList.add("on"); load(); }
      }, s ? s.replace(/_/g, " ") : "All")));
    m.replaceChildren(header("Stores", "Every store on the platform"),
      el("div", { class: "searchbar mb" }, el("span", { class: "ico" }, "🔍"),
        el("input", { class: "input", placeholder: "Search name, ID or email\u2026", oninput: debounce(e => { q = e.target.value.trim(); load(); }, 300) })),
      chips, list);
    load();
  }

  async function openStore(store_id) {
    const d = await api.masterStore(store_id);
    const s = d.store;
    const line = (k, v) => el("div", { class: "t-row" }, el("span", { class: "muted" }, k), el("span", { class: "bold", style: "word-break:break-all;text-align:right" }, v ?? "\u2014"));
    const act = (label, cls, fn) => el("button", { class: "btn " + cls + " sm", onclick: fn }, label);
    const refresh = () => { m.close(); renderSection(); };

    const m = modal({
      title: s.business_name, wide: true,
      body: el("div", { class: "col" },
        el("div", { class: "row between" },
          el("span", { class: "badge " + (STATUS_TONE[s.status] || "") }, s.status.replace(/_/g, " ")),
          el("span", { class: "badge info" }, s.access_level.replace(/_/g, " "))),
        el("div", { class: "card flat" },
          line("Owner", s.owner_name), line("Email", s.owner_email),
          line("Admin ID", s.store_id), line("Public ID", s.public_store_id),
          line("Created", dateFmt(s.created_at)), line("Expires", dateFmt(s.subscription_expiry)),
          line("Products", d.products), line("Orders", d.orders)),
        el("div", { class: "btn-group" },
          act("Copy admin ID", "ghost", () => copy(s.store_id)),
          act("Copy shop link", "ghost", () => copy(`${location.origin}${location.pathname.replace(/master\.html$/, "index.html")}?store=${s.public_store_id}`))),
        el("div", { class: "divider" }),
        el("h4", {}, "Subscription"),
        el("div", { class: "btn-group" },
          ...[7, 30, 90, 365].map(dd => act("+" + dd + "d", "ghost", async () => {
            await api.masterExtend({ store_id: s.store_id, days: dd }); toast(`Extended by ${dd} days`, "ok"); refresh();
          }))),
        el("div", { class: "divider" }),
        el("h4", {}, "Access"),
        el("div", { class: "btn-group" },
          s.status === "SUSPENDED"
            ? act("Reactivate", "primary", async () => { await api.masterSetStoreStatus({ store_id: s.store_id, status: "ACTIVE" }); toast("Store reactivated", "ok"); refresh(); })
            : act("Suspend", "danger", async () => {
                if (!await confirmDialog({ title: "Suspend this store?", message: "The merchant will be locked out and the storefront goes offline.", confirmText: "Suspend", danger: true })) return;
                await api.masterSetStoreStatus({ store_id: s.store_id, status: "SUSPENDED" }); toast("Store suspended", "ok"); refresh(); }),
          s.status === "ARCHIVED"
            ? act("Restore", "ghost", async () => { await api.masterSetStoreStatus({ store_id: s.store_id, status: "ACTIVE" }); toast("Restored", "ok"); refresh(); })
            : act("Archive", "ghost", async () => { await api.masterSetStoreStatus({ store_id: s.store_id, status: "ARCHIVED" }); toast("Archived", "ok"); refresh(); }),
          act("Regenerate admin ID", "ghost", async () => {
            if (!await confirmDialog({ title: "Regenerate the Admin Store ID?", message: "The old ID stops working immediately. The public shop link is unaffected. Send the new ID to the merchant.", confirmText: "Regenerate" })) return;
            const r = await api.masterRegenerateId(s.store_id);
            modal({ title: "New Admin Store ID", body: el("div", {}, el("p", { class: "muted small mb" }, "Share this with the merchant \u2014 it's their only way in."),
              el("div", { class: "card flat", style: "font-weight:750;letter-spacing:.05em;word-break:break-all" }, r.store_id)),
              footer: el("button", { class: "btn primary", onclick: () => copy(r.store_id) }, "Copy") });
            refresh();
          })),
        el("div", { class: "divider" }),
        el("h4", { style: "color:var(--danger)" }, "Danger zone"),
        act("Delete permanently", "danger", async () => {
          if (!await confirmDialog({ title: "Delete this store forever?", message: "Products, orders and settings are erased. This can't be undone.",
            confirmText: "Delete forever", danger: true, typeToConfirm: s.store_id })) return;
          await api.masterDeleteStore(s.store_id); toast("Store deleted", "ok"); refresh();
        }),
        d.payments.length ? el("div", {}, el("div", { class: "divider" }), el("h4", { class: "mb" }, "Payment history"),
          ...d.payments.map(p => el("div", { class: "t-row small" },
            el("span", { class: "muted" }, `${dateFmt(p.created_at)} \u00b7 ${p.plan_name}`),
            el("span", { class: "badge " + ({ APPROVED: "ok", PENDING: "warn", REJECTED: "danger" }[p.status] || "") }, p.status)))) : null)
    });
  }

  /* ---------- Approvals ---------- */
  async function viewPayments(m) {
    const r = await api.masterPendingPayments();
    m.replaceChildren(
      header("Pending payments", `${r.items.length} waiting for review`),
      el("div", { class: "list" }, ...(r.items.length ? r.items.map(p => el("button", { class: "list-item unseen", onclick: () => review(p) },
        p.receipt_file_id ? el("img", { class: "thumb", src: p.receipt_file_id, alt: "" }) : el("div", { class: "thumb", style: "display:grid;place-items:center" }, "🧾"),
        el("div", { class: "grow" },
          el("div", { class: "row between" }, el("strong", { class: "truncate" }, p.store_name), el("span", { class: "bold" }, money(p.amount))),
          el("div", { class: "xs muted" }, `${p.plan_name} \u00b7 ${p.kind} \u00b7 ${dateTimeFmt(p.created_at)}`))))
        : [empty("✅", "All caught up", "No payments are waiting for review.")])));

    function review(p) {
      const approve = el("button", { class: "btn primary" }, "Approve");
      const reject = el("button", { class: "btn danger" }, "Reject");
      const mm = modal({
        title: "Review payment",
        body: el("div", { class: "col" },
          el("div", { class: "card flat" },
            el("div", { class: "t-row" }, el("span", { class: "muted" }, "Store"), el("strong", {}, p.store_name)),
            el("div", { class: "t-row" }, el("span", { class: "muted" }, "Plan"), el("strong", {}, p.plan_name)),
            el("div", { class: "t-row" }, el("span", { class: "muted" }, "Type"), el("strong", {}, p.kind)),
            el("div", { class: "t-row" }, el("span", { class: "muted" }, "Amount"), el("strong", {}, money(p.amount))),
            el("div", { class: "t-row" }, el("span", { class: "muted" }, "Reference"), el("strong", {}, p.reference || "\u2014")),
            el("div", { class: "t-row" }, el("span", { class: "muted" }, "Submitted"), el("strong", {}, dateTimeFmt(p.created_at)))),
          p.receipt_file_id ? el("img", { src: p.receipt_file_id, alt: "Receipt", style: "border-radius:14px" })
            : el("div", { class: "locked" }, "No receipt was uploaded.")),
        footer: [reject, approve]
      });
      approve.onclick = async () => {
        approve.disabled = true;
        try { await api.masterReviewPayment({ payment_id: p.payment_id, approve: true });
          toast("Approved \u2014 store activated", "ok"); mm.close(); renderSection(); }
        catch (e) { toast(e.message, "err"); approve.disabled = false; }
      };
      reject.onclick = () => {
        const reason = el("textarea", { class: "textarea", placeholder: "Tell the merchant what went wrong \u2014 they'll see this." });
        const ok = el("button", { class: "btn danger" }, "Reject payment");
        const m2 = modal({ title: "Reject payment", body: el("div", { class: "field" }, el("label", {}, "Reason"), reason), footer: ok });
        ok.onclick = async () => {
          if (!reason.value.trim()) return toast("Please give a reason.");
          ok.disabled = true;
          try { await api.masterReviewPayment({ payment_id: p.payment_id, approve: false, reason: reason.value.trim() });
            toast("Payment rejected", "ok"); m2.close(); mm.close(); renderSection(); }
          catch (e) { toast(e.message, "err"); ok.disabled = false; }
        };
      };
    }
  }

  /* ---------- Plans ---------- */
  async function viewPlans(m) {
    const plans = await api.listPlans();
    m.replaceChildren(
      header("Subscription plans", "What merchants can buy", [el("button", { class: "btn primary sm", onclick: () => editPlan(null) }, "New plan")]),
      el("div", { class: "list" }, ...plans.map(p => el("div", { class: "list-item" },
        el("div", { class: "grow" }, el("div", { class: "bold" }, p.name),
          el("div", { class: "xs muted" }, `${p.duration_days} days \u00b7 ${p.blurb || ""}`)),
        el("div", { class: "bold" }, money(p.price)),
        el("button", { class: "btn ghost sm", onclick: () => editPlan(p) }, "Edit")))));

    function editPlan(p) {
      const F = { plan_id: p?.plan_id, name: p?.name || "", price: p?.price ?? "", duration_days: p?.duration_days ?? 30,
        blurb: p?.blurb || "", is_active: p ? p.is_active : 1 };
      const save = el("button", { class: "btn primary" }, "Save plan");
      const mm = modal({ title: p ? "Edit plan" : "New plan",
        body: el("div", {},
          el("div", { class: "field" }, el("label", {}, "Name"), el("input", { class: "input", value: F.name, oninput: e => F.name = e.target.value })),
          el("div", { class: "grid-2" },
            el("div", { class: "field" }, el("label", {}, "Price"), el("input", { class: "input", type: "number", value: F.price, oninput: e => F.price = Number(e.target.value) || 0 })),
            el("div", { class: "field" }, el("label", {}, "Duration (days)"), el("input", { class: "input", type: "number", value: F.duration_days, oninput: e => F.duration_days = Number(e.target.value) || 0 }))),
          el("div", { class: "field" }, el("label", {}, "Short description"), el("input", { class: "input", value: F.blurb, oninput: e => F.blurb = e.target.value })),
          el("label", { class: "switch" }, el("input", { type: "checkbox", checked: !!F.is_active, onchange: e => F.is_active = e.target.checked ? 1 : 0 }),
            el("span", { class: "track" }), el("span", {}, "Available to merchants"))),
        footer: save });
      save.onclick = async () => {
        if (!F.name.trim()) return toast("Give the plan a name.");
        save.disabled = true;
        try { await api.masterSavePlan({ plan: F }); toast("Saved", "ok"); mm.close(); renderSection(); }
        catch (e) { toast(e.message, "err"); save.disabled = false; }
      };
    }
  }

  /* ---------- Platform payment methods ---------- */
  async function viewMethods(m) {
    const methods = await api.listMasterPaymentMethods();
    m.replaceChildren(
      header("Platform payment methods", "Shown to merchants at signup and renewal",
        [el("button", { class: "btn primary sm", onclick: () => editM(null) }, "Add method")]),
      el("div", { class: "list" }, ...methods.map(p => el("div", { class: "list-item" },
        p.qr_file_id ? el("img", { class: "thumb", src: p.qr_file_id, alt: "" }) : el("div", { class: "thumb", style: "display:grid;place-items:center" }, "💳"),
        el("div", { class: "grow" }, el("div", { class: "bold" }, p.name),
          el("div", { class: "xs muted" }, [p.account_name, p.account_number].filter(Boolean).join(" \u00b7 "))),
        el("button", { class: "btn ghost sm", onclick: () => editM(p) }, "Edit")))));

    function editM(p) {
      const F = { method_id: p?.method_id, name: p?.name || "", account_name: p?.account_name || "",
        account_number: p?.account_number || "", qr_file_id: p?.qr_file_id || "", is_active: p ? p.is_active : 1 };
      const box = el("div", { class: "uploader" }, F.qr_file_id ? el("img", { src: F.qr_file_id, alt: "" }) : "Upload QR code (optional)");
      const inp = el("input", { type: "file", accept: "image/*", class: "sr", onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        try { F.qr_file_id = await fileToDataURL(f, 900); box.replaceChildren(el("img", { src: F.qr_file_id, alt: "" })); }
        catch (err) { toast(err.message, "err"); } } });
      box.onclick = () => inp.click();
      const save = el("button", { class: "btn primary" }, "Save");
      const mm = modal({ title: p ? "Edit method" : "New method",
        body: el("div", {},
          el("div", { class: "field" }, el("label", {}, "Name"), el("input", { class: "input", value: F.name, oninput: e => F.name = e.target.value })),
          el("div", { class: "grid-2" },
            el("div", { class: "field" }, el("label", {}, "Account name"), el("input", { class: "input", value: F.account_name, oninput: e => F.account_name = e.target.value })),
            el("div", { class: "field" }, el("label", {}, "Account number"), el("input", { class: "input", value: F.account_number, oninput: e => F.account_number = e.target.value }))),
          el("div", { class: "field" }, el("label", {}, "QR code"), box, inp),
          el("label", { class: "switch" }, el("input", { type: "checkbox", checked: !!F.is_active, onchange: e => F.is_active = e.target.checked ? 1 : 0 }),
            el("span", { class: "track" }), el("span", {}, "Active"))),
        footer: save });
      save.onclick = async () => {
        if (!F.name.trim()) return toast("Give the method a name.");
        save.disabled = true;
        try { await api.masterSaveMasterPayment({ method: F }); toast("Saved", "ok"); mm.close(); renderSection(); }
        catch (e) { toast(e.message, "err"); save.disabled = false; }
      };
    }
  }

  boot();
})();
