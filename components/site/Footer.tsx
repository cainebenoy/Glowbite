import Image from "next/image";
import logo from "@/public/logo.png";
import { footerLinks, type Settings } from "@/lib/settings";

export function Footer({ s, year }: { s: Settings; year: number }) {
  const links = footerLinks(s);
  const contact = (
    [
      ["Email", s.contact_email],
      ["Phone", s.contact_phone],
      ["WhatsApp", s.whatsapp],
    ] as const
  ).filter(([, v]) => v.trim());
  return (
    <footer className="site-footer" id="footer">
      <div className="foot">
        <span className="mark">
          <Image src={logo} alt={s.brand_name} style={{ width: "auto", height: 52 }} sizes="121px" />
        </span>
        <p>
          Your details are used only to contact you about this product enquiry or pre-order. Promotional messages are sent only if
          you opt in.
        </p>
        {links.length > 0 && (
          <nav aria-label="Policies and social">
            {links.map((l) => (
              <a key={l.href} href={l.href} {...(/^https?:/.test(l.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {l.label}
              </a>
            ))}
          </nav>
        )}
        {contact.length > 0 && (
          <div className="contact">
            {contact.map(([k, v]) => (
              <div key={k}>
                {k}: <span>{v}</span>
              </div>
            ))}
          </div>
        )}
        <p>
          © {year} {s.brand_name}
        </p>
      </div>
    </footer>
  );
}
