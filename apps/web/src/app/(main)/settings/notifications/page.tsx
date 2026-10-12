"use client";

import { DEFAULT_REMINDER_PROFILES, PRIORITIES, type ReminderProfile, type ReminderProfiles } from "@life/shared";
import { ArrowLeft, BellOff, BellRing, Share, SquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Checkbox, ChipChoice, TimeField } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { RepeatFields, chipsWith, repeatDraft, repeatErrors, repeatValues, type RepeatDraft } from "@/components/reminders/repeat-fields";
import { formatTime } from "@/lib/v2/category-style";
import { usePush } from "@/lib/v2/push";
import { useActions, useAllCategories, useSaveSettings, useUserSettings } from "@/lib/v2/use-day";

const PRIORITY_LABEL = { low: "Low", medium: "Medium", high: "High", critical: "Critical" } as const;

function Card({ title, children, hint }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="card space-y-3 p-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {hint ? <p className="mt-0.5 text-[12px] text-ink-2">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function profileSummary(p: ReminderProfile): string {
  if (!p.enabled) return "No reminder";
  const when = p.leadMin ? `${p.leadMin} min before` : "At its time";
  const repeat = p.repeatEveryMin && p.maxRepeats ? `, every ${p.repeatEveryMin} min up to ${p.maxRepeats} more` : ", once";
  return `${when}${repeat} · snooze ${p.snoozeMin} min`;
}

