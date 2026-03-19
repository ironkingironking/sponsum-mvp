export type UUID = string;

export enum InstrumentType {
  INVOICE_SALE = "INVOICE_SALE",
  COLLATERALIZED_BORROWING = "COLLATERALIZED_BORROWING",
  BILL_OF_EXCHANGE = "BILL_OF_EXCHANGE",
  VENTURE_FINANCING = "VENTURE_FINANCING",
  ANNUITY_GUELT = "ANNUITY_GUELT",
  GUARANTEE_ATTACHMENT = "GUARANTEE_ATTACHMENT",
  MARKETPLACE_PURCHASE = "MARKETPLACE_PURCHASE",
  PROMISSORY_NOTE = "PROMISSORY_NOTE",
  ASSIGNABLE_RECEIVABLE = "ASSIGNABLE_RECEIVABLE",
  CUSTOM_PRIVATE_LAW = "CUSTOM_PRIVATE_LAW"
}

export enum ClaimStatus {
  DRAFT = "DRAFT",
  ISSUED = "ISSUED",
  ACCEPTED = "ACCEPTED",
  ACTIVE = "ACTIVE",
  PARTIALLY_SETTLED = "PARTIALLY_SETTLED",
  SETTLED = "SETTLED",
  OVERDUE = "OVERDUE",
  DEFAULTED = "DEFAULTED",
  DISPUTED = "DISPUTED",
  IN_ENFORCEMENT = "IN_ENFORCEMENT",
  RESOLVED = "RESOLVED",
  CANCELLED = "CANCELLED"
}

export enum DisputeStatus {
  OPEN = "OPEN",
  UNDER_REVIEW = "UNDER_REVIEW",
  MEDIATION = "MEDIATION",
  ARBITRATION = "ARBITRATION",
  COURT = "COURT",
  RESOLVED = "RESOLVED",
  REJECTED = "REJECTED"
}

export enum TrustTier {
  UNVERIFIED = "UNVERIFIED",
  BASIC_VERIFIED = "BASIC_VERIFIED",
  VERIFIED = "VERIFIED",
  TRUSTED_ISSUER = "TRUSTED_ISSUER",
  INSTITUTIONAL_ISSUER = "INSTITUTIONAL_ISSUER"
}

export enum CollateralStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  ENFORCED = "ENFORCED",
  RELEASED = "RELEASED"
}

export enum EscrowStatus {
  DRAFT = "DRAFT",
  FUNDED = "FUNDED",
  RELEASED = "RELEASED",
  RETURNED = "RETURNED",
  DISPUTED = "DISPUTED"
}

export enum CustodyStatus {
  DEPOSITED = "DEPOSITED",
  HELD = "HELD",
  RELEASED = "RELEASED",
  DISPUTED = "DISPUTED"
}

export enum ListingStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  PRIVATE = "PRIVATE",
  FILLED = "FILLED",
  CANCELLED = "CANCELLED"
}

export enum SettlementModel {
  SINGLE_MATURITY = "SINGLE_MATURITY",
  INSTALLMENTS = "INSTALLMENTS",
  ANNUITY = "ANNUITY",
  PROFIT_SHARE = "PROFIT_SHARE",
  REVENUE_SHARE = "REVENUE_SHARE",
  MILESTONE = "MILESTONE",
  CONDITIONAL = "CONDITIONAL"
}

export enum PartyRole {
  SELLER = "seller",
  BUYER = "buyer",
  GUARANTOR = "guarantor",
  ISSUER = "issuer",
  DEBTOR = "debtor",
  CREDITOR = "creditor",
  INVESTOR = "investor",
  OPERATOR = "operator",
  COLLATERAL_PROVIDER = "collateral_provider",
  DRAWER = "drawer",
  DRAWEE = "drawee",
  PAYEE = "payee",
  BORROWER = "borrower",
  LENDER = "lender",
  BENEFICIARY = "beneficiary"
}

export enum TransactionLifecycleStep {
  CREATE = "create",
  FUND = "fund",
  TRANSFER = "transfer",
  SETTLE = "settle"
}

export type ClaimSummary = {
  id: UUID;
  title: string;
  instrumentType: InstrumentType;
  amount: number;
  currency: string;
  maturityDate: string;
  status: ClaimStatus;
  riskRating: string;
  verificationBadge: string;
};
