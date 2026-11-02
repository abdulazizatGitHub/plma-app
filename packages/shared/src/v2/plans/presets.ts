/*
 * Plan presets and step kinds (PLN-01, PLN-05, SYSTEM_DESIGN §5.4). Presets
 * are data: a content collab arrives with its four steps and "Post waits for
 * Payment"; a university course arrives empty with quick-add kinds.
 */

export type StepKind = "shoot" | "edit" | "payment" | "post" | "assignment" | "quiz" | "presentation" | "meeting" | "fyp" | "custom";

export const STEP_KINDS: Record<StepKind, { label: string; icon: string; dated: boolean }> = {
  shoot: { label: "Shoot", icon: "camera", dated: true },
  edit: { label: "Edit", icon: "scissors", dated: true },
  payment: { label: "Payment cleared", icon: "wallet", dated: false },
  post: { label: "Post", icon: "send", dated: true },
  assignment: { label: "Assignment", icon: "file", dated: true },
  quiz: { label: "Quiz", icon: "pencil", dated: true },
  presentation: { label: "Presentation", icon: "presentation", dated: true },
  meeting: { label: "Teacher meeting", icon: "users", dated: true },
  fyp: { label: "FYP task / meeting", icon: "graduation", dated: true },
  custom: { label: "Step", icon: "circle", dated: true },
};

export const isStepKind = (v: unknown): v is StepKind => typeof v === "string" && v in STEP_KINDS;

export type PlanPreset = "collab" | "university" | "blank";

export type PresetStep = { kind: StepKind; dependsOn?: StepKind[] };

export const PLAN_PRESETS: Record<PlanPreset, { label: string; description: string; steps: PresetStep[]; quickAdd: StepKind[] }> = {
  collab: {
    label: "Content collab",
    description: "Shoot → Edit → Payment cleared → Post. Post waits until payment is cleared.",
    steps: [{ kind: "shoot" }, { kind: "edit" }, { kind: "payment" }, { kind: "post", dependsOn: ["payment"] }],
    quickAdd: ["shoot", "edit", "payment", "post", "custom"],
  },
  university: {
    label: "University course",
    description: "Assignments, quizzes, presentations, teacher meetings and FYP work for one course.",
    steps: [],
    quickAdd: ["assignment", "quiz", "presentation", "meeting", "fyp", "custom"],
  },
  blank: {
    label: "Blank plan",
    description: "Your own steps, dates and order.",
    steps: [],
    quickAdd: ["custom"],
  },
};

export const isPlanPreset = (v: unknown): v is PlanPreset => typeof v === "string" && v in PLAN_PRESETS;
