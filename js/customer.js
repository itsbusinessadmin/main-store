/* Universal Store — Customer storefront (index.html).
   Public, no login. Browse -> product modal (variants) -> cart drawer -> 3-step checkout. */
(function () {
  const { $, $$, el, money, dateFmt, store, theme, toast, modal, debounce, uid, fileToDataURL, copy, skeletons, empty } = UI;
  const C = window.US_CONFIG;

  const params = new URLSearchParams(location.search);
  const PUBLIC_ID = (params.get("store") || "").trim().toUpperCase();

  const S = {
    store: null, products: [], offset: 0, hasMore: true, loading: false,
    q: "", category: "", view: store.get("view", "grid"), cart: []
  };
  const cartKey = () => "cart:" + PUBLIC_ID;

  /* ---------------- Boot ---------------- */
  async function boot() {
    theme.init();
    $("#viewToggle").textContent = S.view === "grid" ? "\u2630" : "\u25A6";
    $("#products").dataset.view = S.view;

    if (!PUBLIC_ID) return fatal("No store selected", "This link is missing its store code. Ask the seller for their storefront link \u2014 it should look like \u2026/index.html?store=SHOP-XXXX-XXXX-XXXX");

    try {
      S.store = await api.getStore(PUBLIC_ID);
    } catch (e) {
      return fatal(e.code === "STORE_CLOSED" ? "This store is closed" : "Store not found",
        e.message || "We couldn't load this store. Please check the link and try again.");
    }

    S.cart = store.get(cartKey(), []);
    paintHeader();
    wireEvents();
    renderCategories();
    await loadProducts(true);
    setTimeout(() => $("#splash").classList.add("gone"), 120);
    renderCartFab();
  }

  function fatal(title, msg) {
    $("#splash").classList.add("gone");
    $("#app").replaceChildren(el("div", { class: "wrap mt-lg" },
      el("div", { class: "card" }, empty("\u{1F6D2}", title, msg))));
    $("#storeHeader").classList.add("hide");
  }

  function paintHeader() {
    document.title = S.store.business_name + " \u2014 Shop";
    theme.accent(S.store.accent_color);
    $("#storeName").textContent = S.store.business_name;
    $("#storeTagline").textContent = S.store.tagline || "";
    const logo = $("#storeLogo");
    if (S.store.logo) { logo.src = S.store.logo; logo.classList.remove("hide"); }
    if (S.store.announcement) { $("#announce").textContent = S.store.announcement; $("#announce").classList.remove("hide"); }
    $("#splashLogo").src = S.store.logo || "";
    $("#splashName").textContent = S.store.business_name;
  }

  function renderCategories() {
    const host = $("#categories");
    const cats = (S.store.categories || []).filter(c => !c.is_system || true);
    host.replaceChildren(
      el("button", { class: "chip on", "data-cat": "", onclick: onCat }, "All"),
      ...cats.map(c => el("button", { class: "chip", "data-cat": c.category_id, onclick: onCat }, c.name))
    );
  }
  function onCat(e) {
    $$("#categories .chip").forEach(c => c.classList.remove("on"));
    e.currentTarget.classList.add("on");
    S.category = e.currentTarget.dataset.cat;
    loadProducts(true);
  }

  /* ---------------- Products ---------------- */
  async function loadProducts(reset = false) {
    if (S.loading) return;
    S.loading = true;
    const host = $("#products");
    if (reset) { S.offset = 0; S.hasMore = true; S.products = []; host.replaceChildren(...skeletons(8)); }
    try {
      const r = await api.listProducts({
        public_store_id: PUBLIC_ID, q: S.q, category_id: S.category,
        offset: S.offset, limit: C.PAGE_SIZE
      });
      S.products.push(...r.items);
      S.offset += r.items.length;
      S.hasMore = r.has_more;
      renderProducts(reset);
    } catch (e) {
      host.replaceChildren(empty("\u26A0\uFE0F", "Couldn't load products", e.message));
    } finally { S.loading = false; }
  }

  function renderProducts(reset) {
    const host = $("#products");
    if (reset) host.replaceChildren();
    if (!S.products.length) {
      host.replaceChildren();
      $("#emptyState").replaceChildren(empty("\u{1F50D}", "Nothing here yet",
        S.q ? `No products match \u201c${S.q}\u201d.` : "This store hasn't added products to this category."));
      return;
    }
    $("#emptyState").replaceChildren();
    const frag = document.createDocumentFragment();
    S.products.slice(reset ? 0 : host.children.length).forEach(p => frag.append(productCard(p)));
    host.append(frag);
    $("#loadMore").classList.toggle("hide", !S.hasMore);
  }

  function productCard(p) {
    const soldOut = p.stock <= 0;
    return el("button", { class: "p-card", onclick: () => openProduct(p) },
      el("img", { class: "img", src: p.images?.[0] || "", alt: p.name, loading: "lazy" }),
      el("div", { class: "body" },
        el("div", { class: "name clamp2" }, p.name),
        p.variant_groups?.length ? el("div", { class: "xs muted" }, p.variant_groups.map(g => g.name).join(" \u00b7 ")) : null,
        el("div", { class: "price" }, money(p.price))),
      soldOut ? el("div", { class: "sold-out" }, "Sold out") : null);
  }

  /* ---------------- Product modal ---------------- */
  function openProduct(p) {
    if (p.stock <= 0) return toast("That item is sold out right now.");
    let qty = 1;
    const chosen = {};
    (p.variant_groups || []).forEach(g => chosen[g.name] = null);

    const gallery = el("div", { class: "gallery" }, ...(p.images || []).map(src => el("img", { src, alt: p.name })));
    const dots = el("div", { class: "gal-dots" }, ...(p.images || []).map((_, i) => el("i", { class: i ? "" : "on" })));
    gallery.addEventListener("scroll", debounce(() => {
      const i = Math.round(gallery.scrollLeft / gallery.clientWidth);
      $$("i", dots).forEach((d, j) => d.classList.toggle("on", i === j));
    }, 60));

    const priceEl = el("div", { class: "price bold", style: "font-size:1.35rem;color:var(--brand)" }, money(p.price));
    const nEl = el("span", { class: "n" }, "1");
    const addBtn = el("button", { class: "btn primary block lg" }, "Add to cart");

    const livePrice = () => {
      let price = p.price;
      (p.variant_groups || []).forEach(g => {
        const i = g.options.indexOf(chosen[g.name]);
        if (i > -1) price += (g.price_delta?.[i] || 0);
      });
      return price;
    };
    const refresh = () => {
      priceEl.textContent = money(livePrice() * qty);
      const missing = (p.variant_groups || []).find(g => !chosen[g.name]);
      addBtn.disabled = !!missing;
      addBtn.textContent = missing ? `Choose ${missing.name}` : "Add to cart";
    };

    const variantUI = (p.variant_groups || []).map(g => el("div", { class: "field" },
      el("label", {}, g.name),
      el("div", { class: "chips" }, ...g.options.map((o, i) => el("button", {
        class: "chip", type: "button",
        onclick: e => {
          chosen[g.name] = o;
          e.currentTarget.parentElement.querySelectorAll(".chip").forEach(c => c.classList.remove("on"));
          e.currentTarget.classList.add("on"); refresh();
        }
      }, o + (g.price_delta?.[i] ? ` (+${money(g.price_delta[i])})` : ""))))));

    const stepper = el("div", { class: "stepper" },
      el("button", { "aria-label": "Decrease", onclick: () => { qty = Math.max(1, qty - 1); nEl.textContent = qty; refresh(); } }, "\u2212"),
      nEl,
      el("button", { "aria-label": "Increase", onclick: () => { if (qty >= p.stock) return toast(`Only ${p.stock} in stock.`); qty++; nEl.textContent = qty; refresh(); } }, "+"));

    const m = modal({
      title: p.name,
      body: el("div", { class: "col" },
        gallery, dots,
        el("div", { class: "row between mt" }, priceEl,
          el("span", { class: "badge " + (p.stock > 5 ? "ok" : "warn") }, p.stock + " in stock")),
        p.description ? el("p", { class: "muted mt" }, p.description) : null,
        el("div", { class: "mt" }, ...variantUI),
        el("div", { class: "row mt" }, el("span", { class: "small muted grow" }, "Quantity"), stepper)),
      footer: addBtn
    });
    refresh();

    addBtn.onclick = () => {
      const variantLabel = Object.values(chosen).filter(Boolean).join(" / ");
      const key = p.product_id + "|" + variantLabel;
      const line = S.cart.find(l => l.key === key);
      if (line) {
        if (line.qty + qty > p.stock) return toast(`Only ${p.stock} in stock.`, "err");
        line.qty += qty;
      } else {
        S.cart.push({ key, product_id: p.product_id, name: p.name, variant: { ...chosen }, variantLabel,
                      price: livePrice(), qty, image: p.images?.[0] || "" });
      }
      persistCart(); m.close(); toast("Added to cart", "ok");
    };
  }

  /* ---------------- Cart ---------------- */
  const cartCount = () => S.cart.reduce((t, l) => t + l.qty, 0);
  const cartSubtotal = () => S.cart.reduce((t, l) => t + l.price * l.qty, 0);
  function persistCart() { store.set(cartKey(), S.cart); renderCartFab(); }
  function renderCartFab() {
    const fab = $("#cartFab");
    const n = cartCount();
    fab.hidden = n === 0;
    $("#cartCount").textContent = n;
    $("#cartTotal").textContent = money(cartSubtotal());
  }

  function openCart() {
    if (!S.cart.length) return toast("Your cart is empty.");
    const body = el("div");
    const totals = el("div", { class: "totals" });
    const checkoutBtn = el("button", { class: "btn primary block lg" }, "Checkout");

    const paint = () => {
      body.replaceChildren(...S.cart.map(l => el("div", { class: "cart-line" },
        el("img", { src: l.image, alt: "" }),
        el("div", { class: "grow" },
          el("div", { class: "bold" }, l.name),
          l.variantLabel ? el("div", { class: "xs muted" }, l.variantLabel) : null,
          el("div", { class: "small" }, money(l.price), " \u00d7 ", String(l.qty)),
          el("button", { class: "btn link xs", onclick: () => { S.cart = S.cart.filter(x => x.key !== l.key); persistCart(); S.cart.length ? paint() : (m.close(), toast("Cart cleared")); } }, "Remove")),
        el("div", { class: "bold" }, money(l.price * l.qty)))));
      totals.replaceChildren(
        el("div", { class: "t-row" }, el("span", { class: "muted" }, "Subtotal"), el("span", {}, money(cartSubtotal()))),
        el("div", { class: "t-row muted xs" }, el("span", {}, "Delivery fee"), el("span", {}, "Calculated at checkout")));
      body.append(totals);
    };
    paint();

    const m = modal({ title: `Your cart (${cartCount()})`, body, footer: checkoutBtn, side: true });
    checkoutBtn.onclick = async () => {
      checkoutBtn.disabled = true; checkoutBtn.textContent = "Checking stock\u2026";
      try {
        const r = await api.validateCart(PUBLIC_ID, S.cart);
        if (r.issues.length) {
          S.cart = r.items.filter(i => i.qty > 0).map(i => ({ ...i }));
          persistCart();
          r.issues.forEach(i => toast(i.message, "err", 5000));
          if (!S.cart.length) { m.close(); return; }
          paint();
          checkoutBtn.disabled = false; checkoutBtn.textContent = "Review & checkout";
          return;
        }
        m.close(); openCheckout();
      } catch (e) {
        toast(e.message, "err");
        checkoutBtn.disabled = false; checkoutBtn.textContent = "Checkout";
      }
    };
  }

  /* ---------------- Checkout (3 steps) ---------------- */
  function openCheckout() {
    const F = { name: "", mobile: "", fulfillment: "", address: "", meetup: "", date: "", payment: "", proof: "", notes: "" };
    const ff = S.store.fulfillment || [];
    const pms = S.store.payment_methods || [];
    if (ff.length === 1) F.fulfillment = ff[0].type;
    let step = 1, orderNo = null;

    const steps = el("div", { class: "steps" }, el("div", { class: "s on" }), el("div", { class: "s" }), el("div", { class: "s" }));
    const body = el("div");
    const backBtn = el("button", { class: "btn ghost" }, "Back");
    const nextBtn = el("button", { class: "btn primary" }, "Review order");
    const m = modal({ title: "Checkout", body: el("div", {}, steps, body), footer: [backBtn, nextBtn] });

    const feeFor = () => {
      const row = ff.find(f => f.type === F.fulfillment);
      if (!row || F.fulfillment !== "delivery") return 0;
      return row.fee_mode === "manual" ? null : (row.fee || 0);
    };
    const setStep = n => {
      step = n;
      $$(".s", steps).forEach((s, i) => s.classList.toggle("on", i < n));
      backBtn.classList.toggle("hide", n === 1 || n === 3);
      render();
    };

    function stepForm() {
      const wrap = el("div");
      const f = (label, node, hint) => el("div", { class: "field" }, el("label", {}, label), node, hint ? el("div", { class: "hint" }, hint) : null);

      wrap.append(
        f("Your name", el("input", { class: "input", value: F.name, autocomplete: "name", oninput: e => F.name = e.target.value })),
        f("Mobile number", el("input", { class: "input", type: "tel", value: F.mobile, autocomplete: "tel", placeholder: "09XX XXX XXXX", oninput: e => F.mobile = e.target.value })));

      if (ff.length > 1) {
        wrap.append(f("How would you like to get it?", el("div", { class: "chips" },
          ...ff.map(x => el("button", {
            class: "chip" + (F.fulfillment === x.type ? " on" : ""), type: "button",
            onclick: () => { F.fulfillment = x.type; F.payment = ""; render(); }
          }, ({ delivery: "Delivery", pickup: "Pickup", meetup: "Meet-up" })[x.type])))));
      } else if (ff.length === 1) {
        wrap.append(el("p", { class: "small muted mb" }, "Fulfillment: ",
          el("strong", {}, ({ delivery: "Delivery", pickup: "Pickup", meetup: "Meet-up" })[ff[0].type])));
      }

      const row = ff.find(x => x.type === F.fulfillment);
      if (F.fulfillment === "delivery")
        wrap.append(f("Delivery address", el("textarea", { class: "textarea", value: F.address, oninput: e => F.address = e.target.value }), row?.instructions || ""));
      if (F.fulfillment === "pickup")
        wrap.append(el("div", { class: "card flat mb", style: "background:var(--card-2)" },
          el("div", { class: "bold small" }, "Pick up at"), el("div", { class: "small" }, row?.address || "\u2014"),
          row?.instructions ? el("div", { class: "xs muted mt" }, row.instructions) : null));
      if (F.fulfillment === "meetup")
        wrap.append(f("Meet-up location", el("select", { class: "select", onchange: e => F.meetup = e.target.value },
          el("option", { value: "" }, "Choose a location\u2026"),
          ...(row?.locations || []).map(l => el("option", { value: l, selected: F.meetup === l }, l)))));

      const sch = S.store.scheduling;
      if (sch?.enabled) {
        const min = new Date(Date.now() + (sch.prep_days || 0) * 86400000).toISOString().slice(0, 10);
        const max = new Date(Date.now() + (sch.max_advance_days || 14) * 86400000).toISOString().slice(0, 10);
        wrap.append(f("Preferred date", el("input", { class: "input", type: "date", min, max, value: F.date, onchange: e => F.date = e.target.value }),
          `Available from ${dateFmt(min)} to ${dateFmt(max)}.`));
      }

      const valid = pms.filter(p => !p.valid_for?.length || p.valid_for.includes(F.fulfillment));
      if (valid.length === 1 && !F.payment) F.payment = valid[0].method_id;
      wrap.append(f("Payment method", el("div", { class: "col" },
        ...valid.map(p => el("button", {
          class: "list-item" + (F.payment === p.method_id ? "" : ""), type: "button",
          style: F.payment === p.method_id ? "border-color:var(--brand);background:var(--brand-050)" : "",
          onclick: () => { F.payment = p.method_id; render(); }
        },
          p.qr_file_id ? el("img", { class: "thumb", src: p.qr_file_id, alt: "" }) : el("div", { class: "thumb", style: "display:grid;place-items:center" }, "\u{1F4B3}"),
          el("div", { class: "grow" }, el("div", { class: "bold" }, p.name),
            p.account_number ? el("div", { class: "xs muted" }, p.account_name + " \u00b7 " + p.account_number) : null,
            p.requires_proof ? el("div", { class: "xs muted" }, "Proof of payment required") : null))))));

      const chosenPm = pms.find(p => p.method_id === F.payment);
      if (chosenPm?.requires_proof) {
        const preview = el("div", { class: "uploader" }, F.proof ? el("img", { src: F.proof, alt: "Receipt" }) : "Tap to upload a screenshot of your payment");
        const input = el("input", { type: "file", accept: "image/*", class: "sr", onchange: async e => {
          const file = e.target.files[0]; if (!file) return;
          try { F.proof = await fileToDataURL(file, 1400); preview.replaceChildren(el("img", { src: F.proof, alt: "Receipt" })); }
          catch (err) { toast(err.message, "err"); }
        } });
        preview.onclick = () => input.click();
        wrap.append(f("Proof of payment", el("div", {}, preview, input)));
      }

      wrap.append(f("Notes for the seller (optional)", el("textarea", { class: "textarea", value: F.notes, oninput: e => F.notes = e.target.value })));
      return wrap;
    }

    function validate() {
      if (!F.name.trim()) return "Please enter your name.";
      if (!/\d{7,}/.test(F.mobile.replace(/\D/g, ""))) return "Please enter a valid mobile number.";
      if (!F.fulfillment) return "Choose how you'd like to receive your order.";
      if (F.fulfillment === "delivery" && !F.address.trim()) return "Please enter your delivery address.";
      if (F.fulfillment === "meetup" && !F.meetup) return "Please choose a meet-up location.";
      if (!F.payment) return "Choose a payment method.";
      const pm = pms.find(p => p.method_id === F.payment);
      if (pm?.requires_proof && !F.proof) return "Please upload your proof of payment.";
      return null;
    }

    function stepReview() {
      const fee = feeFor();
      const pm = pms.find(p => p.method_id === F.payment);
      const line = (k, v) => el("div", { class: "t-row" }, el("span", { class: "muted" }, k), el("span", { class: "bold" }, v));
      return el("div", { class: "col" },
        el("div", { class: "card flat", style: "background:var(--card-2)" },
          ...S.cart.map(l => el("div", { class: "t-row" },
            el("span", {}, `${l.qty} \u00d7 ${l.name}${l.variantLabel ? " (" + l.variantLabel + ")" : ""}`),
            el("span", {}, money(l.price * l.qty)))),
          el("div", { class: "totals" },
            line("Subtotal", money(cartSubtotal())),
            line("Delivery fee", fee === null ? "To be confirmed by seller" : money(fee)),
            el("div", { class: "t-row grand" }, el("span", {}, "Total"),
              el("span", {}, money(cartSubtotal() + (fee || 0)) + (fee === null ? " +" : ""))))),
        el("div", { class: "card flat" },
          line("Name", F.name), line("Mobile", F.mobile),
          line("Method", { delivery: "Delivery", pickup: "Pickup", meetup: "Meet-up" }[F.fulfillment]),
          F.address ? line("Address", F.address) : null,
          F.meetup ? line("Meet-up", F.meetup) : null,
          F.date ? line("Preferred date", dateFmt(F.date)) : null,
          line("Payment", pm?.name || "\u2014")),
        el("button", { class: "btn link", onclick: () => setStep(1) }, "Edit details"));
    }

    function stepDone() {
      return el("div", { class: "center", style: "padding:18px 0" },
        el("div", { style: "font-size:46px" }, "\u2705"),
        el("h3", { class: "mt" }, "Order placed"),
        el("p", { class: "muted small mt" }, "Save your order number \u2014 you'll need it to check on your order."),
        el("div", { class: "card mt", style: "background:var(--brand-050);border-color:var(--brand)" },
          el("div", { class: "xs muted" }, "ORDER NUMBER"),
          el("div", { style: "font-size:1.5rem;font-weight:750;letter-spacing:.04em" }, orderNo)),
        el("button", { class: "btn ghost mt", onclick: () => copy(orderNo) }, "Copy order number"));
    }

    function render() {
      body.replaceChildren(step === 1 ? stepForm() : step === 2 ? stepReview() : stepDone());
      nextBtn.textContent = step === 1 ? "Review order" : step === 2 ? "Place order" : "Done";
      nextBtn.disabled = false;
    }

    backBtn.onclick = () => setStep(step - 1);
    nextBtn.onclick = async () => {
      if (step === 1) { const e = validate(); if (e) return toast(e, "err"); return setStep(2); }
      if (step === 3) { m.close(); return; }
      nextBtn.disabled = true; nextBtn.textContent = "Placing order\u2026";
      try {
        const check = await api.validateCart(PUBLIC_ID, S.cart);
        if (check.issues.length) {
          S.cart = check.items.filter(i => i.qty > 0); persistCart();
          check.issues.forEach(i => toast(i.message, "err", 5000));
          nextBtn.disabled = false; setStep(1); return;
        }
        const fee = feeFor();
        const pm = pms.find(p => p.method_id === F.payment);
        const r = await api.placeOrder({
          public_store_id: PUBLIC_ID, client_request_id: uid(),
          customer_name: F.name, mobile: F.mobile, fulfillment_type: F.fulfillment,
          address: F.address, meetup_location: F.meetup, preferred_date: F.date || null,
          payment_method: pm?.name || "", proof_file_id: F.proof, notes: F.notes,
          delivery_fee: fee || 0, subtotal: cartSubtotal(), total: cartSubtotal() + (fee || 0),
          items: S.cart
        });
        orderNo = r.order_number;
        S.cart = []; persistCart();
        setStep(3);
        loadProducts(true);
      } catch (e) {
        toast(e.message, "err", 5000);
        nextBtn.disabled = false; nextBtn.textContent = "Place order";
      }
    };
    setStep(1);
  }

  /* ---------------- Track order ---------------- */
  function openTrack() {
    const input = el("input", { class: "input", placeholder: "e.g. VC-100238", autocomplete: "off" });
    const out = el("div", { class: "mt" });
    const go = el("button", { class: "btn primary" }, "Find order");
    go.onclick = async () => {
      if (!input.value.trim()) return toast("Enter your order number.");
      go.disabled = true;
      try {
        const o = await api.trackOrder(PUBLIC_ID, input.value);
        const tone = { PENDING: "warn", UNPAID: "warn", PAID: "info", COMPLETED: "ok", CANCELLED: "danger" }[o.status] || "";
        out.replaceChildren(el("div", { class: "card flat" },
          el("div", { class: "row between" }, el("strong", {}, o.order_number), el("span", { class: "badge " + tone }, o.status)),
          el("div", { class: "small muted mt" }, "Placed ", dateFmt(o.created_at)),
          el("div", { class: "totals mt" }, ...o.items.map(i =>
            el("div", { class: "t-row" }, el("span", {}, `${i.qty} \u00d7 ${i.name}`), el("span", {}, money(i.price * i.qty)))),
            el("div", { class: "t-row grand" }, el("span", {}, "Total"), el("span", {}, money(o.total))))));
      } catch (e) { out.replaceChildren(el("p", { class: "small", style: "color:var(--danger)" }, e.message)); }
      finally { go.disabled = false; }
    };
    modal({ title: "Check my order", body: el("div", {}, el("div", { class: "field" }, el("label", {}, "Order number"), input), out), footer: go });
  }

  /* ---------------- Store info ---------------- */
  function openInfo() {
    const ff = S.store.fulfillment || [];
    const label = { delivery: "Delivery", pickup: "Pickup", meetup: "Meet-up" };
    modal({
      title: S.store.business_name,
      body: el("div", { class: "col" },
        S.store.tagline ? el("p", { class: "muted" }, S.store.tagline) : null,
        el("h4", { class: "mt" }, "How you can get your order"),
        ...ff.map(f => el("div", { class: "card flat" },
          el("div", { class: "bold" }, label[f.type]),
          f.type === "delivery" ? el("div", { class: "small muted" }, f.fee_mode === "manual" ? "Fee confirmed by the seller after ordering" : "Fee: " + money(f.fee)) : null,
          f.address ? el("div", { class: "small" }, f.address) : null,
          f.locations?.length ? el("div", { class: "small" }, f.locations.join(" \u00b7 ")) : null,
          f.instructions ? el("div", { class: "xs muted mt" }, f.instructions) : null)),
        (S.store.contact || []).length ? el("h4", { class: "mt" }, "Contact") : null,
        ...(S.store.contact || []).map(c => el("div", { class: "row between small" },
          el("span", { class: "muted" }, c.type), el("strong", {}, c.value))),
        el("button", { class: "btn ghost block mt", onclick: () => copy(location.href) }, "Copy storefront link"))
    });
  }

  /* ---------------- Events ---------------- */
  function wireEvents() {
    $("#search").addEventListener("input", debounce(e => { S.q = e.target.value.trim(); loadProducts(true); }, 300));
    $("#cartFab").onclick = openCart;
    $("#trackBtn").onclick = openTrack;
    $("#infoBtn").onclick = openInfo;
    $("#themeBtn").onclick = () => theme.toggle();
    $("#viewToggle").onclick = e => {
      S.view = S.view === "grid" ? "list" : "grid";
      store.set("view", S.view);
      $("#products").dataset.view = S.view;
      e.currentTarget.textContent = S.view === "grid" ? "\u2630" : "\u25A6";
    };
    $("#loadMore").onclick = () => loadProducts(false);
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting && S.hasMore && !S.loading) loadProducts(false); }, { rootMargin: "600px" });
    io.observe($("#sentinel"));
  }

  boot();
})();
