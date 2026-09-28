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
        <p className="text-xs font-medium uppercase tracking-widest text-rose-400">
          Life tracker
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-rose-950">{today}</h1>
        <p className="mt-1 text-sm text-rose-800/65">
          Your calm space for habits, faith, and goals.
        </p>
      </header>
      <TodayDashboard />
    </div>
  );
}
