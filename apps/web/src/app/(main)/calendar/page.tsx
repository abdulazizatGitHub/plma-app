import { PageHeader } from "@/components/ui/page-header";
import { PhaseNotice } from "@/components/ui/phase-notice";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Calendar" title="Calendar" description="Review any day's full record." />
      <PhaseNotice
        phase="10"
        title="Day detail"
        description="Prayers, habits, and tasks for any date, in one view."
      />
    </div>
  );
}
