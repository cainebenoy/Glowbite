# GlowBite pre-order site

A single-product page for the GlowBite water flosser. Visitors join a **non-binding pre-order interest list**: no payment is taken. The GlowBite team reads leads and edits the price, copy, claims and dates in `/admin` without touching code.

- **Public page:** `/`, plus `/privacy`, `/terms`, `/shipping` and `/refunds` once their text is filled in
- **Admin:** `/admin`

---

## For the GlowBite team

### Signing in
1. Go to `https://<your-site>/admin`.
2. Enter your email and press **Email me a sign-in link**. Open the email and click the link. There's no password.
3. Only emails on the admin list can get in. Anyone else gets "This email isn't authorised" and is signed out.

### Reading leads
- **Overview** shows total leads, today's leads (India time), the last 7 days, the opt-in rate, total units requested and the most common PIN-code areas. All of it comes from real submissions.
- **Leads** lists every submission, newest first.
  - Search by name, phone or PIN, and filter by status or marketing opt-in.
  - Change a lead's status (new → contacted → converted / dropped) straight from the table.
- Click a name to see the full record: email, quantity, price shown, consent version, UTM campaign tags, source and timestamps. You can add internal notes there.
- **Data-removal requests:** open the lead, press **Delete…**, type `DELETE` and confirm. This is permanent.

### Exporting
On **Leads**, press **Export CSV**. You get exactly what the current search and filters show, with India-time timestamps, and the file opens cleanly in Excel and Google Sheets.

### Changing the page (Admin → Settings)
Every business-facing detail lives here. Save, and the live page updates within a few seconds.

