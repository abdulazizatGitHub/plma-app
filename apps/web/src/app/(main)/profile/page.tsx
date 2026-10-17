"use client";

import { Bell, BookOpen, Clock, Compass, Download, Eye, LogOut, Moon, Palette, Pencil, RefreshCw, Sparkles, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TOUR_KEY } from "@/components/onboarding/onboarding-gate";
import { useAuth } from "@/components/providers/auth-provider";
import { useStore } from "@/components/providers/store-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { Button, ChipChoice, SegmentedTabs, Sheet, ThemeSwatches } from "@/components/kit";
import { SettingsGroup, SettingsRow } from "@/components/settings/settings-list";
import { Avatar } from "@/components/social/avatar";
import { ProfileForm } from "@/components/social/profile-form";
import { VISIBILITY_LABEL, VisibilityCard } from "@/components/social/visibility-card";
import type { ThemeMode } from "@/lib/theme/theme-utils";
import { useSaveSettings, useUserSettings } from "@/lib/v2/use-day";
import { useFriends } from "@/lib/v2/use-friends";
import { useGroups } from "@/lib/v2/use-groups";
import { useRewards } from "@/lib/v2/use-rewards";
import { useInstall } from "@/lib/v2/install";
import { useSocial } from "@/lib/v2/use-social";

const fmt = (n: number) => n.toLocaleString("en-US");
const DAY_END = (h: number) => (h === 0 ? "Midnight" : `${h} AM`);
const MODE: Record<ThemeMode, string> = { light: "Light", dark: "Dark", system: "System" };
type Open = "profile" | "visibility" | "dayEnd" | "appearance" | null;

/**
 * Profile (owner, 2026-10-17): you at the top, then grouped settings like iOS
 * — People, Your day, Appearance, Help — with Account and Sign out last. Each
 * row shows its current value; details open in a sheet.
 */
