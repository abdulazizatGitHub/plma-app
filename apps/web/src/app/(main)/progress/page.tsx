import { Card, CardTitle } from "@/components/ui/card";

export default function ProgressPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-rose-950">Progress</h1>
        <p className="text-sm text-rose-800/65">
          Charts and consistency over time.
        </p>
      </header>
      <Card>
        <CardTitle>Phase 11</CardTitle>
        <p className="mt-2 text-sm text-rose-800/70">
          Weekly and monthly analytics will summarize what&apos;s working.
        </p>
      </Card>
    </div>
  );
}
