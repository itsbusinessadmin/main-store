/* Universal Store — Customer storefront (index.html)  v2.2
   Public, no login. Browse -> product modal (variants) -> cart drawer -> 3-step checkout.

   v2.2 fixes
     - mount() everywhere (no stray "null" text)
     - product photos / logos / QR codes routed through UI.img() so KV ids resolve
     - cart stores the file id, not a raw src, so thumbs survive a reload
*/
(function () {
  const { $, $$, el, mount, img, imgFallback, imagePicker, fileSrc, dl, dlRow, money, dateFmt,
          store, theme, toast, modal, debounce, uid, copy, skeletons, empty } = UI;
  const C = window.US_CONFIG;

  const params = new URLSearchParams(location.search);
  const PUBLIC_ID = (params.get("store") || "").trim().toUpperCase();

  const S = {
    store: null, products: [], offset: 0, hasMore: true, loading: false,
    q: "", category: "", view: store.get("view", "grid"), cart: []
  };
  const cartKey = () => "cart:" + PUBLIC_ID;
  const FF_LABEL = { delivery: "Delivery", pickup: "Pickup", meetup: "Meet-up" };

  /* ---------------- Boot ---------------- */
  async function boot() {
    theme.init();
    $("#viewToggle").textContent = S.view === "grid" ? "\u2630" : "\u25A6";
    $("#products").dataset.view = S.view;

    if (!PUBLIC_ID) {
      return fatal("No store selected",
        "This link is missing its store code. Ask the seller for their storefront link \u2014 it should look like \u2026/index.html?store=SHOP-XXXX-XXXX-XXXX");
    }

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
    /* Hide the header/hero before wiping #app's contents below — #storeHeader
       lives inside #app, so querying it after mount() replaces #app's children
       would return null and throw. */
    $("#storeHeader")?.classList.add("hide");
    mount($("#app"), el("div", { class: "wrap mt-lg" },
      el("div", { class: "card" }, empty("\u{1F6D2}", title, msg))));
  }

  function paintHeader() {
    document.title = S.store.business_name + " \u2014 Shop";
    theme.accent(S.store.accent_color);
    $("#storeName").textContent = S.store.business_name;
    $("#storeTagline").textContent = S.store.tagline || "";

    const logoSrc = fileSrc(S.store.logo);
    const logo = $("#storeLogo");
    if (logoSrc) { logo.src = logoSrc; logo.classList.remove("hide"); }
    const splashLogo = $("#splashLogo");
    if (logoSrc) splashLogo.src = logoSrc; else splashLogo.style.display = "none";

    if (S.store.announcement) {
      $("#announce").textContent = S.store.announcement;
      $("#announce").classList.remove("hide");
    }
    $("#splashName").textContent = S.store.business_name;

    renderHero();
  }

  /* ---------------- Hero ----------------
     Every field falls back to something sensible so a store that hasn't
     touched the Hero section in Store settings still gets a decent-looking
     landing area instead of an empty one. */
  function renderHero() {
    const kicker = $("#heroKicker");
    if (S.store.hero_kicker) { kicker.textContent = S.store.hero_kicker; kicker.classList.remove("hide"); }
    else kicker.classList.add("hide");

    $("#heroHeading").textContent = S.store.hero_heading || S.store.business_name;

    const sub = $("#heroSub");
    const subText = S.store.hero_subheading || S.store.tagline || "";
    if (subText) { sub.textContent = subText; sub.classList.remove("hide"); }
    else sub.classList.add("hide");

    $("#heroCta").textContent = S.store.hero_cta_text || "Shop now";

    const photos = (S.store.hero_images || []).filter(Boolean);
    const media = $("#heroMedia");
    if (photos.length) {
      const { gallery, dots } = buildGallery(photos, S.store.business_name);
      gallery.id = "heroGallery";
      mount(media, gallery, dots);
      media.classList.remove("hide");
    } else {
      media.classList.add("hide");
    }
  }

  /* Shared swipeable gallery + dot indicators, used by the hero and the
     product modal so both behave identically. */
  function buildGallery(photos, altBase) {
    const gallery = el("div", { class: "gallery" },
      ...photos.map(id => img(id, { alt: altBase || "" }) || el("div", { class: "ph", style: "aspect-ratio:1" }, "\u{1F4E6}")));
    const dots = photos.length > 1
      ? el("div", { class: "gal-dots" }, ...photos.map((_, i) => el("i", { class: i ? "" : "on" })))
      : null;
    if (dots) {
      gallery.addEventListener("scroll", debounce(() => {
        const i = Math.round(gallery.scrollLeft / gallery.clientWidth);
        $$("i", dots).forEach((d, j) => d.classList.toggle("on", i === j));
      }, 60));
    }
    return { gallery, dots };
  }

  function renderCategories() {
    mount($("#categories"),
      el("button", { class: "chip on", "data-cat": "", onclick: onCat }, "All"),
      ...(S.store.categories || []).map(c =>
        el("button", { class: "chip", "data-cat": c.category_id, onclick: onCat }, c.name)));
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
    if (reset) { S.offset = 0; S.hasMore = true; S.products = []; mount(host, ...skeletons(8)); }

    try {
      const r = await api.listProducts({
        public_store_id: PUBLIC_ID, q: S.q, category_id: S.category,
        offset: S.offset, limit: C.PAGE_SIZE
      });
      const before = S.products.length;
      S.products.push(...(r.items || []));
      S.offset += (r.items || []).length;
      S.hasMore = !!r.has_more;
      renderProducts(reset, reset ? 0 : before);
    } catch (e) {
      mount(host, empty("\u26A0\uFE0F", "Couldn't load products", e.message));
    } finally { S.loading = false; }
  }

  function renderProducts(reset, from) {
    const host = $("#products");
    if (reset) mount(host);

    if (!S.products.length) {
      mount(host);
      mount($("#emptyState"), empty("\u{1F50D}", "Nothing here yet",
        S.q ? `No products match \u201c${S.q}\u201d.` : "This store hasn't added products to this category."));
      $("#loadMore").classList.add("hide");
      return;
    }
    mount($("#emptyState"));

    const frag = document.createDocumentFragment();
    S.products.slice(from).forEach(p => frag.append(productCard(p)));
    host.append(frag);
    $("#loadMore").classList.toggle("hide", !S.hasMore);
  }

  function productCard(p) {
    const soldOut = p.stock <= 0;
    const photo = img(p.images?.[0], { alt: p.name, cls: "img" })
      || el("div", { class: "img ph" }, "\u{1F4E6}");
    return el("button", { class: "p-card", onclick: () => openProduct(p) },
      photo,
      el("div", { class: "body" },
        el("div", { class: "name clamp2" }, p.name),
        p.variant_groups?.length
          ? el("div", { class: "xs muted" }, p.variant_groups.map(g => g.name).join(" \u00b7 ")) : null,
        el("div", { class: "price" }, money(p.price))),
      soldOut ? el("div", { class: "sold-out" }, "Sold out") : null);
  }

  /* ---------------- Product modal ---------------- */
  function openProduct(p) {
    if (p.stock <= 0) return toast("That item is sold out right now.");
    let qty = 1;
    const chosen = {};
    (p.variant_groups || []).forEach(g => chosen[g.name] = null);

    const photos = (p.images || []).filter(Boolean);
    const { gallery, dots } = photos.length
      ? buildGallery(photos, p.name)
      : { gallery: el("div", { class: "gallery" }, el("div", { class: "ph", style: "aspect-ratio:1;width:100%;border-radius:12px" }, "\u{1F4E6}")), dots: null };

    const priceEl = el("div", { class: "bold", style: "font-size:1.35rem;color:var(--brand)" }, money(p.price));
    const nEl = el("span", { class: "n" }, "1");
    const addBtn = el("button", { class: "btn primary block lg" }, "Add to cart");

    const livePrice = () => (p.variant_groups || []).reduce((price, g) => {
      const i = g.options.indexOf(chosen[g.name]);
      return price + (i > -1 ? (g.price_delta?.[i] || 0) : 0);
    }, p.price);

    const refresh = () => {
      priceEl.textContent = money(livePrice() * qty);
      const missing = (p.variant_groups || []).find(g => !chosen[g.name]);
      addBtn.disabled = !!missing;
      addBtn.textContent = missing ? `Choose ${missing.name}` : "Add to cart";
    };

    const variantUI = (p.variant_groups || []).map(g => el("div", { class: "field" },
      el("label", {}, g.name),
      el("div", { class: "chips wrap-" }, ...g.options.map((o, i) => el("button", {
        class: "chip", type: "button",
        onclick: e => {
          chosen[g.name] = o;
          e.currentTarget.parentElement.querySelectorAll(".chip").forEach(c => c.classList.remove("on"));
          e.currentTarget.classList.add("on");
          refresh();
        }
      }, o + (g.price_delta?.[i] ? ` (+${money(g.price_delta[i])})` : ""))))));

    const stepper = el("div", { class: "stepper" },
      el("button", { "aria-label": "Decrease", onclick: () => { qty = Math.max(1, qty - 1); nEl.textContent = qty; refresh(); } }, "\u2212"),
      nEl,
      el("button", { "aria-label": "Increase", onclick: () => {
        if (qty >= p.stock) return toast(`Only ${p.stock} in stock.`);
        qty++; nEl.textContent = qty; refresh();
      } }, "+"));

    const m = modal({
      title: p.name,
      body: el("div", {},
        gallery, dots,
        el("div", { class: "row between" }, priceEl,
          el("span", { class: "badge " + (p.stock > 5 ? "ok" : "warn") }, p.stock + " in stock")),
        p.description ? el("p", { class: "muted" }, p.description) : null,
        ...variantUI,
        el("div", { class: "row" }, el("span", { class: "small muted grow" }, "Quantity"), stepper)),
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
        S.cart.push({
          key, product_id: p.product_id, name: p.name,
          variant: { ...chosen }, variantLabel,
          price: livePrice(), qty,
          image: p.images?.[0] || ""      /* store the id, resolve at render time */
        });
      }
      persistCart(); m.close(); toast("Added to cart", "ok");
    };
  }

  /* ---------------- Cart ---------------- */
  const cartCount = () => S.cart.reduce((t, l) => t + l.qty, 0);
  const cartSubtotal = () => S.cart.reduce((t, l) => t + l.price * l.qty, 0);

  function persistCart() { store.set(cartKey(), S.cart); renderCartFab(); }

  function renderCartFab() {
    const n = cartCount();
    $("#cartFab").hidden = n === 0;
    $("#cartCount").textContent = n;
  }

  function openCart() {
    if (!S.cart.length) return toast("Your cart is empty.");
    const body = el("div");
    const checkoutBtn = el("button", { class: "btn primary block lg" }, "Checkout");

    const paint = () => {
      mount(body,
        ...S.cart.map(l => el("div", { class: "cart-line" },
          img(l.image, { alt: "" }) || el("div", { class: "ph", style: "width:62px;height:62px;border-radius:9px" }, "\u{1F4E6}"),
          el("div", { class: "grow" },
            el("div", { class: "bold" }, l.name),
            l.variantLabel ? el("div", { class: "xs muted" }, l.variantLabel) : null,
            el("div", { class: "small muted" }, `${money(l.price)} \u00d7 ${l.qty}`),
            el("button", { class: "btn link xs", onclick: () => {
              S.cart = S.cart.filter(x => x.key !== l.key);
              persistCart();
              if (S.cart.length) paint(); else { m.close(); toast("Cart cleared"); }
            } }, "Remove")),
          el("div", { class: "bold" }, money(l.price * l.qty)))),
        el("div", { class: "totals" },
          el("div", { class: "t-row" }, el("span", {}, "Subtotal"), el("span", {}, money(cartSubtotal()))),
          el("div", { class: "t-row" }, el("span", {}, "Delivery fee"), el("span", { class: "muted" }, "Calculated at checkout"))));
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

    const steps = el("div", { class: "steps" },
      el("div", { class: "s on" }), el("div", { class: "s" }), el("div", { class: "s" }));
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
      $$(".s", steps).forEach((s, idx) => s.classList.toggle("on", idx < n));
      backBtn.classList.toggle("hide", n === 1 || n === 3);
      render();
    };

    const f = (label, node, hint) => el("div", { class: "field" },
      el("label", {}, label), node, hint ? el("div", { class: "hint" }, hint) : null);

    function stepForm() {
      const wrap = el("div");
      wrap.append(
        f("Your name", el("input", { class: "input", value: F.name, autocomplete: "name",
          oninput: e => F.name = e.target.value })),
        f("Mobile number", el("input", { class: "input", type: "tel", value: F.mobile, autocomplete: "tel",
          placeholder: "09XX XXX XXXX", oninput: e => F.mobile = e.target.value })));

      if (ff.length > 1) {
        wrap.append(f("How would you like to get it?", el("div", { class: "chips wrap-" },
          ...ff.map(x => el("button", {
            class: "chip" + (F.fulfillment === x.type ? " on" : ""), type: "button",
            onclick: () => { F.fulfillment = x.type; F.payment = ""; render(); }
          }, FF_LABEL[x.type])))));
      } else if (ff.length === 1) {
        wrap.append(el("p", { class: "small muted mb" }, "Fulfillment: ", el("strong", {}, FF_LABEL[ff[0].type])));
      }

      const row = ff.find(x => x.type === F.fulfillment);
      if (F.fulfillment === "delivery")
        wrap.append(f("Delivery address",
          el("textarea", { class: "textarea", value: F.address, oninput: e => F.address = e.target.value }),
          row?.instructions || ""));
      if (F.fulfillment === "pickup")
        wrap.append(el("div", { class: "card flat mb" },
          el("div", { class: "bold small" }, "Pick up at"),
          el("div", { class: "small" }, row?.address || "\u2014"),
          row?.instructions ? el("div", { class: "xs muted mt" }, row.instructions) : null));
      if (F.fulfillment === "meetup")
        wrap.append(f("Meet-up location", el("select", { class: "select", onchange: e => F.meetup = e.target.value },
          el("option", { value: "" }, "Choose a location\u2026"),
          ...(row?.locations || []).map(l => el("option", { value: l, selected: F.meetup === l }, l)))));

      const sch = S.store.scheduling;
      if (sch?.enabled) {
        const min = new Date(Date.now() + (sch.prep_days || 0) * 86400000).toISOString().slice(0, 10);
        const max = new Date(Date.now() + (sch.max_advance_days || 14) * 86400000).toISOString().slice(0, 10);
        wrap.append(f("Preferred date",
          el("input", { class: "input", type: "date", min, max, value: F.date, onchange: e => F.date = e.target.value }),
          `Available from ${dateFmt(min)} to ${dateFmt(max)}.`));
      }

      const valid = pms.filter(p => !p.valid_for?.length || p.valid_for.includes(F.fulfillment));
      if (valid.length === 1 && !F.payment) F.payment = valid[0].method_id;

      wrap.append(f("Payment method", valid.length ? el("div", { class: "col" },
        ...valid.map(p => el("button", {
          class: "list-item" + (F.payment === p.method_id ? " selected" : ""), type: "button",
          onclick: () => { F.payment = p.method_id; render(); }
        },
          img(p.qr_file_id, { alt: "", cls: "thumb", fallback: imgFallback("\u{1F4B3}") }) || imgFallback("\u{1F4B3}"),
          el("div", { class: "grow" },
            el("div", { class: "li-title" }, p.name),
            p.account_number ? el("div", { class: "li-sub" }, `${p.account_name} \u00b7 ${p.account_number}`) : null,
            p.requires_proof ? el("div", { class: "li-sub" }, "Proof of payment required") : null))))
        : el("div", { class: "locked" }, "This store hasn't set up a payment method yet. Please contact the seller.")));

      const chosenPm = pms.find(p => p.method_id === F.payment);
      if (chosenPm?.qr_file_id) {
        const qr = img(chosenPm.qr_file_id, { alt: "Payment QR code", cls: "qr-img", style: "margin:0 auto" });
        if (qr) wrap.append(el("div", { class: "card flat mb", style: "text-align:center" },
          el("div", { class: "small bold mb" }, "Scan to pay"), qr));
      }
      if (chosenPm?.requires_proof) {
        wrap.append(f("Proof of payment",
          imagePicker({ value: F.proof, label: "Tap to upload a screenshot of your payment",
            maxPx: 1400, onChange: v => F.proof = v })));
      }

      wrap.append(f("Notes for the seller (optional)",
        el("textarea", { class: "textarea", value: F.notes, oninput: e => F.notes = e.target.value })));
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
      return el("div", {},
        el("div", { class: "card flat" },
          el("h4", { class: "sec-h" }, "Your order"),
          ...S.cart.map(l => el("div", { class: "t-row" },
            el("span", {}, `${l.qty} \u00d7 ${l.name}${l.variantLabel ? " (" + l.variantLabel + ")" : ""}`),
            el("span", {}, money(l.price * l.qty)))),
          el("div", { class: "totals" },
            el("div", { class: "t-row" }, el("span", {}, "Subtotal"), el("span", {}, money(cartSubtotal()))),
            el("div", { class: "t-row" }, el("span", {}, "Delivery fee"),
              el("span", {}, fee === null ? "To be confirmed" : money(fee))),
            el("div", { class: "t-row grand" }, el("span", {}, "Total"),
              el("span", {}, money(cartSubtotal() + (fee || 0)) + (fee === null ? " +" : ""))))),
        el("div", { class: "card flat" },
          el("h4", { class: "sec-h" }, "Your details"),
          dl(
            dlRow("Name", F.name),
            dlRow("Mobile", F.mobile),
            dlRow("Method", FF_LABEL[F.fulfillment]),
            dlRow("Address", F.address, { stack: true }),
            dlRow("Meet-up", F.meetup),
            dlRow("Preferred date", F.date ? dateFmt(F.date) : null),
            dlRow("Payment", pm?.name),
            dlRow("Notes", F.notes, { stack: true }))),
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
      mount(body, step === 1 ? stepForm() : step === 2 ? stepReview() : stepDone());
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
          S.cart = check.items.filter(i => i.qty > 0);
          persistCart();
          check.issues.forEach(i => toast(i.message, "err", 5000));
          nextBtn.disabled = false; setStep(1);
          return;
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
        toast(e.message, "err", 6000);
        nextBtn.disabled = false; nextBtn.textContent = "Place order";
      }
    };

    setStep(1);
  }

  /* ---------------- Track order ---------------- */
  function openTrack() {
    const input = el("input", { class: "input", placeholder: "e.g. VC-1001", autocomplete: "off" });
    const out = el("div");
    const go = el("button", { class: "btn primary" }, "Find order");

    go.onclick = async () => {
      if (!input.value.trim()) return toast("Enter your order number.");
      go.disabled = true;
      try {
        const o = await api.trackOrder(PUBLIC_ID, input.value);
        const tone = { PENDING: "warn", UNPAID: "warn", PAID: "info", COMPLETED: "ok", CANCELLED: "danger" }[o.status] || "";
        mount(out, el("div", { class: "card flat" },
          el("div", { class: "row between" },
            el("strong", {}, o.order_number),
            el("span", { class: "badge " + tone }, o.status)),
          el("div", { class: "small muted mt" }, "Placed " + dateFmt(o.created_at)),
          el("div", { class: "totals mt" },
            ...(o.items || []).map(i => el("div", { class: "t-row" },
              el("span", {}, `${i.qty} \u00d7 ${i.name}`), el("span", {}, money(i.price * i.qty)))),
            el("div", { class: "t-row grand" }, el("span", {}, "Total"), el("span", {}, money(o.total))))));
      } catch (e) {
        mount(out, el("p", { class: "small", style: "color:var(--danger)" }, e.message));
      } finally { go.disabled = false; }
    };

    modal({
      title: "Check my order",
      body: el("div", {}, el("div", { class: "field" }, el("label", {}, "Order number"), input), out),
      footer: go
    });
  }

  /* ---------------- Store info ---------------- */
  function openInfo() {
    const ff = S.store.fulfillment || [];
    modal({
      title: S.store.business_name,
      body: el("div", {},
        S.store.tagline ? el("p", { class: "muted" }, S.store.tagline) : null,
        el("h4", { class: "sec-h" }, "How you can get your order"),
        ...ff.map(f => el("div", { class: "card flat" },
          el("div", { class: "bold" }, FF_LABEL[f.type]),
          f.type === "delivery"
            ? el("div", { class: "small muted" },
                f.fee_mode === "manual" ? "Fee confirmed by the seller after ordering" : "Fee: " + money(f.fee))
            : null,
          f.address ? el("div", { class: "small mt" }, f.address) : null,
          f.locations?.length ? el("div", { class: "small mt" }, f.locations.join(" \u00b7 ")) : null,
          f.instructions ? el("div", { class: "xs muted mt" }, f.instructions) : null)),
        (S.store.contact || []).length
          ? el("div", { class: "card flat" },
              el("h4", { class: "sec-h" }, "Contact"),
              dl(...S.store.contact.map(c => dlRow(c.type, c.value))))
          : null,
        el("button", { class: "btn ghost block", onclick: () => copy(location.href) }, "Copy storefront link"))
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
    $("#heroCta").onclick = () => $("#shopSection").scrollIntoView({ behavior: "smooth", block: "start" });
    $$(".nav-link").forEach(a => a.addEventListener("click", e => {
      $$(".nav-link").forEach(x => x.classList.remove("on"));
      e.currentTarget.classList.add("on");
    }));

    const io = new IntersectionObserver(
      es => { if (es[0].isIntersecting && S.hasMore && !S.loading) loadProducts(false); },
      { rootMargin: "600px" });
    io.observe($("#sentinel"));
  }

  boot();
})();
