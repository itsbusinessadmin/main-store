# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: shoppers.** People who arrive from a link a seller shared — a Messenger thread, a Facebook comment, a group chat, a printed QR code. They land on `bilihan.shop/7` or `bilihan.shop/verde` on a phone, usually mid-conversation with the seller. They have no account, no app, and no prior relationship with the platform. Many have never bought from anything but a marketplace app or a chat thread.

**Paying customer: merchants.** Small Philippine sellers running one store. They sign in to the admin with a Store ID (`STR-XXXX-XXXX-XXXX`) — no email, no password — and run the whole business from a phone: catalog, orders, payment methods, fulfillment, their own subscription. They are the ones who pay, but they are not the ones the storefront is designed for.

**Platform owner: master admin.** A single operator (`MASTER_ADMIN_EMAIL`, Google sign-in) who approves subscription payments by eye, manages stores and plans, and watches third-party service usage. Every store activation and renewal passes through this one person.

**When shopper and merchant needs conflict, the shopper wins.** Confirmed: the storefront is the product, and merchants are expected to absorb admin friction to keep the buying flow effortless.

## Product Purpose

Give a small seller a real storefront at a shareable link, and give their buyers a cart and a checkout instead of a chat thread. A merchant creates a store, fills a setup wizard, and gets a URL. A shopper opens the URL, browses a catalog, adds to a cart, and submits a structured order with a name, a mobile number, a fulfillment choice, and proof of payment. The merchant sees that order in a list with a status, instead of scrolling back through comments.

Success is an order that arrives complete and unambiguous — the seller never has to ask "so which variant, and how are you paying?"

## Positioning

**The alternative is chat-based selling.** Confirmed: sellers on this product are coming from Facebook and Messenger — taking orders in comments and DMs, tallying by hand, chasing payment screenshots, losing orders in threads. The mechanism a neighboring product could not truthfully copy is the *shape of the handoff*: the seller keeps selling where their buyers already are (a link dropped into the same chat), but the order arrives structured, idempotent, and already priced, with payment evidence attached.

This is deliberately **not** positioned against marketplaces on fees, or against Western store builders on features. Future work must not blur it into "a cheaper Shopify" or "own your customer, skip the commission" — those are different products with different users.

## Operating Context

- **The link is the entry point, always.** Three forms resolve to the same storefront: sequential number (`/7`), merchant-chosen slug (`/verde`), and the original `?store=SHOP-...` id, which keeps working for old links. A store has a shareable link the moment it exists, before the merchant has configured anything.
- **Checkout is asynchronous and human-settled.** The shopper picks a payment method, uploads a receipt or QR screenshot as proof, and submits. Nothing is captured or authorized. The merchant confirms by looking at the proof. Order status walks `PENDING → UNPAID → PAID → COMPLETED` (or `CANCELLED`).
- **Fulfillment is local and physical.** Delivery, pickup, or meet-up, with per-type fees that can be fixed or settled manually by the merchant after the order. Meet-up carries a list of named locations. Optional scheduling with prep days, max advance window, blocked weekdays, and blocked dates.
- **Subscriptions are approved by hand.** The merchant uploads a payment receipt; the master admin approves or rejects with a reason. Access is gated by `access_level`, not by a hard cutoff: `INITIAL_SETUP` (wizard only), `SUBSCRIPTION_ONLY`, `ORDERS_AND_SUBSCRIPTION` (dashboard and orders stay reachable while the plan lapses), `FULL_ADMIN`, `BLOCKED`.
- **Merchant onboarding is a seven-step wizard:** business, logo, theme, contact, payment, fulfillment, first product. Only business and fulfillment are required; the rest are skippable.
- **Phones, patchy data.** Storefront ships as an installable PWA with a cache-first app shell and network-first API reads with cached fallback. Admin and master are `noindex,nofollow`.

## Capabilities and Constraints

