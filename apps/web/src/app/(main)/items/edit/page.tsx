"use client";

import { PRIORITIES, todayLocalDate, type EditableItemType, type Item } from "@life/shared";
import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ItemEditor } from "@/components/items/item-editor";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { whenLabel } from "@/lib/v2/dates";
import { useItem } from "@/lib/v2/use-day";

const KINDS: EditableItemType[] = ["task", "habit", "group"];

/** /items/edit?id=… edits; otherwise it adds, preset by ?kind ?category ?date ?time ?title ?priority. */
function EditItem() {
  const params = useSearchParams();
  const id = params.get("id");
  const { item, children, ready } = useItem(id);
  const router = useRouter();
  const { notify } = useAddSheet();

  if (id && !ready) return <div className="skeleton h-40" aria-busy="true" aria-label="Loading item" />;
  if (id && !item) return <p className="card px-5 py-6 text-center text-[14px] text-ink">This item doesn&apos;t exist anymore.</p>;

  const kind = params.get("kind");
  const priority = params.get("priority");
  const date = params.get("date");
  const preset = {
    kind: KINDS.includes(kind as EditableItemType) ? (kind as EditableItemType) : undefined,
    title: params.get("title") ?? undefined,
    categoryId: params.get("category"),
    date: date === "none" ? null : (date ?? undefined),
    time: params.get("time"),
    priority: (PRIORITIES as readonly string[]).includes(priority ?? "") ? (priority as Item["priority"]) : undefined,
  };
  const leave = () => (window.history.length > 1 ? router.back() : router.push("/"));

  return (
    <div className="space-y-3">
      <button type="button" onClick={leave} className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </button>
      <h1 className="text-xl font-semibold text-ink">{item ? `Edit ${item.type === "group" ? "routine" : item.type}` : "New item"}</h1>
      <ItemEditor
        key={item?.id ?? "new"}
        item={item}
        existingChildren={children}
        preset={preset}
        onCancel={leave}
        onSaved={(saved, created) => {
          const s = saved.schedule;
          const where = s.kind === "once" ? (s.date ? whenLabel(s.date, todayLocalDate(), ", ") : "Pending") : null;
          notify({
            message: created ? (where ? `Added to ${where}` : `Added “${saved.title}”`) : "Saved",
            action: { label: "View", onClick: () => router.push(`/items/view?id=${saved.id}`) },
          });
          leave();
        }}
      />
    </div>
  );
}

export default function EditItemPage() {
  return (
    <Suspense fallback={<div className="skeleton h-40" aria-busy="true" aria-label="Loading item" />}>
      <EditItem />
    </Suspense>
  );
}
