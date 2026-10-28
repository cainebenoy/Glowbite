# Build: Glowbite pre-order site — end to end

Read `CLAUDE.md` first; its rules override anything here. Then read everything in `reference/`:

| File | What it is |
|---|---|
| `reference/brief.pdf` | The client brief. Source of truth for product facts, copy, form fields, post-submit behaviour and the acceptance checklist. |
| `reference/prototype.html` | The approved single-file prototype. **It is the visual and motion spec.** Open it in a browser and scroll it end to end before writing code. Port its look, its scene sequence, its 3D model and its camera keyframes faithfully. Don't port its code structure. |
| `reference/screens/` | Renders of every scene, desktop (1440×900) and phone (390×844). Match these. |
| `reference/assets/` | `logo.png` (transparent cut-out), `product-front.jpg`, `product-lifestyle.jpg`, `logo-original.jpg`. |
| `reference/schema-v0.sql` | The prototype's leads table. Superseded by the migrations you write below, but keep its constraints. |

Build the whole thing in one run, in the phases below, without stopping for review. Finish with the test suite green and the handover docs written.

---

## 1. Architecture

```
app/
  (site)/page.tsx            landing page (server component; reads settings, renders sections, mounts <Stage/> client-only)
  (site)/privacy|terms|shipping|refunds/page.tsx   policy pages rendered from settings markdown; 404 when empty
  api/leads/route.ts         POST — the only way a lead is written
  admin/(auth)/login/page.tsx          magic-link sign-in
  admin/(app)/layout.tsx               guard: session + admin allowlist, else redirect
  admin/(app)/page.tsx                 overview
  admin/(app)/leads/page.tsx           leads table
  admin/(app)/leads/[id]/page.tsx      lead detail
  admin/(app)/settings/page.tsx        content + offer + claim gates
  admin/(app)/export/route.ts          CSV export (admin only)
  opengraph-image.tsx, sitemap.ts, robots.ts
components/site/*            Header, Rail, Scene, Hero, Specs, Faq, PreorderForm, StickyBar, Footer, ProgressLine
components/stage/*           Stage (Canvas), Device (model), Backdrop (shader), Jet, Effects, useStory (scroll store)
lib/settings.ts              typed settings loader with defaults + zod schema
lib/leads.ts                 validation, phone/PIN normalisation (shared by client and server)
lib/supabase/{server,admin,browser}.ts
lib/notify.ts                team email, customer email, optional webhook
lib/analytics.ts             typed event helper
supabase/migrations/*.sql, supabase/seed.sql
tests/unit/*, tests/e2e/*
```

- Landing page is statically rendered and revalidated on settings change (`revalidateTag('settings')` from the admin save action). Target: HTML + CSS + fonts render the complete page before any 3D JS loads.
- The 3D stage is `dynamic(() => import('…/Stage'), { ssr: false })`, mounted after first paint, behind a still poster image (a render of the hero) so there's no blank flash and no layout shift.
- One scroll source of truth: Lenis drives scroll; a Zustand `useStory` store holds `S` (continuous scene index), per-scene progress `t[i]`, `mode`, `beat`. DOM sections and the R3F scene both read from it. Port `readScroll()`, `ui()` and the keyframe interpolation from the prototype.

## 2. Data model (Supabase migrations)

**`leads`**
`id uuid pk`, `created_at timestamptz`, `full_name text (2–80)`, `phone text unique (E.164 +91[6-9]xxxxxxxxx)`, `email text null (validated)`, `pin_code text (^[1-9][0-9]{5}$)`, `quantity int 1..max_qty`, `marketing_opt_in bool default false`, `consent_text_version text not null`, `price_shown int`, `status text check in (new, contacted, converted, dropped) default new`, `notes text`, `source text`, `utm jsonb`, `referrer text`, `user_agent text`, `ip_hash text` (salted SHA-256, never the raw IP), `updated_at`.
Indexes on `created_at`, `status`, `pin_code`.

**`settings`** — single row (`id = 1`), typed jsonb columns or explicit columns, your choice, validated by `lib/settings.ts`:
- Offer: `brand_name` (default "GlowBite"; see open items), `price` (1299), `mrp` (1499), `show_mrp` (false), `offer_active` (true), `max_qty` (5).
- Gates: `ipx7_verified` (false), `warranty_published` (false), `warranty_text`, `free_shipping_confirmed` (false), `dispatch_window` (null → "Dispatch timing will be confirmed before your order is finalised").
- Content: `in_the_box` (array of {item, qty}; seed: flosser ×1, tips ×5, USB-C cable ×1, flagged unconfirmed in admin until ticked), `instruction_guide_url`, policy markdown for privacy/terms/shipping/refunds, `contact_email`, `contact_phone`, `whatsapp`, social links.
- Ops: `team_notify_emails text[]`, `consent_text_version`.

