import { Card, CardTitle } from "@/components/ui/card";

export default function ContentGoalsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-medium text-ink">Content</h1>
        <p className="mt-1 text-sm text-ink-muted">Pipeline and analytics arrive in Phase 09.</p>
      </header>
      <Card>
        <CardTitle>Coming soon</CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          Idea, to shoot, editing, ready, scheduled, uploaded — each video moves through these
          stages.
        </p>
      </Card>
    </div>
  );
}
