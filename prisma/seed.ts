import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();
const SEEDED_PASSWORD = "mockpass123";

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1
  });

  return `scrypt$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function main() {
  await prisma.eventLog.deleteMany();
  await prisma.uploadedDocument.deleteMany();
  await prisma.custodyRecord.deleteMany();
  await prisma.escrowArrangement.deleteMany();
  await prisma.collateralRecord.deleteMany();
  await prisma.disputeCase.deleteMany();
  await prisma.settlementEvent.deleteMany();
  await prisma.marketplaceListing.deleteMany();
  await prisma.claimParty.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.claimTemplate.deleteMany();
  await prisma.trustProfile.deleteMany();
  await prisma.user.deleteMany();

  const seededPasswordHash = hashPassword(SEEDED_PASSWORD);
  const [issuer, debtor, buyer, guarantor, operator, investor, custodian, escrowAgent] = await Promise.all([
    prisma.user.create({ data: { email: "issuer@sponsum.io", fullName: "Iris Issuer", passwordHash: seededPasswordHash } }),
    prisma.user.create({ data: { email: "debtor@sponsum.io", fullName: "Dario Debtor", passwordHash: seededPasswordHash } }),
    prisma.user.create({ data: { email: "buyer@sponsum.io", fullName: "Bianca Buyer", passwordHash: seededPasswordHash } }),
    prisma.user.create({ data: { email: "guarantor@sponsum.io", fullName: "Gavin Guarantor", passwordHash: seededPasswordHash } }),
    prisma.user.create({ data: { email: "operator@sponsum.io", fullName: "Olaf Operator", passwordHash: seededPasswordHash } }),
    prisma.user.create({ data: { email: "investor@sponsum.io", fullName: "Ines Investor", passwordHash: seededPasswordHash } }),
    prisma.user.create({ data: { email: "custodian@sponsum.io", fullName: "Cora Custodian", passwordHash: seededPasswordHash } }),
    prisma.user.create({ data: { email: "escrow@sponsum.io", fullName: "Elias Escrow", passwordHash: seededPasswordHash } })
  ]);

  await Promise.all([
    prisma.trustProfile.create({
      data: {
        userId: issuer.id,
        totalClaimsIssued: 14,
        totalClaimsSold: 9,
        totalClaimsSettled: 12,
        defaultRate: 4.2,
        disputeRate: 7.1,
        repaymentReliability: 88,
        reputationScore: 76,
        trustTier: "TRUSTED_ISSUER",
        verificationBadges: "identity_verified,document_verified"
      }
    }),
    prisma.trustProfile.create({
      data: {
        userId: buyer.id,
        totalClaimsBought: 18,
        totalClaimsSettled: 15,
        defaultRate: 2.3,
        disputeRate: 3.4,
        repaymentReliability: 92,
        reputationScore: 81,
        trustTier: "VERIFIED",
        verificationBadges: "identity_verified"
      }
    })
  ]);

  const templates = await Promise.all([
    prisma.claimTemplate.create({
      data: {
        key: "invoice-sale",
        title: "Sell an Invoice",
        description: "Sell an existing receivable for immediate liquidity",
        instrumentType: "INVOICE_SALE",
        simpleGuidance: "You provide invoice, debtor, amount, and transfer terms."
      }
    }),
    prisma.claimTemplate.create({
      data: {
        key: "borrow-with-collateral",
        title: "Borrow with Collateral",
        description: "Borrower secures financing with collateral",
        instrumentType: "COLLATERALIZED_BORROWING",
        simpleGuidance: "Set principal, repayment terms, collateral, and enforcement trigger."
      }
    }),
    prisma.claimTemplate.create({
      data: {
        key: "bill-of-exchange",
        title: "Create a Bill of Exchange",
        description: "Drawer/drawee/payee structure with endorsement transfer",
        instrumentType: "BILL_OF_EXCHANGE",
        simpleGuidance: "Define drawer, drawee, payee, amount, and maturity."
      }
    }),
    prisma.claimTemplate.create({
      data: {
        key: "venture-financing",
        title: "Finance a Venture",
        description: "Commenda-style investor/operator financing",
        instrumentType: "VENTURE_FINANCING",
        simpleGuidance: "Set capital, profit share, loss allocation, and reporting."
      }
    }),
    prisma.claimTemplate.create({
      data: {
        key: "annuity-guelt",
        title: "Create an Annuity / Gült-style Claim",
        description: "Recurring long-duration payment rights",
        instrumentType: "ANNUITY_GUELT",
        simpleGuidance: "Define recurring amount, interval, backing, and redemption."
      }
    }),
    prisma.claimTemplate.create({
      data: {
        key: "provide-guarantee",
        title: "Provide a Guarantee",
        description: "Attach guarantor support to claim",
        instrumentType: "GUARANTEE_ATTACHMENT",
        simpleGuidance: "Set guarantee cap, trigger, and recourse conditions."
      }
    }),
    prisma.claimTemplate.create({
      data: {
        key: "buy-claim",
        title: "Buy a Claim on the Marketplace",
        description: "Purchase full or partial claim exposure",
        instrumentType: "MARKETPLACE_PURCHASE",
        simpleGuidance: "Set price, fraction, and transfer conditions."
      }
    })
  ]);

  const claim1 = await prisma.claim.create({
    data: {
      title: "Invoice Sale: Alpine Steel Receivable",
      instrumentType: "INVOICE_SALE",
      status: "ACTIVE",
      amount: 10000,
      currency: "CHF",
      issueDate: new Date("2026-01-10"),
      maturityDate: new Date("2026-06-01"),
      settlementModel: "SINGLE_MATURITY",
      transferability: "Assignable with debtor notification",
      disputeConfig: "Mediation then arbitration",
      governingLaw: "Swiss OR",
      jurisdiction: "Zurich",
      humanSummary:
        "Debtor owes 10,000 CHF due on 1 June 2026. Claim is transferable. If unpaid, dispute starts with mediation.",
      guarantors: guarantor.fullName,
      trustLinks: "issuer_trust_profile",
      createdById: issuer.id,
      issuerId: issuer.id,
      templateId: templates[0].id,
      parties: {
        create: [
          { role: "issuer", userId: issuer.id, displayName: issuer.fullName },
          { role: "debtor", userId: debtor.id, displayName: debtor.fullName },
          { role: "creditor", userId: issuer.id, displayName: issuer.fullName }
        ]
      }
    }
  });

  const claim2 = await prisma.claim.create({
    data: {
      title: "Collateralized Borrowing: Machine Lien",
      instrumentType: "COLLATERALIZED_BORROWING",
      status: "ACTIVE",
      amount: 55000,
      currency: "EUR",
      issueDate: new Date("2026-02-03"),
      maturityDate: new Date("2027-02-03"),
      settlementModel: "INSTALLMENTS",
      transferability: "Transferable with lien assignment",
      disputeConfig: "Mediation then court",
      governingLaw: "German BGB",
      jurisdiction: "Munich",
      humanSummary:
        "Borrower repays in monthly installments. If borrower defaults, collateral can be enforced after notice.",
      createdById: issuer.id,
      issuerId: issuer.id,
      templateId: templates[1].id
    }
  });

  const claim3 = await prisma.claim.create({
    data: {
      title: "Bill of Exchange: Trade Drawer/Drawee",
      instrumentType: "BILL_OF_EXCHANGE",
      status: "ISSUED",
      amount: 42000,
      currency: "EUR",
      issueDate: new Date("2026-03-01"),
      maturityDate: new Date("2026-09-01"),
      settlementModel: "SINGLE_MATURITY",
      transferability: "Endorsement based",
      disputeConfig: "Arbitration",
      governingLaw: "Swiss OR Wechselrecht",
      jurisdiction: "Basel",
      humanSummary:
        "A bill of exchange payable at maturity with endorsement transfer rights.",
      createdById: issuer.id,
      issuerId: issuer.id,
      templateId: templates[2].id
    }
  });

  const claim4 = await prisma.claim.create({
    data: {
      title: "Venture Financing: Commenda Spice Route",
      instrumentType: "VENTURE_FINANCING",
      status: "ACTIVE",
      amount: 80000,
      currency: "USD",
      issueDate: new Date("2026-02-15"),
      maturityDate: new Date("2026-12-15"),
      settlementModel: "PROFIT_SHARE",
      transferability: "Transferable with investor consent",
      disputeConfig: "Mediation then arbitration",
      governingLaw: "English law",
      jurisdiction: "London",
      humanSummary:
        "Investor funds operator. Profit is shared, losses follow agreed allocation rule.",
      createdById: investor.id,
      issuerId: investor.id,
      templateId: templates[3].id,
      parties: {
        create: [
          { role: "investor", userId: investor.id, displayName: investor.fullName },
          { role: "operator", userId: operator.id, displayName: operator.fullName }
        ]
      }
    }
  });

  const claim5 = await prisma.claim.create({
    data: {
      title: "Annuity/Gült Claim: Land Revenue Right",
      instrumentType: "ANNUITY_GUELT",
      status: "ACTIVE",
      amount: 1200,
      currency: "CHF",
      issueDate: new Date("2026-01-01"),
      maturityDate: new Date("2031-01-01"),
      settlementModel: "ANNUITY",
      transferability: "Transferable registry-backed",
      disputeConfig: "Court",
      governingLaw: "Cantonal property law",
      jurisdiction: "Bern",
      humanSummary:
        "Recurring annual payment secured by land-backed rights with redemption terms.",
      createdById: issuer.id,
      issuerId: issuer.id,
      templateId: templates[4].id
    }
  });

  const claim6 = await prisma.claim.create({
    data: {
      title: "Guarantee Attachment: Debtor Payment Support",
      instrumentType: "GUARANTEE_ATTACHMENT",
      status: "ACTIVE",
      amount: 30000,
      currency: "CHF",
      issueDate: new Date("2026-04-01"),
      maturityDate: new Date("2026-10-01"),
      settlementModel: "CONDITIONAL",
      transferability: "Transferable with guarantor notification",
      disputeConfig: "Arbitration",
      governingLaw: "Swiss contract law",
      jurisdiction: "Geneva",
      humanSummary:
        "If debtor does not pay, guarantor pays up to guarantee cap under trigger conditions.",
      guarantors: guarantor.fullName,
      createdById: issuer.id,
      issuerId: issuer.id,
      templateId: templates[5].id
    }
  });

  const claim7 = await prisma.claim.create({
    data: {
      title: "Marketplace Purchase Example",
      instrumentType: "MARKETPLACE_PURCHASE",
      status: "ACTIVE",
      amount: 15000,
      currency: "CHF",
      issueDate: new Date("2026-03-15"),
      maturityDate: new Date("2026-08-15"),
      settlementModel: "CONDITIONAL",
      transferability: "Partial fractions allowed",
      disputeConfig: "Mediation",
      governingLaw: "Swiss OR",
      jurisdiction: "Zurich",
      humanSummary:
        "Buyer can purchase 25% fraction with linked collateral and dispute metadata.",
      isPartialTradable: true,
      createdById: issuer.id,
      issuerId: issuer.id,
      templateId: templates[6].id
    }
  });

  await prisma.marketplaceListing.createMany({
    data: [
      {
        claimId: claim1.id,
        sellerId: issuer.id,
        buyerId: buyer.id,
        status: "FILLED",
        askPrice: 9400,
        ownershipFraction: 1,
        transferConditions: "Recourse disabled"
      },
      {
        claimId: claim7.id,
        sellerId: issuer.id,
        status: "PUBLISHED",
        askPrice: 14500,
        ownershipFraction: 0.25,
        transferConditions: "Minimum lot 10%"
      },
      {
        claimId: claim2.id,
        sellerId: issuer.id,
        status: "PUBLISHED",
        askPrice: 52000,
        ownershipFraction: 0.4,
        transferConditions: "Security assignment with first-lien priority"
      },
      {
        claimId: claim3.id,
        sellerId: issuer.id,
        status: "PUBLISHED",
        askPrice: 40300,
        ownershipFraction: 1,
        transferConditions: "Endorsement transfer, delivery against payment"
      },
      {
        claimId: claim4.id,
        sellerId: investor.id,
        status: "PUBLISHED",
        askPrice: 30000,
        ownershipFraction: 0.35,
        transferConditions: "Investor consent required for downstream transfer"
      },
      {
        claimId: claim5.id,
        sellerId: issuer.id,
        status: "PUBLISHED",
        askPrice: 10800,
        ownershipFraction: 0.5,
        transferConditions: "Registry-backed transfer in annual tranches"
      },
      {
        claimId: claim6.id,
        sellerId: issuer.id,
        status: "PUBLISHED",
        askPrice: 28750,
        ownershipFraction: 0.75,
        transferConditions: "Guarantor notification before settlement date"
      }
    ]
  });

  await prisma.settlementEvent.createMany({
    data: [
      {
        claimId: claim1.id,
        type: "PAYMENT_DUE",
        status: "ACTIVE",
        dueDate: new Date("2026-06-01"),
        amountDue: 10000,
        note: "Main maturity payment due"
      },
      {
        claimId: claim2.id,
        type: "PARTIAL_PAYMENT",
        status: "PARTIALLY_SETTLED",
        dueDate: new Date("2026-05-01"),
        amountDue: 4500,
        amountPaid: 3000,
        note: "Installment partially settled"
      }
    ]
  });

  await prisma.disputeCase.create({
    data: {
      relatedClaimId: claim2.id,
      claimantId: issuer.id,
      respondentId: debtor.id,
      disputeType: "PARTIAL_PAYMENT",
      disputeReason: "Installment underpaid for March cycle",
      status: "MEDIATION",
      resolutionPath: "direct negotiation -> mediation -> court",
      mediatorId: escrowAgent.id,
      auditLog: "Opened on 2026-04-11"
    }
  });

  await prisma.collateralRecord.create({
    data: {
      relatedClaimId: claim2.id,
      collateralType: "movable_assets",
      owner: debtor.fullName,
      beneficiary: issuer.fullName,
      valuation: 77000,
      currency: "EUR",
      verificationStatus: "verified_by_notary",
      lienRank: 1,
      status: "VERIFIED",
      auditLog: "Valuation report attached"
    }
  });

  await prisma.escrowArrangement.create({
    data: {
      relatedClaimId: claim6.id,
      escrowAgent: escrowAgent.fullName,
      assetType: "funds",
      amount: 12000,
      currency: "CHF",
      releaseConditions: "Release to creditor if debtor misses maturity by 15 days",
      status: "FUNDED",
      auditLog: "Escrow funded and verified"
    }
  });

  await prisma.custodyRecord.create({
    data: {
      relatedClaimId: claim3.id,
      custodian: custodian.fullName,
      documentHash: "sha256:bill-example",
      custodyType: "bill_of_exchange_original",
      custodyStatus: "HELD",
      auditLog: "Original lodged for custody"
    }
  });

  await prisma.uploadedDocument.createMany({
    data: [
      {
        claimId: claim1.id,
        uploaderId: issuer.id,
        name: "Invoice #2026-114",
        kind: "invoice",
        url: "/mock/invoice-2026-114.pdf",
        documentHash: "sha256:invoice114",
        isVerified: true
      },
      {
        claimId: claim6.id,
        uploaderId: guarantor.id,
        name: "Guarantee Deed",
        kind: "guarantee",
        url: "/mock/guarantee-deed.pdf",
        documentHash: "sha256:guarantee",
        isVerified: true
      }
    ]
  });

  await prisma.eventLog.createMany({
    data: [
      { claimId: claim1.id, actorId: issuer.id, eventType: "claim_created", payload: { template: "invoice-sale" } },
      { claimId: claim1.id, actorId: issuer.id, eventType: "claim_published", payload: { askPrice: 9400 } },
      { claimId: claim1.id, actorId: buyer.id, eventType: "claim_transferred", payload: { buyer: buyer.id } },
      { claimId: claim2.id, actorId: issuer.id, eventType: "dispute_opened", payload: { type: "partial_payment" } },
      { claimId: claim6.id, actorId: guarantor.id, eventType: "escrow_funded", payload: { amount: 12000 } }
    ]
  });

  console.log("Seeded Sponsum MVP with 7 templates, 7 marketplace listings, and auth users (password: mockpass123).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
