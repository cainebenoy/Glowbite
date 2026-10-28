# CLAUDE.md — Glowbite pre-order site

Standing rules for every session in this repo. The full build task is in `BUILD_PROMPT.md`.

## What this is
A single-product pre-order site for the Glowbite dental water flosser (Kerala/India market, prices in ₹). Visitors join a **non-binding pre-order interest list**. No payment is taken. A small admin area lets the Glowbite team read leads and edit price, copy and dates without touching code.

## Non-negotiables
1. **No invented content.** Product facts come only from `reference/brief.pdf` and the `settings` table. Never write testimonials, ratings, backer counts, "X people joined", countdowns, stock scarcity, dispatch dates, clinical or health claims, or "dentist recommended". If copy is missing, render nothing (hide the element), never a placeholder that reads as real.
2. **Claim gates.** IPX7, warranty, MRP, dispatch window and free-shipping wording render only when their `settings` flag says confirmed. The default for every gate is off.
3. **Never imply an order or payment.** Every CTA and the success state say "pre-order list" and "No payment has been taken."
4. **Lead data is private.** Leads are written only through the server route. The browser never holds a key that can read leads. Admin pages require auth plus an allowlist.
5. **Children.** Only "includes a child mode; follow the product instructions and use with adult supervision". No safety claims.

## Stack (decided — do not swap without proposing first)
Next.js 15 (App Router, TypeScript strict) · React 19 · Tailwind CSS v4 (tokens below) · @react-three/fiber + drei + @react-three/postprocessing · Lenis · Zustand · Supabase (Postgres, Auth, RLS) · Zod · Resend (email) · Cloudflare Turnstile (spam) · @vercel/analytics · Vitest · Playwright · Vercel hosting · pnpm.

## Design tokens (from the approved prototype)
- Background `#000000` (true black). Panels `#0B0B0C`. Hairlines `rgba(255,255,255,.09)`.
- Ink `#F4F6F8`, ink-70 `rgba(236,241,245,.68)`, ink-45 `rgba(236,241,245,.42)`.
- Accent cyan `#00C2FF` — used only for: tank glow, small status dots, focus rings, the progress hairline. Secondary blue `#00AEEF`.
- Type: **Outfit** (Google Fonts via `next/font`), weights 200/300/400/500/600. Display numbers 200, headings 200–300, body 300–400, labels 500 uppercase with 0.24–0.26em tracking. No second family on the page (Poppins 600 is used only to paint the logo onto the 3D model).
- Buttons: solid ink pill, near-black text, one 6px cyan dot. No neon, no glow outlines, no gradients on UI.
- Motion: slow and quiet. Settle-in (blur → sharp), never flicker. Respect `prefers-reduced-motion` everywhere.

## Working style
- Build in batches and run to completion; don't stop for review between steps. Testing happens at the end (unit + e2e), then a human does real-browser testing on a phone and desktop before accepting.
- Propose before changing architecture, the data model, or the stack.
- Keep everything Glowbite edits (price, copy, flags, links, dates) in the `settings` table, editable in `/admin/settings`. Nothing business-facing is hard-coded except defaults in the seed.
- Commit in logical chunks with clear messages.
