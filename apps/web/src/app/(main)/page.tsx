import { TodayDashboard } from "@/components/home/today-dashboard";

export default function HomePage() {
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-medium text-ink">{today}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Habits, faith, and goals, one day at a time.
        </p>
      </header>
      <TodayDashboard />
    </div>
  );
}
