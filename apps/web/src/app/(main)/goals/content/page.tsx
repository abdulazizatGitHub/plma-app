import { PhaseNotice } from "@/components/ui/phase-notice";

export default function ContentGoalsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-medium text-ink">Content</h1>
        <p className="mt-1 text-sm text-ink-muted">Pipeline and analytics arrive in Phase 09.</p>
      </header>
      <PhaseNotice
        phase="09"
        title="Content pipeline"
        description="Idea, to shoot, editing, ready, scheduled, uploaded — each video moves through these stages."
      />
    </div>
  );
}
