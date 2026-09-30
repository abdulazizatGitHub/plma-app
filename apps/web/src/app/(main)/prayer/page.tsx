import { PrayerTracker } from "@/components/prayer/prayer-tracker";
import { PageHeader } from "@/components/ui/page-header";

export default function PrayerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="01/ Faith"
        title="Prayer & Quran"
        description="Log each prayer as you go, plus Surah Mulk nightly and Kahf on Fridays."
      />
      <PrayerTracker />
    </div>
  );
}
