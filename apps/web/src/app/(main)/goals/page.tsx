import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";

export default function GoalsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-rose-950">Goals</h1>
        <p className="text-sm text-rose-800/65">
          Weekly, monthly, and content plans live here.
        </p>
      </header>
      <Card>
        <CardTitle>Weekly & monthly goals</CardTitle>
        <p className="mt-2 text-sm text-rose-800/70">
          Phase 08 — savings targets, weekly room goals, and reviews.
        </p>
      </Card>
      <Card>
        <CardTitle>Content creation</CardTitle>
        <p className="mt-2 text-sm text-rose-800/70">
          Plan videos and track Idea → Uploaded (Phase 09).
        </p>
        <Link
          href="/goals/content"
          className="mt-3 inline-block text-sm font-medium text-rose-500"
        >
          Open content tracker →
        </Link>
      </Card>
    </div>
  );
}
