import { Card, CardTitle } from "@/components/ui/card";

export default function CalendarPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-medium text-ink">Calendar</h1>
        <p className="mt-1 text-sm text-ink-muted">Review any day&apos;s full record.</p>
      </header>
      <Card>
        <CardTitle>Coming in Phase 10</CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          Day detail for prayers, habits, and tasks will show here.
        </p>
      </Card>
    </div>
  );
}
