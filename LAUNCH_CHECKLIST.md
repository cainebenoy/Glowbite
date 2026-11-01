# Launch checklist

Tick everything before the site goes public. Items marked *(settings)* are changed in `/admin/settings`.

## 1. Assets and information GlowBite must provide (brief §10)
- [ ] Actual product photos from multiple angles
- [ ] Packaging and "what's in the box" photo
- [ ] Logo files and preferred font, if available
- [ ] Confirmed price, and whether the pre-order is paid or interest-only (this site is built as **interest-only**, with no payment) *(settings)*
- [ ] Launch/dispatch estimate, or keep the "timing not yet confirmed" wording *(settings: Dispatch window)*
- [ ] Shipping policy and PIN-code serviceability details *(settings: Shipping policy, Free shipping confirmed)*
- [ ] Written warranty terms and support contact *(settings: Warranty, Terms)*
- [ ] Verified feature claims, especially IPX7 and child mode *(settings: IPX7 verified)*
- [ ] Privacy notice, terms, and cancellation/refund policy where applicable *(settings: Policies)*
- [ ] WhatsApp/email/phone contact and official social links *(settings: Contact & social)*

## 2. Acceptance checklist (brief §11)
- [ ] It looks correct on common mobile and desktop screen sizes (360, 390, 414, 768, 1024, 1440, 1920)
- [ ] Visitors can understand the product, price, and pre-order process quickly
- [ ] CTA buttons work and lead to the correct form/section
- [ ] Form submissions are saved and visible only to authorised people
- [ ] Consent and privacy wording is visible before submission
- [ ] The confirmation message accurately describes what happens next
- [ ] No unverified medical, safety, waterproofing, warranty, or delivery claims are published
- [ ] GlowBite has access and can maintain the page after handover

## 3. Open decisions from the build
- [ ] **Visual direction:** the approved look is true-black, which departs from the brief's pale-blue palette (brand cyan and blue survive as accents). GlowBite to confirm this direction.
- [ ] **Brand casing:** the logo says "Glowbite", the brief says "GlowBite". Confirm and set **Brand name** *(settings)*.
- [ ] **Modes vs indicator dots:** the unit shows 3 indicator dots, the brief says 5 modes. The 3D model keeps 3 dots and the copy says "5 modes" until confirmed.
- [ ] **USB-C port location** is unknown, so the 3D plug floats beside the device. Update once known (or supply CAD, see README "GLB naming contract").
- [ ] **In-the-box contents** confirmed against the real package, with each item ticked **Confirmed** *(settings)*
- [ ] **Child mode** confirmed against the product *(copy says "includes a child mode")*
- [ ] **MRP** confirmed and legally appropriate before ticking **Show MRP** *(settings)*
- [ ] WhatsApp/SMS follow-up: not built; needs a WhatsApp Business API provider (see README)

## 4. Production setup
- [ ] Policies published: at minimum the **Privacy Notice** (mention Vercel Web Analytics, cookieless) *(settings)*
- [ ] `consent_text_version` updated whenever the consent wording or privacy notice changes *(settings)*
- [ ] `team_notify_emails` set *(settings: Notifications)*; `RESEND_API_KEY` and `MAIL_FROM` set, with the sending domain verified in Resend
- [ ] Turnstile keys set (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`) for the production domain, **and `TURNSTILE_DISABLED` removed** from Vercel (it is currently `true`). Redeploy afterwards
- [ ] `IP_HASH_SALT` set to a long random value
- [ ] `NEXT_PUBLIC_SITE_URL` set to the production URL
- [ ] Supabase Auth: Site URL + `/admin/auth/callback` redirect set, sign-ups disabled, custom SMTP configured
- [ ] Admins added (`admins` table + invited users); every admin has signed in once
- [ ] A real test lead submitted on production, verified in `/admin` (and in the team email), then **deleted**
- [ ] Social preview checked (e.g. paste the URL into WhatsApp/Slack)
- [ ] Real-device test: scroll the whole story, submit a lead, check it in `/admin`, export CSV, flip a claim gate and see the page update
- [ ] On a mid-range Android phone and an iPhone, check the first scroll stays smooth. Phones build the 3D scene on the first interaction; the poster shows until then
- [ ] Check the brand font on a first visit over a slow connection. Outfit uses `font-display: optional`, so a very slow first load may show the fallback font for that page view
- [ ] Glowbite to accept the social preview showing the price as "INR 1,299" (the image font has no ₹ glyph; the page itself shows ₹)
- [ ] After any change to the 3D model, re-render the posters: `pnpm start`, then `pnpm tsx scripts/render-poster.ts`
