"use client";

import { AVATAR_COLORS, displayNameSchema, usernameSchema, type AvatarColor } from "@life/shared";
import { useEffect, useState } from "react";
import { Button, ColorPicker, Sheet, TextField } from "@/components/kit";
import { useApi } from "@/lib/v2/api";
import { useSocial, type Me } from "@/lib/v2/use-social";
import { Avatar } from "./avatar";

type Check = "idle" | "checking" | "free" | "taken" | "invalid";

/**
 * Display name, @username (checked live) and avatar colour. Save stays
 * disabled until everything is valid (owner: validate every form).
 */
export function ProfileForm({ onSaved, compact }: { onSaved?: (me: Me) => void; compact?: boolean }) {
  const { me, setMe } = useSocial();
  const api = useApi();
  const [name, setName] = useState(me?.displayName ?? "");
  const [username, setUsername] = useState(me?.username ?? "");
  const [color, setColor] = useState<AvatarColor>(me?.avatarColor ?? "sky");
  const [check, setCheck] = useState<Check>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill in once the profile arrives.
  useEffect(() => {
    if (!me) return;
    /* eslint-disable react-hooks/set-state-in-effect -- seed the form from the loaded profile */
    setName((v) => v || me.displayName || "");
    setUsername((v) => v || me.username || "");
    if (me.avatarColor) setColor(me.avatarColor);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [me]);

  const clean = username.trim().toLowerCase();
  const nameError = name.trim() ? (displayNameSchema.safeParse(name).success ? null : "40 characters at most") : "Enter a name";
  const userParse = usernameSchema.safeParse(clean);
  const unchanged = clean === (me?.username ?? "");

  useEffect(() => {
    if (!clean || unchanged) return setCheck("idle"); // eslint-disable-line react-hooks/set-state-in-effect -- reset when cleared
    if (!userParse.success) return setCheck("invalid");
    setCheck("checking");
    const t = setTimeout(async () => {
      const r = await api<{ valid: boolean; available: boolean }>(`/v1/usernames/${encodeURIComponent(clean)}`);
      setCheck(r.ok ? (r.data.available ? "free" : "taken") : "idle");
    }, 350);
    return () => clearTimeout(t);
  }, [clean, unchanged, userParse.success, api]);

  const userError =
    check === "invalid" ? (userParse.success ? null : userParse.error.issues[0]?.message) : check === "taken" ? "That username is taken." : !clean ? "Choose a username" : null;
  const valid = !nameError && !!clean && (unchanged || check === "free");
  const dirty = name.trim() !== (me?.displayName ?? "") || !unchanged || color !== (me?.avatarColor ?? "sky");

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    const r = await api<Me>("/v1/me", { method: "PATCH", body: { displayName: name.trim(), username: clean, avatarColor: color } });
    setSaving(false);
    if (!r.ok) return setError(r.message);
    setMe(r.data);
    onSaved?.(r.data);
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar person={{ name: name || "?", username: clean, avatarColor: color }} size={compact ? 40 : 48} />
        <p className="text-[12.5px] text-ink-2">Friends see your name, @username and this colour. Never your email.</p>
      </div>
      <TextField label="Name" required value={name} maxLength={40} onChange={(e) => setName(e.target.value)} error={name ? nameError : null} autoComplete="nickname" />
      <TextField
        label="Username"
        required
        value={username}
        maxLength={20}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
        error={username ? userError : null}
        hint={check === "checking" ? "Checking…" : check === "free" ? `@${clean} is free` : "Friends can find you by it."}
        trailing={<span className="pr-2.5 text-[13px] text-ink-2">@</span>}
      />
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink">Colour</p>
        <ColorPicker label="Avatar colour" value={color} onChange={(t) => AVATAR_COLORS.includes(t as AvatarColor) && setColor(t as AvatarColor)} />
      </div>
      {error ? (
        <p role="alert" className="text-[12.5px] text-ink">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={!valid || !dirty || saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

/** Asks for a username the first time someone uses a social feature. */
export function UsernameSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Choose your username">
      <p className="mb-3 text-[13px] text-ink-2">Friends find and recognise you by it.</p>
      <ProfileForm
        compact
        onSaved={() => {
          onClose();
          onDone?.();
        }}
      />
    </Sheet>
  );
}
