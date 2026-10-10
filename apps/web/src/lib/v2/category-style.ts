import type { Category } from "@life/shared";
import {
  BookOpen,
  Brain,
  Briefcase,
  Code,
  Droplet,
  Dumbbell,
  GraduationCap,
  Heart,
  Leaf,
  Moon,
  Music,
  Sparkles,
  Sun,
  Tag,
  Users,
  Video,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_TONES, type CategoryTone } from "@/lib/theme/tokens";

/** Icon names stored on categories → lucide icons. Unknown names fall back to a tag. */
const ICONS: Record<string, LucideIcon> = {
  moon: Moon,
  dumbbell: Dumbbell,
  sparkles: Sparkles,
  book: BookOpen,
  graduation: GraduationCap,
  heart: Heart,
  video: Video,
  briefcase: Briefcase,
  brain: Brain,
  leaf: Leaf,
  droplet: Droplet,
  music: Music,
  code: Code,
  wallet: Wallet,
  sun: Sun,
  users: Users,
  tag: Tag,
};

/** Icons offered by the category editor, in picker order. */
export const CATEGORY_ICON_KEYS = Object.keys(ICONS);
export const iconFor = (key: string): LucideIcon => ICONS[key] ?? Tag;

export const categoryIcon = (c: Pick<Category, "icon"> | undefined): LucideIcon => (c ? (ICONS[c.icon] ?? Tag) : Tag);

export const categoryTone = (c: Pick<Category, "color"> | undefined): CategoryTone =>
  c && (CATEGORY_TONES as readonly string[]).includes(c.color) ? (c.color as CategoryTone) : "sky";

const CLOCK = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** "23:00" → "11:00 PM". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return CLOCK.format(new Date(2000, 0, 1, h, m));
}
