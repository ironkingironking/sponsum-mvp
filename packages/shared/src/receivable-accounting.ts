import type { AccountingProposal, ProtocolEventType } from "./receivable-types.js";

export function proposeAccounting(input: {
  eventId: string;
  receivableId: string;
  eventType: ProtocolEventType;
  nominal: string;
  purchasePrice: string;
}): AccountingProposal | null {
  const nominal = Number(input.nominal);
  const price = Number(input.purchasePrice);
  const spread = (nominal - price).toFixed(2);
  if (input.eventType === "ASSET_TRANSFERRED") {
    return {
      proposal_id: `acc-${input.eventId}`,
      event_id: input.eventId,
      receivable_id: input.receivableId,
      standard: "OR",
      status: "PROPOSED",
      lines: [
        { account: "Bank", debit: input.purchasePrice, credit: "0.00", memo: "sale proceeds" },
        { account: "Finanzierungsaufwand", debit: spread, credit: "0.00", memo: "discount" },
        { account: "Forderungen", debit: "0.00", credit: input.nominal, memo: "derecognise receivable" }
      ]
    };
  }
  if (input.eventType === "PAYMENT_RECEIVED") {
    return {
      proposal_id: `acc-${input.eventId}`,
      event_id: input.eventId,
      receivable_id: input.receivableId,
      standard: "OR",
      status: "PROPOSED",
      lines: [
        { account: "Bank", debit: input.nominal, credit: "0.00", memo: "debtor payment" },
        { account: "Forderungserwerb", debit: "0.00", credit: input.purchasePrice, memo: "close investment" },
        { account: "Finanzertrag", debit: "0.00", credit: spread, memo: "yield" }
      ]
    };
  }
  return null;
}
