import { STEP_KINDS, type PlanPreset, type StepKind } from "@life/shared";
import {
  Camera,
  Circle,
  Clapperboard,
  FileText,
  GraduationCap,
  ListTodo,
  PencilLine,
  Presentation,
  Scissors,
  Send,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const BY_KEY: Record<string, LucideIcon> = {
  camera: Camera,
  scissors: Scissors,
  wallet: Wallet,
  send: Send,
  file: FileText,
  pencil: PencilLine,
  presentation: Presentation,
  users: Users,
  graduation: GraduationCap,
  circle: Circle,
};

export const stepIcon = (kind: StepKind): LucideIcon => BY_KEY[STEP_KINDS[kind].icon] ?? Circle;

export const PRESET_ICON: Record<PlanPreset, LucideIcon> = { collab: Clapperboard, university: GraduationCap, blank: ListTodo };
