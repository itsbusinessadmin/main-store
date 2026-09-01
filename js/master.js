/* Universal Store — Master Admin (master.html)  v2.2
   Google Sign-In gated to a single MASTER_ADMIN_EMAIL, checked server-side.

   v2.2 fixes
     - mount() everywhere (no stray "null" text)
     - receipts / QR codes / logos routed through UI.img() so KV ids resolve
     - dl()/dlRow() for readable store detail spacing
     - subscription extension accepts any number of days, not just presets
*/
(function () {
  const { $, $$, el, mount, img, imgFallback, imagePicker, dl, dlRow, money, dateFmt,
          dateTimeFmt, store, theme, toast, modal, confirmDialog, debounce,
          copy, skeletons, empty } = UI;
  const C = window.US_CONFIG;

  const NAV = [
    { id: "dashboard", label: "Dashboard", ico: "\u{1F4CA}" },
    { id: "stores",    label: "Stores",    ico: "\u{1F3EA}" },
    { id: "payments",  label: "Approvals", ico: "\u2705" },
    { id: "plans",     label: "Plans",     ico: "\u{1F39F}\uFE0F" },
    { id: "methods",   label: "Payments",  ico: "\u{1F4B3}" }
  ];
  const S = { section: "dashboard", email: null };

  const STATUS_TONE = { ACTIVE: "ok", PENDING_VERIFICATION: "warn", EXPIRED: "danger", SUSPENDED: "danger", ARCHIVED: "" };

  /* ================= Auth ================= */
  async function boot() {
    theme.init();
    const t = store.get("masterToken");
    if (t) {
      api.masterToken = t;
      try {
        const d = await api.masterDashboard();
        return onIn(store.get("masterEmail"), d);
      }
      catch { store.del("masterToken"); api.masterToken = null; }
    }
    renderSignIn();
  }

  function renderSignIn() {
    $("#shell").classList.add("hide");
    const host = $("#auth");
    host.classList.remove("hide");

    const gBtn = el("div", { id: "gsi" });
    const demoBtn = el("button", { class: "btn primary block lg mt" }, "Sign in (demo owner)");
    demoBtn.onclick = async () => {
      try {
        const r = await api.masterSignIn("demo-token");
        api.masterToken = "demo-token";
        store.set("masterToken", "demo-token"); store.set("masterEmail", r.email);
        onIn(r.email);
      } catch (e) { toast(e.message, "err"); }
    };

    mount(host, el("div", { class: "wrap", style: "min-height:100dvh;display:grid;place-items:center;padding-block:32px" },
      el("div", { style: "width:min(420px,100%)" },
        el("div", { class: "center mb" },
          el("div", { class: "brandmark", style: "justify-content:center" },
            el("div", { class: "logo" }, "US"), el("span", {}, "Master Admin")),
          el("p", { class: "muted small mt" }, "Platform owner access only")),
        el("div", { class: "card" },
          gBtn,
          C.DEMO_MODE ? demoBtn : null,
          el("p", { class: "xs muted mt" }, C.DEMO_MODE
            ? "Demo mode is on \u2014 sign-in is simulated locally."
            : "Only the configured owner email can sign in. Everyone else is rejected by the server.")))));

    if (!C.DEMO_MODE) {
      /* The Google script tag is loaded with async/defer (see master.html), so
         it very often hasn't finished loading yet at this exact point — a
         one-shot check here silently leaves gBtn empty forever with no button
         and no explanation. Poll briefly instead, and fail visibly if Google's
         script genuinely never shows up (e.g. blocked by the network). */
      const tryRenderGoogleButton = () => {
        if (!window.google?.accounts?.id) return false;
        google.accounts.id.initialize({
          client_id: C.GOOGLE_CLIENT_ID,
          callback: async res => {
            try {
              const r = await api.masterSignIn(res.credential);
              api.masterToken = res.credential;
              store.set("masterToken", res.credential); store.set("masterEmail", r.email);
              onIn(r.email);
            } catch (e) { toast(e.message, "err", 6000); }
          }
        });
        google.accounts.id.renderButton(gBtn, { theme: "outline", size: "large", width: 340 });
        return true;
      };

      if (!tryRenderGoogleButton()) {
        const poll = setInterval(() => { if (tryRenderGoogleButton()) clearInterval(poll); }, 200);
        setTimeout(() => {
          clearInterval(poll);
          if (!window.google?.accounts?.id) {
            mount(gBtn, el("p", { class: "small", style: "color:var(--danger)" },
              "Sign-in couldn't load. Check your connection (or ad-blocker) and refresh the page."));
          }
        }, 8000);
      }
    }
  }

  function onIn(email, preloadedDashboard) {
    S.email = email;
    $("#auth").classList.add("hide");
    $("#shell").classList.remove("hide");
    $("#ownerEmail").textContent = email || "owner";
    renderNav(); renderSection(preloadedDashboard);
  }

  const signOut = () => {
    store.del("masterToken"); store.del("masterEmail");
    api.masterToken = null; location.reload();
  };

  /* ================= Nav ================= */
  function renderNav() {
    mount($("#sidebar"),
      el("div", { class: "brandmark", style: "padding:6px 12px 16px" },
        el("div", { class: "logo" }, "US"), el("span", {}, "Master Admin")),
      ...NAV.map(n => el("button", {
        class: "nav-item", "aria-current": S.section === n.id ? "page" : null, onclick: () => go(n.id)
      }, el("span", { class: "ico" }, n.ico), n.label)),
      el("div", { style: "margin-top:auto" }),
      el("button", { class: "nav-item", onclick: () => theme.toggle() },
        el("span", { class: "ico", "data-theme-toggle": "" }, "\u{1F319}"), "Theme"),
      el("button", { class: "nav-item", onclick: signOut }, el("span", { class: "ico" }, "\u21A9\uFE0E"), "Sign out"));

    mount($("#tabbar"), ...NAV.map(n => el("button", {
      "aria-current": S.section === n.id ? "page" : null, onclick: () => go(n.id)
    }, el("span", { class: "ico" }, n.ico), n.label)));
    theme.init();
  }

  function go(id) {
    S.section = id; renderNav(); renderSection();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const header = (t, s, a) => el("div", { class: "page-h" },
    el("div", {}, el("h1", {}, t), s ? el("div", { class: "sub" }, s) : null),
    a && a.length ? el("div", { class: "btn-group" }, ...a.filter(Boolean)) : null);

  const stat = (k, v, sub, small) => el("div", { class: "stat" },
    el("div", { class: "k" }, k),
    el("div", { class: "v" + (small ? " sm" : "") }, v),
    sub ? el("div", { class: "d" }, sub) : null);

  async function renderSection(preloadedDashboard) {
    const m = $("#main");
    mount(m, el("div", { class: "col" }, ...skeletons(3, "skel line"), el("div", { class: "skel card mt" })));
    const map = { dashboard: viewDashboard, stores: viewStores, payments: viewPayments,
                  plans: viewPlans, methods: viewMethods };
    try {
      // Boot already fetched the dashboard once to confirm the saved session
      // is still valid — reuse that response instead of fetching it again.
      if (S.section === "dashboard" && preloadedDashboard) renderDashboard(m, preloadedDashboard);
      else await map[S.section](m);
    }
    catch (e) {
      mount(m, header("Something went wrong"),
        el("div", { class: "card" }, empty("\u26A0\uFE0F", "Couldn't load this page", e.message)));
    }
  }

  /* ================= Dashboard ================= */
  async function viewDashboard(m) { renderDashboard(m, await api.masterDashboard()); }

  function renderDashboard(m, d) {
    mount(m,
      header("Platform overview", S.email ? `Signed in as ${S.email}` : null),
      d.pending_payments ? el("div", { class: "notice warn" },
        el("strong", {}, `${d.pending_payments} payment${d.pending_payments === 1 ? "" : "s"} waiting for review`),
        el("button", { class: "btn primary sm mt", onclick: () => go("payments") }, "Review now")) : null,
      el("div", { class: "stats" },
        stat("Stores", d.total),
        stat("Active", d.active),
        stat("Expired", d.expired),
        stat("Revenue", money(d.revenue))),
      el("div", { class: "card mt-lg" },
        el("div", { class: "card-h" }, el("h3", {}, "Newest stores"),
          el("button", { class: "btn ghost sm", onclick: () => go("stores") }, "All stores")),
        (d.recent_stores || []).length
          ? el("div", { class: "list" }, ...d.recent_stores.map(storeRow))
          : empty("\u{1F3EA}", "No stores yet", "Stores appear here as merchants sign up.")));
  }

  function storeRow(s) {
    return el("button", { class: "list-item", onclick: () => openStore(s.store_id) },
      el("div", { class: "grow" },
        el("div", { class: "row between" },
          el("strong", { class: "truncate" }, s.business_name),
          el("span", { class: "badge " + (STATUS_TONE[s.status] || "") }, s.status.replace(/_/g, " "))),
        el("div", { class: "li-sub truncate" }, `${s.owner_email || "\u2014"} \u00b7 created ${dateFmt(s.created_at)}`)));
  }

  /* ================= Stores ================= */
  async function viewStores(m) {
    let q = "", status = "";
    const list = el("div", { class: "list" });

    const load = async () => {
      mount(list, ...skeletons(4, "skel line"));
      const r = await api.masterStores({ q, status });
      mount(list, ...(r.items.length ? r.items.map(storeRow)
        : [empty("\u{1F3EA}", "No stores match", "Try a different filter.")]));
    };

    const chips = el("div", { class: "chips" },
      ...["", "ACTIVE", "PENDING_VERIFICATION", "EXPIRED", "SUSPENDED", "ARCHIVED"].map(s => el("button", {
        class: "chip" + (s === status ? " on" : ""),
        onclick: e => {
          status = s;
          $$(".chip", chips).forEach(c => c.classList.remove("on"));
          e.currentTarget.classList.add("on");
          load();
        }
      }, s ? s.replace(/_/g, " ") : "All")));

    mount(m,
      header("Stores", "Every store on the platform"),
      el("div", { class: "searchbar mb" }, el("span", { class: "ico" }, "\u{1F50D}"),
        el("input", { class: "input", placeholder: "Search name, ID or email\u2026",
          oninput: debounce(e => { q = e.target.value.trim(); load(); }, 300) })),
      chips, list);
    load();
  }

  async function openStore(store_id) {
    const d = await api.masterStore(store_id);
    const s = d.store;
    const shopUrl = `${location.origin}${location.pathname.replace(/master\.html$/, "index.html")}?store=${s.public_store_id}`;
    const refresh = () => { m.close(); renderSection(); };

    /* --- custom day extension --- */
    const daysInput = el("input", { class: "input", type: "number", min: "1", max: "3650",
      placeholder: "e.g. 45", inputmode: "numeric" });
    const applyBtn = el("button", { class: "btn primary" }, "Add days");

    const extend = async days => {
      const n = Number(days);
      if (!Number.isFinite(n) || n < 1) return toast("Enter how many days to add.", "err");
      if (n > 3650) return toast("That's over 10 years \u2014 please enter a smaller number.", "err");
      applyBtn.disabled = true;
      try {
        await api.masterExtend({ store_id: s.store_id, days: n });
        toast(`Extended by ${n} day${n === 1 ? "" : "s"}`, "ok");
        refresh();
      } catch (e) { toast(e.message, "err"); applyBtn.disabled = false; }
    };

    applyBtn.onclick = () => extend(daysInput.value);
    daysInput.addEventListener("keydown", e => { if (e.key === "Enter") extend(daysInput.value); });

    const quickPicks = el("div", { class: "quick-picks" },
      ...[7, 15, 30, 60, 90, 180, 365].map(dd => el("button", {
        class: "chip", type: "button",
        onclick: () => { daysInput.value = dd; daysInput.focus(); }
      }, `+${dd}d`)));

    const currentExpiry = s.subscription_expiry
      ? `Currently expires ${dateFmt(s.subscription_expiry)}`
      : "No expiry set \u2014 days are counted from today";

    const act = (label, cls, fn) => el("button", { class: "btn " + cls + " sm", onclick: fn }, label);

    const m = modal({
      title: s.business_name, wide: true,
      body: el("div", {},
        el("div", { class: "row between wrap-" },
          el("span", { class: "badge " + (STATUS_TONE[s.status] || "") }, s.status.replace(/_/g, " ")),
          el("span", { class: "badge info" }, s.access_level.replace(/_/g, " "))),

        el("div", { class: "card flat" },
          el("h4", { class: "sec-h" }, "Store details"),
          dl(
            dlRow("Owner", s.owner_name),
            dlRow("Email", s.owner_email),
            dlRow("Admin ID", s.store_id, { mono: true }),
            dlRow("Public ID", s.public_store_id, { mono: true }),
            dlRow("Created", dateFmt(s.created_at)),
            dlRow("Expires", dateFmt(s.subscription_expiry)),
            dlRow("Products", d.products),
            dlRow("Orders", d.orders))),

        el("div", { class: "btn-group" },
          act("Copy admin ID", "ghost", () => copy(s.store_id)),
          act("Copy shop link", "ghost", () => copy(shopUrl))),

        el("div", { class: "card flat" },
          el("h4", { class: "sec-h" }, "Extend subscription"),
          el("p", { class: "hint mb" }, currentExpiry),
          el("div", { class: "input-group" }, daysInput, applyBtn),
          quickPicks),

        el("div", { class: "card flat" },
          el("h4", { class: "sec-h" }, "Access"),
          el("div", { class: "btn-group" },
            s.status === "SUSPENDED"
              ? act("Reactivate", "primary", async () => {
                  await api.masterSetStoreStatus({ store_id: s.store_id, status: "ACTIVE" });
                  toast("Store reactivated", "ok"); refresh();
                })
              : act("Suspend", "danger", async () => {
                  if (!await confirmDialog({ title: "Suspend this store?",
                    message: "The merchant will be locked out and the storefront goes offline.",
                    confirmText: "Suspend", danger: true })) return;
                  await api.masterSetStoreStatus({ store_id: s.store_id, status: "SUSPENDED" });
                  toast("Store suspended", "ok"); refresh();
                }),
            s.status === "ARCHIVED"
              ? act("Restore", "ghost", async () => {
                  await api.masterSetStoreStatus({ store_id: s.store_id, status: "ACTIVE" });
                  toast("Restored", "ok"); refresh();
                })
              : act("Archive", "ghost", async () => {
                  if (!await confirmDialog({ title: "Archive this store?",
                    message: "It stays in your records but goes offline and the merchant loses access.",
                    confirmText: "Archive" })) return;
                  await api.masterSetStoreStatus({ store_id: s.store_id, status: "ARCHIVED" });
                  toast("Archived", "ok"); refresh();
                }),
            act("Regenerate admin ID", "ghost", async () => {
              if (!await confirmDialog({ title: "Regenerate the Admin Store ID?",
                message: "The old ID stops working immediately. The public shop link is unaffected. Send the new ID to the merchant.",
                confirmText: "Regenerate" })) return;
              const r = await api.masterRegenerateId(s.store_id);
              modal({
                title: "New Admin Store ID",
                body: el("div", {},
                  el("p", { class: "muted small" }, "Share this with the merchant \u2014 it's their only way in."),
                  el("div", { class: "card flat mono",
                    style: "font-weight:750;letter-spacing:.05em;overflow-wrap:anywhere;background:var(--brand-050);border-color:var(--brand)" },
                    r.store_id)),
                footer: el("button", { class: "btn primary", onclick: () => copy(r.store_id) }, "Copy")
              });
              refresh();
            }))),

        (d.payments || []).length ? el("div", { class: "card flat" },
          el("h4", { class: "sec-h" }, "Payment history"),
          dl(...d.payments.map(p => dlRow(
            `${dateFmt(p.created_at)} \u00b7 ${p.plan_name || "\u2014"}`,
            el("span", { class: "badge " + ({ APPROVED: "ok", PENDING: "warn", REJECTED: "danger" }[p.status] || "") }, p.status)
          )))) : null,

        el("div", { class: "card flat", style: "border-color:var(--danger)" },
          el("h4", { class: "sec-h", style: "color:var(--danger)" }, "Danger zone"),
          el("p", { class: "hint mb" }, "Deleting erases products, orders and settings. This can't be undone."),
          act("Delete permanently", "danger", async () => {
            if (!await confirmDialog({ title: "Delete this store forever?",
              message: "Products, orders and settings are erased. This can't be undone.",
              confirmText: "Delete forever", danger: true, typeToConfirm: s.store_id })) return;
            await api.masterDeleteStore(s.store_id);
            toast("Store deleted", "ok"); refresh();
          })))
    });
  }

  /* ================= Approvals ================= */
  async function viewPayments(m) {
    const r = await api.masterPendingPayments();

    mount(m,
      header("Pending payments", `${r.items.length} waiting for review`),
      el("div", { class: "list" }, ...(r.items.length ? r.items.map(p => el("button", {
        class: "list-item unseen", onclick: () => review(p)
      },
        img(p.receipt_file_id, { alt: "", cls: "thumb", fallback: imgFallback("\u{1F9FE}") }) || imgFallback("\u{1F9FE}"),
        el("div", { class: "grow" },
          el("div", { class: "row between" },
            el("strong", { class: "truncate" }, p.store_name || "\u2014"),
            el("span", { class: "bold" }, money(p.amount))),
          el("div", { class: "li-sub" },
            `${p.plan_name || "\u2014"} \u00b7 ${p.kind} \u00b7 ${dateTimeFmt(p.created_at)}`))))
        : [empty("\u2705", "All caught up", "No payments are waiting for review.")])));

    function review(p) {
      const approve = el("button", { class: "btn primary" }, "Approve");
      const reject = el("button", { class: "btn danger" }, "Reject");
      const receipt = img(p.receipt_file_id, { alt: "Payment receipt", cls: "receipt-img" });

      const mm = modal({
        title: "Review payment",
        body: el("div", {},
          el("div", { class: "card flat" },
            el("h4", { class: "sec-h" }, "Payment details"),
            dl(
              dlRow("Store", p.store_name),
              dlRow("Plan", p.plan_name),
              dlRow("Type", p.kind),
              dlRow("Amount", money(p.amount)),
              dlRow("Reference", p.reference || "\u2014", { mono: !!p.reference }),
              dlRow("Submitted", dateTimeFmt(p.created_at)))),
          receipt
            ? el("div", { class: "card flat" }, el("h4", { class: "sec-h" }, "Receipt"), receipt)
            : el("div", { class: "locked" }, "No receipt was uploaded.")),
        footer: [reject, approve]
      });

      approve.onclick = async () => {
        approve.disabled = true; reject.disabled = true;
        try {
          await api.masterReviewPayment({ payment_id: p.payment_id, approve: true });
          toast("Approved \u2014 store activated", "ok"); mm.close(); renderSection();
        } catch (e) { toast(e.message, "err"); approve.disabled = false; reject.disabled = false; }
      };

      reject.onclick = () => {
        const reason = el("textarea", { class: "textarea",
          placeholder: "Tell the merchant what went wrong \u2014 they'll see this." });
        const ok = el("button", { class: "btn danger" }, "Reject payment");
        const m2 = modal({
          title: "Reject payment",
          body: el("div", { class: "field" }, el("label", {}, "Reason"), reason),
          footer: ok
        });
        ok.onclick = async () => {
          if (!reason.value.trim()) return toast("Please give a reason.");
          ok.disabled = true;
          try {
            await api.masterReviewPayment({ payment_id: p.payment_id, approve: false, reason: reason.value.trim() });
            toast("Payment rejected", "ok"); m2.close(); mm.close(); renderSection();
          } catch (e) { toast(e.message, "err"); ok.disabled = false; }
        };
      };
    }
  }

  /* ================= Plans ================= */
  async function viewPlans(m) {
    const plans = await api.listPlans();

    mount(m,
      header("Subscription plans", "What merchants can buy",
        [el("button", { class: "btn primary sm", onclick: () => editPlan(null) }, "New plan")]),
      el("div", { class: "list" }, ...(plans.length ? plans.map(p => el("div", { class: "list-item" },
        el("div", { class: "grow" },
          el("div", { class: "li-title" }, p.name),
          el("div", { class: "li-sub" }, `${p.duration_days} days${p.blurb ? " \u00b7 " + p.blurb : ""}`)),
        el("div", { class: "bold" }, money(p.price)),
        el("button", { class: "btn ghost sm", onclick: () => editPlan(p) }, "Edit")))
        : [empty("\u{1F39F}\uFE0F", "No plans yet", "Add one so merchants have something to buy.")])));

    function editPlan(p) {
      const F = { plan_id: p?.plan_id, name: p?.name || "", price: p?.price ?? "",
        duration_days: p?.duration_days ?? 30, blurb: p?.blurb || "", is_active: p ? p.is_active : 1 };
      const save = el("button", { class: "btn primary" }, "Save plan");

      const mm = modal({
        title: p ? "Edit plan" : "New plan",
        body: el("div", {},
          el("div", { class: "field" }, el("label", {}, "Name"),
            el("input", { class: "input", value: F.name, oninput: e => F.name = e.target.value })),
          el("div", { class: "grid-2" },
            el("div", { class: "field" }, el("label", {}, "Price"),
              el("input", { class: "input", type: "number", value: F.price,
                oninput: e => F.price = Number(e.target.value) || 0 })),
            el("div", { class: "field" }, el("label", {}, "Duration (days)"),
              el("input", { class: "input", type: "number", value: F.duration_days,
                oninput: e => F.duration_days = Number(e.target.value) || 0 }))),
          el("div", { class: "field" }, el("label", {}, "Short description"),
            el("input", { class: "input", value: F.blurb, oninput: e => F.blurb = e.target.value })),
          el("label", { class: "switch" },
            el("input", { type: "checkbox", checked: !!F.is_active,
              onchange: e => F.is_active = e.target.checked ? 1 : 0 }),
            el("span", { class: "track" }), el("span", {}, "Available to merchants"))),
        footer: save
      });

      save.onclick = async () => {
        if (!F.name.trim()) return toast("Give the plan a name.");
        if (!F.duration_days) return toast("Set how many days the plan lasts.");
        save.disabled = true;
        try { await api.masterSavePlan({ plan: F }); toast("Saved", "ok"); mm.close(); renderSection(); }
        catch (e) { toast(e.message, "err"); save.disabled = false; }
      };
    }
  }

  /* ================= Platform payment methods ================= */
  async function viewMethods(m) {
    const methods = await api.listMasterPaymentMethods();

    mount(m,
      header("Platform payment methods", "Shown to merchants at signup and renewal",
        [el("button", { class: "btn primary sm", onclick: () => editM(null) }, "Add method")]),
      el("div", { class: "list" }, ...(methods.length ? methods.map(p => el("div", { class: "list-item" },
        img(p.qr_file_id, { alt: "", cls: "thumb", fallback: imgFallback("\u{1F4B3}") }) || imgFallback("\u{1F4B3}"),
        el("div", { class: "grow" },
          el("div", { class: "li-title" }, p.name),
          el("div", { class: "li-sub" }, [p.account_name, p.account_number].filter(Boolean).join(" \u00b7 ") || "No account details")),
        el("button", { class: "btn ghost sm", onclick: () => editM(p) }, "Edit")))
        : [empty("\u{1F4B3}", "No payment methods yet", "Add how merchants should pay you.")])));

    function editM(p) {
      const F = { method_id: p?.method_id, name: p?.name || "", account_name: p?.account_name || "",
        account_number: p?.account_number || "", qr_file_id: p?.qr_file_id || "",
        is_active: p ? p.is_active : 1 };
      const save = el("button", { class: "btn primary" }, "Save");

      const mm = modal({
        title: p ? "Edit method" : "New method",
        body: el("div", {},
          el("div", { class: "field" }, el("label", {}, "Name"),
            el("input", { class: "input", value: F.name, placeholder: "GCash, BDO transfer\u2026",
              oninput: e => F.name = e.target.value })),
          el("div", { class: "grid-2" },
            el("div", { class: "field" }, el("label", {}, "Account name"),
              el("input", { class: "input", value: F.account_name, oninput: e => F.account_name = e.target.value })),
            el("div", { class: "field" }, el("label", {}, "Account number"),
              el("input", { class: "input", value: F.account_number, oninput: e => F.account_number = e.target.value }))),
          el("div", { class: "field" }, el("label", {}, "QR code"),
            imagePicker({ value: F.qr_file_id, label: "Tap to upload a QR code (optional)", maxPx: 900,
              onChange: v => F.qr_file_id = v })),
          el("label", { class: "switch" },
            el("input", { type: "checkbox", checked: !!F.is_active,
              onchange: e => F.is_active = e.target.checked ? 1 : 0 }),
            el("span", { class: "track" }), el("span", {}, "Active"))),
        footer: save
      });

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
