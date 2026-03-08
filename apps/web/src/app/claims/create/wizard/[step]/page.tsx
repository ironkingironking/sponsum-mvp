import { redirect } from "next/navigation";

export default function LegacyClaimWizardStepPage() {
  redirect("/claims/create");
}
