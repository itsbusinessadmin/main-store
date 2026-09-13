/* Universal Store — payment brand recognition.

   A merchant types the name of a payment method free-hand: "BPI", "bpi
   savings", "Bank of the Philippine Islands", "GCASH", "G-Cash". This maps
   whatever they typed to a known Philippine bank or wallet so the row can
   carry that brand's logo instead of a generic card glyph — in the admin
   list, in the master admin, and in the customer's checkout picker.

   Nothing here touches the DOM. It is pure lookup so it can be tested on its
   own and reused anywhere. UI.payMark() turns a result into a node.

   Logos live in icons/banks/<slug>.png, 96x96, sourced from Brandfetch.
   Two entries are not brands at all — plain cash and a generic QR — so they
   resolve to icons from the app's own set rather than to a logo file. */
(function (w) {

  /* Each entry: the slug (also the PNG filename), the display name, and every
     spelling a merchant might reasonably type. Aliases are matched
     case-insensitively and ignore punctuation, so "G-Cash", "g cash" and
     "GCASH" all land on the same entry — only distinct wordings need listing. */
  const BRANDS = [
    // ---- Universal and commercial banks ----
    { slug: "bdo",           name: "BDO",              aliases: ["bdo", "banco de oro", "bdo unibank", "bdo network bank"] },
    { slug: "bpi",           name: "BPI",              aliases: ["bpi", "bank of the philippine islands", "bpi family", "bpi family savings"] },
    { slug: "metrobank",     name: "Metrobank",        aliases: ["metrobank", "metro bank", "metropolitan bank", "mbtc"] },
    { slug: "pnb",           name: "PNB",              aliases: ["pnb", "philippine national bank"] },
    { slug: "securitybank",  name: "Security Bank",    aliases: ["security bank", "securitybank"] },
    { slug: "chinabank",     name: "China Bank",       aliases: ["china bank", "chinabank", "china banking corporation"] },
    { slug: "rcbc",          name: "RCBC",             aliases: ["rcbc", "rizal commercial banking", "rizal commercial banking corporation"] },
    { slug: "unionbank",     name: "UnionBank",        aliases: ["unionbank", "union bank", "unionbank of the philippines", "ubp"] },
    { slug: "eastwest",      name: "EastWest Bank",    aliases: ["eastwest", "east west", "eastwest bank", "east west bank"] },
    { slug: "psbank",        name: "PSBank",           aliases: ["psbank", "ps bank", "philippine savings bank"] },
    { slug: "robinsonsbank", name: "Robinsons Bank",   aliases: ["robinsons bank", "robinsonsbank", "robinsons"] },
    { slug: "hsbc",          name: "HSBC",             aliases: ["hsbc"] },

    // ---- Digital banks ----
    { slug: "maya",          name: "Maya",             aliases: ["maya", "maya bank", "paymaya", "pay maya"] },
    { slug: "gotyme",        name: "GoTyme Bank",      aliases: ["gotyme", "go tyme", "gotyme bank"] },
    { slug: "tonik",         name: "Tonik",            aliases: ["tonik", "tonik bank", "tonik digital bank"] },
    { slug: "maribank",      name: "MariBank",         aliases: ["maribank", "mari bank", "seabank", "sea bank"] },

    // ---- Wallets ----
    { slug: "gcash",         name: "GCash",            aliases: ["gcash", "g cash"] },
    { slug: "grabpay",       name: "GrabPay",          aliases: ["grabpay", "grab pay", "grab"] },
    { slug: "shopeepay",     name: "ShopeePay",        aliases: ["shopeepay", "shopee pay", "shopee"] },
    { slug: "coinsph",       name: "Coins.ph",         aliases: ["coins ph", "coinsph", "coins"] },
    { slug: "paypal",        name: "PayPal",           aliases: ["paypal", "pay pal"] },

    /* ---- Not brands ----
       These resolve to an icon from the app's own set, not to a logo file. */
    { slug: "cash", name: "Cash", icon: "cash",
      aliases: ["cash", "cash on delivery", "cash on pickup", "cod", "pay in cash", "walk in"] },
    { slug: "qr",   name: "QR",   icon: "qr",
      aliases: ["qr", "qr ph", "qrph", "qr code", "scan to pay", "instapay qr"] }
  ];

  /* Lowercase, fold "&" to "and", and turn every run of punctuation into a
     single space. "G-Cash!" and "g cash" both come out as "g cash". */
  function normalize(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  /* Spaced form catches "China Bank"; the squeezed form catches "chinabank".
     Both are needed because merchants type it either way. */
  const squeeze = s => s.replace(/ /g, "");

  /* A short alias must line up with whole words, or "qr" would match the "qr"
     inside a longer word and "bdo" would match inside an unrelated code. Long
     aliases may also match squeezed, which is what lets "chinabank" find
     "China Bank" and the reverse. */
  const SQUEEZE_MIN = 4;

  function aliasHits(alias, norm, flat) {
    const a = normalize(alias);
    if (!a) return 0;
    const bounded = new RegExp("(^| )" + a.replace(/ /g, " ") + "( |$)");
    if (bounded.test(norm)) return a.length;
    if (a.length >= SQUEEZE_MIN && flat.includes(squeeze(a))) return a.length;
    return 0;
  }

  /* Returns { slug, name, logo } for a bank or wallet, { slug, name, icon }
     for cash and QR, or null when nothing recognisable is in the string.

     The longest matching alias wins, which is what keeps "GCash" on GCash
     rather than on plain "cash" — "gcash" is the longer match of the two. */
  function match(name) {
    const norm = normalize(name);
    if (!norm) return null;
    const flat = squeeze(norm);

    let best = null, bestLen = 0;
    for (const b of BRANDS) {
      for (const alias of b.aliases) {
        const len = aliasHits(alias, norm, flat);
        if (len > bestLen) { best = b; bestLen = len; }
      }
    }
    if (!best) return null;
    return best.icon
      ? { slug: best.slug, name: best.name, icon: best.icon }
      : { slug: best.slug, name: best.name, logo: "icons/banks/" + best.slug + ".png" };
  }

  w.US_BANKS = { match, normalize, brands: BRANDS };

  /* So the matcher can be exercised by a test runner outside the browser. */
  if (typeof module !== "undefined" && module.exports) module.exports = w.US_BANKS;

})(typeof window !== "undefined" ? window : globalThis);
