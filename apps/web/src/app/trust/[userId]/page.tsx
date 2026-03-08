import { Card, SectionTitle } from "@sponsum/ui";
import { apiGet } from "@/lib/api";

type TrustProfile = {
  user: { fullName: string; email: string };
  trustTier: string;
  reputationScore: number;
  repaymentReliability: number;
  defaultRate: string;
  disputeRate: string;
  verificationBadges: string | null;
};

export default async function TrustProfilePage({ params }: { params: { userId: string } }) {
  const profile = await apiGet<TrustProfile>(`/trust/${params.userId}`);

  return (
    <Card>
      <SectionTitle title={`Trust Profile: ${profile.user.fullName}`} subtitle={profile.user.email} />
      <p>Trust tier: {profile.trustTier}</p>
      <p>Reputation score: {profile.reputationScore}</p>
      <p>Repayment reliability: {profile.repaymentReliability}%</p>
      <p>Default rate: {profile.defaultRate}%</p>
      <p>Dispute rate: {profile.disputeRate}%</p>
      <p>Verification badges: {profile.verificationBadges || "none"}</p>
    </Card>
  );
}
