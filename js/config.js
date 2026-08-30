/* Universal Store — global config.
   Change API_BASE to your deployed Cloudflare Worker URL.
   Leave DEMO_MODE = true to run the whole app with an in-browser mock backend
   (no Worker, no D1, no KV needed) so you can design/test offline. */
window.US_CONFIG = {
  APP_NAME: "Universal Store",
  API_BASE: "https://universal-store.YOUR-SUBDOMAIN.workers.dev",
  DEMO_MODE: true,
  GOOGLE_CLIENT_ID: "YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com",
  CURRENCY: "PHP",
  CURRENCY_SYMBOL: "\u20b1",
  PAGE_SIZE: 20,
  STORAGE_PREFIX: "us:"
};
