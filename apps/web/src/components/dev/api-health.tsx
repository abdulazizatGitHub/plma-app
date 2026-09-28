"use client";

import { useEffect, useState } from "react";

type HealthLine = { label: string; ok: boolean; detail: string };

export function ApiHealth() {
  const [lines, setLines] = useState<HealthLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

    async function load() {
      try {
        const apiRes = await fetch(`${base}/health`);
        if (!apiRes.ok) throw new Error(`API HTTP ${apiRes.status}`);
        const api = (await apiRes.json()) as { status: string };

        let dbLine: HealthLine = {
          label: "Postgres",
          ok: false,
          detail: "Not connected — set DATABASE_URL (see docs/DATABASE_SETUP.md)",
        };

        try {
          const dbRes = await fetch(`${base}/health/db`);
          if (dbRes.ok) {
            const db = (await dbRes.json()) as { database: string };
            dbLine = {
              label: "Postgres",
              ok: true,
              detail: db.database,
            };
          }
        } catch {
          /* keep dbLine as failed */
        }

        setLines([
          { label: "API", ok: true, detail: api.status },
          dbLine,
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unavailable");
      }
    }

    void load();
  }, []);

  if (error) {
    return (
      <p className="mt-2 text-sm text-warning">
        API offline — run <code className="text-xs">npm run dev</code> at repo
        root. ({error})
      </p>
    );
  }

  if (!lines) {
    return <p className="mt-2 text-sm text-ink-muted">Checking API…</p>;
  }

  return (
    <ul className="mt-2 space-y-1 text-sm">
      {lines.map((line) => (
        <li key={line.label} className={line.ok ? "text-success" : "text-warning"}>
          {line.label}: {line.detail}
        </li>
      ))}
    </ul>
  );
}
