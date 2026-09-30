import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { PhaseNotice } from "@/components/ui/phase-notice";

export default function GoalsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Goals" description="Weekly, monthly, and content plans live here." />
      <PhaseNotice
        phase="08"
        title="Weekly & monthly goals"
        description="Savings targets, weekly room goals, and reviews."
      />
      <PhaseNotice
        phase="09"
        title="Content creation"
        description="Plan videos and track them from idea through upload."
      />
      <Link
        href="/goals/content"
        className="block text-sm font-medium text-accent-text hover:opacity-80"
      >
        Open content tracker
      </Link>
    </div>
  );
}
