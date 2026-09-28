import { PhaseNotice } from "@/components/ui/phase-notice";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-medium text-ink">Calendar</h1>
        <p className="mt-1 text-sm text-ink-muted">Review any day&apos;s full record.</p>
      </header>
      <PhaseNotice
        phase="10"
        title="Day detail"
        description="Prayers, habits, and tasks for any date, in one view."
      />
    </div>
  );
}
