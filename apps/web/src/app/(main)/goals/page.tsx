import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";

export default function GoalsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-medium text-ink">Goals</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Weekly, monthly, and content plans live here.
        </p>
      </header>
      <Card>
        <CardTitle>Weekly & monthly goals</CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          Savings targets, weekly room goals, and reviews arrive in Phase 08.
        </p>
      </Card>
      <Card>
        <CardTitle>Content creation</CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          Plan videos and track them from idea through upload, arriving in Phase 09.
        </p>
        <Link
          href="/goals/content"
          className="mt-3 inline-block text-sm font-medium text-accent hover:opacity-80"
        >
          Open content tracker
        </Link>
      </Card>
    </div>
  );
}
