"use client";

import { useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Button } from "@/components/ui/button";
import { createLocalCustomHabit } from "@/lib/sync/sync-engine";

export function AddCustomHabit() {
  const { refresh } = useAppData();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setMessage(null);
    try {
      await createLocalCustomHabit(trimmed);
      setName("");
      setMessage("Saved locally — sync when online to update the cloud.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save habit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-3 space-y-3">
      <label className="block text-sm text-rose-800/80">
        Custom habit name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Skincare"
          className="mt-1 w-full rounded-2xl border border-rose-100 bg-white px-3 py-2.5 text-sm text-rose-950 outline-none ring-rose-200 focus:ring-2"
        />
      </label>
      <Button type="submit" disabled={busy || !name.trim()} className="w-full">
        {busy ? "Saving…" : "Add custom habit"}
      </Button>
      {message ? <p className="text-xs text-rose-800/70">{message}</p> : null}
    </form>
  );
}
