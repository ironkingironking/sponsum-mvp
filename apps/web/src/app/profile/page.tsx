import { Card, SectionTitle } from "@sponsum/ui";

export default function ProfilePage() {
  return (
    <div className="container grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title="Profile" subtitle="Manage trust settings, verification and notification preferences." />
      </Card>

      <div className="grid grid-2">
        <Card>
          <h3 style={{ marginTop: 0 }}>Trust level</h3>
          <p style={{ color: "#475569" }}>Complete verification to improve marketplace visibility and investor confidence.</p>
          <button type="button">Start verification</button>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Preferences</h3>
          <p style={{ color: "#475569" }}>Choose updates for settlements, offers and disputes.</p>
          <button type="button" className="ghost">Notification settings</button>
        </Card>
      </div>
    </div>
  );
}
