# Build summary

The Glowbite pre-order site is built end to end per `BUILD_PROMPT.md` and `CLAUDE.md`. What's left is a human check on a real phone and a desktop browser, then the items in `LAUNCH_CHECKLIST.md`.

## Verified (2026-11-01)

| Check | Result |
|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | Clean |
| Unit tests (Vitest) | 66/66: validation, settings defaults, claim gates, FAQ, scenes, CSV |
| DB tests against local Supabase | 14/14. Anon can't read, insert, update or delete leads; settings are read-only to the public; private tables are closed |
| E2E, Chromium (desktop + iPhone 13 profile) | 30/30: the 10 spec scenarios, plus the real magic-link sign-in via the local inbox and export checks |
| E2E, real WebKit (iPhone 13 profile) | 15/15 (`pnpm test:e2e:webkit`) |
| Lighthouse, mobile (Turnstile key set) | Performance 0.98, LCP 2.3 s, CLS 0, TBT 10 ms, Accessibility 0.97, SEO 100 |
| 3D stage chunk | 161 KB gzip (budget 250 KB) |

## Changes from the spec

### Approved during the build
- **Private `settings_ops` table** holding the team notify emails and "last changed by", so the public settings row never exposes them.
- **Settings stored as one Zod-validated JSONB column.**
- **Fixed CSP with no nonces,** so the landing page stays static.
- **Scenes keyed by id,** so the IPX7 scene inserts cleanly.
- **React Three Fiber dropped for plain three.js** (2026-10-30). R3F bundled all of three.js and pushed the stage to 260 KB. The prototype was plain three.js too. As a result:
  - drei's `PerformanceMonitor` became the prototype's own adaptive-quality loop.
  - `@react-three/postprocessing` became three's built-in `EffectComposer` and `UnrealBloomPass`.

### Made to meet the budgets, not explicitly approved
Each of these is also listed in LAUNCH_CHECKLIST.
- **3D starts on the first interaction on phones** (scroll, touch or key). Building the scene costs seconds of CPU on mid-range phones. Until then, a poster rendered from the same 3D frame is shown, art-directed for phone and desktop so the handoff doesn't jump. Desktop starts the 3D after load and idle. Save-Data visitors keep the poster.
- **Outfit uses `font-display: optional`.** This removes the font-swap layout shift. A first visit on a very slow connection may show the fallback font for that page view.
- **Turnstile loads only when the form nears the viewport,** or when a field gets focus.

### Improvements to the 3D model over the prototype
- The water surface follows the tapered tank walls with a soft meniscus.
- Bubbles rise in the tank scene.
- The three indicator dots sit between the buttons. In the prototype the top one was hidden under the power button's ring.
- The printed logo uses a sharper texture.
- MSAA anti-aliasing works through the bloom pipeline.
- Phone and tablet framing is consistent across screen sizes.

## After launch (2026-11-02)
- **Live:** https://glowbite-rosy.vercel.app
  - Vercel Hobby on cainebenoy@gmail.com.
  - Free Supabase project `npafkbkppipklpfihrqh` in the personal org "Glowbite".
  - Verified with a real lead (saved, then deleted), the admin gate, RLS and the sitemap URL.
- **Lighthouse on the live site (mobile, 3 runs):** performance 0.93–0.99, LCP 2.0–2.4 s, CLS 0, accessibility 0.97, SEO 100.
- **Spam protection is off for now:** `TURNSTILE_DISABLED=true` stands in until Turnstile keys exist (the owner chose this).
- **Social preview** now uses Outfit, with a one-glyph Noto Sans fallback for ₹ (Outfit has no ₹ glyph).
- **CI:** GitHub Actions runs lint, type-check, unit tests and a production build on every push and pull request.

## Bugs found and fixed by testing
- **Magic-link sign-in was broken:** `[auth.email] enable_signup = false` turns off the email provider entirely in Supabase. Sign-ups are now blocked by `[auth] enable_signup = false` instead, and the README deploy steps say to keep the Email provider on.
- **CSP and WebKit on http:** `upgrade-insecure-requests` broke all assets in WebKit over plain http. It's now emitted only for https sites.
- **Hero CTA label:** it rendered white on white because a link-colour rule outranked the button colour.

## Not built, as the spec says
- **WhatsApp/SMS follow-up.** `notifyWhatsApp()` in `lib/notify.ts` is the hook. It needs a WhatsApp Business API provider.
- **Production deployment.** By decision, the build was tested locally only. `README.md` → "Deploying" covers Vercel and Supabase cloud.

## Open items for Glowbite
See `LAUNCH_CHECKLIST.md`. In short:
- Confirm the true-black visual direction and the brand casing.
- Confirm the claims: IPX7, warranty, MRP, free shipping, dispatch, in-the-box contents, child mode.
- Publish the policies, with the Privacy Notice first.
- Set the production environment keys.
- Run a real-device pass, including first-scroll smoothness on a mid-range phone.
