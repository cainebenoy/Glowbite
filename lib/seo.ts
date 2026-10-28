// SEO copy and structured data, from settings. No ratings or reviews, ever.
import { inr, type Settings } from "./settings";

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const siteTitle = (s: Settings) => `${s.brand_name} Water Flosser — Join the Pre-order List`;

export function siteDescription(s: Settings): string {
  const price = s.offer_active ? ` Pre-order interest price ${inr(s.price)}.` : "";
  return `Discover the ${s.brand_name} Water Flosser — a rechargeable device designed to make water flossing part of your daily oral-care routine. 5 modes, 350 ml tank, 5 tips, USB-C charging.${price} No payment taken now.`;
}

export function productJsonLd(s: Settings) {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${s.brand_name} Water Flosser`,
    brand: { "@type": "Brand", name: s.brand_name },
    image: `${url}/product-front.jpg`,
    description:
      "Rechargeable water flosser with 5 modes including a child mode, a 350 ml water tank, 5 tips and USB-C charging.",
    url,
    ...(s.offer_active
      ? {
          offers: {
            "@type": "Offer",
            price: String(s.price),
            priceCurrency: "INR",
            availability: "https://schema.org/PreOrder",
            url: `${url}/#preorder`,
          },
        }
      : {}),
  };
}
