"use client";

import { createCategory, updateCategory, type Category } from "@life/shared";
import type { FormEvent } from "react";
import { DisabledHint } from "@/components/auth/auth-shell";
import { Button, ColorPicker, IconPicker, Sheet, TextField } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { useForm } from "@/lib/forms/use-form";
import { categoryName } from "@/lib/forms/validators";
import { CATEGORY_ICON_KEYS, categoryTone, iconFor } from "@/lib/v2/category-style";
import { useActions, useNextCategoryOrder } from "@/lib/v2/use-day";

const ICON_OPTIONS = CATEGORY_ICON_KEYS.map((key) => ({ key, Icon: iconFor(key) }));

function CategoryForm({ category, onDone }: { category: Category | null; onDone: () => void }) {
  const run = useActions();
  const nextOrder = useNextCategoryOrder();
  const { notify } = useAddSheet();
  const form = useForm(
    { name: category?.name ?? "", icon: category?.icon ?? "sparkles", color: category ? categoryTone(category) : "lilac" },
    { name: (v) => categoryName(v) },
  );
  const { values } = form;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.attempt()) return;
    const draft = { name: values.name, icon: values.icon, color: values.color };
    void run((ctx) => (category ? updateCategory(category, draft, ctx) : createCategory(crypto.randomUUID(), draft, nextOrder(), ctx)));
    notify({ message: category ? "Category saved" : `Added “${values.name.trim()}”` });
    onDone();
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-3.5">
      <TextField label="Name" placeholder="e.g. Physical" autoFocus required maxLength={60} {...form.field("name")} />
      <div>
        <p className="mb-1 text-[12px] font-medium text-ink">Icon</p>
        <IconPicker label="Icon" options={ICON_OPTIONS} value={values.icon} tone={categoryTone({ color: values.color })} onChange={(v) => form.set("icon", v)} />
      </div>
      <div>
        <p className="mb-1 text-[12px] font-medium text-ink">Colour</p>
        <ColorPicker label="Colour" value={values.color} onChange={(v) => form.set("color", v)} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={!form.isValid}>
        {category ? "Save" : "Add category"}
      </Button>
      <DisabledHint show={!form.isValid} message="Give the category a name to continue." />
    </form>
  );
}

/** New / edit category (CAT-01): name, icon, colour. */
export function CategorySheet({ open, category, onClose }: { open: boolean; category: Category | null; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={category ? "Edit category" : "New category"}>
      {open ? <CategoryForm key={category?.id ?? "new"} category={category} onDone={onClose} /> : null}
    </Sheet>
  );
}
