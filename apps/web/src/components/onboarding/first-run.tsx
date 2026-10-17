"use client";

import { Bell, CalendarRange, Download, MapPin, Moon, Send, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, ChipChoice, RingStack, StickyActions } from "@/components/kit";
import { useLocation } from "@/components/location/location-provider";
import { ProfileForm } from "@/components/social/profile-form";
import { useInstall } from "@/lib/v2/install";
import { usePush } from "@/lib/v2/push";
import { RING_COLOR } from "@/lib/v2/rings";
import { useSaveSettings, useUserSettings } from "@/lib/v2/use-day";

/*
 * First-run guide (owner, 2026-10-17): a short welcome, then who you are, your
 * day and prayer times, interests and suggestions (welcome page), and finally
 * reminders and installing — before the tour of Today.
 */

type Slide = { title: string; body: string; art: ReactNode };

const tile = (icon: ReactNode, tone: string) => (
  <span className="inline-flex h-24 w-24 items-center justify-center rounded-[28px] text-ink [&>svg]:h-11 [&>svg]:w-11" style={{ background: `var(--cat-${tone})` }} aria-hidden>
    {icon}
  </span>
);

const SLIDES: Slide[] = [
  {
    title: "Your day in three rings",
    body: "Prayer, Commitments and Balance fill as you go. Close every ring that applies and the day is complete — that keeps your streak going.",
    art: (
      <RingStack
        label=""
        size={120}
        stroke={13}
        gap={3}
        rings={[
          { key: "prayer", pct: 80, color: RING_COLOR.prayer },
          { key: "commit", pct: 60, color: RING_COLOR.commit },
          { key: "balance", pct: 100, color: RING_COLOR.balance },
        ]}
      />
    ),
  },
  { title: "Prayers at the right time", body: "Times for where you are. Tap a prayer when you've prayed it — late or qada is one hold away, and nothing is assumed.", art: tile(<Moon />, "lilac") },
  { title: "Plans and reminders", body: "Habits, tasks, routines and step-by-step plans, with reminders that follow how important each one is.", art: tile(<CalendarRange />, "mint") },
  { title: "Friends keep you going", body: "Snap your day to friends, keep a streak together, and set group goals — they see your points, never your items.", art: tile(<Users />, "peach") },
];

export function IntroSlides({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <div className="flex min-h-[70dvh] flex-col">
      <div className="flex justify-end">
        <button type="button" onClick={onDone} className="min-h-9 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-track">
          Skip intro
        </button>
      </div>
      <section aria-label={s.title} key={i} className="install-step flex flex-1 flex-col items-center justify-center gap-5 px-2 text-center">
        {s.art}
        <div className="space-y-2">
          <h1 className="text-[22px] font-semibold text-ink">{s.title}</h1>
          <p className="mx-auto max-w-sm text-[14px] text-ink-2">{s.body}</p>
        </div>
      </section>
      <div className="flex justify-center gap-1.5 py-4" aria-hidden>
        {SLIDES.map((_, d) => (
          <span key={d} className={`h-1.5 rounded-full transition-all ${d === i ? "w-5 bg-primary-strong" : "w-1.5 bg-track"}`} />
        ))}
      </div>
      <StickyActions>
        <div className="flex gap-2">
          {i > 0 ? (
            <Button size="lg" variant="secondary" className="flex-1" onClick={() => setI(i - 1)}>
              Back
            </Button>
          ) : null}
          <Button size="lg" className="flex-1" onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? "Let's set up" : "Next"}
          </Button>
        </div>
      </StickyActions>
    </div>
  );
}

const StepHead = ({ n, of, title, body }: { n: number; of: number; title: string; body: string }) => (
  <header>
    <p className="text-[12px] font-medium text-ink-2">
      Step {n} of {of}
    </p>
    <h1 className="text-xl font-semibold text-ink">{title}</h1>
    <p className="mt-0.5 text-[13px] text-ink-2">{body}</p>
  </header>
);

export function ProfileStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="space-y-4">
      <StepHead n={1} of={4} title="Who are you?" body="Your name and a @username let friends find you. You can change these any time in Profile." />
      <div className="card p-4">
        <ProfileForm onSaved={onDone} />
      </div>
      <button type="button" onClick={onDone} className="mx-auto block min-h-9 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-track">
        Skip for now
      </button>
    </div>
  );
}

const DAY_END = (h: number) => (h === 0 ? "Midnight" : `${h} AM`);

