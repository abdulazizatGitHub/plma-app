import { PhaseNotice } from "@/components/ui/phase-notice";

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-medium text-ink">Progress</h1>
        <p className="mt-1 text-sm text-ink-muted">Charts and consistency over time.</p>
      </header>
      <PhaseNotice
        phase="11"
        title="Analytics"
        description="Weekly and monthly trends that show what's working."
      />
    </div>
  );
}