**`admins`** — `email text pk`. Seeded from env `ADMIN_EMAILS`.

**`rate_limits`** — `ip_hash`, `window_start`, `count` (or use a Postgres function); 5 submissions per IP hash per 10 minutes.

**RLS**
- `leads`: RLS on, **no** anon/authenticated policies for select/insert/update/delete. Only the service role (server route, admin server actions) touches it. Admin pages read via server components using the service role *after* the allowlist check.
- `settings`: public select (it's public content), no public writes; writes via admin server action only.
- `admins`, `rate_limits`: no public access.
- Write a migration test (SQL or Vitest against local Supabase) proving anon cannot select or insert leads.

## 3. Landing page — scenes and sections

Port the prototype's sequence exactly. Copy comes from the brief; where this table differs from the prototype, this table wins (it restores the brief's benefit lines and subheadline). Don't add lines.

| # | Scene | Copy (DOM) | 3D (port from prototype `K` keyframes) |
|---|---|---|---|
| 0 | Hero | tag "Glowbite Water Flosser" · H1 "A fresher-feeling clean, **made simple.**" (last two words in ink-45) · subheadline (brief §9): "Discover the GlowBite Water Flosser — a rechargeable device designed to make water flossing part of your daily oral-care routine." · CTA "Join the Pre-order List" · price + "Pre-order interest price" · "No payment taken now." · scroll cue | Device right, slow sway, faint jet |
| 1 | Tank | tag "Water tank" · counter 0→350 "ml" · line: "A generous 350 ml tank." (brief benefit) | Camera down to tank; water level rises with scroll; glow rises with fill |
| 2 | Modes | tag "Modes" · "5 modes" · line: "Multiple modes for a personalised feel, including a child mode." (brief benefit) · readout bars 1–5 | Close-up on panel; indicator dots light; jet rate/pulse varies by mode |
| 3 | Tips | tag "In the box" · "5 tips" · line: "Multiple tips for different users and routines." (brief benefit) | Pull back; 5 spare tips orbit slowly |
| 4 | Charging | tag "Charging" · "USB-C" · line: "Portable, rechargeable convenience over USB-C." (brief benefit) | Thin light ring climbs the body; USB-C plug floats beside (port position unconfirmed — don't plug it into the body) |
| 5 | Routine (tall) | three beats: "Fill." / "Choose." / "Glide." with the brief's step text; link the instruction guide when set | Device tilted into use, jet on |
| 6 | Pre-order | "Be first / in line." + offer card (price; MRP if gated on; "No payment taken now"; shipping line = "Free shipping" when `free_shipping_confirmed`, else "Free shipping, subject to confirmed terms"; dispatch line; brief trust line "Product details, availability, shipping and warranty terms will be confirmed before your order is finalised.") + form. Hide the price and CTA copy that mentions the offer when `offer_active` is false. | Device settles left under the heading |
| — | IPX7 scene | Only when `ipx7_verified`: tag "Water resistance" · "IPX7" · "Rated IPX7 for water resistance." | Reuse scene-4 framing |
| — | Specs | "At a glance." grid from settings (modes, tank, tips, charging, gated IPX7/warranty, in-the-box line) | Opaque section, stage hidden |
| — | FAQ | The 8 brief questions; answers from settings and the gates (e.g. ship date → dispatch_window or "not confirmed yet") | — |
| — | Footer | Logo, privacy sentence, only links that exist in settings, contact as selectable text, © year | — |

Chrome: fixed header (logo + ghost pill CTA), right-side chapter rail (desktop), 1px cyan progress line at the top, sticky buy bar on mobile (hidden while the form is on screen). Every CTA scrolls smoothly to the form.

Mobile (<860px): device centred in the top half, copy bottom-aligned over a black fade, rail hidden, header CTA replaced by the sticky bar. Check 360, 390, 414, 768, 1024, 1440, 1920 widths.

## 4. The 3D stage (R3F)

Port the prototype's `<script type="module">` faithfully into components. Specifics to keep:
- **Model** (`Device.tsx`): lathe body from the measured `BODY` profile, oval cross-section 0.88, tank profile, thick floor, white cap + internal hose, waisted body, domed top + collar, clear bent tip with nozzle, panel artwork texture conformed to the curved body via `surfZ`, power + mode buttons with icon textures, three indicator dots, "Gl⚡wbite" printed logo texture. Build geometry once in `useMemo`; dispose on unmount.
- **GLB slot**: if `public/models/glowbite.glb` exists, load it (`useGLTF`, Draco) instead of the procedural model, with named nodes `water`, `dots`, `tip` so the story still works. Document the naming contract in the README. This is how the manufacturer's CAD replaces the hand-built model.
- **Look**: true-black backdrop shader with only a faint neutral lift behind the device; studio env map built from a black room with one softbox and two strip lights (PMREM); key + two rim lights; water emissive cyan that scales with fill; small additive floor glow; Bloom (low strength ~0.4, threshold ~0.78) via @react-three/postprocessing; ACES tone mapping.
- **Jet**: instanced droplets from the tip along its direction, gravity, rate tied to scene and mode. Cap instance counts lower on mobile.
- **Interaction**: pointer parallax on fine pointers only (device yaw ±0.32 rad, pitch ±0.07; backdrop light follows slightly).
- **Performance**: drei `PerformanceMonitor` + `AdaptiveDpr` — step DPR down (max 2 desktop / 1.5 mobile → floor 1), then disable bloom. Pause rendering when the tab is hidden and when the stage is scrolled past (specs/FAQ/footer). `frameloop="demand"` is not suitable for the jet; use `always` while visible.
- **Fallbacks**: no WebGL → keep the poster image. `prefers-reduced-motion` → no sway, no jet, instant camera moves, counters jump to final values.
- **Budget**: Stage JS chunk ≤ 250 KB gzip. Mobile Lighthouse: Performance ≥ 85, LCP ≤ 2.5 s, CLS ≤ 0.05, Accessibility ≥ 95, SEO 100.

## 5. Pre-order form and lead pipeline

Fields (brief §6): Full name · Mobile (+91 prefix shown, normalise `+91`/`0` prefixes, must match `[6-9]\d{9}`) · PIN code (6 digits, not starting 0) · Email (optional) · Quantity stepper (1..`max_qty`, shows running total at the offer price) · unchecked "Also send me GlowBite offers and updates (optional)." · consent paragraph exactly as the brief, with the Privacy Notice link (hide the link if no privacy policy is set, and show a build warning in admin). Turnstile widget (invisible/managed). Hidden honeypot.

`POST /api/leads`:
1. Parse with the shared Zod schema. 400 with per-field messages.
2. Verify Turnstile token (skip only when `TURNSTILE_SECRET` is unset in development).
3. Rate limit by salted IP hash.
4. Honeypot filled → return 200 success without saving.
5. Insert with the service role. Unique violation on `phone` → 200 `{ status: "duplicate" }` (the page shows "You're already on the list"; never reveal other data).
6. Fire-and-forget (with `waitUntil`): team email via Resend to `team_notify_emails` (name, phone, PIN, qty, opt-in, time IST, link to the admin record), optional `TEAM_WEBHOOK_URL` POST (Slack/Discord-compatible JSON), and a customer confirmation email only if an email was given, transactional, no marketing content. Failures are logged, never shown to the visitor.
7. Return `{ status: "created" }`.

Client: disable the button while submitting, inline errors on blur, focus the first invalid field, success state with the brief's exact message, droplet burst (respect reduced motion), remember submission in localStorage to show "already on the list" on return. Network failure → inline retry message, data kept in the form.

## 6. Admin (`/admin`)

- Supabase Auth magic link. After sign-in, the layout checks the email against `admins`; anyone else gets signed out with a clear message. No sign-up page.
- **Overview**: total leads, today, last 7 days (small bar chart), opt-in rate, total quantity requested, top PIN prefixes (first 3 digits). Real numbers only; empty states when there are none.
- **Leads**: server-paginated table (newest first), search by name/phone/PIN, filter by status and opt-in, inline status change, detail page with notes and the full record (UTM, source, timestamps). Delete with an in-page confirmation step (for data-removal requests).
- **Export**: CSV of the current filter, IST timestamps, UTF-8 BOM so Excel opens it cleanly.
- **Settings**: grouped form (Offer, Claim gates, In the box, Dispatch, Policies (markdown with preview), Contact & social, Notifications). Each claim gate shows the brief's verification note next to its toggle. Save → validate → write → `revalidateTag('settings')`. Show "last changed by/at".
- Admin UI uses the same tokens but is a plain, dense tool. No 3D.

## 7. SEO, sharing, analytics, legal

- Metadata from settings: title "GlowBite Water Flosser — Join the Pre-order List", description from the brief copy, canonical, `lang="en-IN"`, theme-color `#000000`.
- `opengraph-image.tsx`: black, logo, product render, price only if `offer_active`.
- JSON-LD `Product` with `Offer` (price from settings, INR, `PreOrder`) — no `aggregateRating`, no reviews.
- `sitemap.ts` (landing + existing policy pages), `robots.ts` (disallow `/admin`).
- Favicon/app icons: the cyan bolt on black (see prototype `build.py`).
- Analytics: `@vercel/analytics` (cookieless) + custom events `cta_click {location}`, `scene_view {scene}`, `form_view`, `form_start`, `form_error {field}`, `lead_submit {quantity, opt_in, duplicate}`, `faq_open {q}`. Mention analytics in the privacy notice requirements list in the README. No third-party trackers.
- Security headers via `next.config`: CSP (self, Supabase, Turnstile, Vercel analytics, Google Fonts only if not using `next/font` self-hosting), `X-Frame-Options DENY`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy` minimal.

## 8. Environment

`.env.example` with: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SALT`, `ADMIN_EMAILS`, `RESEND_API_KEY`, `MAIL_FROM`, `TEAM_WEBHOOK_URL` (optional), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `NEXT_PUBLIC_SITE_URL`. The app must boot and the form must work locally with only the Supabase vars set (notifications and Turnstile log "skipped" instead of failing).

## 9. Tests (run all at the end; fix until green)

- **Unit (Vitest)**: phone normalisation table (+91, 0-prefix, spaces, invalid starts), PIN rules, email optional, quantity bounds, settings defaults and gate logic (e.g. IPX7 hidden when false), FAQ answers switch with gates, CSV escaping.
- **DB**: anon cannot select/insert/update `leads`; anon can select `settings`, cannot update it.
- **E2E (Playwright, against local Supabase + `next start`)**, desktop and iPhone 13 profiles:
  1. Landing renders the full text content with JS disabled (no-JS smoke).
  2. Every CTA reaches the form.
  3. Invalid submit shows inline errors and focuses the first one.
  4. Valid submit → success state → row exists in `leads` with normalised phone.
  5. Same phone again → "already on the list", still one row.
  6. Honeypot submit → success UI, no row.
  7. Rate limit → 6th rapid submit is refused politely.
  8. `/admin` redirects to login when signed out; a non-allowlisted session is rejected.
  9. Toggling `ipx7_verified` in settings makes the IPX7 scene and spec appear after revalidation.
  10. No horizontal scroll at 360px; reduced-motion run has no running animations.
- Lighthouse CI on the built landing page (mobile) with the budgets in §4.

## 10. Deploy and handover

- `supabase/` config + migrations + seed; scripts: `pnpm db:reset`, `pnpm db:types` (generate TS types).
- Vercel: project config, env var list, preview deployments on PRs.
- `README.md` written for two readers:
  - **Glowbite team**: how to sign in, read and export leads, change price/MRP/dates/claims/policies in `/admin/settings`, add an admin, and where data lives.
  - **Developers**: local setup, env, scripts, architecture map, the GLB naming contract, how to run tests.
- `LAUNCH_CHECKLIST.md`: the brief's §10 and §11 lists as checkboxes, plus: policies published, `team_notify_emails` set, Turnstile keys set, a real test lead submitted on production and verified in admin, then deleted.

## 11. Open items (build so these are settings, not code changes)

1. Brand casing: logo says "Glowbite", brief says "GlowBite". `brand_name` setting, default "GlowBite".
2. The unit shows 3 indicator dots; the brief says 5 modes. Keep 3 dots on the model and "5 modes" in copy until confirmed.
3. USB-C port location unknown: plug floats beside the device.
4. The approved look is true-black, which departs from the brief's pale-blue palette (brand cyan and blue survive as accents). Glowbite needs to confirm this direction before launch; note it in LAUNCH_CHECKLIST.
5. MRP, IPX7, warranty, dispatch window, free-shipping terms, in-the-box contents, child mode: all start unconfirmed.
6. WhatsApp/SMS follow-up isn't built (needs a WhatsApp Business API provider). Leave a `notify.ts` hook and a README note.

## Definition of done

All tests green, Lighthouse budgets met, `pnpm build` clean with no type errors or lint errors, README + LAUNCH_CHECKLIST written, and a short summary listing anything you couldn't complete and why. Then stop; a human tests on real devices before launch.
