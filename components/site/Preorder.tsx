// Pre-order section: heading, offer card and the form.
import {
  dispatchLine,
  hasPolicy,
  inr,
  shippingLine,
  showMrp,
  showWarranty,
  TRUST_LINE,
  type Settings,
} from "@/lib/settings";
import { PreorderForm } from "./PreorderForm";

export function Preorder({ s }: { s: Settings }) {
  return (
    <section className="order" id="preorder" data-scene="preorder" aria-labelledby="preorder-title">
      <div className="order-grid">
        <div className="order-lead">
          <span className="tag">Pre-order list</span>
          <h2 id="preorder-title" tabIndex={-1} style={{ outline: "none" }}>
            Be first
            <br />
            in line.
          </h2>
        </div>
        <div className="card" id="formCard">
          <div className="offer">
            <div>
              {s.offer_active && (
                <>
                  <div className="big">{inr(s.price)}</div>
                  <span className="fine">
                    Pre-order interest price
                    {showMrp(s) && (
                      <span className="mrp">MRP {inr(s.mrp)}</span>
                    )}
                  </span>
                </>
              )}
            </div>
            <ul>
              <li>No payment taken now</li>
              <li>{shippingLine(s)}</li>
              {showWarranty(s) && <li>Warranty: {s.warranty_text.trim()}</li>}
              <li>{dispatchLine(s)}</li>
            </ul>
          </div>
          <p className="trust">{TRUST_LINE}</p>
          <PreorderForm
            brand={s.brand_name}
            price={s.price}
            offerActive={s.offer_active}
            maxQty={s.max_qty}
            privacyHref={hasPolicy(s, "privacy") ? "/privacy" : null}
          />
        </div>
      </div>
    </section>
  );
}
