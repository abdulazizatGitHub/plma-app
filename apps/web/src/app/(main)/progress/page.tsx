import { Card, CardTitle } from "@/components/ui/card";

export default function ProgressPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-medium text-ink">Progress</h1>
        <p className="mt-1 text-sm text-ink-muted">Charts and consistency over time.</p>
      </header>
      <Card>
        <CardTitle>Coming in Phase 11</CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          Weekly and monthly analytics will summarize what&apos;s working.
        </p>
      </Card>
    </div>
  );
}
