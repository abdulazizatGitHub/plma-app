import { PageHeader } from "@/components/ui/page-header";
import { PhaseNotice } from "@/components/ui/phase-notice";

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Progress" title="Progress" description="Charts and consistency over time." />
      <PhaseNotice
        phase="11"
        title="Analytics"
        description="Weekly and monthly trends that show what's working."
      />
    </div>
  );
}
