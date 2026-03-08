import { Card, SectionTitle } from "@sponsum/ui";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="grid" style={{ gap: 16, maxWidth: 560 }}>
      <Card>
        <SectionTitle title="Create Account" subtitle="Register to create claims and trade on the marketplace." />
        <RegisterForm />
      </Card>
    </div>
  );
}
