import { PageHeader } from "@/components/ui/page-header";
import { PhaseNotice } from "@/components/ui/phase-notice";

export default function ContentGoalsPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Goals / Content" title="Content" description="Pipeline and analytics arrive in Phase 09." />
      <PhaseNotice
        phase="09"
        title="Content pipeline"
        description="Idea, to shoot, editing, ready, scheduled, uploaded — each video moves through these stages."
      />
    </div>
  );
}
