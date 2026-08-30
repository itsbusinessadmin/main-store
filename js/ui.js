/* Universal Store — shared UI kit: DOM helpers, toasts, modals, theme, money, storage. */
(function (w) {
  const C = w.US_CONFIG;

  /* ---------- DOM ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "dataset") Object.assign(n.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, "");
      else if (v !== false && v != null) n.setAttribute(k, v);
    }
    kids.flat().forEach(c => c != null && n.append(c.nodeType ? c : document.createTextNode(c)));
    return n;
  }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  /* ---------- Format ---------- */
  const money = n => C.CURRENCY_SYMBOL + Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const dateFmt = (d, o = { month: "short", day: "numeric", year: "numeric" }) =>
    d ? new Date(d).toLocaleDateString(undefined, o) : "—";
  const dateTimeFmt = d => d ? new Date(d).toLocaleString(undefined,
    { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
  const daysLeft = iso => Math.ceil((new Date(iso) - Date.now()) / 86400000);

  /* ---------- Storage (namespaced, safe) ---------- */
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
      const mode = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      this.apply(mode);
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
  function toast(msg, kind = "", ms = 3200) {
    if (!toastHost) { toastHost = el("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.append(toastHost); }
    const t = el("div", { class: "toast " + kind }, msg);
    toastHost.append(t);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 200); }, ms);
  }

  /* ---------- Modal (accessible: focus trap + ESC + scroll lock) ---------- */
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
        scrim.remove();
        openStack.pop();
        if (!openStack.length) document.body.style.overflow = "";
        prevFocus && prevFocus.focus?.();
        onClose && onClose();
      }, 180);
    };
    const closeBtn = el("button", { class: "btn icon ghost", "aria-label": "Close", onclick: close }, "\u2715");
    if (!side) sheet.append(el("div", { class: "grabber" }));
    sheet.append(el("div", { class: "sheet-h" }, el("h2", {}, title), closeBtn));
    const bodyEl = el("div", { class: "sheet-b" });
    (Array.isArray(body) ? body : [body]).forEach(b => b && bodyEl.append(b.nodeType ? b : el("div", { html: String(b) })));
    sheet.append(bodyEl);
    if (footer) sheet.append(el("div", { class: "sheet-f" }, ...(Array.isArray(footer) ? footer : [footer])));
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

    return { scrim, sheet, body: bodyEl, close, setBody(...n) { bodyEl.replaceChildren(...n); } };
  }

  function confirmDialog({ title = "Are you sure?", message = "", confirmText = "Confirm", danger = false, typeToConfirm = null }) {
    return new Promise(resolve => {
      let input;
      const okBtn = el("button", { class: "btn " + (danger ? "danger" : "primary") }, confirmText);
      const kids = [el("p", { class: "muted" }, message)];
      if (typeToConfirm) {
        okBtn.disabled = true;
        input = el("input", {
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

  /* ---------- Misc helpers ---------- */
  const debounce = (fn, ms = 280) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID()
    : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9));

  function fileToDataURL(file, maxPx = 1200, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file."));
      const img = new Image(), fr = new FileReader();
      fr.onload = () => { img.src = fr.result; };
      fr.onerror = () => reject(new Error("Could not read that file."));
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const c = el("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("That image could not be loaded."));
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

  function skeletons(n, cls = "skel card") {
    return Array.from({ length: n }, () => el("div", { class: cls }));
  }

  function empty(icon, title, sub, action) {
    return el("div", { class: "empty" },
      el("div", { class: "ico" }, icon), el("h3", {}, title),
      el("p", { class: "small" }, sub || ""), action || null);
  }

  /* Lightweight drag-to-reorder for a list container. onDrop(orderedIds). */
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

  w.UI = { $, $$, el, esc, money, dateFmt, dateTimeFmt, daysLeft, store, theme, toast, modal,
           confirmDialog, debounce, uid, fileToDataURL, copy, skeletons, empty, sortable };
})(window);