export default function ProfilePage() {
  const { theme, setTheme, mode, setMode } = useTheme();
  const { user, signOut } = useAuth();
  const { store, syncing, lastResult, syncNow } = useStore();
  const { me } = useSocial();
  const { rewards } = useRewards();
  const friends = useFriends();
  const groups = useGroups();
  const settings = useUserSettings();
  const saveSettings = useSaveSettings();
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [signingOut, setSigningOut] = useState(false);
  const { installed, openGuide } = useInstall();

  const realName = me?.displayName || user?.name || "";
  const name = realName || "Set your name";
  const pending = store?.pendingCount() ?? 0;
  const sync = syncing
    ? "Syncing…"
    : !lastResult
      ? "Not synced yet"
      : lastResult.ok
        ? pending
          ? `${pending} waiting to upload`
          : "Up to date"
        : lastResult.reason === "offline"
          ? "Offline — saved on this device"
          : "Sync problem";
  const friendCount = friends.data.friends.length;
  const requests = friends.data.incoming.length;
  const groupCount = groups.data?.groups.length ?? 0;
  const invites = groups.data?.invites.length ?? 0;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-ink">Profile</h1>

      {/* You */}
      <section aria-label="You" className="card flex items-center gap-4 p-4">
        <Avatar person={{ name: realName, username: me?.username ?? user?.email ?? null, avatarColor: me?.avatarColor ?? null }} size={60} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold text-ink">{name}</p>
          <p className="truncate text-[13px] text-ink-2">{me?.username ? `@${me.username}` : "No username yet"}</p>
          <p className="truncate text-[12px] text-ink-2">{user?.email}</p>
          {rewards ? (
            <p className="mt-1 flex items-center gap-1 text-[12px] text-ink-2">
              <Sparkles className="h-3.5 w-3.5 text-progress" aria-hidden />
              Level {rewards.level} · {fmt(rewards.points)} pts · {rewards.streak.current}-day streak
            </p>
          ) : null}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen("profile")} aria-label="Edit profile">
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
        </Button>
      </section>

      <SettingsGroup title="People">
        <SettingsRow
          icon={<Users />}
          tone="sky"
          label="Friends"
          href="/friends"
          value={requests ? `${requests} request${requests === 1 ? "" : "s"}` : friendCount ? `${friendCount} friend${friendCount === 1 ? "" : "s"}` : "Invite someone"}
        />
        <SettingsRow
          icon={<UsersRound />}
          tone="mint"
          label="Groups"
          href="/groups"
          value={invites ? `${invites} invite${invites === 1 ? "" : "s"}` : groupCount ? `${groupCount} group${groupCount === 1 ? "" : "s"}` : "Start one"}
        />
        <SettingsRow icon={<Eye />} tone="lilac" label="Who can see my progress" onClick={() => setOpen("visibility")} value={VISIBILITY_LABEL[settings.visibility as keyof typeof VISIBILITY_LABEL] ?? "Friends"} />
      </SettingsGroup>

      <SettingsGroup title="Your day">
        <SettingsRow icon={<Clock />} tone="peach" label="My day ends at" onClick={() => setOpen("dayEnd")} value={DAY_END(settings.dayEndHour)} />
        <SettingsRow icon={<Moon />} tone="lilac" label="Prayer settings" href="/settings/prayer" value={settings.locationLabel ?? "Location, times"} />
        <SettingsRow icon={<Bell />} tone="yellow" label="Reminders" href="/settings/notifications" value={settings.notificationsEnabled === false ? "Off" : "On"} />
      </SettingsGroup>

      <SettingsGroup title="Appearance">
        <SettingsRow icon={<Palette />} tone="pink" label="Theme and mode" onClick={() => setOpen("appearance")} value={`${theme[0].toUpperCase()}${theme.slice(1)} · ${MODE[mode]}`} />
      </SettingsGroup>

      <SettingsGroup title="Help">
        <SettingsRow icon={<BookOpen />} tone="mint" label="App guide" href="/help" value="How Life works" />
        <SettingsRow icon={<Download />} tone="sky" label="Install the app" onClick={openGuide} value={installed ? "Installed" : "How to"} />
        <SettingsRow
          icon={<Compass />}
          tone="teal"
          label="Replay the tour"
          onClick={() => {
            store?.setMeta(TOUR_KEY, "pending");
            router.push("/");
          }}
        />
      </SettingsGroup>

      <SettingsGroup title="Account" footer="Signing out removes your data from this device. It stays safe in your account.">
        <SettingsRow
          icon={<RefreshCw />}
          tone="sky"
          label="Sync"
          value={sync}
          trailing={
            <Button size="sm" variant="ghost" onClick={() => void syncNow()} disabled={syncing || !store}>
              Sync now
            </Button>
          }
        />
        <li>
          <button
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await signOut();
              router.replace("/sign-in");
            }}
            className="flex min-h-12 w-full items-center gap-3 px-3.5 text-left text-[14px] font-medium text-todo hover:bg-track/60 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </li>
      </SettingsGroup>

      {process.env.NODE_ENV !== "production" ? (
        <Link href="/dev/ui-kit" className="block text-center text-[13px] text-link">
          UI kit (dev)
        </Link>
      ) : null}

      <Sheet open={open === "profile"} onClose={() => setOpen(null)} title="Edit profile">
        <ProfileForm onSaved={() => setOpen(null)} />
      </Sheet>
      <Sheet open={open === "visibility"} onClose={() => setOpen(null)} title="Who can see my progress">
        <VisibilityCard bare />
      </Sheet>
      <Sheet open={open === "dayEnd"} onClose={() => setOpen(null)} title="My day ends at">
        <p className="mb-3 text-[13px] text-ink-2">
          When your day ends it locks: its progress, streaks and rewards become final. Night owl? Let the day run past midnight so late logging still counts for the evening.
        </p>
        <ChipChoice
          legend="My day ends at"
          hideLegend
          options={[0, 1, 2, 3, 4].map((h) => ({ value: h, label: DAY_END(h) }))}
          value={settings.dayEndHour}
          onChange={(dayEndHour) => void saveSettings({ dayEndHour })}
        />
      </Sheet>
      <Sheet open={open === "appearance"} onClose={() => setOpen(null)} title="Theme and mode">
        <p className="mb-3 text-[13px] text-ink-2">Each theme comes from one of the app&apos;s reference designs.</p>
        <ThemeSwatches value={theme} onChange={setTheme} />
        <div className="mt-4">
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
        </div>
      </Sheet>
    </div>
  );
}
