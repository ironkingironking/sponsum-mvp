import { Card, SectionTitle } from "@sponsum/ui";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="grid" style={{ gap: 16, maxWidth: 560 }}>
      <Card>
        <SectionTitle title="Login" subtitle="Sign in to access your Sponsum workspace." />
        <LoginForm />
      </Card>
    </div>
  );
}
