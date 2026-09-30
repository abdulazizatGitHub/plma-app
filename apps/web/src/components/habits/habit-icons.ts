import type { PrayerName } from "@life/shared";
import {
  Activity,
  BedDouble,
  BookMarked,
  BookOpen,
  Dumbbell,
  Footprints,
  GlassWater,
  GraduationCap,
  HandHeart,
  Leaf,
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

export const SECTION_ICONS = {
  faith: HandHeart,
  body: Activity,
  mind: Leaf,
} as const;
