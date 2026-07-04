import { Suspense } from "react";
import { Card } from "@sponsum/ui";
import { DealsInvestmentWorkbench } from "@/components/deals/DealsInvestmentWorkbench";

export default function MyDealsPage() {
  return (
    <Suspense
      fallback={
        <div className="container">
          <Card>
            <p style={{ margin: 0, color: "#475569" }}>Loading live deals...</p>
          </Card>
        </div>
      }
    >
      <DealsInvestmentWorkbench />
    </Suspense>
  );
}
