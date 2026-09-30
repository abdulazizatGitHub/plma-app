import type { PrayerName } from "@life/shared";
import {
  BedDouble,
  BookMarked,
  BookOpen,
  Dumbbell,
  Footprints,
  GlassWater,
  GraduationCap,
  HandHeart,
  Moon,
  MoonStar,
  PhoneOff,
  Sun,
  SunMedium,
  Sunrise,
  Sunset,
  type LucideIcon,
} from "lucide-react";

export const HABIT_ICONS: Record<string, LucideIcon> = {
  prayer: HandHeart,
  quran: BookOpen,
  steps: Footprints,
  water: GlassWater,
  exercise: Dumbbell,
  sleep: MoonStar,
  "make-bed": BedDouble,
  "no-phone": PhoneOff,
  reading: BookMarked,
  study: GraduationCap,
};

export const PRAYER_ICONS: Record<PrayerName, LucideIcon> = {
  fajr: Sunrise,
  zuhr: Sun,
  asr: SunMedium,
  maghrib: Sunset,
  isha: Moon,
};
