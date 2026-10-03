export type RiskInput = {
  verificationScore: number;
  daysToMaturity: number;
  disputed: boolean;
  debtorKyc: boolean;
  acceptedRatio: number;
};

export type RiskResult = {
  class: string;
  expected_yield_hint: number;
  factors: string[];
};

export function computeRiskScore(input: RiskInput): RiskResult {
  const factors: string[] = [];
  let points = 70;
  if (input.verificationScore >= 90) {
    points += 12;
    factors.push("high_verification");
  } else if (input.verificationScore >= 70) {
    points += 6;
    factors.push("medium_verification");
  } else {
    points -= 8;
    factors.push("low_verification");
  }
  if (input.daysToMaturity <= 30) {
    points += 6;
    factors.push("short_maturity");
  } else if (input.daysToMaturity > 90) {
    points -= 6;
    factors.push("long_maturity");
  }
  if (input.disputed) {
    points -= 25;
    factors.push("dispute");
  }
  if (input.debtorKyc) {
    points += 4;
    factors.push("debtor_kyc");
  }
  if (input.acceptedRatio < 1) {
    points -= 10;
    factors.push("partial_acceptance");
  }
  points = Math.max(0, Math.min(100, points));
  const className =
    points >= 90 ? "AA" : points >= 80 ? "A-" : points >= 70 ? "BBB" : points >= 55 ? "BB" : "B";
  const expected = Number((8.5 - points / 25).toFixed(2));
  return { class: className, expected_yield_hint: expected, factors };
}
