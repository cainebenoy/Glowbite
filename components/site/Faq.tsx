"use client";
import type { FaqItem } from "@/lib/settings";
import { track } from "@/lib/analytics";

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <section className="faq" id="faq" aria-labelledby="faqTitle">
      <div className="faq-in">
        <h2 id="faqTitle">Good to know.</h2>
        <div>
          {items.map((it) => (
            <details
              key={it.q}
              onToggle={(e) => {
                if ((e.currentTarget as HTMLDetailsElement).open) track("faq_open", { q: it.q });
              }}
            >
              <summary>
                {it.q}
                <b aria-hidden="true" />
              </summary>
              <div className="ans">
                {it.a}
                {it.link && (
                  <>
                    {" "}
                    <a
                      href={it.link.href}
                      {...(/^https?:/.test(it.link.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {it.link.label}
                    </a>
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