| You want to… | Do this |
|---|---|
| Change the price | **Offer → Pre-order interest price** |
| Show the MRP crossed out | Set **MRP**, tick **Show MRP** (only once it's confirmed and legally appropriate) |
| Pause the offer | Untick **Offer active**. The price disappears; the list stays open |
| Limit units per person | **Maximum quantity per lead** |
| Publish IPX7 | Tick **IPX7 verified** once you have the supplier documentation. This adds the IPX7 scene, spec line and FAQ answer |
| Publish the warranty | Set **Warranty term** (e.g. `1 year`), tick **Warranty published** once the terms and service process are ready |
| Confirm free shipping | Tick **Free shipping confirmed**. Until then the page says "Free shipping, subject to confirmed terms" |
| Set a dispatch date | **Dispatch window**, e.g. `Expected dispatch: March 2027`. Leave blank while it's unconfirmed |
| Fix what's in the box | **In the box**: edit items and quantities, and tick **Confirmed** once checked against the real package |
| Publish policies | Paste Markdown into **Policies**. Each one gets its own page and a footer link. Empty means no page. **The Privacy Notice must be filled in before launch** |
| Add contact details and social links | **Contact & social**. Only filled-in items appear in the footer |
| Change who gets new-lead emails | **Notifications → Team notification emails** (private, never shown on the site) |
| Change the spelling of the brand | **Brand name** (`GlowBite` by default; the logo reads "Glowbite") |

"Last changed by" at the top of Settings shows who saved last, and when.

**Claim gates:** IPX7, warranty, MRP, free shipping and dispatch dates are hidden everywhere until their setting is turned on. Every gate starts off.

### Adding an admin
A developer runs this once in the Supabase SQL editor (Dashboard → SQL), then creates the user under **Authentication → Users → Add user → Send invitation** (or "Create new user" with the same email):

```sql
insert into public.admins (email) values ('new.person@example.com');
```

To remove someone, delete the row from `admins` and delete the user under Authentication → Users.

### Where the data lives
- Leads, settings and the admin list are in your **Supabase** project (Postgres).
- Leads can't be read from the public website. They're readable only through `/admin` (after sign-in and the allowlist check) and in the Supabase dashboard.
- Visitor IP addresses are never stored. Only a salted one-way hash is kept, for spam rate-limiting.
- **Analytics:** Vercel Web Analytics (cookieless) counts page views and these events: CTA clicks, scenes viewed, form viewed/started/errored, submissions, and FAQ opens. **Mention this in the Privacy Notice.**

---

## For developers

### Stack
Next.js 15 (App Router, strict TS) · React 19 · Tailwind CSS v4 · three.js (plain; EffectComposer + UnrealBloomPass) · Lenis · Zustand · Supabase (Postgres, Auth, RLS) · Zod · Resend · Cloudflare Turnstile · @vercel/analytics · Vitest · Playwright · pnpm · Vercel.

### Local setup
Requirements: Node 20+, pnpm, Docker Desktop running. The Supabase CLI is a dev dependency (`pnpm supabase …`).

```bash
pnpm install
pnpm db:start                 # local Supabase in Docker; prints URLs and keys
cp .env.example .env.local    # paste API URL, anon key and service_role key from `pnpm supabase status`
pnpm db:reset                 # migrations + seed + admins from ADMIN_EMAILS
pnpm dev                      # http://localhost:3000
```

Only the Supabase variables are required. Email, webhook and Turnstile log `skipped` when unset. Magic-link emails land in Mailpit at http://localhost:54324.

### Environment
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public reads (settings) and admin auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only: writes leads, admin reads |
| `IP_HASH_SALT` | Salt for hashing IPs (rate limit) |
| `ADMIN_EMAILS` | Comma-separated admin allowlist for `pnpm db:reset` |
| `RESEND_API_KEY`, `MAIL_FROM` | Team + customer emails |
| `TEAM_WEBHOOK_URL` | Optional Slack/Discord webhook |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | Spam protection. Verification is skipped only when the secret is unset outside Vercel production |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL, sitemap, email links |
| `RATE_LIMIT_MAX` | Optional, default 5 submissions per IP per 10 minutes |

### Scripts
| Script | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint`, `pnpm typecheck` | ESLint, `tsc --noEmit` |
| `pnpm db:start` / `db:stop` | Local Supabase |
| `pnpm db:reset` | Re-apply migrations and seed, then seed admins |
| `pnpm db:types` | Generate `lib/supabase/types.ts` from the local schema |
| `pnpm test` | Unit + DB tests (Vitest; DB tests need local Supabase) |
| `pnpm test:e2e` | Playwright on desktop and iPhone 13 profiles (builds and starts the app) |
| `pnpm lhci` | Lighthouse CI on the built landing page (run `pnpm build` first) |
| `pnpm tsx scripts/gen-seed.ts` | Regenerate `supabase/seed.sql` from `DEFAULT_SETTINGS` |

### Architecture map
```
app/(site)/page.tsx              landing page: static, reads settings, renders scenes, mounts the stage after load
app/(site)/[policy]/page.tsx     privacy | terms | shipping | refunds from settings markdown (404 when empty)
app/(site)/opengraph-image.tsx   social image (price only while the offer is active)
app/api/leads/route.ts           POST: the only way a lead is written
app/admin/(auth)/login           magic-link sign-in (server action; allowlist-checked, no sign-up)
app/admin/auth/{callback,signout}
app/admin/(app)/*                overview, leads, lead detail, settings, export (route) and actions
components/site/*                Header/Rail/StickyBar (Chrome), Scenes, Preorder + PreorderForm, Specs, Faq, Footer
components/stage/*               StoryDriver (Lenis + scroll model), useStory (Zustand), StageMount, Stage (canvas), studio.ts (three.js engine: renderer, env, bloom, frame loop),
                                 model.ts (procedural device + GLB adapter), keyframes.ts (camera keys by scene id)
lib/settings.ts                  settings schema, defaults, gate logic, derived copy (specs, FAQ, scenes, footer)
lib/settings-server.ts           cached settings loader (tag "settings")
lib/leads.ts                     shared lead validation and phone/PIN normalisation
lib/admin-auth.ts                requireAdmin()/getAdmin(): session + allowlist
lib/notify.ts                    team email, customer email, webhook, WhatsApp hook (stub)
supabase/migrations, seed.sql    schema, RLS, rate-limit function; seed generated from DEFAULT_SETTINGS
```

**Data model:**
- `leads` is private: RLS on, no policies, service role only.
- `settings(id=1, data jsonb)` is public select, admin-only writes.
- `settings_ops` holds notify emails and last-changed-by. It's private.
- `admins` is the allowlist, and is private.
- `rate_limits` plus `check_rate_limit()` are private, executable only by the service role.

**Rendering:**
- The landing page is statically generated.
- Saving settings calls `revalidateTag("settings")`.
- The 3D stage is a client-only dynamic import behind a still poster. The poster is a render of the same hero frame (`scripts/render-poster.ts`; re-run it after changing the model).
  - **Desktop:** the stage mounts after `load` and idle.
  - **Phones:** it mounts on the first scroll, touch or key press. Building it costs seconds of CPU on mid-range phones, and the poster looks the same until then.
  - **No WebGL, or Save-Data on:** the poster stays.
- Outfit uses `font-display: optional` (preloaded). This removes the font-swap layout shift. The trade-off: a first visit on a very slow connection may show the fallback font for that page view.
- The browser bundle keeps Zod out. Client code imports `lib/lead-rules.ts` and `lib/format.ts`, not the schema modules.

**Security headers:** a fixed CSP (no nonces, so the page stays static) allowing self, Supabase, Turnstile and Vercel Analytics; plus `X-Frame-Options: DENY`, `Referrer-Policy` and a minimal `Permissions-Policy` (`next.config.ts`).

### Replacing the hand-built model with CAD (GLB naming contract)
Put the manufacturer's model at `public/models/glowbite.glb` and rebuild. The page detects it at build time and loads it with Draco support instead of the procedural model. Copy the Draco decoders once with:

```bash
mkdir -p public/draco && cp node_modules/three/examples/jsm/libs/draco/gltf/* public/draco/
```

The scroll story needs three named nodes:

| Node | What it is | What the story does |
|---|---|---|
| `water` | The water volume inside the tank, origin at the tank floor | Scaled on Y with the fill level (0 → 1) |
| `dots` | Parent of the indicator dot mesh(es) | Every mesh below it glows (emissive) on mode changes |
| `tip` | An empty or mesh at the nozzle exit | The jet emits from its origin along its local +Y axis |

**Scale and orientation:**
- Units match the procedural model: the device is about 3.9 units tall and the tank base sits at y = 0.
- Facing +Z, with the front panel toward the camera.

If the GLB fails to load, the procedural model is used and a console warning is logged.

### Notifications
- **On every new lead:**
  - Team email via Resend to `team_notify_emails`
  - An optional webhook POST (`{text, content}`, which works for both Slack and Discord)
  - A transactional confirmation to the visitor, only when they gave an email
- Everything runs after the response (`waitUntil`). Failures are logged and never shown to the visitor.
- **WhatsApp/SMS follow-up is not built.** It needs a WhatsApp Business API provider (Gupshup, Twilio, Meta Cloud API…). Implement `notifyWhatsApp()` in `lib/notify.ts`; it already receives every new lead.

### Tests
- `tests/unit` covers:
  - Phone normalisation, PIN, email and quantity rules
  - Settings defaults (including that they match the seed), gate logic, FAQ switching, scenes
  - CSV escaping
- `tests/db` covers RLS against local Supabase:
  - Anon can't select, insert, update or delete `leads`.
  - Anon can read `settings` but can't write it.
  - Private tables and the rate-limit function are closed to anon.
- `tests/e2e`: the 10 scenarios from the build spec, on both device profiles.
  - Uses Cloudflare's always-pass Turnstile test keys and mints admin sessions with the service role (no inbox needed).
  - Runs serially because tests share the database and rate-limit bucket.

### Deploying (Vercel + Supabase cloud)
1. Create a Supabase project. Then run `pnpm supabase link --project-ref <ref>` and `pnpm supabase db push`, and run `supabase/seed.sql` in the SQL editor.
2. In Supabase Auth settings:
   - Set **Site URL** to the production URL.
   - Add `https://<domain>/admin/auth/callback` to the redirect URLs.
   - Disable sign-ups.
   - Configure custom SMTP so magic links are delivered reliably.
3. Add each admin: insert into `admins`, then invite the user (see "Adding an admin").
4. Import the repo into Vercel and set the environment variables above for Production and Preview. Preview deployments run automatically on pull requests.
5. Set up Resend (verify the sending domain) and Turnstile (add the production domain).
6. Work through `LAUNCH_CHECKLIST.md`.
