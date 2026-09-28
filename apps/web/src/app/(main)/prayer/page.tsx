import { PrayerTracker } from "@/components/prayer/prayer-tracker";

export default function PrayerPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-rose-400">
          Faith
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-rose-950">
          Prayer & Quran
        </h1>
        <p className="mt-1 text-sm text-rose-800/65">
          Mark today&apos;s prayers, Surah Mulk, and Surah Kahf on Fridays.
        </p>
      </header>
      <PrayerTracker />
    </div>
  );
}
