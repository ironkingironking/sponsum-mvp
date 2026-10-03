"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../../lib/api";

type Portfolio = {
  invested: string;
  outstanding_nominal: string;
  expected_income: string;
  items: Array<{
    receivable_id: string;
    outstanding_amount: string;
    maturity_date: string;
    status: string;
  }>;
};

export default function SponsumPortfolioPage() {
  const [book, setBook] = useState<Portfolio | null>(null);

  useEffect(() => {
    apiGet<Portfolio>("/api/sponsum/v1/portfolio/buyer-1")
      .then(setBook)
      .catch(() => setBook({ invested: "0.00", outstanding_nominal: "0.00", expected_income: "0.00", items: [] }));
  }, []);

  return (
    <main data-testid="sponsum-portfolio">
      <h1>Sponsum Portfolio</h1>
      <p data-testid="sponsum-portfolio-invested">Invested {book?.invested ?? "—"}</p>
      <p data-testid="sponsum-portfolio-outstanding">Outstanding nominal {book?.outstanding_nominal ?? "—"}</p>
      <p data-testid="sponsum-portfolio-income">Expected income {book?.expected_income ?? "—"}</p>
      <ul>
        {(book?.items ?? []).map((item) => (
          <li key={item.receivable_id}>
            {item.receivable_id} {item.outstanding_amount} {item.status} {item.maturity_date}
          </li>
        ))}
      </ul>
    </main>
  );
}