**Shipped:** three-surface app — customer storefront (`index.html`), merchant admin (`admin.html`), master admin (`master.html`) — sharing one stylesheet, one icon set, and one UI kit. Catalog with categories, variant groups with price deltas, per-product images, stock, sort order, active flag. Cart persisted per canonical store id (so `/7` and `/verde` share one cart). Three-step checkout. Order idempotency via `client_request_id`. Light and dark mode on every surface. Merchant-set accent color, logo, announcement bar, and a hero block (kicker, heading, subheading, CTA label, swipeable image gallery), each falling back to a sane default when blank.

**Technical constraints that bound design work:**
- No framework, no build step, no bundler, no package.json. Plain HTML, one CSS file (`public/css/app.css`, ~880 lines), vanilla JS modules loaded with `defer`. DOM is built in JS via an `el()` helper, not templates.
- Cloudflare Worker serves both the pages and the API from one origin. D1 for data, KV for files. Everything public lives under `public/`, enforced as a directory allow-list.
- Images are uploaded client-side, downscaled to a max pixel bound, and stored as KV `FILE-` ids. There is no image CDN and no transform pipeline.
- Currency is PHP (`₱`), fixed in config. Page size 20.
- Merchant auth is a Store ID string — no password reset, no email recovery. Losing the ID is a support event through the master admin.

**Undecided / explicitly open:**
- **The product name.** The code says "Universal Store" throughout (`APP_NAME`, page titles, code headers); the domain is `bilihan.shop`. Confirmed as an open decision — future work must not quietly settle it in either direction, and must not introduce a third name.
- No multi-store-per-merchant support; the model is one merchant, one store. Not stated as permanent.
- `ALLOWED_ORIGINS` still points at a GitHub Pages origin while the Worker serves the pages itself — a leftover from an earlier hosting arrangement, not a current product fact.

## Brand Commitments

- `bilihan.shop` is the live domain and the short-link namespace. "Bilihan" is Filipino for *a place to buy*.
- Existing identity is thin and merchant-overridable by design: a single SVG icon, a default accent (`#173d24`, a deep green), a light background (`#f6f7f5`). Each merchant sets their own accent and logo, so the platform's own identity has to survive being swapped out on every storefront.
- No other binding brand constraint has been stated. Voice in current copy is plain, short, and unbranded ("Shop this store", "No account needed") — observed, not confirmed as a commitment.

## Evidence on Hand

- **Real:** the codebase itself; three live subscription plans with real prices (Starter ₱299/30d, Growth ₱799/90d, Annual ₱2790/365d); the `bilihan.shop` domain and its short-link scheme; the Cloudflare D1/KV deployment (`cloudflare/wrangler.toml`).
- **Not real, do not cite:** everything in `public/js/mock.js` is demo fixture data for `DEMO_MODE`, including the GCash and BDO account names. It is not a customer, a testimonial, or a reference.
- **Absent — future work must not fabricate these:** no testimonials, no named merchants, no store or order counts, no revenue figures, no press, no case studies, no uptime or performance benchmarks, no app-store presence. A marketing surface for this product currently has no social proof to draw on, and inventing some is out of bounds.

## Product Principles

1. **The shopper never signs up.** No account, no app install, no login wall between a shared link and a submitted order. Anything that adds an identity step to the buying flow is a regression.
2. **The order carries its own evidence.** Structured fields plus an uploaded proof of payment, so the seller confirms by looking rather than by asking. The product's job ends where a chat thread's job used to begin.
3. **A store is real from the first minute.** A link exists before the catalog does. Empty and half-configured states are normal operating conditions, not edge cases.
4. **Access degrades, it does not vanish.** A lapsed or unapproved merchant keeps a reduced but coherent admin, not a locked door. Gating is by section, never by dead end.
5. **The merchant's whole back office is a phone.** Every admin task must be completable one-handed on a mid-range Android screen.

## Accessibility & Inclusion

No standard has been formally adopted — recorded as open rather than assumed. Established facts that bear on it: both light and dark modes ship on all three surfaces; merchants choose an arbitrary accent color, so contrast cannot be guaranteed by a fixed palette and must hold for merchant-supplied values; interface copy is English-only today, against a primarily Filipino-speaking user base, with no i18n layer present.
