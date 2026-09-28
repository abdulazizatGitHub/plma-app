import { Card, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";

const todayItems = [
  { label: "Prayer", value: "0/5", done: false },
  { label: "Quran", value: "0/1", done: false },
  { label: "Steps", value: "0/10,000", done: false },
  { label: "Water", value: "0/8", done: false },
  { label: "Exercise", value: "Pending", done: false },
  { label: "Reading", value: "Pending", done: false },
  { label: "Study", value: "0m", done: false },
  { label: "Make bed", value: "Pending", done: false },
  { label: "No phone", value: "Pending", done: false },
] as const;

export function DashboardStub() {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle className="mb-3">Today&apos;s progress</CardTitle>
        <ProgressBar value={0} label="Daily completion" />
        <p className="mt-2 text-xs text-rose-800/60">
          Tracking connects in upcoming phases — layout preview for your daily
          dashboard.
        </p>
      </Card>

      <ul className="space-y-2">
        {todayItems.map((item) => (
          <li key={item.label}>
            <Card className="flex items-center justify-between py-3">
              <span className="text-sm font-medium text-rose-950/90">
                {item.label}
              </span>
              <span
                className={`text-sm tabular-nums ${
                  item.done ? "text-emerald-600" : "text-rose-800/55"
                }`}
              >
                {item.value}
              </span>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
