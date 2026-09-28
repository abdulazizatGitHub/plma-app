import { Card, CardTitle } from "@/components/ui/card";

export default function ContentGoalsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-rose-950">Content</h1>
        <p className="text-sm text-rose-800/65">
          Pipeline and analytics — Phase 09.
        </p>
      </header>
      <Card>
        <CardTitle>Coming soon</CardTitle>
        <p className="mt-2 text-sm text-rose-800/70">
          Idea → To Shoot → Editing → Ready → Scheduled → Uploaded
        </p>
      </Card>
    </div>
  );
}
