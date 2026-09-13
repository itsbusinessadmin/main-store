/* Universal Store — API client.
   One endpoint, many actions (RPC style), exactly as in BRAIN.md §3.
   api.call("store_save_product", {...}) -> POST { action, ...payload }

   If US_CONFIG.DEMO_MODE is true, calls are routed to the in-browser mock
   backend in mock.js so the UI is fully explorable with no server. mock.js is
   fetched on first use rather than linked from the pages: it is the largest
   script in the project and a live store never executes a line of it. */
(function (w) {
  const C = w.US_CONFIG;

  class ApiError extends Error {
    constructor(message, code, status) { super(message); this.code = code; this.status = status; }
  }

  const PUBLIC_READS = new Set([
    "public_get_store", "public_list_products", "public_get_product",
    "public_list_categories", "public_get_fulfillment", "public_get_payment_methods",
    "public_validate_cart"
  ]);

  /* Resolves once mock.js has loaded. Cached, so concurrent calls at boot
     share one request instead of racing to insert several script tags. */
  let mockReady = null;
  function loadMock() {
    return mockReady ||= new Promise((resolve, reject) => {
      if (w.MockBackend) return resolve();
      const tag = document.createElement("script");
      tag.src = "js/mock.js";
      tag.onload = () => resolve();
      tag.onerror = () => { mockReady = null; reject(new ApiError("Couldn't load the demo data.", "NETWORK", 0)); };
      document.head.append(tag);
    });
  }

  const api = {
    ApiError,

    /* Credentials held in memory; persisted by each app as it sees fit. */
    storeId: null,      // STR-XXXX-XXXX-XXXX  (merchant)
    masterToken: null,  // Google ID token      (platform owner)

    async call(action, payload = {}, { signal, retries = 1 } = {}) {
      if (C.DEMO_MODE) { await loadMock(); return w.MockBackend.handle(action, payload, this); }

      const body = JSON.stringify({ action, ...payload });
      const headers = { "Content-Type": "application/json" };
      if (this.storeId) headers["X-Store-Id"] = this.storeId;
      if (this.masterToken) headers["Authorization"] = "Bearer " + this.masterToken;

      let lastErr;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await fetch(C.API_BASE + "/", { method: "POST", headers, body, signal });
          let json;
          try { json = await res.json(); }
          catch { throw new ApiError("The server returned an unreadable response.", "BAD_JSON", res.status); }
          if (!res.ok || json.ok === false) {
            throw new ApiError(json.error || "Request failed.", json.code || "ERROR", res.status);
          }
          return json.data ?? json;
        } catch (e) {
          lastErr = e;
          if (e.name === "AbortError" || e instanceof ApiError) throw e;
          if (attempt < retries) await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        }
      }
      throw new ApiError("Can't reach the server. Check your connection and try again.", "NETWORK", 0);
    },

    /* Cached GET for public storefront reads — lets the service worker serve them offline. */
    async read(action, payload = {}) {
      if (C.DEMO_MODE || !PUBLIC_READS.has(action)) return this.call(action, payload);
      const qs = new URLSearchParams({ action, ...Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)])) });
      const res = await fetch(C.API_BASE + "/?" + qs.toString());
      const json = await res.json().catch(() => ({ ok: false, error: "Unreadable response." }));
      if (!res.ok || json.ok === false) throw new ApiError(json.error || "Request failed.", json.code, res.status);
      return json.data ?? json;
    },

    /* ---- Files (KV) ---- */
    uploadFile: (dataUrl, kind) => api.call("file_upload", { data: dataUrl, kind }),
    fileUrl: id => (!id ? "" : id.startsWith("data:") ? id : `${C.API_BASE}/?action=file_get&id=${encodeURIComponent(id)}`),

    /* ---- Public storefront ---- */
    getStore: publicId => api.read("public_get_store", { public_store_id: publicId }),
    listProducts: p => api.read("public_list_products", p),
    getProduct: (publicId, id) => api.read("public_get_product", { public_store_id: publicId, product_id: id }),
    validateCart: (publicId, items) => api.call("public_validate_cart", { public_store_id: publicId, items }),
    placeOrder: p => api.call("public_place_order", p),

    /* ---- Merchant ---- */
    storeLogin: storeId => api.call("store_login", { store_id: storeId }),
    storeSignup: p => api.call("store_signup", p),
    storeDashboard: () => api.call("store_dashboard"),
    storeOrders: p => api.call("store_list_orders", p),
    storeUpdateOrder: p => api.call("store_update_order", p),
    storeCatalog: () => api.call("store_catalog", {}),
    storeSaveProduct: p => api.call("store_save_product", p),
    storeDeleteProduct: id => api.call("store_delete_product", { product_id: id }),
    storeBulkDeleteProducts: ids => api.call("store_bulk_delete_products", { ids }),
    storeBulkMoveProducts: (ids, category_id) => api.call("store_bulk_move_products", { ids, category_id }),
    storeBulkDeleteOrders: ids => api.call("store_bulk_delete_orders", { ids }),
    storeBulkDeleteCategories: ids => api.call("store_bulk_delete_categories", { ids }),
    storeReorderProducts: ids => api.call("store_reorder_products", { ids }),
    storeSaveCategory: p => api.call("store_save_category", p),
    storeDeleteCategory: id => api.call("store_delete_category", { category_id: id }),
    storeSavePaymentMethod: p => api.call("store_save_payment_method", p),
    storeDeletePaymentMethod: id => api.call("store_delete_payment_method", { method_id: id }),
    storeSaveFulfillment: p => api.call("store_save_fulfillment", p),
    storeSaveSettings: p => api.call("store_save_settings", p),
    storeSubscription: () => api.call("store_get_subscription"),
    storeSubmitPayment: p => api.call("store_submit_payment", p),
    storeCompleteSetup: () => api.call("store_complete_setup"),
    listPlans: () => api.read("public_list_plans"),
    listMasterPaymentMethods: () => api.read("public_list_master_payment_methods"),

    /* ---- Master admin ---- */
    masterSignIn: token => api.call("master_sign_in", { id_token: token }),
    masterDashboard: () => api.call("master_dashboard"),
    masterStores: p => api.call("master_list_stores", p),
    masterStore: id => api.call("master_get_store", { store_id: id }),
    masterSetStoreStatus: p => api.call("master_set_store_status", p),
    masterRegenerateId: id => api.call("master_regenerate_store_id", { store_id: id }),
    masterExtend: p => api.call("master_extend_subscription", p),
    masterDeleteStore: id => api.call("master_delete_store", { store_id: id }),
    masterPendingPayments: () => api.call("master_list_pending_payments"),
    masterReviewPayment: p => api.call("master_review_payment", p),
    masterSavePlan: p => api.call("master_save_plan", p),
    masterSaveMasterPayment: p => api.call("master_save_master_payment_method", p),
    storeSetSlug: slug => api.call("store_set_slug", { slug }),
    masterUsage: () => api.call("master_usage"),
    masterSaveUsageService: p => api.call("master_save_usage_service", p),
    masterDeleteUsageService: id => api.call("master_delete_usage_service", { service_id: id })
  };

  w.api = api;
})(window);
