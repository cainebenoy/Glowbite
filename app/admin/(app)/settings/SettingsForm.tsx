"use client";
import { useActionState, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import { POLICY_KEYS, POLICY_TITLES, type Settings } from "@/lib/settings";
import { saveSettings, type SaveSettingsState } from "../actions";

type Bool = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
type Text = { [K in keyof Settings]: Settings[K] extends string ? K : never }[keyof Settings];
type Num = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

const input = "w-full rounded-lg border border-white/15 bg-black px-3 py-2";

function Group({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-line bg-panel p-4">
      <legend className="px-1 text-sm font-medium uppercase tracking-[0.18em] text-ink-70">{title}</legend>
      {note && <p className="mb-3 text-sm text-ink-45">{note}</p>}
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Err({ msg }: { msg?: string }) {
  return msg ? (
    <span role="alert" className="text-xs text-err">
      {msg}
    </span>
  ) : null;
}

export function SettingsForm({ initial, initialEmails }: { initial: Settings; initialEmails: string[] }) {
  const [s, setS] = useState<Settings>(initial);
  const [emails, setEmails] = useState(initialEmails.join("\n"));
  const [preview, setPreview] = useState<Record<string, boolean>>({});
  const [state, action, pending] = useActionState<SaveSettingsState, FormData>(saveSettings, { status: "idle" });
  const errs = state.status === "error" ? (state.errors ?? {}) : {};

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));

  const text = (k: Text, label: string, opts?: { hint?: string; type?: string; placeholder?: string; full?: boolean }) => (
    <label className={`flex flex-col gap-1 text-sm ${opts?.full ? "md:col-span-2" : ""}`}>
      <span>{label}</span>
      <input
        name={k}
        type={opts?.type ?? "text"}
        value={s[k]}
        placeholder={opts?.placeholder}
        onChange={(e) => set(k, e.target.value)}
        className={input}
      />
      {opts?.hint && <span className="text-xs text-ink-45">{opts.hint}</span>}
      <Err msg={errs[k]} />
    </label>
  );
  const num = (k: Num, label: string, hint?: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <input name={k} type="number" inputMode="numeric" value={s[k]} onChange={(e) => set(k, Number(e.target.value))} className={input} />
      {hint && <span className="text-xs text-ink-45">{hint}</span>}
      <Err msg={errs[k]} />
    </label>
  );
  const toggle = (k: Bool, label: string, verify?: string) => (
    <label className="flex items-start gap-3 text-sm md:col-span-2">
      <input type="checkbox" name={k} checked={s[k]} onChange={(e) => set(k, e.target.checked)} className="mt-0.5 h-5 w-5 accent-cyan" />
      <span className="flex flex-col gap-0.5">
        <span>{label}</span>
        {verify && <span className="text-xs text-ink-45">Brief: {verify}</span>}
      </span>
    </label>
  );

  const unconfirmedBox = s.in_the_box.some((b) => !b.confirmed);

  return (
    <form
      action={(fd) => {
        fd.set(
          "payload",
          JSON.stringify({
            settings: s,
            team_notify_emails: emails.split(/[\s,;]+/).filter(Boolean),
          }),
        );
        return action(fd);
      }}
      className="flex flex-col gap-5"
    >
      {!s.privacy_md.trim() && (
        <p role="note" className="rounded-xl border border-[#ffd27a]/40 bg-[#ffd27a]/10 px-4 py-3 text-sm text-[#ffd27a]">
          Build warning: no Privacy Notice is published. The form&apos;s consent line won&apos;t link to one, and the footer won&apos;t
          list it. Add the privacy policy below before launch.
        </p>
      )}

      <Group title="Offer">
        {text("brand_name", "Brand name", { hint: 'Logo says "Glowbite"; brief says "GlowBite". Shown in copy, emails and SEO.' })}
        {num("max_qty", "Maximum quantity per lead", "The form's quantity stepper stops here.")}
        {num("price", "Pre-order interest price (₹)")}
        {num("mrp", "MRP (₹)")}
        {toggle("offer_active", "Offer active (show the price)", "Display ₹1,299 as the proposed pre-order price only while that offer is active.")}
        {toggle("show_mrp", "Show MRP next to the price", "Show as MRP only if confirmed and legally appropriate.")}
      </Group>

      <Group title="Claim gates" note="Each claim is hidden everywhere on the site until its box is ticked.">
        {toggle("ipx7_verified", "IPX7 verified (adds the IPX7 scene, spec and FAQ)", "Verify supplier documentation before claiming.")}
        {toggle("warranty_published", "Warranty published", "Publish only once terms and service process are confirmed.")}
        {text("warranty_text", "Warranty term", { hint: 'e.g. "1 year". Shown as "Warranty: 1 year" when published.' })}
        {toggle("free_shipping_confirmed", 'Free shipping confirmed (says "Free shipping" instead of "subject to confirmed terms")', "Free shipping was planned; confirm serviceable areas and terms.")}
      </Group>

      <Group title="Dispatch">
        {text("dispatch_window", "Dispatch window", {
          full: true,
          placeholder: "Leave blank until confirmed",
          hint: 'e.g. "Expected dispatch: March 2027". While blank the site says: "Dispatch timing will be confirmed before your order is finalised".',
        })}
      </Group>

      <fieldset className="rounded-2xl border border-line bg-panel p-4">
        <legend className="px-1 text-sm font-medium uppercase tracking-[0.18em] text-ink-70">In the box</legend>
        <p className="mb-3 text-sm text-ink-45">Brief: show the actual included items and quantities, only if they are in the delivered package.</p>
        {unconfirmedBox && (
          <p className="mb-3 text-sm text-[#ffd27a]">Unconfirmed: tick each item once it&apos;s checked against the real package.</p>
        )}
        <div className="flex flex-col gap-2">
          {s.in_the_box.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                aria-label={`Item ${i + 1}`}
                value={b.item}
                onChange={(e) => set("in_the_box", s.in_the_box.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))}
                className={`${input} flex-1 min-w-48`}
              />
              <input
                aria-label={`Quantity of item ${i + 1}`}
                type="number"
                min={1}
                value={b.qty}
                onChange={(e) => set("in_the_box", s.in_the_box.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))}
                className={`${input} w-20`}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={b.confirmed}
                  onChange={(e) => set("in_the_box", s.in_the_box.map((x, j) => (j === i ? { ...x, confirmed: e.target.checked } : x)))}
                  className="h-4 w-4 accent-cyan"
                />
                Confirmed
              </label>
              <button
                type="button"
                onClick={() => set("in_the_box", s.in_the_box.filter((_, j) => j !== i))}
                className="rounded-lg border border-white/15 px-2 py-1 text-sm text-ink-70"
              >
                Remove
              </button>
              <Err msg={errs[`in_the_box.${i}.item`] ?? errs[`in_the_box.${i}.qty`]} />
            </div>
          ))}
          <button
            type="button"
            onClick={() => set("in_the_box", [...s.in_the_box, { item: "", qty: 1, confirmed: false }])}
            className="self-start rounded-lg border border-white/25 px-3 py-1.5 text-sm"
          >
            Add item
          </button>
        </div>
        <div className="mt-4">{text("instruction_guide_url", "Official instruction guide URL", { full: true, placeholder: "https://…", hint: "Linked from the routine scene and the FAQ when set." })}</div>
      </fieldset>

      <fieldset className="rounded-2xl border border-line bg-panel p-4">
        <legend className="px-1 text-sm font-medium uppercase tracking-[0.18em] text-ink-70">Policies (Markdown)</legend>
        <p className="mb-3 text-sm text-ink-45">Each policy gets its own page (e.g. /privacy) and a footer link once it has content. Empty = no page.</p>
        <div className="flex flex-col gap-5">
          {POLICY_KEYS.map((k) => {
            const key = `${k}_md` as const;
            return (
              <div key={k} className="flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <label htmlFor={key}>{POLICY_TITLES[k]}</label>
                  <button type="button" className="text-xs text-ink-70 underline" onClick={() => setPreview((p) => ({ ...p, [k]: !p[k] }))}>
                    {preview[k] ? "Edit" : "Preview"}
                  </button>
                </div>
                {preview[k] ? (
                  <div className="prose min-h-24 rounded-lg border border-white/15 bg-black p-3 text-ink-70">
                    {s[key].trim() ? <Markdown>{s[key]}</Markdown> : <em>Empty: no page will be published.</em>}
                  </div>
                ) : (
                  <textarea id={key} rows={6} value={s[key]} onChange={(e) => set(key, e.target.value)} className={`${input} font-mono text-xs`} />
                )}
                <Err msg={errs[key]} />
              </div>
            );
          })}
        </div>
      </fieldset>

      <Group title="Contact & social" note="Only filled-in items appear in the footer. Use official, working links only.">
        {text("contact_email", "Contact email", { type: "email" })}
        {text("contact_phone", "Contact phone")}
        {text("whatsapp", "WhatsApp number")}
        {text("instagram_url", "Instagram URL", { placeholder: "https://…" })}
        {text("facebook_url", "Facebook URL", { placeholder: "https://…" })}
        {text("youtube_url", "YouTube URL", { placeholder: "https://…" })}
      </Group>

      <Group title="Notifications & consent">
        <label className="flex flex-col gap-1 text-sm">
          <span>Team notification emails (one per line)</span>
          <textarea rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} className={input} />
          <span className="text-xs text-ink-45">Each new lead is emailed here (needs RESEND_API_KEY). Private: never shown on the site.</span>
          <Err msg={errs.team_notify_emails} />
        </label>
        {text("consent_text_version", "Consent text version", { hint: "Stored with every lead. Change it whenever the consent wording or privacy notice changes." })}
      </Group>

      <div className="sticky bottom-0 -mx-5 flex items-center gap-4 border-t border-line bg-black/90 px-5 py-3 backdrop-blur">
        <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2.5 font-medium text-[#07090c] disabled:opacity-60">
          {pending ? "Saving…" : "Save settings"}
        </button>
        <span role="status" className="text-sm">
          {state.status === "saved" && <span className="text-ink-70">Saved. The live page is updating.</span>}
          {state.status === "error" && (
            <span className="text-err">{errs._ ?? "Some fields need attention. Nothing was saved."}</span>
          )}
        </span>
      </div>
    </form>
  );
}
