"use client";

import { useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Button } from "@/components/ui/button";
import {
  createLocalCustomHabit,
  validateCustomHabitName,
} from "@/lib/sync/sync-engine";

const MAX_NAME_LENGTH = 120;

export function AddCustomHabit() {
  const { refresh } = useAppData();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const trimmed = name.trim();
  const liveError = name.length > 0 ? validateCustomHabitName(trimmed) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateCustomHabitName(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await createLocalCustomHabit(trimmed);
      setName("");
      setMessage("Saved locally — sync when online to update the cloud.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save habit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-3 space-y-3" noValidate>
      <label className="block text-sm text-ink-muted">
        Custom habit name
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Skincare"
          maxLength={MAX_NAME_LENGTH}
          aria-invalid={liveError ? true : undefined}
          aria-describedby={liveError || error ? "custom-habit-error" : undefined}
          className={`mt-1 w-full rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/40 ${
            liveError || error ? "border-danger" : "border-line"
          }`}
        />
        <span className="mt-1 block text-right text-[10px] text-ink-muted/70">
          {name.length}/{MAX_NAME_LENGTH}
        </span>
      </label>
      {liveError || error ? (
        <p id="custom-habit-error" className="text-xs text-danger">
          {error ?? liveError}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || !trimmed || Boolean(liveError)}
        className="w-full"
      >
        {busy ? "Saving…" : "Add custom habit"}
      </Button>
      {message ? <p className="text-xs text-ink-muted">{message}</p> : null}
    </form>
  );
}
