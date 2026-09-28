import { ApiHealth } from "@/components/dev/api-health";
import { AddCustomHabit } from "@/components/habits/add-custom-habit";
import { SyncStatus } from "@/components/dev/sync-status";
import { Card, CardTitle } from "@/components/ui/card";

export default function MorePage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-rose-950">More</h1>
        <p className="text-sm text-rose-800/65">
          Settings, reminders, and quick add (Phase 12).
        </p>
      </header>
      <Card>
        <CardTitle>System</CardTitle>
        <ApiHealth />
      </Card>
      <Card>
        <CardTitle>Data & sync</CardTitle>
        <SyncStatus />
      </Card>
      <Card>
        <CardTitle>Custom habits</CardTitle>
        <p className="mt-1 text-sm text-rose-800/65">
          Add habits without redeploying the app (CRD §24).
        </p>
        <AddCustomHabit />
      </Card>
    </div>
  );
}
