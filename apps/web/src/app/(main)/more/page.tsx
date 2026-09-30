import { PageHeader } from "@/components/ui/page-header";
import { ApiHealth } from "@/components/dev/api-health";
import { AddCustomHabit } from "@/components/habits/add-custom-habit";
import { SyncStatus } from "@/components/dev/sync-status";
import { ThemePicker } from "@/components/settings/theme-picker";
import { Card, CardTitle } from "@/components/ui/card";

export default function MorePage() {
  return (
    <div className="space-y-4">
      <PageHeader title="More" description="Appearance, settings, and quick add — reminders arrive in Phase 12." />
      <Card>
        <CardTitle>Appearance</CardTitle>
        <ThemePicker />
      </Card>
      <Card>
        <CardTitle>Custom habits</CardTitle>
        <p className="mt-1 text-sm text-ink-muted">Add habits without redeploying the app.</p>
        <AddCustomHabit />
      </Card>
      <Card>
        <CardTitle>Data & sync</CardTitle>
        <SyncStatus />
      </Card>
      <Card>
        <CardTitle>System</CardTitle>
        <ApiHealth />
      </Card>
    </div>
  );
}
