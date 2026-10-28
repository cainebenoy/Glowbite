import { specs, type Settings } from "@/lib/settings";

export function Specs({ s }: { s: Settings }) {
  return (
    <section className="specs" id="specs" aria-labelledby="specsTitle">
      <div className="specs-in">
        <div>
          <span className="tag">Specifications</span>
          <h2 id="specsTitle">At a glance.</h2>
        </div>
        <dl className="spec-grid" data-testid="spec-grid">
          {specs(s).map((sp) => (
            <div key={sp.label} className={sp.full ? "full" : undefined}>
              <dt>{sp.label}</dt>
              <dd>
                {sp.value}
                {sp.note && <small>{sp.note}</small>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
