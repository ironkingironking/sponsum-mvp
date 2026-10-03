import Link from "next/link";

const DEMO_INVOICE = "INV-2026-482";

export default function SponsumHubPage() {
  return (
    <main className="sponsum-invoice-panel" data-testid="sponsum-hub">
      <header>
        <h1>Sponsum</h1>
        <p className="muted">Forderung finanzieren, bilateral verkaufen, direkt abrechnen.</p>
      </header>
      <div className="primary-action-grid">
        <Link href={`/sponsum/invoice/${DEMO_INVOICE}`} className="primary-action-card" data-testid="sponsum-entry-invoice">
          <strong>Rechnung öffnen</strong>
          <p>Demo {DEMO_INVOICE}: Liquidität beschaffen oder Forderung verkaufen.</p>
        </Link>
        <Link href="/sponsum/portfolio" className="primary-action-card" data-testid="sponsum-entry-portfolio">
          <strong>Portfolio</strong>
          <p>Gekaufte Forderungen, Restlaufzeit und erwarteter Ertrag.</p>
        </Link>
      </div>
    </main>
  );
}
