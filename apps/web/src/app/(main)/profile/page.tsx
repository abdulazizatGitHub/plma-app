"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TOUR_KEY } from "@/components/onboarding/onboarding-gate";
import { useStore } from "@/components/providers/store-provider";
import { useSaveSettings, useUserSettings } from "@/lib/v2/use-day";
import { ChipChoice, SegmentedTabs, ThemeSwatches } from "@/components/kit";
import { useTheme } from "@/components/providers/theme-provider";
import { AccountCard } from "@/components/settings/account-card";
import { ProfileForm } from "@/components/social/profile-form";
import { VisibilityCard } from "@/components/social/visibility-card";
import type { ThemeMode } from "@/lib/theme/theme-utils";

/** Account, theme, your day, and links to prayer and reminder settings. */
export default function ProfilePage() {
  const { theme, setTheme, mode, setMode } = useTheme();
  const { store } = useStore();
  const settings = useUserSettings();
  const saveSettings = useSaveSettings();
  const router = useRouter();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-ink">Profile</h1>
      <section className="card p-5">
        <h2 className="mb-3 text-[15px] font-medium text-ink">Account</h2>
        <AccountCard />
      </section>
      <section className="card p-5" aria-label="You">
        <h2 className="mb-3 text-[15px] font-medium text-ink">You</h2>
        <ProfileForm />
      </section>
      <VisibilityCard />
      <Link href="/friends" className="card flex min-h-12 items-center gap-3 px-5 text-[14px] font-medium text-ink">
        <span className="flex-1">Friends</span>
        <span className="text-[12px] font-normal text-ink-2">Invite, requests, leaderboard</span>
      </Link>
      <section className="card p-5">
        <h2 className="mb-1 text-[15px] font-medium text-ink">Theme</h2>
        <p className="mb-3 text-[13px] text-ink-2">Each theme comes from one of the app&apos;s reference designs.</p>
        <ThemeSwatches value={theme} onChange={setTheme} />
        <h2 className="mt-5 mb-3 text-[15px] font-medium text-ink">Appearance</h2>
        <SegmentedTabs<ThemeMode>
          label="Appearance"
          value={mode}
          onChange={setMode}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />
      </section>
      <section className="card p-5" aria-label="Your day">
        <h2 className="mb-1 text-[15px] font-medium text-ink">Your day</h2>
        <p className="mb-3 text-[13px] text-ink-2">
          When your day ends it locks: its progress, streaks and rewards become final. Night owl? Let the day run past midnight so
          late logging still counts for the evening.
        </p>
        <ChipChoice
          legend="My day ends at"
          options={[0, 1, 2, 3, 4].map((h) => ({ value: h, label: h === 0 ? "Midnight" : `${h} AM` }))}
          value={settings.dayEndHour}
          onChange={(dayEndHour) => void saveSettings({ dayEndHour })}
        />
      </section>
      <Link href="/settings/prayer" className="card flex min-h-12 items-center gap-3 px-5 text-[14px] font-medium text-ink">
        <span className="flex-1">Prayer settings</span>
        <span className="text-[12px] font-normal text-ink-2">Location, times, your prayers</span>
      </Link>
      <Link href="/settings/notifications" className="card flex min-h-12 items-center gap-3 px-5 text-[14px] font-medium text-ink">
        <span className="flex-1">Reminders</span>
        <span className="text-[12px] font-normal text-ink-2">Notifications, quiet hours, priorities</span>
      </Link>
      <section className="card p-5">
        <h2 className="mb-1 text-[15px] font-medium text-ink">Help</h2>
        <p className="mb-3 text-[13px] text-ink-2">A quick walk through Today: the ring, the tiles, marking things done and adding more.</p>
        <button
          type="button"
          onClick={() => {
            store?.setMeta(TOUR_KEY, "pending");
            router.push("/");
          }}
          className="min-h-9 rounded-full bg-track px-3.5 text-[13px] font-medium text-ink hover:bg-border"
        >
          Show the app tour
        </button>
      </section>
      {process.env.NODE_ENV !== "production" ? (
        <Link href="/dev/ui-kit" className="block text-center text-[13px] text-link">
          UI kit (dev)
        </Link>
      ) : null}
    </div>
  );
}
