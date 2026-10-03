"use client";

import { useParams } from "next/navigation";
import { InvoiceSponsumPanel } from "../../../../components/sponsum/InvoiceSponsumPanel";

export default function SponsumInvoicePage() {
  const params = useParams<{ invoiceId: string }>();
  return <InvoiceSponsumPanel invoiceId={String(params.invoiceId ?? "")} />;
}
