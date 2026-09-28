import { PrayerTracker } from "@/components/prayer/prayer-tracker";

export default function PrayerPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-medium text-ink">Prayer & Quran</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Mark today&apos;s prayers, Surah Mulk, and Surah Kahf on Fridays.
        </p>
      </header>
      <PrayerTracker />
    </div>
  );
}
