"use client";
// Pre-order interest form. Validation rules are shared with the server (lib/leads.ts).
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { fieldRules, type LeadField } from "@/lib/lead-rules";
import { inr } from "@/lib/format";
import { track } from "@/lib/analytics";

type Props = {
  brand: string;
  price: number;
  offerActive: boolean;
  maxQty: number;
  privacyHref: string | null;
};

type Field = Exclude<LeadField, "quantity">;
const FIELDS: Field[] = ["name", "phone", "pin", "email"];
const STORAGE_KEY = "glowbite_lead";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type View = "form" | "created" | "duplicate";

export function PreorderForm({ brand, price, offerActive, maxQty, privacyHref }: Props) {
  const [values, setValues] = useState<Record<Field, string>>({ name: "", phone: "", pin: "", email: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [qty, setQty] = useState(1);
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [view, setView] = useState<View>("form");
  const [token, setToken] = useState("");
  const started = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<HTMLCanvasElement>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Returning visitor who already joined
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) setView("duplicate");
    } catch {}
  }, []);

  // form_view once the form scrolls into view
  useEffect(() => {
    const el = formRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          track("form_view");
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (view !== "form") doneRef.current?.focus({ preventScroll: true });
  }, [view]);

  const check = (f: Field, v = values[f]) => {
    const msg = fieldRules[f](v);
    setErrors((e) => ({ ...e, [f]: msg }));
    return msg;
  };

  const onChange = (f: Field, raw: string) => {
    let v = raw;
    if (f === "pin") v = raw.replace(/\D/g, "").slice(0, 6);
    if (f === "phone") v = raw.replace(/[^\d\s+-]/g, "");
    if (!started.current) {
      started.current = true;
      track("form_start");
    }
    setValues((s) => ({ ...s, [f]: v }));
    if (errors[f]) check(f, v);
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setFormError("");
    const found = FIELDS.map((f) => [f, check(f)] as const).filter(([, m]) => m);
    if (found.length) {
      const first = found[0]![0];
      document.getElementById(first)?.focus();
      found.forEach(([f]) => track("form_error", { field: f }));
      return;
    }
    if (SITE_KEY && !token) {
      setFormError("Just a moment, we're checking this browser. Please try again in a few seconds.");
      return;
    }
    const company = (e.currentTarget.elements.namedItem("company") as HTMLInputElement | null)?.value ?? "";
    setBusy(true);
    try {
      const params = new URLSearchParams(location.search);
      const utm = Object.fromEntries([...params].filter(([k]) => k.startsWith("utm_")));
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
          pin: values.pin,
          email: values.email || null,
          quantity: qty,
          optIn,
          company,
          turnstileToken: token,
          utm,
          source: location.hostname,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        status?: string;
        errors?: Partial<Record<Field, string>>;
        message?: string;
      };
      if (res.ok && (body.status === "created" || body.status === "duplicate")) {
        const duplicate = body.status === "duplicate";
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {}
        track("lead_submit", { quantity: qty, opt_in: optIn, duplicate });
        setView(duplicate ? "duplicate" : "created");
        if (!duplicate) burst(burstRef.current);
        return;
      }
      if (res.status === 400 && body.errors && Object.keys(body.errors).length) {
        setErrors(body.errors);
        const first = FIELDS.find((f) => body.errors![f]);
        if (first) document.getElementById(first)?.focus();
        return;
      }
      setFormError(body.message || "We couldn't save your details. Check your connection and try again.");
      turnstileRef.current?.reset();
    } catch {
      setFormError("We couldn't save your details. Check your connection and try again.");
      turnstileRef.current?.reset();
    } finally {
      setBusy(false);
    }
  }

  const fieldProps = (f: Field) => ({
    id: f,
    name: f,
    value: values[f],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(f, e.target.value),
    onBlur: () => values[f] && check(f),
    "aria-invalid": errors[f] ? true : undefined,
    "aria-describedby": errors[f] ? `e-${f}` : undefined,
    className: "in",
  });

  return (
    <>
      <canvas ref={burstRef} className="burst" aria-hidden="true" />
      {view === "form" ? (
        <form ref={formRef} className="lead-form" noValidate onSubmit={onSubmit} aria-label="Join the pre-order list">
          <div className={`f${errors.name ? " bad" : ""}`}>
            <label htmlFor="name">Full name</label>
            <input {...fieldProps("name")} autoComplete="name" maxLength={80} placeholder="Your name" />
            <span className="err" id="e-name" role="alert">
              {errors.name}
            </span>
          </div>
          <div className={`f${errors.phone ? " bad" : ""}`}>
            <label htmlFor="phone">Mobile number</label>
            <div className="ph">
              <span aria-hidden="true">+91</span>
              <input
                {...fieldProps("phone")}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={16}
                placeholder="10-digit mobile"
              />
            </div>
            <span className="err" id="e-phone" role="alert">
              {errors.phone}
            </span>
          </div>
          <div className="two">
            <div className={`f${errors.pin ? " bad" : ""}`}>
              <label htmlFor="pin">PIN code</label>
              <input {...fieldProps("pin")} inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="6 digits" />
              <span className="err" id="e-pin" role="alert">
                {errors.pin}
              </span>
            </div>
            <div className={`f${errors.email ? " bad" : ""}`}>
              <label htmlFor="email">
                Email <em>Optional</em>
              </label>
              <input {...fieldProps("email")} type="email" autoComplete="email" maxLength={120} placeholder="you@example.com" />
              <span className="err" id="e-email" role="alert">
                {errors.email}
              </span>
            </div>
          </div>
          <div className="f" role="group" aria-labelledby="qty-label">
            <span className="lbl" id="qty-label">
              Quantity <em>Optional</em>
            </span>
            <div className="qty">
              <div className="step">
                <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <output id="qOut" aria-live="polite" aria-label="Quantity">
                  {qty}
                </output>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={qty >= maxQty}
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                >
                  +
                </button>
              </div>
              {offerActive && qty > 1 && <small>{inr(price * qty)} at the pre-order price</small>}
            </div>
          </div>
          <div className="hp" aria-hidden="true">
            <label htmlFor="company">Company</label>
            <input id="company" name="company" tabIndex={-1} autoComplete="off" />
          </div>
          <label className="chk" htmlFor="optin">
            <input type="checkbox" id="optin" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
            <span>Also send me {brand} offers and updates (optional).</span>
          </label>
          <p className="consent">
            By submitting, you agree that {brand} may contact you about this product enquiry or pre-order.
            {privacyHref ? (
              <>
                {" "}
                Read our <a href={privacyHref}>Privacy Notice</a> to understand how your details are used.
              </>
            ) : null}
          </p>
          {SITE_KEY && (
            <Turnstile
              ref={turnstileRef}
              siteKey={SITE_KEY}
              onSuccess={setToken}
              onExpire={() => setToken("")}
              options={{ size: "flexible", theme: "dark", appearance: "interaction-only" }}
            />
          )}
          {formError && (
            <div className="ferr" role="alert">
              {formError}
            </div>
          )}
          <button className="cta submit" type="submit" aria-busy={busy || undefined}>
            <i className="dot" aria-hidden="true" />
            <span>{busy ? "Joining…" : "Join the Pre-order List"}</span>
          </button>
          <p className="fine" style={{ textAlign: "center" }}>
            Non-binding interest list. No payment is taken now.
          </p>
        </form>
      ) : (
        <div className="done" ref={doneRef} tabIndex={-1} role="status" data-testid="lead-done">
          <span className="tag">Pre-order list</span>
          <h3>{view === "duplicate" ? "You're already on the list." : "You're on the list!"}</h3>
          <p>
            {view === "duplicate"
              ? `We have your details. We'll reach out with the next steps and availability details. No payment has been taken.`
              : `Thanks for your interest in ${brand}. We'll reach out with the next steps and availability details. No payment has been taken.`}
          </p>
        </div>
      )}
    </>
  );
}

function burst(cv: HTMLCanvasElement | null) {
  if (!cv || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const card = cv.parentElement!;
  const x = cv.getContext("2d");
  if (!x) return;
  const dpr = Math.min(devicePixelRatio || 1, 2),
    W = card.clientWidth,
    H = card.clientHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ps = Array.from({ length: 80 }, () => {
    const a = Math.random() * 6.283,
      v = 2 + Math.random() * 8;
    return { x: W * 0.2, y: 120, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, r: 2 + Math.random() * 4, l: 1 };
  });
  (function f() {
    x.clearRect(0, 0, W, H);
    let n = 0;
    for (const p of ps) {
      if (p.l <= 0) continue;
      n++;
      p.vy += 0.22;
      p.x += p.vx;
      p.y += p.vy;
      p.l -= 0.013;
      x.beginPath();
      x.fillStyle = `rgba(200,236,255,${p.l * 0.8})`;
      x.ellipse(p.x, p.y, p.r * 0.8, p.r, Math.atan2(p.vy, p.vx) + 1.57, 0, 6.283);
      x.fill();
    }
    if (n) requestAnimationFrame(f);
    else x.clearRect(0, 0, W, H);
  })();
}
