import { Card, CardTitle } from "@/components/ui/card";

export default function CalendarPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-rose-950">Calendar</h1>
        <p className="text-sm text-rose-800/65">
          Review any day&apos;s full record.
        </p>
      </header>
      <Card>
        <CardTitle>Phase 10</CardTitle>
        <p className="mt-2 text-sm text-rose-800/70">
          Day detail for prayers, habits, and tasks will show here.
        </p>
      </Card>
    </div>
  );
}
