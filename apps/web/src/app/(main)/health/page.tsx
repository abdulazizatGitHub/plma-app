import { HealthTracker } from "@/components/health/health-tracker";
import { PageHeader } from "@/components/ui/page-header";

export default function HealthPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="02/ Body"
        title="Health"
        description="Steps, water, exercise, and sleep — log today and see how the week is going."
      />
      <HealthTracker />
    </div>
  );
}
