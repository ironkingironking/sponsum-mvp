import { InstrumentType, SettlementModel } from "./types";

export type TemplateDefinition = {
  id: string;
  title: string;
  instrumentType: InstrumentType;
  description: string;
  settlementDefaults: SettlementModel[];
  requiredRoles: string[];
};

export const CORE_TEMPLATES: TemplateDefinition[] = [
  {
    id: "invoice-sale",
    title: "Sell an Invoice",
    instrumentType: InstrumentType.INVOICE_SALE,
    description: "Sell a receivable for immediate liquidity.",
    settlementDefaults: [SettlementModel.SINGLE_MATURITY],
    requiredRoles: ["seller", "debtor", "buyer"]
  },
  {
    id: "borrow-with-collateral",
    title: "Borrow with Collateral",
    instrumentType: InstrumentType.COLLATERALIZED_BORROWING,
    description: "Raise financing with pledged collateral.",
    settlementDefaults: [SettlementModel.INSTALLMENTS],
    requiredRoles: ["borrower", "lender", "collateral_provider"]
  },
  {
    id: "bill-of-exchange",
    title: "Create a Bill of Exchange",
    instrumentType: InstrumentType.BILL_OF_EXCHANGE,
    description: "Issue and transfer a bill of exchange-like instrument.",
    settlementDefaults: [SettlementModel.SINGLE_MATURITY],
    requiredRoles: ["drawer", "drawee", "payee"]
  },
  {
    id: "venture-financing",
    title: "Finance a Venture",
    instrumentType: InstrumentType.VENTURE_FINANCING,
    description: "Commenda-style investor/operator venture contract.",
    settlementDefaults: [SettlementModel.PROFIT_SHARE, SettlementModel.REVENUE_SHARE],
    requiredRoles: ["investor", "operator"]
  },
  {
    id: "annuity-guelt",
    title: "Create an Annuity / Gült-style Claim",
    instrumentType: InstrumentType.ANNUITY_GUELT,
    description: "Recurring payment obligation backed by long-term value.",
    settlementDefaults: [SettlementModel.ANNUITY],
    requiredRoles: ["debtor", "creditor", "beneficiary"]
  },
  {
    id: "provide-guarantee",
    title: "Provide a Guarantee",
    instrumentType: InstrumentType.GUARANTEE_ATTACHMENT,
    description: "Attach third-party guarantee to increase claim reliability.",
    settlementDefaults: [SettlementModel.CONDITIONAL],
    requiredRoles: ["guarantor", "creditor", "debtor"]
  },
  {
    id: "buy-claim",
    title: "Buy a Claim on the Marketplace",
    instrumentType: InstrumentType.MARKETPLACE_PURCHASE,
    description: "Purchase full or fractional exposure of a listed claim.",
    settlementDefaults: [SettlementModel.CONDITIONAL],
    requiredRoles: ["seller", "buyer"]
  }
];