export function DayStep({ onDone }: { onDone: () => void }) {
  const settings = useUserSettings();
  const save = useSaveSettings();
  const { ensure } = useLocation();
  const located = settings.locationMode !== "unset";
  return (
    <div className="space-y-4">
      <StepHead n={2} of={4} title="Your day and prayer times" body="Prayer times are worked out for where you are, and your day can run past midnight if you're up late." />
      <section className="card space-y-2 p-4" aria-label="Prayer times">
        <h2 className="flex items-center gap-2 text-[15px] font-medium text-ink">
          <MapPin className="h-4 w-4 text-ink-2" aria-hidden /> Prayer times
        </h2>
        <p className="text-[13px] text-ink-2">{located ? `Times are for ${settings.locationLabel ?? "your location"}.` : "Use your location for accurate times — or pick a city. Until then, times are for Karachi."}</p>
        <Button variant={located ? "secondary" : "primary"} onClick={() => void ensure("whileUsing", "Prayer times are calculated for where you are.")}>
          <MapPin className="h-4 w-4" aria-hidden /> {located ? "Change location" : "Set my location"}
        </Button>
      </section>
      <section className="card space-y-2 p-4" aria-label="When your day ends">
        <h2 className="text-[15px] font-medium text-ink">My day ends at</h2>
        <p className="text-[13px] text-ink-2">When it ends, the day locks and its streaks become final. Night owl? Pick a later time.</p>
        <ChipChoice legend="My day ends at" hideLegend options={[0, 1, 2, 3, 4].map((h) => ({ value: h, label: DAY_END(h) }))} value={settings.dayEndHour} onChange={(dayEndHour) => void save({ dayEndHour })} />
      </section>
      <StickyActions>
        <Button size="lg" className="w-full" onClick={onDone}>
          Next
        </Button>
      </StickyActions>
    </div>
  );
}

export function ReadyStep({ onDone }: { onDone: () => void }) {
  const push = usePush();
  const { installed, canPrompt, install, openGuide } = useInstall();
  const on = push.state === "on";
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-ink">You&apos;re all set</h1>
        <p className="mt-0.5 text-[13px] text-ink-2">Two last things help Life work best. Both can be done later from Profile.</p>
      </header>
      <section className="card flex items-start gap-3 p-4" aria-label="Reminders">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-ink" style={{ background: "var(--cat-yellow)" }} aria-hidden>
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-[15px] font-medium text-ink">Reminders</h2>
          <p className="text-[13px] text-ink-2">A nudge when something&apos;s due, at a pace that matches how important it is. Quiet hours are respected.</p>
          {on ? (
            <p className="text-[13px] font-medium text-ink">Reminders are on.</p>
          ) : push.state === "ios-install" ? (
            <p className="text-[13px] text-ink-2">On iPhone, reminders work once Life is on your Home Screen — install it below first.</p>
          ) : push.state === "denied" ? (
            <p className="text-[13px] text-ink-2">Notifications are blocked for this site — allow them in the browser&apos;s site settings.</p>
          ) : push.state === "unsupported" ? (
            <p className="text-[13px] text-ink-2">This browser can&apos;t show notifications.</p>
          ) : (
            <Button size="sm" onClick={() => void push.turnOn()} disabled={push.busy}>
              <Bell className="h-3.5 w-3.5" aria-hidden /> Turn on reminders
            </Button>
          )}
        </div>
      </section>
      <section className="card flex items-start gap-3 p-4" aria-label="Install">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-ink" style={{ background: "var(--cat-sky)" }} aria-hidden>
          <Download className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-[15px] font-medium text-ink">Install the app</h2>
          <p className="text-[13px] text-ink-2">Opens like an app from your Home Screen and works offline.</p>
          {installed ? (
            <p className="text-[13px] font-medium text-ink">Installed on this device.</p>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void (canPrompt ? install() : openGuide())}>
              <Download className="h-3.5 w-3.5" aria-hidden /> {canPrompt ? "Install" : "Show me how"}
            </Button>
          )}
        </div>
      </section>
      <p className="flex items-center gap-2 text-[12.5px] text-ink-2">
        <Send className="h-3.5 w-3.5" aria-hidden /> Next, a quick tour of Today.
      </p>
      <StickyActions>
        <Button size="lg" className="w-full" onClick={onDone}>
          Go to Today
        </Button>
      </StickyActions>
    </div>
  );
}
