import Link from "next/link";
import { PhaseNotice } from "@/components/ui/phase-notice";

export default function GoalsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-medium text-ink">Goals</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Weekly, monthly, and content plans live here.
        </p>
      </header>
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
        className="block text-sm font-medium text-accent hover:opacity-80"
      >
        Open content tracker
      </Link>
    </div>
  );
}