/** One priority's window: on/off, lead time, repeat and snooze. Saved together once valid. */
function PriorityCard({ priority, profile, onSave }: { priority: (typeof PRIORITIES)[number]; profile: ReminderProfile; onSave: (p: ReminderProfile) => void }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(profile.enabled);
  const [lead, setLead] = useState(String(profile.leadMin));
  const leadOptions = chipsWith([0, 5, 10, 15, 30, 60], Number(lead), (n) => (n ? `${n} min before` : "At its time"));
  const [rep, setRep] = useState<RepeatDraft>(() => repeatDraft(profile.repeatEveryMin, profile.maxRepeats, profile.snoozeMin));
  const reset = () => {
    setEnabled(profile.enabled);
    setLead(String(profile.leadMin));
    setRep(repeatDraft(profile.repeatEveryMin, profile.maxRepeats, profile.snoozeMin));
  };
  const leadError = lead === "" || Number(lead) > 1440 ? "0 to 1440 minutes" : null;
  const valid = !enabled || (!leadError && Object.keys(repeatErrors(rep)).length === 0);
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">{PRIORITY_LABEL[priority]}</p>
          <p className="text-[12px] text-ink-2">{profileSummary(profile)}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          aria-expanded={open}
          aria-label={`${open ? "Close" : "Edit"} ${PRIORITY_LABEL[priority]} reminders`}
          onClick={() => {
            if (!open) reset();
            setOpen(!open);
          }}
        >
          {open ? "Close" : "Edit"}
        </Button>
      </div>
      {open ? (
        <form
          className="mt-3 space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            onSave(enabled ? { enabled, leadMin: Number(lead), ...repeatValues(rep) } : { ...profile, enabled: false });
            setOpen(false);
          }}
        >
          <Checkbox checked={enabled} onChange={setEnabled}>
            Remind me about {PRIORITY_LABEL[priority].toLowerCase()} priority items
          </Checkbox>
          {enabled ? (
            <>
              <ChipChoice legend="When" options={leadOptions} value={lead} onChange={setLead} />
              <p className="-mt-1 text-[11.5px] text-ink-2">Untimed items remind at your check-in time.</p>
              <RepeatFields value={rep} onChange={setRep} />
            </>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!valid}>
              Save
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

/** Reminders (REM-01…06): this device, quiet hours, priority windows, nudges, muted categories. */
export default function NotificationSettingsPage() {
  const router = useRouter();
  const settings = useUserSettings();
  const save = useSaveSettings();
  const run = useActions();
  const categories = useAllCategories().filter((c) => !c.archivedAt);
  const { notify } = useAddSheet();
  const push = usePush();
  const [upcoming, setUpcoming] = useState<{ title: string; at: string }[] | null>(null);
  const profiles: ReminderProfiles = settings.reminderProfiles ?? DEFAULT_REMINDER_PROFILES;
  const { upcoming: loadUpcoming } = push;

  useEffect(() => {
    if (push.state !== "on") return;
    let live = true;
    const t = setTimeout(() => {
      loadUpcoming().then((u) => live && setUpcoming(u), () => live && setUpcoming(null));
    }, 1500);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [push.state, loadUpcoming, settings]);

  const quietOn = !!(settings.quietFrom && settings.quietTo);

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => router.push("/profile")} className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Profile
      </button>
      <h1 className="text-xl font-semibold text-ink">Reminders</h1>

      <Card title="This device" hint="Reminders arrive as notifications, even when the app is closed.">
        {push.state === "on" ? (
          <>
            <p className="flex items-center gap-2 text-[13px] text-ink">
              <BellRing className="h-4 w-4 text-done" aria-hidden /> Notifications are on for this device.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" onClick={() => void push.sendTest().then((ok) => ok && notify({ message: "Test sent — check your notifications" }))}>
                Send a test
              </Button>
              <Button size="sm" variant="secondary" disabled={push.busy} onClick={() => void push.turnOff()}>
                Turn off here
              </Button>
            </div>
            {upcoming?.length ? (
              <div>
                <p className="mb-1 text-[12px] font-medium text-ink">Coming up</p>
                <ul className="space-y-0.5 text-[12px] text-ink-2" aria-label="Upcoming reminders">
                  {upcoming.map((u) => (
                    <li key={`${u.title}-${u.at}`}>
                      {new Date(u.at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })} · {u.title}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : push.state === "ios-install" ? (
          <div className="space-y-2 text-[13px] text-ink">
            <p>On iPhone and iPad, reminders work once Life is on your Home Screen:</p>
            <ol className="space-y-1.5">
              <li className="flex items-center gap-2">
                <Share className="h-4 w-4 shrink-0 text-ink-2" aria-hidden /> 1. Tap <b>Share</b> in Safari&apos;s toolbar.
              </li>
              <li className="flex items-center gap-2">
                <SquarePlus className="h-4 w-4 shrink-0 text-ink-2" aria-hidden /> 2. Choose <b>Add to Home Screen</b>.
              </li>
              <li className="flex items-center gap-2">
                <BellRing className="h-4 w-4 shrink-0 text-ink-2" aria-hidden /> 3. Open Life from the Home Screen and turn notifications on here.
              </li>
            </ol>
          </div>
        ) : push.state === "denied" ? (
          <p className="flex items-start gap-2 text-[13px] text-ink">
            <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-todo" aria-hidden />
            Notifications are blocked for this site. Allow them in your browser&apos;s site settings (the icon next to the address), then come back.
          </p>
        ) : push.state === "unsupported" ? (
          <p className="text-[13px] text-ink-2">This browser can&apos;t show notifications from Life. Try Chrome, Edge or Firefox, or the installed app.</p>
        ) : push.state === "off" ? (
          <Button disabled={push.busy} onClick={() => void push.turnOn()}>
            <BellRing className="h-4 w-4" aria-hidden /> Turn on notifications
          </Button>
        ) : (
          <p className="text-[13px] text-ink-2">Checking…</p>
        )}
        {push.error ? (
          <p role="alert" className="text-[12px] text-todo">
            {push.error}
          </p>
        ) : null}
      </Card>

      <Card title="Reminders" hint="One switch for every device.">
        <Checkbox checked={settings.notificationsEnabled !== false} onChange={(notificationsEnabled) => void save({ notificationsEnabled })}>
          Send me reminders
        </Checkbox>
        <Checkbox
          checked={quietOn}
          onChange={(on) => void save(on ? { quietFrom: "22:00", quietTo: "07:00" } : { quietFrom: null, quietTo: null })}
        >
          Quiet hours — nothing arrives; reminders wait until they end
        </Checkbox>
        {quietOn ? (
          <div className="flex flex-wrap gap-3 pl-7">
            <TimeField label="Quiet from" value={settings.quietFrom ?? "22:00"} onChange={(v) => v && void save({ quietFrom: v })} />
            <TimeField label="Quiet to" value={settings.quietTo ?? "07:00"} onChange={(v) => v && void save({ quietTo: v })} />
          </div>
        ) : null}
        <TimeField label="Check-in time for untimed items" value={settings.checkinTime ?? "20:00"} onChange={(v) => v && void save({ checkinTime: v })} />
      </Card>

      <Card
        title="By priority"
        hint="Every item reminds by its priority. Give an item its own reminder in its editor and that one replaces this, so only one is ever active."
      >
        <ul className="space-y-2">
          {PRIORITIES.map((p) => (
            <PriorityCard
              key={`${p}-${JSON.stringify(profiles[p])}`}
              priority={p}
              profile={profiles[p]}
              onSave={(next) => {
                void save((s) => ({ reminderProfiles: { ...(s.reminderProfiles ?? DEFAULT_REMINDER_PROFILES), [p]: next } }));
                notify({ message: `${PRIORITY_LABEL[p]} reminders saved` });
              }}
            />
          ))}
        </ul>
        <Button size="sm" variant="secondary" onClick={() => void save({ reminderProfiles: DEFAULT_REMINDER_PROFILES })}>
          Reset to defaults
        </Button>
      </Card>

      <Card title="Daily nudges" hint="Both are off unless you turn them on.">
        <div className="space-y-2">
          <Checkbox checked={!!settings.morningSummaryAt} onChange={(on) => void save({ morningSummaryAt: on ? "07:00" : null })}>
            Morning summary — what&apos;s on today
          </Checkbox>
          {settings.morningSummaryAt ? (
            <div className="pl-7">
              <TimeField label="Morning summary time" hideLabel value={settings.morningSummaryAt} onChange={(v) => v && void save({ morningSummaryAt: v })} />
            </div>
          ) : null}
          <Checkbox checked={!!settings.planTomorrowAt} onChange={(on) => void save({ planTomorrowAt: on ? "21:00" : null })}>
            Plan tomorrow — an evening nudge to set up the next day
          </Checkbox>
          {settings.planTomorrowAt ? (
            <div className="pl-7">
              <TimeField label="Plan tomorrow time" hideLabel value={settings.planTomorrowAt} onChange={(v) => v && void save({ planTomorrowAt: v })} />
            </div>
          ) : null}
        </div>
      </Card>

      {categories.length ? (
        <Card title="Muted categories" hint="Items in a muted category never remind.">
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id}>
                <Checkbox
                  checked={!!c.remindersMuted}
                  onChange={(muted) => void run((ctx) => [{ entity: "categories", row: { ...c, remindersMuted: muted, updatedAt: ctx.now } }])}
                >
                  Mute {c.name}
                </Checkbox>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="px-1 text-[11px] text-ink-2">
        Times follow {settings.timezone.replace("_", " ")}. Delivery can be a minute or so late; exact alarms come with the phone app. Your check-in time is{" "}
        {formatTime(settings.checkinTime ?? "20:00")}.
      </p>
    </div>
  );
}
