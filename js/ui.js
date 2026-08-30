/* Universal Store — shared UI kit: DOM helpers, toasts, modals, theme, money, storage.
   v2.2
     + mount()  — replaceChildren that ignores null/false (fixes stray "null" text)
     + img()    — every image src routed through api.fileUrl() so KV FILE- ids resolve
     + dl()/dlRow() — definition rows with proper spacing
*/
(function (w) {
  const C = w.US_CONFIG;

  /* ---------- DOM ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "dataset") Object.assign(n.dataset, v);
      else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, "");
      else n.setAttribute(k, v);
    }
    kids.flat(Infinity).forEach(c => {
      if (c == null || c === false || c === "") return;
      n.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return n;
  }

  /* Safe replaceChildren. Node.replaceChildren() stringifies null to "null",
     which is where the stray "nullnull" came from. Always use this instead. */
  function mount(host, ...nodes) {
    host.replaceChildren(
      ...nodes.flat(Infinity).filter(n => n != null && n !== false && n !== "")
    );
    return host;
  }

  const esc = s => String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  /* ---------- Images ----------
     File ids from the Worker look like "FILE-uuid" and are not URLs. Route
     everything through api.fileUrl(), which passes data: URLs straight through
     and builds a ?action=file_get URL for KV ids. */
  function fileSrc(id) {
    if (!id) return "";
    if (typeof w.api?.fileUrl === "function") return w.api.fileUrl(id);
    return String(id).startsWith("data:") ? id
      : `${C.API_BASE}/?action=file_get&id=${encodeURIComponent(id)}`;
  }

  function img(id, { alt = "", cls = "", style = "", fallback = null } = {}) {
    const src = fileSrc(id);
    if (!src) return fallback;
    const node = el("img", { src, alt, class: cls || null, style: style || null, loading: "lazy" });
    node.addEventListener("error", () => {
      if (fallback && node.parentElement) node.replaceWith(fallback);
      else node.style.display = "none";
    });
    return node;
  }

  const imgFallback = (glyph = "\u{1F5BC}\uFE0F", cls = "thumb") =>
    el("div", { class: cls + " ph" }, glyph);

  /* ---------- Format ---------- */
  const money = n => C.CURRENCY_SYMBOL + Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const dateFmt = (d, o = { month: "short", day: "numeric", year: "numeric" }) =>
    d ? new Date(d).toLocaleDateString(undefined, o) : "\u2014";
  const dateTimeFmt = d => d ? new Date(d).toLocaleString(undefined,
    { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "\u2014";
  const daysLeft = iso => Math.ceil((new Date(iso) - Date.now()) / 86400000);

  /* ---------- Definition rows (label / value, properly spaced) ---------- */
  const dlRow = (label, value, opts = {}) => {
    if (value == null || value === "") return null;
    return el("div", { class: "dl-row" + (opts.stack ? " stack" : "") },
      el("span", { class: "dl-k" }, label),
      el("span", { class: "dl-v" + (opts.mono ? " mono" : "") + (opts.tone ? " " + opts.tone : "") },
        value.nodeType ? value : String(value)));
  };
  const dl = (...rows) => el("div", { class: "dl" }, ...rows.flat(Infinity).filter(Boolean));

  /* ---------- Storage ---------- */
  const store = {
    get(k, fb = null) {
      try { const v = localStorage.getItem(C.STORAGE_PREFIX + k); return v ? JSON.parse(v) : fb; }
      catch { return fb; }
    },
    set(k, v) { try { localStorage.setItem(C.STORAGE_PREFIX + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(C.STORAGE_PREFIX + k); } catch {} }
  };

  /* ---------- Theme ---------- */
  const theme = {
    init() {
      const saved = store.get("colorMode");
      this.apply(saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    },
    apply(mode) {
      document.documentElement.setAttribute("data-color-mode", mode);
      store.set("colorMode", mode);
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.content = mode === "dark" ? "#0e120f" : "#f6f7f5";
      $$("[data-theme-toggle]").forEach(b => b.textContent = mode === "dark" ? "\u2600\uFE0F" : "\u{1F319}");
    },
    toggle() {
      this.apply(document.documentElement.getAttribute("data-color-mode") === "dark" ? "light" : "dark");
    },
    accent(hex) { if (hex) document.documentElement.style.setProperty("--brand", hex); }
  };

  /* ---------- Toasts ---------- */
  let toastHost;
  function toast(msg, kind = "", ms = 3400) {
    if (!toastHost) { toastHost = el("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.append(toastHost); }
    const t = el("div", { class: "toast " + kind }, msg);
    toastHost.append(t);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 200); }, ms);
  }

  /* ---------- Modal ---------- */
  const openStack = [];
  function modal({ title = "", body, footer = null, wide = false, side = false, onClose } = {}) {
    const scrim = el("div", { class: "scrim" + (side ? " right" : "") });
    const sheet = el("div", {
      class: "sheet" + (wide ? " wide" : "") + (side ? " drawer" : ""),
      role: "dialog", "aria-modal": "true", "aria-label": title || "Dialog"
    });
    const close = () => {
      scrim.classList.remove("open");
      setTimeout(() => {
        scrim.remove(); openStack.pop();
        if (!openStack.length) document.body.style.overflow = "";
        prevFocus && prevFocus.focus?.();
        onClose && onClose();
      }, 180);
    };
    const closeBtn = el("button", { class: "btn icon ghost", "aria-label": "Close", onclick: close }, "\u2715");
    if (!side) sheet.append(el("div", { class: "grabber" }));
    sheet.append(el("div", { class: "sheet-h" }, el("h2", {}, title), closeBtn));
    const bodyEl = el("div", { class: "sheet-b" });
    mount(bodyEl, ...(Array.isArray(body) ? body : [body]));
    sheet.append(bodyEl);
    if (footer) {
      const f = el("div", { class: "sheet-f" });
      mount(f, ...(Array.isArray(footer) ? footer : [footer]));
      sheet.append(f);
    }
    scrim.append(sheet);
    scrim.addEventListener("mousedown", e => { if (e.target === scrim) close(); });

    const prevFocus = document.activeElement;
    document.body.append(scrim);
    document.body.style.overflow = "hidden";
    openStack.push(close);
    requestAnimationFrame(() => scrim.classList.add("open"));

    scrim.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.stopPropagation(); close(); return; }
      if (e.key !== "Tab") return;
      const f = $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', sheet)
        .filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    setTimeout(() => ($$('input,select,textarea,button', bodyEl)[0] || closeBtn).focus(), 220);

    return { scrim, sheet, body: bodyEl, close, setBody(...n) { mount(bodyEl, ...n); } };
  }

  function confirmDialog({ title = "Are you sure?", message = "", confirmText = "Confirm", danger = false, typeToConfirm = null }) {
    return new Promise(resolve => {
      const okBtn = el("button", { class: "btn " + (danger ? "danger" : "primary") }, confirmText);
      const kids = [el("p", { class: "muted" }, message)];
      if (typeToConfirm) {
        okBtn.disabled = true;
        const input = el("input", {
          class: "input", placeholder: typeToConfirm, autocomplete: "off",
          oninput: e => okBtn.disabled = e.target.value.trim() !== typeToConfirm
        });
        kids.push(el("div", { class: "field mt" },
          el("label", {}, "Type ", el("code", {}, typeToConfirm), " to confirm"), input));
      }
      const m = modal({
        title, body: el("div", {}, ...kids),
        footer: [el("button", { class: "btn ghost", onclick: () => { m.close(); resolve(false); } }, "Cancel"), okBtn]
      });
      okBtn.onclick = () => { m.close(); resolve(true); };
    });
  }

  /* ---------- Image picker (upload + preview + remove) ---------- */
  function imagePicker({ value = "", label = "Tap to upload an image", maxPx = 1200, onChange } = {}) {
    let current = value;
    const box = el("div", { class: "uploader" });
    const input = el("input", { type: "file", accept: "image/*", class: "sr" });

    const paint = () => {
      if (current) {
        const preview = img(current, { alt: "Preview", style: "max-height:170px;margin:0 auto;border-radius:12px" })
          || el("div", { class: "muted small" }, "Image saved");
        mount(box,
          preview,
          el("div", { class: "row center mt", style: "justify-content:center;gap:8px" },
            el("button", { class: "btn ghost sm", type: "button", onclick: e => { e.stopPropagation(); input.click(); } }, "Replace"),
            el("button", { class: "btn ghost sm", type: "button", onclick: e => {
              e.stopPropagation(); current = ""; onChange && onChange(""); paint();
            } }, "Remove")));
      } else {
        mount(box, el("div", { class: "up-ico" }, "\u{1F4F7}"), el("div", { class: "small" }, label));
      }
    };

    input.onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        current = await fileToDataURL(file, maxPx);
        onChange && onChange(current);
        paint();
      } catch (err) { toast(err.message, "err"); }
      input.value = "";
    };
    box.onclick = () => input.click();
    paint();
    return el("div", {}, box, input);
  }

  /* ---------- Misc ---------- */
  const debounce = (fn, ms = 280) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID()
    : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9));

  function fileToDataURL(file, maxPx = 1200, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file."));
      const image = new Image(), fr = new FileReader();
      fr.onload = () => { image.src = fr.result; };
      fr.onerror = () => reject(new Error("Could not read that file."));
      image.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(image.width, image.height));
        const c = el("canvas");
        c.width = Math.round(image.width * scale); c.height = Math.round(image.height * scale);
        c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      image.onerror = () => reject(new Error("That image could not be loaded."));
      fr.readAsDataURL(file);
    });
  }

  function copy(text) {
    (navigator.clipboard?.writeText(text) ?? Promise.reject())
      .then(() => toast("Copied to clipboard", "ok"))
      .catch(() => {
        const t = el("textarea", { style: "position:fixed;opacity:0" }); t.value = text;
        document.body.append(t); t.select(); document.execCommand("copy"); t.remove();
        toast("Copied to clipboard", "ok");
      });
  }

  const skeletons = (n, cls = "skel card") => Array.from({ length: n }, () => el("div", { class: cls }));

  const empty = (icon, title, sub, action) => el("div", { class: "empty" },
    el("div", { class: "ico" }, icon), el("h3", {}, title),
    sub ? el("p", { class: "small" }, sub) : null, action || null);

  function sortable(container, onDrop) {
    let dragging = null;
    container.addEventListener("dragstart", e => {
      const item = e.target.closest("[data-sort-id]"); if (!item) return;
      dragging = item; item.classList.add("dragging"); e.dataTransfer.effectAllowed = "move";
    });
    container.addEventListener("dragover", e => {
      e.preventDefault(); if (!dragging) return;
      const after = [...container.querySelectorAll("[data-sort-id]:not(.dragging)")]
        .reduce((best, child) => {
          const b = child.getBoundingClientRect(), off = e.clientY - b.top - b.height / 2;
          return off < 0 && off > best.off ? { off, node: child } : best;
        }, { off: -Infinity, node: null }).node;
      after ? container.insertBefore(dragging, after) : container.append(dragging);
    });
    container.addEventListener("dragend", () => {
      if (!dragging) return;
      dragging.classList.remove("dragging"); dragging = null;
      onDrop([...container.querySelectorAll("[data-sort-id]")].map(n => n.dataset.sortId));
    });
  }

  w.UI = { $, $$, el, mount, esc, img, fileSrc, imgFallback, imagePicker, dl, dlRow,
           money, dateFmt, dateTimeFmt, daysLeft, store, theme, toast, modal,
           confirmDialog, debounce, uid, fileToDataURL, copy, skeletons, empty, sortable };
})(window);
