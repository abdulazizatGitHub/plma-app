/**
 * Habit → category mapping. Categories drive the pastel chip color defined
 * once in globals.css (`--cat-*`) and shared by every theme preset. Class
 * strings are written out literally so Tailwind's scanner generates them.
 */
export type HabitCategory =
  | "prayer"
  | "quran"
  | "move"
  | "water"
  | "rest"
  | "focus"
  | "mind"
  | "sleep";

const HABIT_CATEGORY: Record<string, HabitCategory> = {
  prayer: "prayer",
  quran: "quran",
  steps: "move",
  exercise: "move",
  water: "water",
  sleep: "sleep",
  "make-bed": "rest",
  "no-phone": "mind",
  reading: "focus",
  study: "focus",
};

export const CATEGORY_BG: Record<HabitCategory, string> = {
  prayer: "bg-cat-prayer",
  quran: "bg-cat-quran",
  move: "bg-cat-move",
  water: "bg-cat-water",
  rest: "bg-cat-rest",
  focus: "bg-cat-focus",
  mind: "bg-cat-mind",
  sleep: "bg-cat-sleep",
};

/** Unmapped keys fall back to the neutral `mind` chip rather than throwing. */
export function habitCategory(habitKey: string): HabitCategory {
  return HABIT_CATEGORY[habitKey] ?? "mind";
}

export function categoryColor(habitKey: string): string {
  return `var(--cat-${habitCategory(habitKey)})`;
}
