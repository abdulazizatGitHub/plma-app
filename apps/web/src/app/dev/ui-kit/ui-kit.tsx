"use client";

import { ArrowRight, BookOpen, CalendarClock, CalendarDays, Dumbbell, GraduationCap, Home, LayoutGrid, Moon, Sun, TrendingUp, User, Video } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Bars,
  BottomNavBar,
  Button,
  CategoryCard,
  Chip,
  DateStrip,
  PrayerRow,
  QuantityRow,
  Ring,
  SegmentedTabs,
  Sheet,
  SheetAction,
  StatusTiles,
  TaskRow,
  TextField,
  addDays,
  type ItemState,
  type PrayerChip,
} from "@/components/kit";
import { useTheme } from "@/components/providers/theme-provider";

const TODAY = new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const INITIAL_PRAYERS: PrayerChip[] = [
  { key: "fajr", label: "Fajr", status: "missed", time: "5:02" },
  { key: "zuhr", label: "Zuhr", status: "done", time: "12:31" },
  { key: "asr", label: "Asr", status: "open", time: "4:47" },
  { key: "maghrib", label: "Maghrib", status: "open", time: "6:21" },
  { key: "isha", label: "Isha", status: "qada", time: "7:38" },
];

export function UiKit() {
  const { resolvedMode, setMode } = useTheme();
  const [filter, setFilter] = useState<ItemState | null>(null);
  const [date, setDate] = useState(TODAY);
  const [steps, setSteps] = useState(4000);
  const [water, setWater] = useState(3);
  const [tasks, setTasks] = useState<Record<string, ItemState>>({ quiz: "todo", gym: "in_progress", sadqa: "done" });
  const [prayers, setPrayers] = useState(INITIAL_PRAYERS);
  const [expanded, setExpanded] = useState<string | null>("physical");
  const [tab, setTab] = useState<"all" | "ongoing" | "done">("all");
  const [sheet, setSheet] = useState(false);
  const [email, setEmail] = useState("not-an-email");

  const toggle = (key: string) =>
    setTasks((t) => ({ ...t, [key]: t[key] === "done" ? "todo" : "done" }));
  const togglePrayer = (key: string) =>
    setPrayers((ps) =>
      ps.map((p) => (p.key === key ? { ...p, status: p.status === "done" || p.status === "qada" ? "open" : "done" } : p)),
    );

  return (
    <div className="mx-auto min-h-dvh max-w-[430px] space-y-8 px-4 pt-6 pb-40">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">UI kit</h1>
          <p className="text-[13px] text-ink-2">v2 Phase 0 · tokens from UI Images/</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setMode(resolvedMode === "dark" ? "light" : "dark")}
          aria-label={`Switch to ${resolvedMode === "dark" ? "light" : "dark"} mode`}
        >
          {resolvedMode === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          {resolvedMode === "dark" ? "Light" : "Dark"}
        </Button>
      </header>

      <Section title="Today header">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-ink">Today</h3>
            <p className="text-[13px] text-ink-2">Friday, 9 October</p>
          </div>
          <Ring label="60% of today done" value={60} size={52}>
            <span className="text-[13px] font-semibold text-ink">60%</span>
          </Ring>
        </div>
        <DateStrip selected={date} today={TODAY} onSelect={setDate} marked={new Set([TODAY, addDays(TODAY, 1)])} />
      </Section>

      <Section title="Status tiles">
        <StatusTiles counts={{ todo: 4, in_progress: 2, done: 5 }} selected={filter} onSelect={setFilter} />
        <p className="text-[13px] text-ink-2">Filter: {filter ?? "none"} (tap again to clear)</p>
      </Section>

      <Section title="Prayer row">
        <PrayerRow prayers={prayers} onToggle={togglePrayer} onMore={() => setSheet(true)} />
        <p className="text-[13px] text-ink-2">
          Any order. Fajr shows missed, Isha shows qada. Tap a chip to toggle prayed.
        </p>
      </Section>

      <Section title="Task rows">
        <div className="space-y-2">
          <TaskRow
            title="Quiz — Data Structures"
            meta="10:00 · University"
            categoryColor="var(--cat-lilac)"
            priority="critical"
            state={tasks.quiz}
            onToggle={() => toggle("quiz")}
            onOpen={() => {}}
            onMore={() => setSheet(true)}
          />
          <TaskRow
            title="Gym — Push day"
            meta="3 of 5 exercises · Physical"
            categoryColor="var(--cat-mint)"
            priority="high"
            state={tasks.gym}
            onToggle={() => toggle("gym")}
            onOpen={() => {}}
            onMore={() => setSheet(true)}
          />
          <TaskRow
            title="Give sadqa"
            meta="Spiritual"
            categoryColor="var(--cat-peach)"
            state={tasks.sadqa}
            onToggle={() => toggle("sadqa")}
            onMore={() => setSheet(true)}
          />
        </div>
      </Section>

      <Section title="Quantity rows">
        <div className="space-y-2">
          <QuantityRow title="Steps" value={steps} onChange={setSteps} step={500} target={10000} unit="steps" categoryColor="var(--cat-mint)" onMore={() => setSheet(true)} />
          <QuantityRow title="Water" value={water} onChange={setWater} step={1} target={8} unit="glasses" categoryColor="var(--cat-sky)" onMore={() => setSheet(true)} />
        </div>
        <p className="text-[13px] text-ink-2">Tap the number to type a value, e.g. 10,000.</p>
      </Section>

      <Section title="Category cards">
        <div className="space-y-2">
          <CategoryCard
            name="Physical"
            tone="mint"
            icon={<Dumbbell className="h-5 w-5" />}
            done={1}
            total={3}
            expanded={expanded === "physical"}
            onToggle={() => setExpanded(expanded === "physical" ? null : "physical")}
          >
            <TaskRow title="Gym — Push day" meta="Mon · Wed · Fri" state="in_progress" />
            <TaskRow title="Walk after Isha" meta="Daily" state="done" />
          </CategoryCard>
          <CategoryCard name="University" tone="lilac" icon={<GraduationCap className="h-5 w-5" />} done={0} total={1} expanded={expanded === "uni"} onToggle={() => setExpanded(expanded === "uni" ? null : "uni")}>
            <TaskRow title="Quiz — Data Structures" meta="Today 10:00" state="todo" priority="critical" />
          </CategoryCard>
          <CategoryCard name="Content creation" tone="peach" icon={<Video className="h-5 w-5" />} done={0} total={0} expanded={false} onToggle={() => {}} />
          <CategoryCard name="Reading" tone="pink" icon={<BookOpen className="h-5 w-5" />} done={2} total={2} expanded={false} onToggle={() => {}} />
        </div>
      </Section>

      <Section title="Segmented tabs">
        <SegmentedTabs
          label="Filter plans"
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "All" },
            { value: "ongoing", label: "Ongoing" },
            { value: "done", label: "Completed" },
          ]}
        />
      </Section>

      <Section title="Rings and bars">
        <div className="card flex items-center justify-around p-4">
          {[0, 50, 100].map((v) => (
            <Ring key={v} label={`${v}%`} value={v} size={64} stroke={7}>
              <span className="text-[13px] font-semibold text-ink">{v}%</span>
            </Ring>
          ))}
        </div>
        <div className="card p-4">
          <Bars label="Steps, last 7 days" values={[6200, 8100, 10400, 4300, 9000, 12000, 4000]} labels={["M", "T", "W", "T", "F", "S", "S"]} highlight={6} />
        </div>
      </Section>

      <Section title="Chips">
        <div className="flex flex-wrap gap-2">
          <Chip tone="todo">To Do</Chip>
          <Chip tone="progress">In Progress</Chip>
          <Chip tone="done">Done</Chip>
          <Chip tone="muted">Skipped</Chip>
          <Chip tone="primary">After Zuhr</Chip>
          <Chip tone="mint">Physical</Chip>
          <Chip tone="lilac">University</Chip>
          <Chip tone="peach">Content</Chip>
          <Chip tone="lime">Health</Chip>
          <Chip tone="pink">Mental</Chip>
        </div>
      </Section>

      <Section title="Buttons and fields">
        <div className="flex flex-wrap gap-2">
          <Button>Save</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="ghost">Skip</Button>
          <Button disabled>Disabled</Button>
        </div>
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={email.includes("@") ? null : "Enter a valid email address."} />
        <TextField label="Restaurant" placeholder="e.g. Café Aylanto" hint="Shown on the shoot day." />
        <Button size="lg" className="w-full" onClick={() => setSheet(true)}>
          Open sheet <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </Section>

      <Section title="Bottom navigation">
        <BottomNavBar
          inline
          activeHref="/"
          onAdd={() => setSheet(true)}
          items={[
            { href: "/", label: "Today", icon: Home },
            { href: "/categories", label: "Categories", icon: LayoutGrid },
            { href: "/progress", label: "Progress", icon: TrendingUp },
            { href: "/profile", label: "Profile", icon: User },
          ]}
        />
      </Section>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Gym — Push day">
        <SheetAction icon={<ArrowRight className="h-5 w-5" />} label="Move to tomorrow" onClick={() => setSheet(false)} />
        <SheetAction icon={<CalendarDays className="h-5 w-5" />} label="Move to a date…" onClick={() => setSheet(false)} />
        <SheetAction icon={<CalendarClock className="h-5 w-5" />} label="Mark pending" onClick={() => setSheet(false)} />
        <SheetAction label="Skip today" onClick={() => setSheet(false)} />
        <SheetAction label="Delete" tone="danger" onClick={() => setSheet(false)} />
      </Sheet>
    </div>
  );
}
