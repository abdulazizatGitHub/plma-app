"use client";

import { ArrowUpFromLine, Check, Copy, Download, EllipsisVertical, Globe, MonitorDown, Pause, Play, Plus, SquarePlus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button, SegmentedTabs, Sheet } from "@/components/kit";
import { useInstall, type InstallPlatform } from "@/lib/v2/install";

type Device = "iphone" | "android" | "computer";
type Step = { caption: ReactNode; screen: ReactNode };

const deviceFor = (p: InstallPlatform): Device => (p === "ios-safari" || p === "ios-other" ? "iphone" : p === "android" ? "android" : "computer");

/** The app's icon, small, for the mock home screens. */
function LifeIcon({ size = 34, pop }: { size?: number; pop?: boolean }) {
  return (
    <span className={`flex flex-col items-center gap-0.5 ${pop ? "install-pop" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static icon in a mockup */}
      <img src="/icons/icon-192.png" alt="" width={size} height={size} className="rounded-[22%]" />
      <span className="text-[8px] font-medium text-ink">Life</span>
    </span>
  );
}

/** A pulsing dot where you'd tap. */
const Tap = ({ className }: { className: string }) => <span aria-hidden className={`install-tap absolute h-7 w-7 rounded-full bg-primary/35 ring-2 ring-primary ${className}`} />;

function Phone({ children, bar }: { children: ReactNode; bar?: ReactNode }) {
  return (
    <div className="relative mx-auto flex h-[300px] w-[160px] flex-col overflow-hidden rounded-[26px] border-[5px] border-ink bg-bg shadow-md" aria-hidden>
      <div className="mx-auto mt-1 h-3 w-14 rounded-full bg-ink" />
      <div className="relative flex-1">{children}</div>
      {bar}
    </div>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto h-[190px] w-full max-w-[300px] overflow-hidden rounded-[12px] border-2 border-ink/80 bg-bg shadow-md" aria-hidden>
      {children}
    </div>
  );
}

const page = (
  <div className="space-y-1.5 p-2.5">
    <div className="h-2.5 w-16 rounded bg-track" />
    <div className="h-14 rounded-[10px] bg-surface" />
    <div className="h-8 rounded-[10px] bg-surface" />
    <div className="h-8 rounded-[10px] bg-surface" />
  </div>
);

const IPHONE: Step[] = [
  {
    caption: (
      <>
        In <b>Safari</b>, tap <b>Share</b> <ArrowUpFromLine className="inline h-3.5 w-3.5" /> (on newer iPhones it&apos;s under <b>⋯</b>).
      </>
    ),
    screen: (
      <Phone
        bar={
          <div className="relative flex h-9 items-center justify-around border-t border-border bg-surface text-ink-2">
            <span className="text-[10px]">‹ ›</span>
            <ArrowUpFromLine className="h-4 w-4 text-link" />
            <span className="text-[10px]">⋯</span>
            <Tap className="top-1 left-[66px]" />
          </div>
        }
      >
        {page}
      </Phone>
    ),
  },
  {
    caption: (
      <>
        Scroll and choose <b>Add to Home Screen</b> <SquarePlus className="inline h-3.5 w-3.5" />.
      </>
    ),
    screen: (
      <Phone>
        {page}
        <div className="install-sheet absolute inset-x-0 bottom-0 space-y-1 rounded-t-[14px] bg-surface p-2 shadow-lg">
          {["Copy", "Add to Reading List", "Add Bookmark"].map((t) => (
            <div key={t} className="rounded-[8px] bg-bg px-2 py-1.5 text-[9px] text-ink">
              {t}
            </div>
          ))}
          <div className="relative flex items-center justify-between rounded-[8px] bg-primary/15 px-2 py-1.5 text-[9px] font-semibold text-ink">
            Add to Home Screen <SquarePlus className="h-3 w-3" />
            <Tap className="-top-1 right-6" />
          </div>
        </div>
      </Phone>
    ),
  },
  {
    caption: (
      <>
        Tap <b>Add</b> in the top corner.
      </>
    ),
    screen: (
      <Phone>
        <div className="relative flex items-center justify-between border-b border-border bg-surface px-2 py-1.5 text-[9px]">
          <span className="text-link">Cancel</span>
          <span className="font-semibold text-ink">Add to Home Screen</span>
          <span className="font-semibold text-link">Add</span>
          <Tap className="-top-0.5 -right-1" />
        </div>
        <div className="flex items-center gap-2 p-3">
          <LifeIcon size={30} />
          <div className="flex-1 rounded-[6px] bg-surface px-2 py-1 text-[9px] text-ink">Life</div>
        </div>
      </Phone>
    ),
  },
  {
    caption: (
      <>
        Open <b>Life</b> from your Home Screen. Reminders and offline use now work.
      </>
    ),
    screen: (
      <Phone>
        <div className="grid grid-cols-4 gap-2 p-3">
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} className="h-7 w-7 rounded-[22%] bg-track" />
          ))}
          <LifeIcon size={28} pop />
        </div>
      </Phone>
    ),
  },
];

const ANDROID: Step[] = [
  {
    caption: (
      <>
        In <b>Chrome</b>, tap the menu <EllipsisVertical className="inline h-3.5 w-3.5" /> at the top right.
      </>
    ),
    screen: (
      <Phone>
        <div className="relative flex items-center gap-1 border-b border-border bg-surface px-2 py-1.5">
          <Globe className="h-3 w-3 text-ink-2" />
          <span className="flex-1 truncate rounded-full bg-bg px-2 py-0.5 text-[8px] text-ink-2">life.app</span>
          <EllipsisVertical className="h-3.5 w-3.5 text-ink" />
          <Tap className="-top-0.5 -right-1.5" />
        </div>
        {page}
      </Phone>
    ),
  },
  {
    caption: (
      <>
        Choose <b>Install app</b> (or <b>Add to Home screen</b>).
      </>
    ),
    screen: (
      <Phone>
        {page}
        <div className="install-sheet absolute top-6 right-1 w-[110px] space-y-0.5 rounded-[10px] bg-surface p-1.5 shadow-lg">
          {["New tab", "History", "Downloads"].map((t) => (
            <div key={t} className="px-1.5 py-1 text-[8.5px] text-ink">
              {t}
            </div>
          ))}
          <div className="relative flex items-center gap-1 rounded-[6px] bg-primary/15 px-1.5 py-1 text-[8.5px] font-semibold text-ink">
            <Download className="h-3 w-3" /> Install app
            <Tap className="-top-1 right-1" />
          </div>
        </div>
      </Phone>
    ),
  },
  {
    caption: (
      <>
        Tap <b>Install</b>.
      </>
    ),
    screen: (
      <Phone>
        {page}
        <div className="absolute inset-x-2 top-20 space-y-2 rounded-[12px] bg-surface p-2.5 shadow-lg">
          <div className="flex items-center gap-2">
            <LifeIcon size={24} />
            <span className="text-[9px] font-semibold text-ink">Install app?</span>
          </div>
          <div className="relative flex justify-end gap-3 text-[9px] font-semibold">
            <span className="text-ink-2">Cancel</span>
            <span className="text-link">Install</span>
            <Tap className="-top-2 -right-1.5" />
          </div>
        </div>
      </Phone>
    ),
  },
  {
    caption: (
      <>
        Open <b>Life</b> from your home screen or app drawer.
      </>
    ),
    screen: (
      <Phone>
        <div className="grid grid-cols-4 gap-2 p-3">
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} className="h-7 w-7 rounded-full bg-track" />
          ))}
          <LifeIcon size={28} pop />
        </div>
      </Phone>
    ),
  },
];

const COMPUTER: Step[] = [
  {
    caption: (
      <>
        In <b>Chrome</b> or <b>Edge</b>, click the install icon <MonitorDown className="inline h-3.5 w-3.5" /> at the right of the address bar.
      </>
    ),
    screen: (
      <Screen>
        <div className="relative flex items-center gap-1.5 border-b border-border bg-surface px-2 py-1.5">
          <span className="h-2 w-2 rounded-full bg-todo" />
          <span className="h-2 w-2 rounded-full bg-progress" />
          <span className="h-2 w-2 rounded-full bg-done" />
          <span className="ml-1 flex-1 truncate rounded-full bg-bg px-2 py-0.5 text-[9px] text-ink-2">life.app</span>
          <MonitorDown className="h-3.5 w-3.5 text-ink" />
          <Tap className="-top-0.5 right-0" />
        </div>
        {page}
      </Screen>
    ),
  },
  {
    caption: (
      <>
        Click <b>Install</b>.
      </>
    ),
    screen: (
      <Screen>
        {page}
        <div className="absolute top-9 right-3 w-[150px] space-y-2 rounded-[10px] bg-surface p-2.5 shadow-lg">
          <div className="flex items-center gap-2">
            <LifeIcon size={22} />
            <span className="text-[9px] font-semibold text-ink">Install app?</span>
          </div>
          <div className="relative flex justify-end gap-2 text-[9px] font-semibold">
            <span className="rounded-full bg-primary-strong px-2 py-0.5 text-on-primary-strong">Install</span>
            <span className="text-ink-2">Cancel</span>
            <Tap className="-top-1.5 left-4" />
          </div>
        </div>
      </Screen>
    ),
  },
  {
    caption: <>Life opens in its own window, and you can pin it to your taskbar or Dock.</>,
    screen: (
      <Screen>
        <div className="install-pop absolute inset-3 overflow-hidden rounded-[8px] border border-border bg-bg shadow-md">
          <div className="flex items-center gap-1.5 bg-primary-strong px-2 py-1 text-[9px] font-semibold text-on-primary-strong">Life</div>
          {page}
        </div>
      </Screen>
    ),
  },
];

const STEPS: Record<Device, Step[]> = { iphone: IPHONE, android: ANDROID, computer: COMPUTER };

/** "Install Life" (owner, 2026-10-17): animated step cards for iPhone, Android and computers. */
export function InstallGuide() {
  const { guideOpen, closeGuide, platform, canPrompt, install, installed } = useInstall();
  const [device, setDevice] = useState<Device>(deviceFor(platform));
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [copied, setCopied] = useState(false);
  const steps = STEPS[device];

  useEffect(() => {
    if (!guideOpen) return;
    /* eslint-disable react-hooks/set-state-in-effect -- start each opening on this device's steps */
    setDevice(deviceFor(platform));
    setStep(0);
    setPlaying(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [guideOpen, platform]);

  useEffect(() => {
    if (!guideOpen || !playing) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % steps.length), 3200);
    return () => clearTimeout(t);
  }, [guideOpen, playing, step, steps.length]);

  return (
    <Sheet open={guideOpen} onClose={closeGuide} title="Install Life">
      <div className="space-y-3">
        {installed ? (
          <p className="flex items-center gap-2 rounded-[12px] bg-done/25 px-3 py-2 text-[13px] text-ink">
            <Check className="h-4 w-4" aria-hidden /> Life is installed on this device.
          </p>
        ) : (
          <p className="text-[13px] text-ink-2">Installed, Life opens like an app, works offline, and can send you reminders.</p>
        )}
        {canPrompt && !installed ? (
          <Button className="w-full" onClick={() => void install()}>
            <Plus className="h-4 w-4" aria-hidden /> Install now
          </Button>
        ) : null}
        {platform === "ios-other" && device === "iphone" ? (
          <div className="space-y-2 rounded-[12px] bg-progress/25 px-3 py-2.5 text-[13px] text-ink">
            <p>
              On iPhone, apps are added from <b>Safari</b>. Copy this page&apos;s link, open Safari, paste it, then follow the steps.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void navigator.clipboard?.writeText(window.location.origin).then(
                  () => setCopied(true),
                  () => setCopied(false),
                )
              }
            >
              <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? "Link copied" : "Copy link"}
            </Button>
          </div>
        ) : null}
        {platform === "desktop-safari" && device === "computer" ? (
          <p className="rounded-[12px] bg-track px-3 py-2 text-[13px] text-ink">
            On a Mac with Safari: <b>File → Add to Dock</b>. In Chrome or Edge, follow the steps below.
          </p>
        ) : null}
        <SegmentedTabs<Device>
          label="Device"
          value={device}
          onChange={(d) => {
            setDevice(d);
            setStep(0);
          }}
          options={[
            { value: "iphone", label: "iPhone" },
            { value: "android", label: "Android" },
            { value: "computer", label: "Computer" },
          ]}
        />
        <div key={`${device}-${step}`} className="install-step py-1">
          {steps[step].screen}
        </div>
        <ol className="space-y-1" aria-label={`Steps for ${device}`}>
          {steps.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  setStep(i);
                  setPlaying(false);
                }}
                aria-current={i === step ? "step" : undefined}
                className={`flex w-full items-start gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-[13px] ${i === step ? "bg-primary/12 text-ink" : "text-ink-2 hover:bg-track"}`}
              >
                <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${i === step ? "bg-primary-strong text-on-primary-strong" : "bg-track text-ink"}`}>
                  {i + 1}
                </span>
                <span>{s.caption}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[12.5px] font-medium text-link hover:bg-track">
          {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />} {playing ? "Pause" : "Play"}
        </button>
      </div>
    </Sheet>
  );
}
